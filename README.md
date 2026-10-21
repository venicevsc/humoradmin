# Humor Admin

Admin area for the Venice-Style Captions database (Next.js 16 + Supabase).

- **Stats** (`/`): laugh rate, hall of fame/shame, most divisive captions, which joke angle lands,
  caption length vs. reception, a day × hour voting heatmap, daily AI runs, critics and top creators.
- **Users** (`/users`): list of profiles with emails, activity counts and sign-in times; superadmins
  can grant or revoke admin for other users.
- **Media** (`/media`, `/media/photos`): create, read, update and delete AI captions and photos.
- **Votes** (`/votes`): read-only up/downvotes and photo likes.

## Security

Every route is behind Google login **and** `profiles.is_superadmin = true`, checked in three places:

1. `proxy.ts` redirects signed-out users to `/login` and non-admins to `/denied`.
2. `requireAdmin()` in `lib/admin.ts` runs in the admin layout, every page and every server action.
3. Row-level security in `supabase/admin.sql`: the admin-only policies use `public.is_superadmin()`,
   so even a request made directly with the public anon key can't read other users' data.
   No service-role key is used anywhere.

A trigger stops anyone from setting `is_superadmin` on their own profile through the API.

## Won't you be locked out?

Yes, if the flag could only be set from inside the admin area. The way out is that the project owner
already has access that doesn't go through the app: the Supabase dashboard. The SQL Editor runs as
the `postgres` role, which bypasses RLS and the trigger, so the first superadmin is granted by hand
there (the last statement in `supabase/admin.sql`). After that, any superadmin can make other users
admins from the Users page (through `admin_set_superadmin()`), but nobody can change their own flag
from the app, so you can't promote yourself or accidentally remove the last admin by demoting yourself.

## Setup

1. Run `supabase/admin.sql` in the Supabase SQL Editor (after the main app's SQL).
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
3. Add `https://<admin-domain>/auth/callback` to Supabase → Authentication → URL Configuration → Redirect URLs.
