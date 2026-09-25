import { AdminShell } from "@/components/AdminShell";
import { setCost } from "@/lib/actions";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalksAndTopics } from "@/lib/data";

export default async function TopicsPage() {
  await requireAuthOrRedirect();
  const { topics } = await loadTalksAndTopics();

  return (
    <AdminShell>
      <h1>Topics</h1>
      <p className="muted">
        Every group channel that is not a talk. Cost is stored as metadata on the channel and defaults to 1.
      </p>
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Description</th>
            <th className="num">Blocks</th>
            <th className="num">Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <tr key={topic.id}>
              <td>
                <a href={`https://www.are.na/${topic.ownerSlug}/${topic.slug}`} target="_blank" rel="noreferrer">
                  {topic.title}
                </a>
              </td>
              <td className="muted">{topic.description}</td>
              <td className="num">{topic.blockCount}</td>
              <td className="num">
                <form action={setCost} id={`cost-${topic.id}`}>
                  <input type="hidden" name="channelId" value={topic.id} />
                  <input type="number" name="cost" min={0} step="any" defaultValue={topic.cost} />
                </form>
              </td>
              <td>
                <button type="submit" form={`cost-${topic.id}`} className="secondary">
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminShell>
  );
}
