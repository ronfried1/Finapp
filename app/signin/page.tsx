import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="signin">
      <section className="signin-panel">
        <p className="eyebrow">Personal finance dashboard</p>
        <h1>Finance Clarity</h1>
        <p>
          Clear snapshot of cash, spending patterns, and fixed expenses. Built for monthly control over bank and credit
          card behavior.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button className="button" type="submit">
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
