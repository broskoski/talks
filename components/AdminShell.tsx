import Link from "next/link";
import { logout } from "@/lib/actions";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <nav className="nav">
        <Link href="/">Talks</Link>
        <Link href="/topics">Topics</Link>
        <span className="spacer" />
        <form action={logout}>
          <button type="submit" className="secondary">
            Log out
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
