"use client";

import { useState, useTransition } from "react";
import { saveRounds } from "@/lib/actions";
import { MAX_ROUND_SIZE, isFixedRound, type Topic } from "@/lib/talks";

const SLOTS = MAX_ROUND_SIZE;

function chosen(round: number[]): number[] {
  return round.filter((id) => id > 0);
}

function pad(round: number[]): number[] {
  const out = round.slice(0, SLOTS);
  while (out.length < SLOTS) out.push(0);
  return out;
}

export function RoundsEditor({
  talkId,
  topics,
  initialRounds,
}: {
  talkId: number;
  topics: Topic[];
  initialRounds: number[][];
}) {
  const [rounds, setRounds] = useState<number[][]>(initialRounds.map(pad));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(ri: number, si: number, value: number) {
    setRounds((rs) => rs.map((r, i) => (i === ri ? r.map((v, j) => (j === si ? value : v)) : r)));
    setMessage(null);
  }

  function move(ri: number, dir: -1 | 1) {
    setRounds((rs) => {
      const to = ri + dir;
      if (to < 0 || to >= rs.length) return rs;
      const copy = rs.slice();
      [copy[ri], copy[to]] = [copy[to], copy[ri]];
      return copy;
    });
  }

  function remove(ri: number) {
    setRounds((rs) => rs.filter((_, i) => i !== ri));
  }

  function add() {
    setRounds((rs) => [...rs, pad([])]);
  }

  function save() {
    const clean = rounds.map(chosen);
    startTransition(async () => {
      try {
        await saveRounds(talkId, clean);
        setMessage("Saved.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <div>
      {rounds.map((round, ri) => (
        <div className="round" key={ri}>
          <span className="round-label">
            Round {ri + 1}
            {isFixedRound(chosen(round)) ? <span className="badge" style={{ marginLeft: "0.5em" }}>Fixed</span> : null}
          </span>
          {round.map((value, si) => (
            <select key={si} value={value} className="select" onChange={(e) => update(ri, si, Number(e.target.value))}>
              <option value={0}>{si === 0 ? "— choose —" : "— none —"}</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.minutes} min, {t.blockCount} blocks)
                </option>
              ))}
            </select>
          ))}
          <div className="actions">
            <button type="button" className="button sm" onClick={() => move(ri, -1)} disabled={ri === 0} aria-label="Move up">
              Up
            </button>
            <button type="button" className="button sm" onClick={() => move(ri, 1)} disabled={ri === rounds.length - 1} aria-label="Move down">
              Down
            </button>
            <button type="button" className="button sm alert" onClick={() => remove(ri)}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="row" style={{ marginTop: "var(--space-2)" }}>
        <button type="button" className="button ghost" onClick={add}>
          Add round
        </button>
        <button type="button" className="button primary" onClick={save} disabled={pending}>
          {pending ? "Saving" : "Save rounds"}
        </button>
        {message ? <span className={message === "Saved." ? "sm slate" : "sm alert"}>{message}</span> : null}
      </div>
      <p className="note">
        Each round offers 2 or 3 topics for the audience to pick from. A round with a single topic is fixed: it goes in
        the talk without a vote. Saving clears any picks that no longer fit the rounds.
      </p>
    </div>
  );
}
