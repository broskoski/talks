// Progress events streamed by /api/talks/[id]/build, one JSON object per line.
// Shared between the route and the stage; no server-only imports.

export type BuildEvent =
  | { type: "progress"; total: number; done: number; label: string; section: string | null; thumb: string | null }
  | { type: "result"; total: number; done: number; remaining: number; finished: boolean; channelUrl: string }
  | { type: "error"; message: string };

/** Read an NDJSON response, yielding each parsed line. */
export async function* readEvents(res: Response): AsyncGenerator<BuildEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as BuildEvent;
    }
  }
  const rest = buffer.trim();
  if (rest) yield JSON.parse(rest) as BuildEvent;
}
