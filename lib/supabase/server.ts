import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./config";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Server Supabase client — used in Server Components, Server Actions and Route
// Handlers. Reads/writes the auth session through Next's cookie store.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component. This can be
          // ignored if middleware is refreshing user sessions (it is).
        }
      },
    },
  });
}
