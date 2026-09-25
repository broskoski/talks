import "server-only";
import { env } from "./env";

const BASE = "https://api.are.na/v3";

export type MetadataValue = string | number | boolean;
export type Metadata = Record<string, MetadataValue>;
export type MetadataInput = Record<string, MetadataValue | null>;

export type MarkdownContent = { markdown: string; html: string; plain: string };

export type ArenaChannel = {
  id: number;
  type: "Channel";
  slug: string;
  title: string;
  description: MarkdownContent | null;
  visibility: "public" | "private" | "closed";
  created_at: string;
  updated_at: string;
  metadata: Metadata | null;
  owner: { id: number; type: "User" | "Group"; slug: string; name?: string };
  counts: { blocks: number; channels: number; contents: number };
};

export type ImageVersion = { src: string; src_2x: string; width?: number | null; height?: number | null };

export type ArenaBlock = {
  id: number;
  base_type: "Block";
  type: "Text" | "Image" | "Link" | "Attachment" | "Embed" | "PendingBlock";
  title: string | null;
  image?: { small: ImageVersion; medium: ImageVersion; square: ImageVersion; large: ImageVersion } | null;
  connection?: { position?: number } | null;
};

type Paginated<T> = {
  data: T[];
  meta: { current_page: number; next_page: number | null; has_more_pages: boolean; total_count: number };
};

export class ArenaError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, url: string) {
    super(`Are.na ${status} on ${url}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_ATTEMPTS = 4;

async function arenaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${env.arenaToken}`,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch (err) {
      // Network failure: retry with backoff.
      lastError = err;
      await sleep(500 * attempt);
      continue;
    }

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    const body = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) throw new ArenaError(res.status, body, url);

    let wait = 500 * 2 ** (attempt - 1);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : 5000;
    }
    lastError = new ArenaError(res.status, body, url);
    await sleep(wait + Math.random() * 250);
  }
  throw lastError;
}

async function paginate<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await arenaFetch<Paginated<T>>(`${path}${sep}page=${page}&per=100`);
    out.push(...res.data);
    if (!res.meta.has_more_pages || !res.meta.next_page) break;
    page = res.meta.next_page;
  }
  return out;
}

// --- Group ------------------------------------------------------------------

let groupIdPromise: Promise<number> | null = null;

/** Numeric id of the configured group, memoised for the life of the process. */
export function getGroupId(): Promise<number> {
  if (!groupIdPromise) {
    groupIdPromise = arenaFetch<{ id: number }>(`/groups/${env.arenaGroup}`)
      .then((g) => g.id)
      .catch((err) => {
        groupIdPromise = null;
        throw err;
      });
  }
  return groupIdPromise;
}

/** Every channel owned by the group (topics and talks alike). */
export async function listGroupChannels(): Promise<ArenaChannel[]> {
  const items = await paginate<ArenaChannel | ArenaBlock>(
    `/groups/${env.arenaGroup}/contents?type=Channel&sort=created_at_asc`,
  );
  return items.filter((c): c is ArenaChannel => c.type === "Channel");
}

// --- Channels ---------------------------------------------------------------

export function getChannel(id: number | string): Promise<ArenaChannel> {
  return arenaFetch<ArenaChannel>(`/channels/${id}`);
}

export async function createChannel(input: {
  title: string;
  description?: string;
  metadata?: Metadata;
  visibility?: "public" | "private" | "closed";
}): Promise<ArenaChannel> {
  const groupId = await getGroupId();
  return arenaFetch<ArenaChannel>("/channels", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      visibility: input.visibility ?? "private",
      description: input.description,
      owner: { id: groupId, type: "Group" },
      metadata: input.metadata,
    }),
  });
}

/** PUT with merge semantics on metadata (null deletes a key). */
export function updateChannel(
  id: number,
  input: { title?: string; description?: string | null; metadata?: MetadataInput },
): Promise<ArenaChannel> {
  return arenaFetch<ArenaChannel>(`/channels/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteChannel(id: number): Promise<void> {
  return arenaFetch<void>(`/channels/${id}`, { method: "DELETE" });
}

/** All blocks in a channel, in the owner's manual order. Nested channels are dropped. */
export async function listChannelBlocks(id: number): Promise<ArenaBlock[]> {
  const items = await paginate<ArenaBlock | ArenaChannel>(`/channels/${id}/contents?sort=position_asc`);
  return items.filter((b): b is ArenaBlock => (b as ArenaBlock).base_type === "Block");
}

/** First few image thumbnails for a channel, for the stage cards. */
export async function channelThumbs(id: number, limit = 4): Promise<string[]> {
  const res = await arenaFetch<Paginated<ArenaBlock | ArenaChannel>>(
    `/channels/${id}/contents?sort=position_asc&per=24&page=1`,
  );
  const thumbs: string[] = [];
  for (const item of res.data) {
    const block = item as ArenaBlock;
    if (block.base_type !== "Block") continue;
    const src = block.image?.small?.src;
    if (src) thumbs.push(src);
    if (thumbs.length >= limit) break;
  }
  return thumbs;
}

// --- Connections ------------------------------------------------------------

/** Connect one block to one channel. Appends to the end of the channel. */
export function connectBlock(blockId: number, channelId: number): Promise<void> {
  return arenaFetch<unknown>("/connections", {
    method: "POST",
    body: JSON.stringify({
      connectable_id: blockId,
      connectable_type: "Block",
      channel_ids: [channelId],
    }),
  }).then(() => undefined);
}

/** Public web URL of a channel. */
export function channelUrl(channel: Pick<ArenaChannel, "slug" | "owner">): string {
  return `https://www.are.na/${channel.owner.slug}/${channel.slug}`;
}
