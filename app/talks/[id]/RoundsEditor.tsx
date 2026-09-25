"use client";

import { useState, useTransition } from "react";
import { saveRounds } from "@/lib/actions";
import type { Topic } from "@/lib/talks";

const SLOTS = 3;

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
    const clean = rounds.map((r) => r.filter((id) => id > 0));
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
    <div className="stack">
      {rounds.map((round, ri) => (
        <div className="round" key={ri}>
          <span className="label">Round {ri + 1}</span>
          {round.map((value, si) => (
            <select key={si} value={value} onChange={(e) => update(ri, si, Number(e.target.value))}>
              <option value={0}>{si < 2 ? "— choose —" : "— none —"}</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} (cost {t.cost}, {t.blockCount} blocks)
                </option>
              ))}
            </select>
          ))}
          <button type="button" className="secondary" onClick={() => move(ri, -1)} disabled={ri === 0}>
            ↑
          </button>
          <button type="button" className="secondary" onClick={() => move(ri, 1)} disabled={ri === rounds.length - 1}>
            ↓
          </button>
          <button type="button" className="danger" onClick={() => remove(ri)}>
            Remove
          </button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="secondary" onClick={add}>
          Add round
        </button>
        <button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save rounds"}
        </button>
        {message ? <span className={message === "Saved." ? "muted" : "error"}>{message}</span> : null}
      </div>
      <p className="muted">Each round needs 2 or 3 topics. Saving rounds clears picks that no longer fit.</p>
    </div>
  );
}
