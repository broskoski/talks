import type { NextRequest } from "next/server";
import {
  channelUrl,
  connectBlock,
  createTextBlock,
  deleteConnection,
  getChannel,
  listChannelBlocks,
  updateChannel,
  type ArenaBlock,
} from "@/lib/arena";
import { isAuthenticated } from "@/lib/auth";
import { loadTalksAndTopics } from "@/lib/data";
import { SECTION_KEY, SLIDE_KEY, endSlide, sectionSlide, titleSlide, type SlideKind } from "@/lib/slides";
import { parseTalk, topicMap } from "@/lib/talks";

// Each POST connects a bounded batch and returns. The stage loops until finished,
// so no single request runs long and an interrupted build can be re-run safely.
//
// Are.na shows a channel newest-first: the last block connected appears at the
// top. So the talk is assembled back to front. Reading order is title slide,
// then for each pick a section block followed by that channel's blocks as they
// appear on Are.na, then the end slide. We connect that sequence in reverse:
// end slide first, title slide last. Generated text blocks are tagged with
// metadata so a re-run finds them instead of creating them again.
const MAX_PER_CALL = 20;
const TIME_BUDGET_MS = 8000;
const GAP_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step =
  | { kind: "title" }
  | { kind: "end" }
  | { kind: "section"; channelId: number; markdown: string }
  | { kind: "block"; blockId: number };

function slideOf(block: ArenaBlock): SlideKind | null {
  const kind = block.metadata?.[SLIDE_KEY];
  return kind === "title" || kind === "section" || kind === "end" ? kind : null;
}

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/talks/[id]/build">) {
  if (!(await isAuthenticated())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const channel = await getChannel(id);
  const talk = parseTalk(channel);
  if (!talk) return Response.json({ error: "Not a talk" }, { status: 404 });
  if (talk.picks.length === 0) return Response.json({ error: "Nothing picked yet" }, { status: 400 });
  const url = channelUrl(channel);
  const { topics } = await loadTalksAndTopics();
  const map = topicMap(topics);

  // Reading order. Source blocks come back position_asc; reversed, that is the
  // order Are.na displays them in. A block shared between picks appears once,
  // under the first pick.
  const reading: Step[] = [{ kind: "title" }];
  const seen = new Set<number>();
  for (const pickId of talk.picks) {
    const topic = map.get(pickId);
    reading.push({ kind: "section", channelId: pickId, markdown: sectionSlide(topic?.title ?? `Channel ${pickId}`) });
    const blocks = await listChannelBlocks(pickId);
    for (const block of blocks.reverse()) {
      if (!seen.has(block.id)) {
        seen.add(block.id);
        reading.push({ kind: "block", blockId: block.id });
      }
    }
  }
  reading.push({ kind: "end" });
  const plan = reading.slice().reverse(); // connection order

  // What is already in the talk channel.
  const inChannel = await listChannelBlocks(id);
  const blockIds = new Set(inChannel.map((b) => b.id));
  const sections = new Set(
    inChannel.filter((b) => slideOf(b) === "section").map((b) => Number(b.metadata?.[SECTION_KEY])),
  );
  const titleBlock = inChannel.find((b) => slideOf(b) === "title");
  let hasTitle = Boolean(titleBlock);
  const hasEnd = inChannel.some((b) => slideOf(b) === "end");
  const isDone = (step: Step) => {
    switch (step.kind) {
      case "title":
        return hasTitle;
      case "end":
        return hasEnd;
      case "section":
        return sections.has(step.channelId);
      case "block":
        return blockIds.has(step.blockId);
    }
  };

  // The title slide must be the last thing connected. If it is already there
  // but other steps are still missing (picks changed after a build), take it
  // out and recreate it at the end.
  if (titleBlock?.connection && plan.some((s) => s.kind !== "title" && !isDone(s))) {
    await deleteConnection(titleBlock.connection.id);
    hasTitle = false;
    await sleep(GAP_MS);
  }

  const started = Date.now();
  let addedNow = 0;
  for (const step of plan) {
    if (isDone(step)) continue;
    if (addedNow >= MAX_PER_CALL || Date.now() - started > TIME_BUDGET_MS) break;
    switch (step.kind) {
      case "end":
        await createTextBlock({ markdown: endSlide(url), channelId: id, metadata: { [SLIDE_KEY]: "end" } });
        break;
      case "section":
        await createTextBlock({
          markdown: step.markdown,
          channelId: id,
          metadata: { [SLIDE_KEY]: "section", [SECTION_KEY]: step.channelId },
        });
        sections.add(step.channelId);
        break;
      case "block":
        await connectBlock(step.blockId, id);
        blockIds.add(step.blockId);
        break;
      case "title":
        await createTextBlock({
          markdown: titleSlide(talk.title, new Date()),
          channelId: id,
          metadata: { [SLIDE_KEY]: "title" },
        });
        hasTitle = true;
        break;
    }
    addedNow++;
    await sleep(GAP_MS);
  }

  const done = plan.filter(isDone).length;
  const finished = done === plan.length;

  if (finished) {
    const list = talk.picks.map((p, i) => `${i + 1}. ${map.get(p)?.title ?? `Channel ${p}`}`).join("\n");
    await updateChannel(id, {
      description: `Assembled live from the audience's picks:\n\n${list}`,
      metadata: { status: "built", built_at: new Date().toISOString() },
    });
  }

  return Response.json({
    total: plan.length,
    done,
    remaining: plan.length - done,
    finished,
    channelUrl: url,
  });
}
