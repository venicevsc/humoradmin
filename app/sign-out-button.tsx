"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ className = "link-button" }: { className?: string }) {
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button onClick={signOut} className={className}>
      Sign out
    </button>
  );
}
