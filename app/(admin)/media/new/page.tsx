import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createCaption } from "../actions";
import { CaptionFields, Flash } from "../shared";

export default async function NewCaptionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; photo?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { error, photo } = await searchParams;
  const { data: photos } = await supabase
    .from("photos")
    .select("id, alt_text")
    .order("id", { ascending: false });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/media">Captions</Link> / New
          </p>
          <h1>New caption</h1>
        </div>
      </div>
      <Flash error={error} />
      <form action={createCaption} className="card" style={{ maxWidth: 640 }}>
        <CaptionFields photos={photos ?? []} defaultPhotoId={Number(photo) || undefined} />
        <div className="toolbar">
          <button className="button primary" type="submit">
            Create caption
          </button>
          <Link href="/media/photos" className="small">
            Need a new photo first?
          </Link>
        </div>
      </form>
    </>
  );
}
