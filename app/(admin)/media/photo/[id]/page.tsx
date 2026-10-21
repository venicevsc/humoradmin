import Link from "next/link";
import { notFound } from "next/navigation";
import { displayName, formatDate, requireAdmin } from "@/lib/admin";
import { deletePhoto, updatePhoto } from "../../actions";
import { ANGLE_LABELS, DeleteForm, Flash } from "../../shared";

export default async function PhotoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { error, saved } = await searchParams;
  const photoId = Number(id);
  if (!Number.isInteger(photoId)) notFound();

  const { data: photo } = await supabase
    .from("photos")
    .select("id, image_url, alt_text, user_id, created_at")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) notFound();

  const [{ data: captions }, { data: owner }, { count: likeCount }] = await Promise.all([
    supabase.from("captions").select("id, caption_text, angle").eq("photo_id", photoId).order("id"),
    photo.user_id
      ? supabase.from("profiles").select("first_name, last_name").eq("id", photo.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("photo_id", photoId),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/media/photos">Photos</Link> / #{photo.id}
          </p>
          <h1>Edit photo</h1>
        </div>
        <span className="muted small">
          Uploaded by {displayName(owner ?? undefined, "seed data")} · {formatDate(photo.created_at)} · {likeCount ?? 0} likes
        </span>
      </div>

      <Flash error={error} saved={saved} />

      <div className="grid two">
        <form action={updatePhoto} className="card">
          <input type="hidden" name="id" value={photo.id} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.image_url} alt={photo.alt_text ?? ""} style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 8, background: "var(--neutral)" }} />
          <label className="field">
            Image URL
            <input name="image_url" type="url" required defaultValue={photo.image_url} />
          </label>
          <label className="field">
            Alt text
            <input name="alt_text" maxLength={200} defaultValue={photo.alt_text ?? ""} />
          </label>
          <button className="button primary" type="submit">
            Save changes
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head">
              <h2>Captions ({captions?.length ?? 0})</h2>
              <Link href={`/media/new?photo=${photo.id}`} className="small">
                + Add caption
              </Link>
            </div>
            {(captions ?? []).map((c) => (
              <Link key={c.id} href={`/media/${c.id}`} className="quote" style={{ color: "inherit" }}>
                <div className="small muted">{ANGLE_LABELS[c.angle ?? "photo"]}</div>
                {c.caption_text}
              </Link>
            ))}
          </section>

          <DeleteForm
            action={deletePhoto}
            id={photo.id}
            what="photo"
            warning={`This also deletes its ${captions?.length ?? 0} captions, their votes, its likes and its generation records.`}
          />
        </div>
      </div>
    </>
  );
}
