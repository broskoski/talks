import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { createTalk } from "@/lib/actions";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalksAndTopics } from "@/lib/data";
import { topicMap, spent } from "@/lib/talks";

export default async function TalksPage() {
  await requireAuthOrRedirect();
  const { talks, topics } = await loadTalksAndTopics();
  const map = topicMap(topics);

  return (
    <AdminShell>
      <section className="section">
        <h1>Talks</h1>
        {talks.length === 0 ? (
          <p className="muted">No talks yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th className="num">Budget</th>
                <th className="num">Rounds</th>
                <th className="num">Picks</th>
                <th className="num">Blocks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {talks.map((talk) => (
                <tr key={talk.id}>
                  <td>
                    <Link href={`/talks/${talk.id}`}>{talk.title}</Link>
                  </td>
                  <td>
                    <span className={`status ${talk.status}`}>{talk.status}</span>
                  </td>
                  <td className="num">
                    {spent(talk.picks, map)} / {talk.budget}
                  </td>
                  <td className="num">{talk.rounds.length}</td>
                  <td className="num">{talk.picks.length}</td>
                  <td className="num">{talk.blockCount}</td>
                  <td>
                    <Link href={`/talks/${talk.id}/stage`}>Stage →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
        <h2>New talk</h2>
        <form action={createTalk} className="row">
          <input type="text" name="title" placeholder="Talk name" required />
          <label className="row">
            Budget
            <input type="number" name="budget" min={0} step="any" defaultValue={10} required />
          </label>
          <button type="submit">Create</button>
        </form>
        <p className="muted">Creates a private channel in the group. Building the talk fills that channel.</p>
      </section>
    </AdminShell>
  );
}
