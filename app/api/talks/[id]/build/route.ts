import type { NextRequest } from "next/server";
import { channelUrl, connectBlock, getChannel, listChannelBlocks, updateChannel } from "@/lib/arena";
import { isAuthenticated } from "@/lib/auth";
import { loadTalksAndTopics } from "@/lib/data";
import { parseTalk, topicMap } from "@/lib/talks";

// Each POST connects a bounded batch and returns. The stage loops until finished,
// so no single request runs long and an interrupted build can be re-run safely.
const MAX_PER_CALL = 20;
const TIME_BUDGET_MS = 8000;
const GAP_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/talks/[id]/build">) {
  if (!(await isAuthenticated())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const channel = await getChannel(id);
  const talk = parseTalk(channel);
  if (!talk) return Response.json({ error: "Not a talk" }, { status: 404 });
  if (talk.picks.length === 0) return Response.json({ error: "Nothing picked yet" }, { status: 400 });

  // Ordered, deduplicated block list: pick order, then position within each channel.
  const wanted: number[] = [];
  const seen = new Set<number>();
  for (const pickId of talk.picks) {
    for (const block of await listChannelBlocks(pickId)) {
      if (!seen.has(block.id)) {
        seen.add(block.id);
        wanted.push(block.id);
      }
    }
  }

  const existing = new Set((await listChannelBlocks(id)).map((b) => b.id));
  const started = Date.now();
  let connectedNow = 0;
  for (const blockId of wanted) {
    if (existing.has(blockId)) continue;
    if (connectedNow >= MAX_PER_CALL || Date.now() - started > TIME_BUDGET_MS) break;
    await connectBlock(blockId, id);
    existing.add(blockId);
    connectedNow++;
    await sleep(GAP_MS);
  }

  const done = wanted.filter((b) => existing.has(b)).length;
  const finished = done === wanted.length;

  if (finished) {
    const { topics } = await loadTalksAndTopics();
    const map = topicMap(topics);
    const list = talk.picks.map((p, i) => `${i + 1}. ${map.get(p)?.title ?? `Channel ${p}`}`).join("\n");
    await updateChannel(id, {
      description: `Assembled live from the audience's picks:\n\n${list}`,
      metadata: { status: "built", built_at: new Date().toISOString() },
    });
  }

  return Response.json({
    total: wanted.length,
    done,
    remaining: wanted.length - done,
    finished,
    channelUrl: channelUrl(channel),
  });
}
