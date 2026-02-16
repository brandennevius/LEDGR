import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anonKey };
};

export async function POST(request: NextRequest) {
  try {
    const { factorId, code } = (await request.json()) as {
      factorId?: string;
      code?: string;
    };

    if (!factorId || !code?.trim()) {
      return NextResponse.json({ error: "Factor and code are required." }, { status: 400 });
    }

    const { url, anonKey } = getSupabaseConfig();
    const response = NextResponse.json({});
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

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json(
        { error: "Your session is missing or expired. Please sign in again." },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to verify MFA code." }, { status: 500 });
  }
}

