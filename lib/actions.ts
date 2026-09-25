"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createChannel, deleteChannel, getChannel, updateChannel } from "./arena";
import { requireAuth } from "./auth";
import { loadTalksAndTopics } from "./data";
import { env } from "./env";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "./session";
import {
  candidatesFor,
  newTalkMetadata,
  parseTalk,
  serializePicks,
  serializeRounds,
  topicMap,
  type TalkStatus,
} from "./talks";

// --- Auth -------------------------------------------------------------------

function passwordMatches(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(env.adminPassword);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) redirect("/login?error=1");
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(env.adminPassword), sessionCookieOptions);
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

// --- Helpers ----------------------------------------------------------------

function num(value: FormDataEntryValue | null, fallback = NaN): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Load a talk channel by id, refusing to treat a topic channel as a talk. */
async function loadTalkStrict(id: number) {
  const channel = await getChannel(id);
  const talk = parseTalk(channel);
  if (!talk) throw new Error(`Channel ${id} is not a talk`);
  return talk;
}

function revalidateTalk(id: number) {
  revalidatePath("/");
  revalidatePath(`/talks/${id}`);
  revalidatePath(`/talks/${id}/stage`);
}

// --- Talks ------------------------------------------------------------------

export async function createTalk(formData: FormData): Promise<void> {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  const budget = num(formData.get("budget"));
  if (!title) throw new Error("A talk needs a name");
  if (!(budget >= 0)) throw new Error("Budget must be a number");
  const channel = await createChannel({ title, metadata: newTalkMetadata(budget) });
  revalidatePath("/");
  redirect(`/talks/${channel.id}`);
}

export async function updateTalk(formData: FormData): Promise<void> {
  await requireAuth();
  const id = num(formData.get("talkId"));
  const title = String(formData.get("title") ?? "").trim();
  const budget = num(formData.get("budget"));
  const status = String(formData.get("status") ?? "draft") as TalkStatus;
  if (!title) throw new Error("A talk needs a name");
  if (!(budget >= 0)) throw new Error("Budget must be a number");
  if (!["draft", "live", "built"].includes(status)) throw new Error("Bad status");
  await loadTalkStrict(id);
  await updateChannel(id, { title, metadata: { budget, status } });
  revalidateTalk(id);
}

export async function setStatus(formData: FormData): Promise<void> {
  await requireAuth();
  const id = num(formData.get("talkId"));
  const status = String(formData.get("status") ?? "") as TalkStatus;
  if (!["draft", "live", "built"].includes(status)) throw new Error("Bad status");
  await loadTalkStrict(id);
  await updateChannel(id, { metadata: { status } });
  revalidateTalk(id);
}

export async function saveRounds(talkId: number, rounds: number[][]): Promise<void> {
  await requireAuth();
  const { topics } = await loadTalksAndTopics();
  const known = new Set(topics.map((t) => t.id));
  const clean = rounds.map((round) => round.map(Number).filter((id) => known.has(id)));
  for (const [i, round] of clean.entries()) {
    if (round.length < 2 || round.length > 3) throw new Error(`Round ${i + 1} needs 2 or 3 topics`);
    if (new Set(round).size !== round.length) throw new Error(`Round ${i + 1} repeats a topic`);
  }
  const talk = await loadTalkStrict(talkId);
  // Changing rounds invalidates picks made under the old rounds.
  const picksStillValid = talk.picks.every((id, i) => clean[i]?.includes(id));
  await updateChannel(talkId, {
    metadata: {
      rounds: serializeRounds(clean),
      ...(picksStillValid ? {} : { picks: serializePicks([]) }),
    },
  });
  revalidateTalk(talkId);
}

export async function deleteTalk(formData: FormData): Promise<void> {
  await requireAuth();
  const id = num(formData.get("talkId"));
  await loadTalkStrict(id); // never delete a topic channel
  await deleteChannel(id);
  revalidatePath("/");
  redirect("/");
}

// --- Topics -----------------------------------------------------------------

export async function setCost(formData: FormData): Promise<void> {
  await requireAuth();
  const id = num(formData.get("channelId"));
  const cost = num(formData.get("cost"));
  if (!(cost >= 0)) throw new Error("Cost must be a number");
  const channel = await getChannel(id);
  if (parseTalk(channel)) throw new Error("That channel is a talk, not a topic");
  await updateChannel(id, { metadata: { cost } });
  revalidatePath("/topics");
  revalidatePath("/");
}

// --- Stage ------------------------------------------------------------------

export type PickResult = { picks: number[]; error?: string };

export async function pick(talkId: number, channelId: number): Promise<PickResult> {
  await requireAuth();
  const [talk, { topics }] = await Promise.all([loadTalkStrict(talkId), loadTalksAndTopics()]);
  const candidate = candidatesFor(talk, talk.picks, topicMap(topics)).find((c) => c.topic.id === channelId);
  if (!candidate) return { picks: talk.picks, error: "Not in this round" };
  if (!candidate.available) return { picks: talk.picks, error: `Cannot pick: ${candidate.reason}` };
  const picks = [...talk.picks, channelId];
  await updateChannel(talkId, { metadata: { picks: serializePicks(picks), status: "live" } });
  return { picks };
}

export async function undo(talkId: number): Promise<PickResult> {
  await requireAuth();
  const talk = await loadTalkStrict(talkId);
  if (talk.picks.length === 0) return { picks: talk.picks };
  const picks = talk.picks.slice(0, -1);
  await updateChannel(talkId, { metadata: { picks: serializePicks(picks) } });
  return { picks };
}

export async function resetPicks(formData: FormData): Promise<void> {
  await requireAuth();
  const id = num(formData.get("talkId"));
  const talk = await loadTalkStrict(id);
  await updateChannel(id, {
    metadata: {
      picks: serializePicks([]),
      ...(talk.status === "built" ? { status: "live", built_at: null } : {}),
    },
  });
  revalidateTalk(id);
}
