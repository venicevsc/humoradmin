import Link from "next/link";
import type { Caption, Photo } from "@/lib/stats";

export const ANGLE_LABELS: Record<string, string> = {
  photo: "About the photo",
  name: "About the name",
  both: "Photo + name",
  chat: "Chat joke",
};

export function Flash({ error, saved, deleted }: { error?: string; saved?: string; deleted?: string }) {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (saved) return <p className="notice" role="status">Saved.</p>;
  if (deleted) return <p className="notice" role="status">Deleted.</p>;
  return null;
}

export function MediaTabs({ active }: { active: "captions" | "photos" }) {
  return (
    <div className="toolbar">
      <Link href="/media" className="button" aria-current={active === "captions" ? "page" : undefined}
        style={active === "captions" ? { background: "var(--neutral)", fontWeight: 600 } : undefined}>
        Captions
      </Link>
      <Link href="/media/photos" className="button" aria-current={active === "photos" ? "page" : undefined}
        style={active === "photos" ? { background: "var(--neutral)", fontWeight: 600 } : undefined}>
        Photos
      </Link>
    </div>
  );
}

// Used for both create and edit. Chat jokes have a setup and no photo;
// every other type hangs off a photo (enforced by captions_photo_or_setup).
export function CaptionFields({
  caption,
  photos,
  defaultPhotoId,
}: {
  caption?: Caption;
  photos: Pick<Photo, "id" | "alt_text">[];
  defaultPhotoId?: number;
}) {
  return (
    <>
      <label className="field">
        Caption type
        <select name="angle" defaultValue={caption?.angle ?? "photo"} required>
          {Object.entries(ANGLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Photo <span className="small">(for every type except chat jokes)</span>
        <select name="photo_id" defaultValue={caption?.photo_id ?? defaultPhotoId ?? ""}>
          <option value="">— none —</option>
          {photos.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} {p.alt_text ? `· ${p.alt_text.slice(0, 60)}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Setup <span className="small">(chat jokes only: what the user said)</span>
        <input name="setup" maxLength={200} defaultValue={caption?.setup ?? ""} />
      </label>
      <label className="field">
        Caption
        <textarea name="caption_text" required maxLength={280} defaultValue={caption?.caption_text ?? ""} />
      </label>
    </>
  );
}

// Two-step delete without a browser confirm() dialog.
export function DeleteForm({
  action,
  id,
  what,
  warning,
}: {
  action: (form: FormData) => Promise<void>;
  id: number;
  what: string;
  warning: string;
}) {
  return (
    <details className="card" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)" }}>
      <summary style={{ cursor: "pointer", color: "var(--danger)", fontWeight: 600 }}>Delete this {what}…</summary>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        <input type="hidden" name="id" value={id} />
        <p className="small muted">{warning}</p>
        <button className="button danger" type="submit">
          Yes, permanently delete {what} #{id}
        </button>
      </form>
    </details>
  );
}
