import { notFound } from "next/navigation";
import { requireAuthOrRedirect } from "@/lib/auth";
import { loadTalkWithTopics, loadThumbs } from "@/lib/data";
import { Stage } from "./Stage";

export default async function StagePage({ params }: PageProps<"/talks/[id]/stage">) {
  await requireAuthOrRedirect();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const { talk, topics } = await loadTalkWithTopics(id);
  if (!talk) notFound();
  const thumbs = await loadThumbs(talk.rounds.flat());
  return <Stage talk={talk} topics={topics} thumbs={thumbs} />;
}
