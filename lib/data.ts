import "server-only";
import { channelThumbs, getChannel, listGroupChannels, ArenaError } from "./arena";
import { parseTalk, splitChannels, type Talk, type Topic } from "./talks";

export async function loadTalksAndTopics(): Promise<{ talks: Talk[]; topics: Topic[] }> {
  return splitChannels(await listGroupChannels());
}

/** A talk by channel id, or null when the channel is missing or not a talk. */
export async function loadTalk(id: number): Promise<Talk | null> {
  try {
    return parseTalk(await getChannel(id));
  } catch (err) {
    if (err instanceof ArenaError && err.status === 404) return null;
    throw err;
  }
}

export async function loadTalkWithTopics(id: number): Promise<{ talk: Talk | null; topics: Topic[] }> {
  const [talk, all] = await Promise.all([loadTalk(id), loadTalksAndTopics()]);
  return { talk, topics: all.topics };
}

/** Thumbnails for every channel that appears in any round, keyed by channel id. */
export async function loadThumbs(channelIds: number[]): Promise<Record<number, string[]>> {
  const unique = Array.from(new Set(channelIds));
  const entries = await Promise.all(
    unique.map(async (id) => {
      try {
        return [id, await channelThumbs(id)] as const;
      } catch {
        return [id, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
