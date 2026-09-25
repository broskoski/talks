"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page" style={{ paddingTop: "var(--space-8)" }}>
      <h1>Something went wrong</h1>
      <p className="alert" style={{ marginTop: "var(--space-3)" }}>
        {error.message || "Unknown error"}
      </p>
      <p className="note">If this mentions Are.na 401 or 403, check ARENA_TOKEN in .env.local and that it has write scope.</p>
      <div className="row" style={{ marginTop: "var(--space-4)" }}>
        <button type="button" className="button" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="button ghost">
          Back to talks
        </Link>
      </div>
    </main>
  );
}
