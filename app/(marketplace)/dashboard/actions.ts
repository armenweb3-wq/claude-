"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type State = { error: string | null; ok?: boolean };

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[^0-9.]/g, "");
  return s ? Number(s) : null;
}

// Save the founder's startup listing (one per user — upsert on owner_id).
export async function saveStartup(
  _prev: State,
  formData: FormData,
): Promise<State> {
  if (!isSupabaseConfigured)
    return { error: "Supabase isn't connected yet." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Your startup needs a name." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("startups").upsert(
    {
      owner_id: user.id,
      name,
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      sector: String(formData.get("sector") ?? "") || null,
      stage: String(formData.get("stage") ?? "") || null,
      location: String(formData.get("location") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      funding_goal: num(formData.get("funding_goal")),
      published: formData.get("published") === "on",
    },
    { onConflict: "owner_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// Save the investor's listing (one per user — upsert on owner_id).
export async function saveInvestor(
  _prev: State,
  formData: FormData,
): Promise<State> {
  if (!isSupabaseConfigured)
    return { error: "Supabase isn't connected yet." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Your investor profile needs a name." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sectors = formData.getAll("sectors").map(String).filter(Boolean);
  const stages = formData.getAll("stages").map(String).filter(Boolean);

  const { error } = await supabase.from("investors").upsert(
    {
      owner_id: user.id,
      name,
      thesis: String(formData.get("thesis") ?? "").trim() || null,
      sectors: sectors.length ? sectors : null,
      stages: stages.length ? stages : null,
      check_min: num(formData.get("check_min")),
      check_max: num(formData.get("check_max")),
      location: String(formData.get("location") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      published: formData.get("published") === "on",
    },
    { onConflict: "owner_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}
