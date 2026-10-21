"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setSuperadmin(form: FormData) {
  const { supabase, user } = await requireAdmin();
  const userId = String(form.get("user_id") ?? "");
  const value = form.get("value") === "true";

  if (!UUID.test(userId)) redirect("/users?error=" + encodeURIComponent("Unknown user."));
  if (userId === user.id) {
    redirect("/users?error=" + encodeURIComponent("You can't change your own admin status."));
  }

  const { error } = await supabase.rpc("admin_set_superadmin", { p_user_id: userId, p_value: value });
  if (error) redirect("/users?error=" + encodeURIComponent(error.message));

  revalidatePath("/users");
  redirect(`/users?${value ? "granted" : "revoked"}=1`);
}
