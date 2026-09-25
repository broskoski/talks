"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pick as pickAction, undo as undoAction, type PickResult } from "@/lib/actions";
import {
  candidatesFor,
  isFinished,
  remainingBudget,
  spent,
  topicMap,
  type Talk,
  type Topic,
} from "@/lib/talks";

type BuildState =
  | { phase: "idle" }
  | { phase: "running"; total: number; done: number }
  | { phase: "finished"; total: number; channelUrl: string }
  | { phase: "error"; message: string };

export function Stage({
  talk,
  topics,
  thumbs,
}: {
  talk: Talk;
  topics: Topic[];
  thumbs: Record<number, string[]>;
}) {
  const map = topicMap(topics);
  const [picks, setPicks] = useState<number[]>(talk.picks);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [build, setBuild] = useState<BuildState>(
    talk.status === "built"
      ? { phase: "finished", total: talk.blockCount, channelUrl: `https://www.are.na/${talk.ownerSlug}/${talk.slug}` }
      : { phase: "idle" },
  );

  // Server actions are dispatched one at a time per client, but chain them
  // explicitly anyway so a server result can never be applied out of order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const persist = useCallback((run: () => Promise<PickResult>) => {
    setInFlight((n) => n + 1);
    queue.current = queue.current
      .then(run)
      .then((result) => {
        if (result.error) {
          // Server disagreed: adopt its picks so the screen matches Are.na.
          setPicks(result.picks);
          setSaveError(result.error);
        } else {
          setSaveError(null);
        }
      })
      .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : "Could not save"))
      .finally(() => setInFlight((n) => n - 1));
  }, []);

  const candidates = candidatesFor(talk, picks, map);
  const finished = isFinished(talk, picks, map);
  const remaining = remainingBudget(talk, picks, map);
  const used = spent(picks, map);
  const building = build.phase === "running" || build.phase === "finished";

  const doPick = useCallback(
    (index: number) => {
      if (finished || building) return;
      const c = candidates[index];
      if (!c || !c.available) return;
      setPicks((p) => [...p, c.topic.id]);
      persist(() => pickAction(talk.id, c.topic.id));
    },
    [candidates, finished, building, persist, talk.id],
  );

  const doUndo = useCallback(() => {
    if (building || picks.length === 0) return;
    setPicks((p) => p.slice(0, -1));
    persist(() => undoAction(talk.id));
  }, [building, picks.length, persist, talk.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        doPick(Number(e.key) - 1);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        doUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doPick, doUndo]);

  async function runBuild() {
    setBuild({ phase: "running", total: 0, done: 0 });
    try {
      for (;;) {
        const res = await fetch(`/api/talks/${talk.id}/build`, { method: "POST" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Build failed (${res.status})`);
        if (body.finished) {
          setBuild({ phase: "finished", total: body.total, channelUrl: body.channelUrl });
          return;
        }
        setBuild({ phase: "running", total: body.total, done: body.done });
      }
    } catch (err) {
      setBuild({ phase: "error", message: err instanceof Error ? err.message : "Build failed" });
    }
  }

  const roundNumber = Math.min(picks.length + 1, talk.rounds.length);

  return (
    <main className="stage">
      <header className="top">
        <div className="title">{talk.title}</div>
        <div className="round-count">
          {finished ? "Done" : `Round ${roundNumber} of ${talk.rounds.length}`}
        </div>
      </header>

      <div className="budget">
        <div className="bar">
          <div className="used" style={{ width: `${talk.budget > 0 ? Math.min(100, (used / talk.budget) * 100) : 0}%` }} />
        </div>
        <div className="numbers">
          <span>Spent {used}</span>
          <span>Budget {talk.budget}</span>
          <span>Left {remaining}</span>
        </div>
      </div>

      {picks.length > 0 ? (
        <div className="picked">
          {picks.map((id, i) => (
            <span key={i}>{map.get(id)?.title ?? id}</span>
          ))}
        </div>
      ) : null}

      {!finished ? (
        <div className="cards" style={{ "--cols": candidates.length } as React.CSSProperties}>
          {candidates.map((c, i) => (
            <button
              key={`${picks.length}-${c.topic.id}`}
              type="button"
              className="card"
              disabled={!c.available}
              onClick={() => doPick(i)}
            >
              <div className="key">{i + 1}</div>
              <div className="name">{c.topic.title}</div>
              <div className="desc">{c.topic.description}</div>
              {thumbs[c.topic.id]?.length ? (
                <div className="thumbs">
                  {thumbs[c.topic.id].map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" />
                  ))}
                </div>
              ) : null}
              <div className="meta">
                <span>Cost {c.topic.cost}</span>
                <span>{c.topic.blockCount} blocks</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="summary">
          {picks.length === 0 ? (
            <p>Nothing fits the budget. Check the rounds and costs.</p>
          ) : (
            <ol>
              {picks.map((id, i) => (
                <li key={i}>
                  {map.get(id)?.title ?? id} <span style={{ opacity: 0.6 }}>· cost {map.get(id)?.cost ?? 1}</span>
                </li>
              ))}
            </ol>
          )}

          {build.phase === "idle" && picks.length > 0 ? (
            <button type="button" className="big" onClick={runBuild} disabled={inFlight > 0}>
              {inFlight > 0 ? "Saving…" : "Build the talk"}
            </button>
          ) : null}
          {build.phase === "running" ? (
            <div className="progress">
              Connecting blocks… {build.done} / {build.total || "?"}
            </div>
          ) : null}
          {build.phase === "finished" ? (
            <div className="progress">
              Built. {build.total} blocks.{" "}
              <a href={build.channelUrl} target="_blank" rel="noreferrer">
                Open the channel ↗
              </a>
            </div>
          ) : null}
          {build.phase === "error" ? (
            <div className="stack">
              <div className="progress" style={{ color: "#ffcc00" }}>
                {build.message}
              </div>
              <button type="button" className="big" onClick={runBuild}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      )}

      <footer className="foot">
        <span>1 / 2 / 3 to pick · Backspace to undo</span>
        {saveError ? <span className="warn">Not saved: {saveError}</span> : null}
        {!saveError && inFlight > 0 ? <span>Saving…</span> : null}
        <a href={`/talks/${talk.id}`}>Admin</a>
      </footer>
    </main>
  );
}
