import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/client",
  "/app",
  "/coach",
  "/accounts",
  "/categories",
  "/goals",
];

const isProtectedRoute = (pathname: string) =>
  protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  // Some OAuth provider/Supabase fallback setups may return to "/" with ?code=...
  // Normalize that into the dedicated callback route so session exchange always runs.
  if (
    request.nextUrl.pathname === "/" &&
    request.nextUrl.searchParams.has("code")
  ) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && request.nextUrl.pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/client";
    return NextResponse.redirect(redirectUrl);
  }

  if (user || !isProtectedRoute(request.nextUrl.pathname)) {
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.searchParams.set("next", request.nextUrl.pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
