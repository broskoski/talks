"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="admin">
      <h1>Something went wrong</h1>
      <p className="error">{error.message || "Unknown error"}</p>
      <p className="muted">
        If this mentions Are.na 401 or 403, check ARENA_TOKEN in .env.local and that it has write scope.
      </p>
      <div className="row">
        <button type="button" onClick={reset}>
          Try again
        </button>
        <a href="/">Talks</a>
      </div>
    </main>
  );
}
