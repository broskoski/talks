import { AdminShell } from "@/components/AdminShell";
import { setMinutes } from "@/lib/actions";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalksAndTopics } from "@/lib/data";

export default async function TopicsPage() {
  await requireAuthOrRedirect();
  const { topics } = await loadTalksAndTopics();

  return (
    <AdminShell crumbs={[{ label: "Talks", href: "/" }, { label: "Topics" }]}>
      <section className="section">
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Description</th>
              <th className="num">Blocks</th>
              <th className="num" style={{ width: 0 }}>
                Minutes
              </th>
              <th style={{ width: 0 }}></th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td className="primary">
                  <a href={`https://www.are.na/${topic.ownerSlug}/${topic.slug}`} target="_blank" rel="noreferrer">
                    {topic.title}
                  </a>
                </td>
                <td className="slate">{topic.description}</td>
                <td className="num">{topic.blockCount}</td>
                <td className="num">
                  <form action={setMinutes} id={`minutes-${topic.id}`}>
                    <input type="hidden" name="channelId" value={topic.id} />
                    <input
                      type="number"
                      name="minutes"
                      min={0}
                      step={1}
                      defaultValue={topic.minutesSet ? topic.minutes : ""}
                      placeholder={String(topic.minutes)}
                      className="input short"
                      aria-label="Minutes"
                    />
                  </form>
                </td>
                <td>
                  <button type="submit" form={`minutes-${topic.id}`} className="button sm">
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          Every channel in the group that is not a talk. Minutes are stored on the channel. A greyed value is an estimate
          from the block count, about 20 seconds a block. Save an empty field to go back to the estimate.
        </p>
      </section>
    </AdminShell>
  );
}
