import { displayName, fetchAll, formatDate, requireAdmin } from "@/lib/admin";
import type { Generation, Like, Profile, Vote } from "@/lib/stats";
import { setSuperadmin } from "./actions";

type AuthUser = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; role?: string; error?: string; granted?: string; revoked?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const { q = "", sort = "recent", role = "", error: actionError, granted, revoked } = await searchParams;

  const [profiles, { data: authUsers, error }, votes, likes, generations] = await Promise.all([
    fetchAll<Profile & { hometown: string | null }>(
      supabase,
      "profiles",
      "id, first_name, last_name, avatar_url, hometown, is_superadmin, created_at",
    ),
    supabase.rpc("admin_list_users"),
    fetchAll<Pick<Vote, "id" | "user_id" | "vote">>(supabase, "caption_votes", "id, user_id, vote"),
    fetchAll<Pick<Like, "id" | "user_id">>(supabase, "likes", "id, user_id"),
    fetchAll<Pick<Generation, "id" | "user_id" | "kind">>(supabase, "generations", "id, user_id, kind"),
  ]);

  const authById = new Map(((authUsers ?? []) as AuthUser[]).map((u) => [u.id, u]));
  const countBy = <T extends { user_id: string }>(rows: T[], keep: (r: T) => boolean = () => true) => {
    const m = new Map<string, number>();
    for (const r of rows) if (keep(r)) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const ups = countBy(votes, (v) => v.vote > 0);
  const downs = countBy(votes, (v) => v.vote < 0);
  const likeCounts = countBy(likes);
  const photoRuns = countBy(generations, (g) => g.kind !== "chat");
  const chatRuns = countBy(generations, (g) => g.kind === "chat");

  const needle = q.trim().toLowerCase();
  const rows = profiles
    .map((p) => ({
      ...p,
      email: authById.get(p.id)?.email ?? null,
      lastSignIn: authById.get(p.id)?.last_sign_in_at ?? null,
      up: ups.get(p.id) ?? 0,
      down: downs.get(p.id) ?? 0,
      likes: likeCounts.get(p.id) ?? 0,
      photoRuns: photoRuns.get(p.id) ?? 0,
      chatRuns: chatRuns.get(p.id) ?? 0,
    }))
    .filter((r) => role !== "admin" || r.is_superadmin)
    .filter((r) => !needle || `${displayName(r, "")} ${r.email ?? ""} ${r.hometown ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (sort === "active") return b.up + b.down + b.photoRuns + b.chatRuns - (a.up + a.down + a.photoRuns + a.chatRuns);
      if (sort === "joined") return b.created_at.localeCompare(a.created_at);
      return (b.lastSignIn ?? "").localeCompare(a.lastSignIn ?? "");
    });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Users &amp; profiles</h1>
        </div>
        <span className="muted small">
          {profiles.length} profiles · {profiles.filter((p) => p.is_superadmin).length} admins
        </span>
      </div>

      {actionError && <p className="notice error" role="alert">{actionError}</p>}
      {granted && <p className="notice" role="status">Admin access granted.</p>}
      {revoked && <p className="notice" role="status">Admin access removed.</p>}

      {error && <p className="notice error">Couldn&apos;t load emails: {error.message}</p>}

      <form className="toolbar" action="/users">
        <input name="q" placeholder="Search name, email, hometown…" defaultValue={q} style={{ flex: 1, minWidth: 200 }} />
        <select name="role" defaultValue={role}>
          <option value="">Everyone</option>
          <option value="admin">Admins only</option>
        </select>
        <select name="sort" defaultValue={sort}>
          <option value="recent">Last sign-in</option>
          <option value="joined">Newest accounts</option>
          <option value="active">Most active</option>
        </select>
        <button className="button" type="submit">
          Filter
        </button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Hometown</th>
              <th className="num">Votes ▲/▼</th>
              <th className="num">Likes</th>
              <th className="num">AI runs</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No users match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt="" className="avatar" />
                    ) : (
                      <span className="avatar" style={{ display: "inline-block" }} />
                    )}
                    <div>
                      <div>{displayName(r, "(no name yet)")}</div>
                      <div className="small muted" title={r.id}>
                        {r.id.slice(0, 8)}… {r.is_superadmin && <span className="pill admin">superadmin</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="small">{r.email ?? "—"}</td>
                <td className="small">{r.hometown ?? "—"}</td>
                <td className="num">
                  {r.up} / {r.down}
                </td>
                <td className="num">{r.likes}</td>
                <td className="num" title={`${r.photoRuns} photo, ${r.chatRuns} chat`}>
                  {r.photoRuns + r.chatRuns}
                </td>
                <td className="small muted">{formatDate(r.created_at)}</td>
                <td className="small muted">{formatDate(r.lastSignIn)}</td>
                <td>
                  {r.id === user.id ? (
                    <span className="small muted" title="Ask another superadmin to change your status">
                      You
                    </span>
                  ) : (
                    <form action={setSuperadmin}>
                      <input type="hidden" name="user_id" value={r.id} />
                      <input type="hidden" name="value" value={String(!r.is_superadmin)} />
                      <button
                        type="submit"
                        className={`button ${r.is_superadmin ? "danger" : ""}`}
                        style={{ padding: "4px 10px", fontSize: 13 }}
                      >
                        {r.is_superadmin ? "Remove admin" : "Make admin"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
