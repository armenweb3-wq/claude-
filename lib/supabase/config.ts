// Single source of truth for whether Supabase credentials are present. The app
// is designed to render (with friendly "connect Supabase" states) even before
// these are set, so the client can preview the UI before wiring the backend.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
