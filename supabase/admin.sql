-- Admin panel: superadmin flag, admin-only RLS policies, and helper functions.
-- Run in the Supabase SQL Editor after the main app's SQL files. Idempotent.

-- ---------------------------------------------------------------- schema --

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- profiles_update_own lets users edit their own row, which would include this
-- column. From the API only a superadmin may change it, and never their own
-- (so nobody can promote themselves or lock the last admin out by accident).
-- The SQL editor / dashboard (postgres, service_role) can always change it.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_superadmin is distinct from (case when tg_op = 'INSERT' then false else old.is_superadmin end)
     and coalesce(auth.role(), '') in ('anon', 'authenticated')
     and (tg_op = 'INSERT' or new.id = auth.uid() or not public.is_superadmin()) then
    raise exception 'only another superadmin can change is_superadmin' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

-- --------------------------------------------------------------- functions --

-- Security definer so it can read profiles without tripping profiles' own RLS.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_superadmin from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- Emails and sign-in times live in auth.users, which the API can't read.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at
    from auth.users u;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Grant or revoke admin from the admin panel. Security definer so it can update
-- someone else's profile past profiles_update_own; the trigger above still
-- checks that the caller is a superadmin changing someone other than themselves.
create or replace function public.admin_set_superadmin(p_user_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'you can''t change your own admin status' using errcode = '42501';
  end if;

  update public.profiles set is_superadmin = p_value where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;
end;
$$;

revoke all on function public.admin_set_superadmin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_superadmin(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------- RLS --
-- Added alongside the existing "own row" policies; Postgres ORs them together.

-- READ users/profiles
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using ((select public.is_superadmin()));

-- READ upvotes/downvotes/likes
drop policy if exists "caption_votes_select_admin" on public.caption_votes;
create policy "caption_votes_select_admin" on public.caption_votes
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "likes_select_admin" on public.likes;
create policy "likes_select_admin" on public.likes
  for select to authenticated using ((select public.is_superadmin()));

-- READ the prompts behind each generation
drop policy if exists "generations_select_admin" on public.generations;
create policy "generations_select_admin" on public.generations
  for select to authenticated using ((select public.is_superadmin()));

-- CREATE/UPDATE/DELETE AI generated media (reads are already public)
drop policy if exists "captions_insert_admin" on public.captions;
create policy "captions_insert_admin" on public.captions
  for insert to authenticated with check ((select public.is_superadmin()));

drop policy if exists "captions_update_admin" on public.captions;
create policy "captions_update_admin" on public.captions
  for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "captions_delete_admin" on public.captions;
create policy "captions_delete_admin" on public.captions
  for delete to authenticated using ((select public.is_superadmin()));

drop policy if exists "photos_insert_admin" on public.photos;
create policy "photos_insert_admin" on public.photos
  for insert to authenticated with check ((select public.is_superadmin()));

drop policy if exists "photos_update_admin" on public.photos;
create policy "photos_update_admin" on public.photos
  for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "photos_delete_admin" on public.photos;
create policy "photos_delete_admin" on public.photos
  for delete to authenticated using ((select public.is_superadmin()));

-- ------------------------------------------------------------- bootstrap --
-- The answer to "won't you be locked out?": the SQL editor runs as postgres,
-- which bypasses RLS and the trigger above, so the first superadmin is
-- granted here, by hand, by whoever owns the Supabase project.
-- Sign in to the main app with Google once first so the profile row exists.
-- After that, superadmins can promote others from the Users page.

update public.profiles
set is_superadmin = true
where id = (select id from auth.users where email = 'sinara.vsc@gmail.com');

-- Make the API pick up new functions right away (avoids "could not find the
-- function ... in the schema cache").
notify pgrst, 'reload schema';
