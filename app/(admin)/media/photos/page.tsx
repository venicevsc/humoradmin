import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createPhoto } from "../actions";
import { Flash, MediaTabs } from "../shared";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { error, deleted } = await searchParams;
  const { data: photos } = await supabase
    .from("photos")
    .select("id, image_url, alt_text, created_at, captions(count), likes(count)")
    .order("id", { ascending: false });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">AI generated media</p>
          <h1>Photos</h1>
        </div>
        <MediaTabs active="photos" />
      </div>

      <Flash error={error} deleted={deleted} />

      <form action={createPhoto} className="card">
        <h2>Add a photo by URL</h2>
        <div className="toolbar">
          <input name="image_url" type="url" placeholder="https://…" required style={{ flex: 2, minWidth: 220 }} />
          <input name="alt_text" placeholder="Description (alt text)" maxLength={200} style={{ flex: 1, minWidth: 160 }} />
          <button className="button primary" type="submit">
            Add photo
          </button>
        </div>
      </form>

      <div className="grid tiles" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
        {(photos ?? []).map((p) => (
          <Link key={p.id} href={`/media/photo/${p.id}`} className="tile" style={{ color: "inherit", textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.alt_text ?? ""} className="thumb" style={{ width: "100%", height: 130 }} />
            <div className="small" style={{ marginTop: 8 }}>
              #{p.id} {p.alt_text && <span className="muted">· {p.alt_text}</span>}
            </div>
            <div className="small muted">
              {p.captions?.[0]?.count ?? 0} captions · {p.likes?.[0]?.count ?? 0} likes
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
