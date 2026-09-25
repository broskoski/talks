import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { LinkRow } from "@/components/LinkRow";
import { createTalk } from "@/lib/actions";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalksAndTopics } from "@/lib/data";
import { topicMap, minutesSpent } from "@/lib/talks";

export default async function TalksPage() {
  await requireAuthOrRedirect();
  const { talks, topics } = await loadTalksAndTopics();
  const map = topicMap(topics);

  return (
    <AdminShell crumbs={[{ label: "Talks" }]}>
      <section className="section">
        {talks.length === 0 ? (
          <p className="slate">No talks yet. Create one below.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Talk</th>
                <th>Status</th>
                <th className="num">Minutes</th>
                <th className="num">Length</th>
                <th className="num">Rounds</th>
                <th className="num">Blocks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {talks.map((talk) => (
                <LinkRow key={talk.id} href={`/talks/${talk.id}`}>
                  <td className="primary">
                    <Link href={`/talks/${talk.id}`}>{talk.title}</Link>
                  </td>
                  <td>
                    <span className={`badge ${talk.status}`}>{talk.status}</span>
                  </td>
                  <td className="num">{minutesSpent(talk.picks, map)}</td>
                  <td className="num">{talk.minutes} min</td>
                  <td className="num">
                    {talk.picks.length} / {talk.rounds.length}
                  </td>
                  <td className="num">{talk.blockCount}</td>
                  <td className="num">
                    <Link href={`/talks/${talk.id}/stage`} className="button sm">
                      Stage
                    </Link>
                  </td>
                </LinkRow>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
        <h2 className="section-header">New talk</h2>
        <form action={createTalk} className="row">
          <input type="text" name="title" placeholder="Talk name" className="input" required />
          <label className="row">
            <input type="number" name="minutes" min={0} step={1} defaultValue={40} className="input short" aria-label="Length in minutes" required />
            <span className="sm slate">minutes</span>
          </label>
          <button type="submit" className="button primary">
            Create talk
          </button>
        </form>
        <p className="note">Creates a private channel in the group. Building the talk fills that channel.</p>
      </section>
    </AdminShell>
  );
}
