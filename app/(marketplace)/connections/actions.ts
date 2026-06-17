"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type State = { error: string | null; ok?: boolean };

// A founder/investor reaches out to another user (the "matchmaking" action).
export async function sendConnection(
  _prev: State,
  formData: FormData,
): Promise<State> {
  if (!isSupabaseConfigured)
    return { error: "Supabase isn't connected yet. See docs/SETUP.md." };

  const toId = String(formData.get("to_id") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (!toId) return { error: "Missing recipient." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id === toId)
    return { error: "You can't connect with yourself." };

  const { error } = await supabase
    .from("connections")
    .upsert(
      { from_id: user.id, to_id: toId, message: message || null },
      { onConflict: "from_id,to_id" },
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// The recipient accepts or declines a pending request.
export async function respondToConnection(formData: FormData) {
  if (!isSupabaseConfigured) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "accepted" && status !== "declined")) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("connections")
    .update({ status })
    .eq("id", id)
    .eq("to_id", user.id);

  revalidatePath("/dashboard");
}
