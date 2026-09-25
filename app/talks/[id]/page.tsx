import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { deleteTalk, resetPicks, updateTalk } from "@/lib/actions";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalkWithTopics } from "@/lib/data";
import { minutesSpent, topicMap } from "@/lib/talks";
import { RoundsEditor } from "./RoundsEditor";

export default async function TalkPage({ params }: PageProps<"/talks/[id]">) {
  await requireAuthOrRedirect();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const { talk, topics } = await loadTalkWithTopics(id);
  if (!talk) notFound();
  const map = topicMap(topics);

  return (
    <AdminShell crumbs={[{ label: "Talks", href: "/" }, { label: talk.title }]}>
      <section className="section">
        <div className="title-row">
          <h1>{talk.title}</h1>
          <span className={`badge ${talk.status}`}>{talk.status}</span>
          <span className="spacer" />
          <div className="links">
            <Link href={`/talks/${talk.id}/stage`}>Open stage</Link>
            <a href={`https://www.are.na/${talk.ownerSlug}/${talk.slug}`} target="_blank" rel="noreferrer">
              View on Are.na
            </a>
          </div>
        </div>
        <form action={updateTalk} className="row">
          <input type="hidden" name="talkId" value={talk.id} />
          <label className="field">
            <span className="label">Name</span>
            <input type="text" name="title" defaultValue={talk.title} className="input" required />
          </label>
          <label className="field">
            <span className="label">Length (minutes)</span>
            <input type="number" name="minutes" min={0} step={1} defaultValue={talk.minutes} className="input short" required />
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select name="status" defaultValue={talk.status} className="select">
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="built">Built</option>
            </select>
          </label>
          <label className="field">
            <span className="label">&nbsp;</span>
            <button type="submit" className="button">
              Save changes
            </button>
          </label>
        </form>
      </section>

      <section className="section">
        <h2 className="section-header">Rounds</h2>
        <RoundsEditor talkId={talk.id} topics={topics} initialRounds={talk.rounds} />
      </section>

      <section className="section">
        <h2 className="section-header">Picks</h2>
        {talk.picks.length === 0 ? (
          <p className="sm slate">Nothing picked yet.</p>
        ) : (
          <table>
            <tbody>
              {talk.picks.map((pid, i) => (
                <tr key={i}>
                  <td className="num slate" style={{ width: 40 }}>
                    {i + 1}
                  </td>
                  <td className="primary">{map.get(pid)?.title ?? `Channel ${pid}`}</td>
                  <td className="num">{map.get(pid)?.minutes ?? "?"} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">
          {minutesSpent(talk.picks, map)} of {talk.minutes} minutes used. The channel holds {talk.blockCount} blocks
          {talk.builtAt ? `, built ${new Date(talk.builtAt).toLocaleString()}` : ""}.
        </p>
        <form action={resetPicks} className="row" style={{ marginTop: "var(--space-3)" }}>
          <input type="hidden" name="talkId" value={talk.id} />
          <button type="submit" className="button ghost">
            Reset picks
          </button>
          <span className="xs slate">Clears the picks only. Blocks already connected to the channel stay.</span>
        </form>
      </section>

      <section className="section">
        <h2 className="section-header">Delete</h2>
        <form action={deleteTalk} className="row">
          <input type="hidden" name="talkId" value={talk.id} />
          <button type="submit" className="button alert">
            Delete talk and its channel
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
