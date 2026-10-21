import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const savedNext = cookieStore.get("login_next")?.value;
  let next = "/";
  try {
    next = safeNext(savedNext ? decodeURIComponent(savedNext) : null);
  } catch {
    next = "/";
  }

  const supabase = await createClient();
  let user = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  }

  // A code works once; a repeated callback falls back to the session cookie.
  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) {
    const reason = code ? "auth_failed" : "missing_code";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  // The proxy sends non-admins on to /denied from here.
  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.delete("login_next");
  return response;
}
