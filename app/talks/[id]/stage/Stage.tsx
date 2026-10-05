"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pick as pickAction, undo as undoAction, type PickResult } from "@/lib/actions";
import { readEvents, type BuildEvent } from "@/lib/build";
import {
  candidatesFor,
  isFinished,
  isFixedRound,
  minutesLeft,
  minutesReserved,
  minutesSpent,
  topicMap,
  upcomingFixed,
  type Talk,
  type Topic,
} from "@/lib/talks";

type BuildState =
  | { phase: "idle" }
  | { phase: "running"; total: number; done: number; label: string; section: string | null; thumbs: string[] }
  | { phase: "finished"; total: number; channelUrl: string }
  | { phase: "error"; message: string };

const RECENT_THUMBS = 14;

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
  const fixed = isFixedRound(talk.rounds[picks.length] ?? []);
  const finished = isFinished(talk, picks, map);
  const remaining = Math.max(0, minutesLeft(talk, picks, map));
  const used = minutesSpent(picks, map);
  const fixedAhead = upcomingFixed(talk, picks);
  const reserved = minutesReserved(talk, picks, map);
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
      } else if (fixed && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        doPick(0);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        doUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doPick, doUndo, fixed]);

  async function runBuild() {
    setBuild({ phase: "running", total: 0, done: 0, label: "Starting", section: null, thumbs: [] });
    try {
      // Each request connects a bounded batch and streams progress; loop until the server says finished.
      for (;;) {
        const res = await fetch(`/api/talks/${talk.id}/build`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Build failed (${res.status})`);
        }
        let result: Extract<BuildEvent, { type: "result" }> | null = null;
        for await (const event of readEvents(res)) {
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "result") {
            result = event;
            break;
          }
          setBuild((prev) => ({
            phase: "running",
            total: event.total,
            done: event.done,
            label: event.label,
            section: event.section,
            thumbs: event.thumb
              ? [event.thumb, ...(prev.phase === "running" ? prev.thumbs : [])].slice(0, RECENT_THUMBS)
              : prev.phase === "running"
                ? prev.thumbs
                : [],
          }));
        }
        if (!result) throw new Error("The build stopped without finishing");
        if (result.finished) {
          setBuild({ phase: "finished", total: result.total, channelUrl: result.channelUrl });
          return;
        }
      }
    } catch (err) {
      setBuild({ phase: "error", message: err instanceof Error ? err.message : "Build failed" });
    }
  }

  const roundNumber = Math.min(picks.length + 1, talk.rounds.length);
  const fraction = talk.minutes > 0 ? Math.min(1, used / talk.minutes) : 0;

  return (
    <main className="stage theme-dark">
      <header className="stage-top">
        <div className="crumbs">
          <span className="current">{talk.title}</span>
          <span className="sep" />
          <span className="sub">{finished ? "Done" : `Round ${roundNumber} of ${talk.rounds.length}`}</span>
        </div>
        <span className="spacer" />
        <div className="figures">
          <span>
            <b>{used} min</b> used
          </span>
          <span>
            <b>{remaining} min</b> left
          </span>
          {reserved > 0 ? (
            <span>
              <b>{reserved} min</b> fixed
            </span>
          ) : null}
          <span>
            <b>{talk.minutes} min</b> talk
          </span>
        </div>
      </header>

      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={talk.minutes} aria-valuenow={used}>
        <div style={{ transform: `scaleX(${fraction})` }} />
      </div>

      {(picks.length > 0 || fixedAhead.length > 0) && !finished ? (
        <div className="picked">
          {picks.map((id, i) => (
            <span key={i} className="badge outline">
              {map.get(id)?.title ?? id}
            </span>
          ))}
          {fixedAhead.map((id) => (
            <span key={`fixed-${id}`} className="badge outline fixed" title="Fixed: in the talk regardless of the vote">
              {map.get(id)?.title ?? id}
              <small>fixed</small>
            </span>
          ))}
        </div>
      ) : null}

      {!finished ? (
        <div className={fixed ? "cards fixed" : "cards"} style={{ "--cols": candidates.length } as React.CSSProperties}>
          {candidates.map((c, i) => (
            <button
              key={`${picks.length}-${c.topic.id}`}
              type="button"
              className="channel"
              disabled={!c.available}
              onClick={() => doPick(i)}
            >
              <span className="badge key">{fixed ? "Fixed" : i + 1}</span>
              <span className="name">{c.topic.title}</span>
              {c.topic.description ? <span className="subtitle">{c.topic.description}</span> : null}
              <span className="meta">
                <b>{c.topic.minutes} min</b>
                {c.topic.blockCount} blocks
              </span>
              {c.reason === "over_time" ? (
                <span className="why">
                  {reserved > 0
                    ? `Only ${Math.max(0, remaining - reserved)} min left after the fixed ${reserved}`
                    : `Only ${remaining} min left`}
                </span>
              ) : null}
              {c.reason === "already_picked" ? <span className="why">Already in the talk</span> : null}
              {thumbs[c.topic.id]?.length ? (
                <span className="thumbs">
                  {thumbs[c.topic.id].map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" />
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="summary">
          {picks.length === 0 ? (
            <p>Nothing fits the time left. Check the rounds and minutes in the admin.</p>
          ) : (
            <table>
              <tbody>
                {picks.map((id, i) => (
                  <tr key={i}>
                    <td className="num slate" style={{ width: "2.5em" }}>
                      {i + 1}
                    </td>
                    <td>
                      <b>{map.get(id)?.title ?? id}</b>
                      {map.get(id)?.description ? <span className="subtitle">{map.get(id)?.description}</span> : null}
                    </td>
                    <td className="num slate">{map.get(id)?.minutes ?? "?"} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {picks.length > 0 ? (
            <p className="slate num">
              {used} of {talk.minutes} minutes.
            </p>
          ) : null}

          {build.phase === "idle" && picks.length > 0 ? (
            <button type="button" className="button primary" onClick={runBuild} disabled={inFlight > 0}>
              {inFlight > 0 ? "Saving" : "Build the talk"}
            </button>
          ) : null}
          {build.phase === "running" ? (
            <div className="stack">
              <div className="progress">
                <div style={{ transform: `scaleX(${build.total ? build.done / build.total : 0})` }} />
              </div>
              <div className="status num">
                {build.done} of {build.total || "?"}
                {build.section ? <span className="slate"> · {build.section}</span> : null}
              </div>
              <div className="status build-label">{build.label}</div>
              {build.thumbs.length ? (
                <div className="build-thumbs">
                  {build.thumbs.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {build.phase === "finished" ? (
            <div className="status">
              Built with {build.total} blocks.{" "}
              <a href={build.channelUrl} target="_blank" rel="noreferrer">
                Open the channel
              </a>
            </div>
          ) : null}
          {build.phase === "error" ? (
            <div className="stack">
              <div className="status alert">{build.message}</div>
              <button type="button" className="button primary" onClick={runBuild}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      )}

      <footer className="stage-foot">
        <span>
          {finished
            ? "Backspace undoes the last pick."
            : fixed
              ? "This one is fixed. Press Enter to continue. Backspace undoes."
              : "Press 1, 2 or 3 to pick. Backspace undoes."}
        </span>
        {saveError ? <span className="alert">Not saved: {saveError}</span> : null}
        {!saveError && inFlight > 0 ? <span>Saving</span> : null}
        <span className="spacer" />
        <a href={`/talks/${talk.id}`}>Admin</a>
      </footer>
    </main>
  );
}
