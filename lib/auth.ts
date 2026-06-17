import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile } from "@/lib/types";

// Returns the signed-in user's auth record + profile row, or nulls. Safe to call
// before Supabase is configured (returns nulls instead of throwing).
export async function getCurrentUser() {
  if (!isSupabaseConfigured) {
    return { user: null, profile: null as Profile | null };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) ?? null };
}
