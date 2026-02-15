import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/client";
  const next = requestedNext.startsWith("/") ? requestedNext : "/client";

  if (code) {
    const response = NextResponse.redirect(new URL(next, origin));
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    });

    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  return NextResponse.redirect(new URL(next, origin));
}
