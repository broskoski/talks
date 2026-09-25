import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { deleteTalk, resetPicks, updateTalk } from "@/lib/actions";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalkWithTopics } from "@/lib/data";
import { spent, topicMap } from "@/lib/talks";
import { RoundsEditor } from "./RoundsEditor";

export default async function TalkPage({ params }: PageProps<"/talks/[id]">) {
  await requireAuthOrRedirect();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const { talk, topics } = await loadTalkWithTopics(id);
  if (!talk) notFound();
  const map = topicMap(topics);

  return (
    <AdminShell>
      <section className="section">
        <div className="row">
          <h1>{talk.title}</h1>
          <span className={`status ${talk.status}`}>{talk.status}</span>
          <span className="spacer" />
          <Link href={`/talks/${talk.id}/stage`}>Open stage →</Link>
          <a href={`https://www.are.na/${talk.ownerSlug}/${talk.slug}`} target="_blank" rel="noreferrer">
            Channel on Are.na ↗
          </a>
        </div>
        <form action={updateTalk} className="row">
          <input type="hidden" name="talkId" value={talk.id} />
          <input type="text" name="title" defaultValue={talk.title} required />
          <label className="row">
            Budget
            <input type="number" name="budget" min={0} step="any" defaultValue={talk.budget} required />
          </label>
          <label className="row">
            Status
            <select name="status" defaultValue={talk.status}>
              <option value="draft">draft</option>
              <option value="live">live</option>
              <option value="built">built</option>
            </select>
          </label>
          <button type="submit">Save</button>
        </form>
      </section>

      <section className="section">
        <h2>Rounds</h2>
        <RoundsEditor talkId={talk.id} topics={topics} initialRounds={talk.rounds} />
      </section>

      <section className="section">
        <h2>Picks</h2>
        {talk.picks.length === 0 ? (
          <p className="muted">Nothing picked yet.</p>
        ) : (
          <ol>
            {talk.picks.map((pid, i) => (
              <li key={i}>
                {map.get(pid)?.title ?? `Channel ${pid}`} <span className="muted">(cost {map.get(pid)?.cost ?? 1})</span>
              </li>
            ))}
          </ol>
        )}
        <p>
          Spent {spent(talk.picks, map)} of {talk.budget}. Channel has {talk.blockCount} blocks
          {talk.builtAt ? `, built ${talk.builtAt}` : ""}.
        </p>
        <form action={resetPicks} className="row">
          <input type="hidden" name="talkId" value={talk.id} />
          <button type="submit" className="secondary">
            Reset picks
          </button>
          <span className="muted">Clears picks only. Blocks already connected to the channel stay there.</span>
        </form>
      </section>

      <section className="section">
        <h2>Danger</h2>
        <form action={deleteTalk} className="row">
          <input type="hidden" name="talkId" value={talk.id} />
          <button type="submit" className="danger">
            Delete talk and its channel
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
