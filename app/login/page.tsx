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
        <input type="password" name="password" placeholder="Password" className="input" autoFocus required />
        {error ? <p className="sm alert">That password is not right.</p> : null}
        <button type="submit" className="button primary">
          Log in
        </button>
      </form>
    </main>
  );
}
