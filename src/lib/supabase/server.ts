import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createSupabaseServerClient = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // Server Components can't set cookies. Route handlers handle auth cookies.
      },
      remove() {
        // Server Components can't remove cookies.
      },
    },
  });
};
