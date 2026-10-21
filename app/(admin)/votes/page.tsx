import Link from "next/link";
import { displayName, formatDate, requireAdmin } from "@/lib/admin";

const PAGE_SIZE = 50;

export default async function VotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; page?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const tab = params.tab === "likes" ? "likes" : "votes";
  const type = params.type === "up" || params.type === "down" ? params.type : "";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const [{ count: upCount }, { count: downCount }, { count: likeCount }] = await Promise.all([
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("vote", 1),
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("vote", -1),
    supabase.from("likes").select("id", { count: "exact", head: true }),
  ]);

  let rows: {
    id: number;
    user_id: string;
    created_at: string;
    vote?: number;
    target: { id: number; text: string; href: string; image?: string };
  }[] = [];
  let total = 0;

  if (tab === "votes") {
    let query = supabase
      .from("caption_votes")
      .select("id, user_id, vote, created_at, captions(id, caption_text, photos(image_url))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (type) query = query.eq("vote", type === "up" ? 1 : -1);
    const { data, count } = await query;
    total = count ?? 0;
    rows = (data ?? []).map((v) => {
      const c = Array.isArray(v.captions) ? v.captions[0] : v.captions;
      const photo = c && (Array.isArray(c.photos) ? c.photos[0] : c.photos);
      return {
        id: v.id,
        user_id: v.user_id,
        created_at: v.created_at,
        vote: v.vote,
        target: { id: c?.id, text: c?.caption_text ?? "(deleted)", href: `/media/${c?.id}`, image: photo?.image_url },
      };
    });
  } else {
    const { data, count } = await supabase
      .from("likes")
      .select("id, user_id, created_at, photos(id, image_url, alt_text)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    total = count ?? 0;
    rows = (data ?? []).map((l) => {
      const p = Array.isArray(l.photos) ? l.photos[0] : l.photos;
      return {
        id: l.id,
        user_id: l.user_id,
        created_at: l.created_at,
        target: { id: p?.id, text: p?.alt_text || `Photo #${p?.id}`, href: `/media/photo/${p?.id}`, image: p?.image_url },
      };
    });
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (overrides: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    const merged = { tab, type, page, ...overrides };
    if (merged.tab !== "votes") sp.set("tab", String(merged.tab));
    if (merged.type) sp.set("type", String(merged.type));
    if (Number(merged.page) > 1) sp.set("page", String(merged.page));
    return `/votes${sp.size ? `?${sp}` : ""}`;
  };

  const up = upCount ?? 0;
  const down = downCount ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Read only</p>
          <h1>Votes &amp; ratings</h1>
        </div>
      </div>

      <div className="grid tiles">
        <div className="tile">
          <div className="label">Upvotes</div>
          <div className="value">{up.toLocaleString()}</div>
        </div>
        <div className="tile">
          <div className="label">Downvotes</div>
          <div className="value">{down.toLocaleString()}</div>
        </div>
        <div className="tile">
          <div className="label">Up : down ratio</div>
          <div className="value">{down ? (up / down).toFixed(1) : "—"} : 1</div>
        </div>
        <div className="tile">
          <div className="label">Photo likes</div>
          <div className="value">{(likeCount ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="toolbar">
        <Link className="button" href={link({ tab: "votes", type: "", page: 1 })}
          style={tab === "votes" && !type ? { background: "var(--neutral)", fontWeight: 600 } : undefined}>
          All votes
        </Link>
        <Link className="button" href={link({ tab: "votes", type: "up", page: 1 })}
          style={tab === "votes" && type === "up" ? { background: "var(--neutral)", fontWeight: 600 } : undefined}>
          ▲ Upvotes
        </Link>
        <Link className="button" href={link({ tab: "votes", type: "down", page: 1 })}
          style={tab === "votes" && type === "down" ? { background: "var(--neutral)", fontWeight: 600 } : undefined}>
          ▼ Downvotes
        </Link>
        <Link className="button" href={link({ tab: "likes", type: "", page: 1 })}
          style={tab === "likes" ? { background: "var(--neutral)", fontWeight: 600 } : undefined}>
          ❤ Photo likes
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tab === "votes" ? "Vote" : "Like"}</th>
              <th>By</th>
              <th>On</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nothing here yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.vote === undefined ? (
                    <span className="pill">❤</span>
                  ) : (
                    <span className={`pill ${r.vote > 0 ? "up" : "down"}`}>{r.vote > 0 ? "▲ up" : "▼ down"}</span>
                  )}
                </td>
                <td className="small">{displayName(profileById.get(r.user_id), "Anonymous")}</td>
                <td>
                  <Link href={r.target.href} style={{ display: "flex", gap: 10, alignItems: "center", color: "inherit" }}>
                    {r.target.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.target.image} alt="" className="thumb" style={{ width: 36, height: 36 }} />
                    )}
                    <span className="small">{r.target.text}</span>
                  </Link>
                </td>
                <td className="small muted">{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="muted small">
          {total.toLocaleString()} rows · page {page} of {pages}
        </span>
        {page > 1 && (
          <Link className="button" href={link({ page: page - 1 })}>
            ← Prev
          </Link>
        )}
        {page < pages && (
          <Link className="button" href={link({ page: page + 1 })}>
            Next →
          </Link>
        )}
      </div>
    </>
  );
}
