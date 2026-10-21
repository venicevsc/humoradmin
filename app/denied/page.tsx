import { createClient } from "@/lib/supabase/server";
import SignOutButton from "../sign-out-button";

export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="center">
      <div className="card narrow">
        <p className="eyebrow">403</p>
        <h1>Not a superadmin</h1>
        <p className="muted">
          You&apos;re signed in as <strong>{user?.email}</strong>, but this
          account doesn&apos;t have <code>profiles.is_superadmin</code> set.
          Ask the project owner to grant it from the Supabase dashboard.
        </p>
        <SignOutButton className="button wide" />
      </div>
    </main>
  );
}
