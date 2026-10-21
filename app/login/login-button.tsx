"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginButton({ next }: { next: string }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    // A second click would overwrite the first flow's verifier cookie.
    if (starting) return;
    setStarting(true);
    setError(null);

    // The redirect URI has to stay exactly /auth/callback, so the page to
    // return to travels in a short-lived cookie instead.
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie =
      next === "/"
        ? `login_next=; path=/; max-age=0; samesite=lax${secure}`
        : `login_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax${secure}`;

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signInError) {
      setError("Couldn't reach Google. Please try again.");
      setStarting(false);
    }
  };

  return (
    <>
      <button onClick={handleGoogleLogin} disabled={starting} className="button primary wide">
        {starting ? "Opening Google..." : "Continue with Google"}
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
