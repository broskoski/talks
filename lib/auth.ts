import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, env.adminPassword);
}

/** For server actions: throw instead of redirecting. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not signed in");
}

/** For pages: redirect to /login. */
export async function requireAuthOrRedirect(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}
