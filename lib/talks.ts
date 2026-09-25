// Talk and topic model. All state lives in Are.na channel metadata.
// This file has no server-only imports so the stage client component can use it.

import type { ArenaChannel, Metadata } from "./arena";

export type TalkStatus = "draft" | "live" | "built";

export type Talk = {
  id: number;
  slug: string;
  title: string;
  ownerSlug: string;
  budget: number;
  /** Each round is a list of 2 or 3 topic channel ids. */
  rounds: number[][];
  /** Picked topic channel ids, in pick order. One per round. */
  picks: number[];
  status: TalkStatus;
  builtAt: string | null;
  blockCount: number;
};

export type Topic = {
  id: number;
  slug: string;
  title: string;
  ownerSlug: string;
  description: string;
  cost: number;
  blockCount: number;
};

export const DEFAULT_COST = 1;

export function isTalkChannel(channel: ArenaChannel): boolean {
  return channel.metadata?.talk === true;
}

function parseIdArray(value: unknown): number[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function parseRounds(value: unknown): number[][] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(Array.isArray)
      .map((round: unknown[]) => round.map(Number).filter(Number.isFinite));
  } catch {
    return [];
  }
}

function parseStatus(value: unknown): TalkStatus {
  return value === "live" || value === "built" ? value : "draft";
}

export function parseTalk(channel: ArenaChannel): Talk | null {
  if (!isTalkChannel(channel)) return null;
  const m = channel.metadata ?? {};
  return {
    id: channel.id,
    slug: channel.slug,
    title: channel.title,
    ownerSlug: channel.owner.slug,
    budget: Math.max(0, Number(m.budget) || 0),
    rounds: parseRounds(m.rounds),
    picks: parseIdArray(m.picks),
    status: parseStatus(m.status),
    builtAt: typeof m.built_at === "string" ? m.built_at : null,
    blockCount: channel.counts.blocks,
  };
}

export function parseTopic(channel: ArenaChannel): Topic {
  const raw = Number(channel.metadata?.cost);
  return {
    id: channel.id,
    slug: channel.slug,
    title: channel.title,
    ownerSlug: channel.owner.slug,
    description: channel.description?.plain ?? "",
    cost: Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COST,
    blockCount: channel.counts.blocks,
  };
}

/** Split the group's channels into talks and topics. */
export function splitChannels(channels: ArenaChannel[]): { talks: Talk[]; topics: Topic[] } {
  const talks: Talk[] = [];
  const topics: Topic[] = [];
  for (const channel of channels) {
    const talk = parseTalk(channel);
    if (talk) talks.push(talk);
    else topics.push(parseTopic(channel));
  }
  return { talks, topics };
}

export function serializeRounds(rounds: number[][]): string {
  return JSON.stringify(rounds);
}

export function serializePicks(picks: number[]): string {
  return JSON.stringify(picks);
}

export function newTalkMetadata(budget: number): Metadata {
  return {
    talk: true,
    budget,
    rounds: serializeRounds([]),
    picks: serializePicks([]),
    status: "draft",
  };
}

// --- Game logic -------------------------------------------------------------

export type TopicMap = Map<number, Topic>;

export function topicMap(topics: Topic[]): TopicMap {
  return new Map(topics.map((t) => [t.id, t]));
}

export function costOf(topics: TopicMap, id: number): number {
  return topics.get(id)?.cost ?? DEFAULT_COST;
}

export function spent(picks: number[], topics: TopicMap): number {
  return picks.reduce((sum, id) => sum + costOf(topics, id), 0);
}

export function remainingBudget(talk: Pick<Talk, "budget">, picks: number[], topics: TopicMap): number {
  return talk.budget - spent(picks, topics);
}

export type Candidate = {
  topic: Topic;
  /** False when the topic does not fit the remaining budget or was already picked. */
  available: boolean;
  reason: "ok" | "over_budget" | "already_picked" | "missing";
};

export function candidatesFor(
  talk: Pick<Talk, "budget" | "rounds">,
  picks: number[],
  topics: TopicMap,
): Candidate[] {
  const round = talk.rounds[picks.length];
  if (!round) return [];
  const remaining = remainingBudget(talk, picks, topics);
  return round.map((id) => {
    const topic = topics.get(id);
    if (!topic) {
      return {
        topic: { id, slug: "", title: `Missing channel ${id}`, ownerSlug: "", description: "", cost: 0, blockCount: 0 },
        available: false,
        reason: "missing",
      };
    }
    if (picks.includes(id)) return { topic, available: false, reason: "already_picked" };
    if (topic.cost > remaining) return { topic, available: false, reason: "over_budget" };
    return { topic, available: true, reason: "ok" };
  });
}

/** The talk is over at the last round, or when nothing in the current round fits. */
export function isFinished(talk: Pick<Talk, "budget" | "rounds">, picks: number[], topics: TopicMap): boolean {
  if (picks.length >= talk.rounds.length) return true;
  return !candidatesFor(talk, picks, topics).some((c) => c.available);
}

/** Validate a proposed pick list against the rounds and budget. Returns an error message or null. */
export function validatePicks(talk: Pick<Talk, "budget" | "rounds">, picks: number[], topics: TopicMap): string | null {
  if (picks.length > talk.rounds.length) return "More picks than rounds";
  const seen = new Set<number>();
  let remaining = talk.budget;
  for (let i = 0; i < picks.length; i++) {
    const id = picks[i];
    if (!talk.rounds[i].includes(id)) return `Pick ${i + 1} is not in round ${i + 1}`;
    if (seen.has(id)) return `Channel ${id} picked twice`;
    seen.add(id);
    remaining -= costOf(topics, id);
    if (remaining < 0) return `Pick ${i + 1} exceeds the budget`;
  }
  return null;
}
