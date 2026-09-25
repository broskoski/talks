"use client";

import { useRouter } from "next/navigation";

/** A table row that navigates on click, except when the click lands on a link or button inside it. */
export function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="link-row"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
