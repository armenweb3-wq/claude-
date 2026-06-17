"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type State = { error: string | null };

// --- Register ---------------------------------------------------------------
export async function registerAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  if (!isSupabaseConfigured)
    return { error: "Supabase isn't connected yet. See docs/SETUP.md." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "founder");

  if (!email || !password || !fullName)
    return { error: "Please fill in your name, email and password." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (role !== "founder" && role !== "investor")
    return { error: "Please choose whether you're a founder or an investor." };

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=1");
}

// --- Login ------------------------------------------------------------------
export async function loginAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  if (!isSupabaseConfigured)
    return { error: "Supabase isn't connected yet. See docs/SETUP.md." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password)
    return { error: "Please enter your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

// --- Logout -----------------------------------------------------------------
export async function logoutAction() {
  if (isSupabaseConfigured) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}
