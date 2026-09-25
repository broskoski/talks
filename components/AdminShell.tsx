import Link from "next/link";
import { logout } from "@/lib/actions";

export type Crumb = { label: string; href?: string };

export function AdminShell({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  return (
    <div className="page">
      <nav className="nav">
        <div className="crumbs">
          {crumbs.map((crumb, i) => (
            <span key={i} className="crumbs">
              {i > 0 ? <span className="sep" /> : null}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span className="current">{crumb.label}</span>}
            </span>
          ))}
        </div>
        <span className="spacer" />
        <div className="nav-right">
          <Link href="/topics">Topics</Link>
          <form action={logout}>
            <button type="submit" className="button sm">
              Log out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
