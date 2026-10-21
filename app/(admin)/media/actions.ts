"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

const ANGLES = ["photo", "name", "both", "chat"];

function text(form: FormData, key: string, max: number) {
  const value = String(form.get(key) ?? "").trim();
  return value.slice(0, max);
}

function id(form: FormData, key: string) {
  const n = Number(form.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

// ---------------------------------------------------------------- captions --

function readCaption(form: FormData, back: string) {
  const caption_text = text(form, "caption_text", 281);
  const angle = text(form, "angle", 10);
  const photo_id = id(form, "photo_id");
  const setup = text(form, "setup", 201) || null;

  if (caption_text.length < 1 || caption_text.length > 280) fail(back, "Caption must be 1–280 characters.");
  if (!ANGLES.includes(angle)) fail(back, "Pick a caption type.");
  if (angle === "chat" && !setup) fail(back, "Chat jokes need a setup line.");
  if (angle !== "chat" && !photo_id) fail(back, "Photo captions need a photo.");
  if (setup && setup.length > 200) fail(back, "Setup must be 200 characters or fewer.");

  return {
    caption_text,
    angle,
    photo_id: angle === "chat" ? null : photo_id,
    setup: angle === "chat" ? setup : null,
  };
}

export async function createCaption(form: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/media/new";
  const values = readCaption(form, back);

  const { data, error } = await supabase.from("captions").insert(values).select("id").single();
  if (error) fail(back, error.message);

  revalidatePath("/media");
  redirect(`/media/${data.id}?saved=1`);
}

export async function updateCaption(form: FormData) {
  const { supabase } = await requireAdmin();
  const captionId = id(form, "id");
  if (!captionId) redirect("/media");
  const back = `/media/${captionId}`;
  const values = readCaption(form, back);

  const { error } = await supabase.from("captions").update(values).eq("id", captionId);
  if (error) fail(back, error.message);

  revalidatePath("/media");
  redirect(`${back}?saved=1`);
}

export async function deleteCaption(form: FormData) {
  const { supabase } = await requireAdmin();
  const captionId = id(form, "id");
  if (!captionId) redirect("/media");

  const { error } = await supabase.from("captions").delete().eq("id", captionId);
  if (error) fail(`/media/${captionId}`, error.message);

  revalidatePath("/media");
  redirect("/media?deleted=1");
}

// ------------------------------------------------------------------ photos --

export async function createPhoto(form: FormData) {
  const { supabase, user } = await requireAdmin();
  const back = "/media/photos";
  const image_url = httpsUrl(text(form, "image_url", 2000));
  const alt_text = text(form, "alt_text", 200) || null;
  if (!image_url) fail(back, "Image URL must start with https://");

  const { data, error } = await supabase
    .from("photos")
    .insert({ image_url, alt_text, user_id: user.id })
    .select("id")
    .single();
  if (error) fail(back, error.message);

  revalidatePath("/media/photos");
  redirect(`/media/photo/${data.id}?saved=1`);
}

export async function updatePhoto(form: FormData) {
  const { supabase } = await requireAdmin();
  const photoId = id(form, "id");
  if (!photoId) redirect("/media/photos");
  const back = `/media/photo/${photoId}`;
  const image_url = httpsUrl(text(form, "image_url", 2000));
  const alt_text = text(form, "alt_text", 200) || null;
  if (!image_url) fail(back, "Image URL must start with https://");

  const { error } = await supabase.from("photos").update({ image_url, alt_text }).eq("id", photoId);
  if (error) fail(back, error.message);

  revalidatePath("/media/photos");
  redirect(`${back}?saved=1`);
}

export async function deletePhoto(form: FormData) {
  const { supabase } = await requireAdmin();
  const photoId = id(form, "id");
  if (!photoId) redirect("/media/photos");

  // Captions, likes and votes cascade with the photo.
  const { error } = await supabase.from("photos").delete().eq("id", photoId);
  if (error) fail(`/media/photo/${photoId}`, error.message);

  revalidatePath("/media");
  redirect("/media/photos?deleted=1");
}
