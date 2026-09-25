import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page" style={{ paddingTop: "var(--space-8)" }}>
      <h1>Not found</h1>
      <p style={{ marginTop: "var(--space-3)" }}>
        <Link href="/" className="button ghost">
          Back to talks
        </Link>
      </p>
    </main>
  );
}
