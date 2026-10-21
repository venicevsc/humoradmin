import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import LoginButton from "./login-button";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "That sign-in didn't finish. Please try again.",
  missing_code: "That sign-in link was incomplete. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeNext(next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(destination);

  return (
    <main className="center">
      <div className="card narrow">
        <p className="eyebrow">Humor Admin</p>
        <h1>Staff only</h1>
        <p className="muted">
          Sign in with Google. Only accounts marked as superadmin in the
          database can open the admin area.
        </p>
        {error && ERROR_MESSAGES[error] && (
          <p className="notice" role="alert">
            {ERROR_MESSAGES[error]}
          </p>
        )}
        <LoginButton next={destination} />
      </div>
    </main>
  );
}
