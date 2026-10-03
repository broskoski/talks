// Talk and topic model. All state lives in Are.na channel metadata.
// This file has no server-only imports so the stage client component can use it.

import type { ArenaChannel, Metadata } from "./arena";

export type TalkStatus = "draft" | "live" | "built";

export type Talk = {
  id: number;
  slug: string;
  title: string;
  ownerSlug: string;
  /** Length of the talk in whole minutes. */
  minutes: number;
  /** Each round is a list of 1 to 3 topic channel ids. A round with one id is fixed: it is in the talk no matter what. */
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
  /** How long this topic takes to present, in whole minutes. */
  minutes: number;
  /** True when minutes were set on the channel, false when estimated from the block count. */
  minutesSet: boolean;
  blockCount: number;
};

/** Rough presenting time when a topic has no minutes set: 20 seconds a block, at least 1 minute. */
export function estimateMinutes(blockCount: number): number {
  return Math.max(1, Math.ceil(blockCount / 3));
}

export function isTalkChannel(channel: ArenaChannel): boolean {
  return channel.metadata?.talk === true;
}

/** Talk channels are titled "** Name" on Are.na so they stand out in the group. The app shows just the name. */
export const TALK_PREFIX = "** ";

export function channelTitleFor(name: string): string {
  return TALK_PREFIX + talkNameFrom(name);
}

export function talkNameFrom(channelTitle: string): string {
  return channelTitle.startsWith(TALK_PREFIX) ? channelTitle.slice(TALK_PREFIX.length).trim() : channelTitle.trim();
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
    title: talkNameFrom(channel.title),
    ownerSlug: channel.owner.slug,
    minutes: Math.max(0, Math.round(Number(m.minutes) || 0)),
    rounds: parseRounds(m.rounds),
    picks: parseIdArray(m.picks),
    status: parseStatus(m.status),
    builtAt: typeof m.built_at === "string" ? m.built_at : null,
    blockCount: channel.counts.blocks,
  };
}

export function parseTopic(channel: ArenaChannel): Topic {
  const raw = Number(channel.metadata?.minutes);
  const minutesSet = channel.metadata?.minutes != null && Number.isFinite(raw) && raw >= 0;
  return {
    id: channel.id,
    slug: channel.slug,
    title: channel.title,
    ownerSlug: channel.owner.slug,
    description: channel.description?.plain ?? "",
    minutes: minutesSet ? Math.round(raw) : estimateMinutes(channel.counts.blocks),
    minutesSet,
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

export function newTalkMetadata(minutes: number): Metadata {
  return {
    talk: true,
    minutes,
    rounds: serializeRounds([]),
    picks: serializePicks([]),
    status: "draft",
  };
}

// --- Game logic -------------------------------------------------------------

export const MAX_ROUND_SIZE = 3;

/** A round with a single topic is pre-determined; the audience does not get a choice. */
export function isFixedRound(round: number[]): boolean {
  return round.length === 1;
}

export type TopicMap = Map<number, Topic>;

export function topicMap(topics: Topic[]): TopicMap {
  return new Map(topics.map((t) => [t.id, t]));
}

export function minutesOf(topics: TopicMap, id: number): number {
  return topics.get(id)?.minutes ?? estimateMinutes(0);
}

export function minutesSpent(picks: number[], topics: TopicMap): number {
  return picks.reduce((sum, id) => sum + minutesOf(topics, id), 0);
}

export function minutesLeft(talk: Pick<Talk, "minutes">, picks: number[], topics: TopicMap): number {
  return talk.minutes - minutesSpent(picks, topics);
}

export type Candidate = {
  topic: Topic;
  /** False when the topic does not fit the remaining time or was already picked. */
  available: boolean;
  reason: "ok" | "over_time" | "already_picked" | "missing";
};

export function candidatesFor(
  talk: Pick<Talk, "minutes" | "rounds">,
  picks: number[],
  topics: TopicMap,
): Candidate[] {
  const round = talk.rounds[picks.length];
  if (!round) return [];
  const remaining = minutesLeft(talk, picks, topics);
  return round.map((id) => {
    const topic = topics.get(id);
    if (!topic) {
      return {
        topic: {
          id,
          slug: "",
          title: `Missing channel ${id}`,
          ownerSlug: "",
          description: "",
          minutes: 0,
          minutesSet: false,
          blockCount: 0,
        },
        available: false,
        reason: "missing",
      };
    }
    if (picks.includes(id)) return { topic, available: false, reason: "already_picked" };
    if (topic.minutes > remaining) return { topic, available: false, reason: "over_time" };
    return { topic, available: true, reason: "ok" };
  });
}

/** The talk is over at the last round, or when nothing in the current round fits the time left. */
export function isFinished(talk: Pick<Talk, "minutes" | "rounds">, picks: number[], topics: TopicMap): boolean {
  if (picks.length >= talk.rounds.length) return true;
  return !candidatesFor(talk, picks, topics).some((c) => c.available);
}

/** Validate a proposed pick list against the rounds and length. Returns an error message or null. */
export function validatePicks(talk: Pick<Talk, "minutes" | "rounds">, picks: number[], topics: TopicMap): string | null {
  if (picks.length > talk.rounds.length) return "More picks than rounds";
  const seen = new Set<number>();
  let remaining = talk.minutes;
  for (let i = 0; i < picks.length; i++) {
    const id = picks[i];
    if (!talk.rounds[i].includes(id)) return `Pick ${i + 1} is not in round ${i + 1}`;
    if (seen.has(id)) return `Channel ${id} picked twice`;
    seen.add(id);
    remaining -= minutesOf(topics, id);
    if (remaining < 0) return `Pick ${i + 1} runs over the talk length`;
  }
  return null;
}
