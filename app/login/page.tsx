import { redirect } from "next/navigation";
import { login } from "@/lib/actions";
import { isAuthenticated } from "@/lib/auth";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await isAuthenticated()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="login">
      <form action={login}>
        <h1>Talks</h1>
        <input type="password" name="password" placeholder="Password" autoFocus required />
        {error ? <p className="error">Wrong password.</p> : null}
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}
