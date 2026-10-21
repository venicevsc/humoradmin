import Link from "next/link";
import { formatDate, requireAdmin } from "@/lib/admin";
import { ANGLE_LABELS, Flash, MediaTabs } from "./shared";

const PAGE_SIZE = 25;
const SORTS = {
  newest: { column: "created_at", ascending: false, label: "Newest" },
  oldest: { column: "created_at", ascending: true, label: "Oldest" },
  best: { column: "score", ascending: false, label: "Highest score" },
  worst: { column: "score", ascending: true, label: "Lowest score" },
} as const;

type Row = {
  caption_id: number;
  score: number;
  upvotes: number;
  downvotes: number;
};

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; angle?: string; sort?: string; page?: string; deleted?: string; error?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const angle = params.angle && params.angle in ANGLE_LABELS ? params.angle : "";
  const sortKey = (params.sort && params.sort in SORTS ? params.sort : "newest") as keyof typeof SORTS;
  const sort = SORTS[sortKey];
  const page = Math.max(1, Number(params.page) || 1);

  // Score sorting needs the caption_scores view; text search needs captions.
  // Filter on captions, then join scores for the page being shown.
  let query = supabase
    .from("captions")
    .select("id, caption_text, setup, angle, created_at, photo_id, generation_id, photos(image_url, alt_text)", {
      count: "exact",
    });
  if (q) query = query.or(`caption_text.ilike.%${q.replace(/[%,()]/g, "")}%,setup.ilike.%${q.replace(/[%,()]/g, "")}%`);
  if (angle) query = query.eq("angle", angle);

  let captionIds: number[] | null = null;
  if (sort.column === "score") {
    // Order all matching ids by score first, then page.
    const { data: scores } = await supabase
      .from("caption_scores")
      .select("caption_id, score")
      .order("score", { ascending: sort.ascending })
      .order("caption_id", { ascending: false });
    captionIds = (scores ?? []).map((s) => s.caption_id);
  }

  let rows;
  let count = 0;
  if (captionIds) {
    const { data, count: c } = await query.limit(10000);
    const byId = new Map((data ?? []).map((r) => [r.id, r]));
    const ordered = captionIds.map((cid) => byId.get(cid)).filter((r) => r !== undefined);
    count = c ?? ordered.length;
    rows = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const { data, count: c } = await query
      .order(sort.column, { ascending: sort.ascending })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    rows = data ?? [];
    count = c ?? 0;
  }

  const { data: scoreRows } = rows.length
    ? await supabase
        .from("caption_scores")
        .select("caption_id, score, upvotes, downvotes")
        .in("caption_id", rows.map((r) => r.id))
    : { data: [] as Row[] };
  const scores = new Map((scoreRows ?? []).map((s: Row) => [s.caption_id, s]));

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (angle) sp.set("angle", angle);
    if (sortKey !== "newest") sp.set("sort", sortKey);
    if (p > 1) sp.set("page", String(p));
    return `/media${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">AI generated media</p>
          <h1>Captions</h1>
        </div>
        <div className="toolbar">
          <MediaTabs active="captions" />
          <Link href="/media/new" className="button primary">
            + New caption
          </Link>
        </div>
      </div>

      <Flash deleted={params.deleted} error={params.error} />

      <form className="toolbar" action="/media">
        <input name="q" placeholder="Search caption or setup…" defaultValue={q} style={{ flex: 1, minWidth: 200 }} />
        <select name="angle" defaultValue={angle}>
          <option value="">All types</option>
          {Object.entries(ANGLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sortKey}>
          {Object.entries(SORTS).map(([value, s]) => (
            <option key={value} value={value}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="button" type="submit">
          Filter
        </button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Media</th>
              <th>Caption</th>
              <th>Type</th>
              <th className="num">Votes</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No captions match.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const photo = Array.isArray(c.photos) ? c.photos[0] : c.photos;
              const s = scores.get(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    {photo ? (
                      <Link href={`/media/photo/${c.photo_id}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.image_url} alt={photo.alt_text ?? ""} className="thumb" />
                      </Link>
                    ) : (
                      <div className="thumb" style={{ display: "grid", placeItems: "center" }}>💬</div>
                    )}
                  </td>
                  <td style={{ maxWidth: 480 }}>
                    {c.setup && <div className="small muted">“{c.setup}”</div>}
                    {c.caption_text}
                    {!c.generation_id && <div className="small muted">added by admin</div>}
                  </td>
                  <td>
                    <span className="pill">{ANGLE_LABELS[c.angle ?? "photo"] ?? c.angle}</span>
                  </td>
                  <td className="num">
                    <span className="pill up">▲ {s?.upvotes ?? 0}</span>{" "}
                    <span className="pill down">▼ {s?.downvotes ?? 0}</span>
                  </td>
                  <td className="small muted">{formatDate(c.created_at)}</td>
                  <td>
                    <Link href={`/media/${c.id}`}>Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="muted small">
          {count.toLocaleString()} captions · page {page} of {pages}
        </span>
        {page > 1 && (
          <Link className="button" href={link(page - 1)}>
            ← Prev
          </Link>
        )}
        {page < pages && (
          <Link className="button" href={link(page + 1)}>
            Next →
          </Link>
        )}
      </div>
    </>
  );
}
