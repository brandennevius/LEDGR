import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/client",
  "/app",
  "/coach",
  "/accounts",
  "/categories",
  "/goals",
  "/mfa",
];

const isProtectedRoute = (pathname: string) =>
  protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

const isMfaRoute = (pathname: string) =>
  pathname === "/mfa" ||
  pathname.startsWith("/mfa/");

const isAuthUtilityRoute = (pathname: string) =>
  pathname.startsWith("/auth/");

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

  if (user && !isAuthUtilityRoute(request.nextUrl.pathname)) {
    const [{ data: aalData }, { data: factorsData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    const hasVerifiedFactor =
      (factorsData?.totp?.length ?? 0) > 0 ||
      (factorsData?.phone?.length ?? 0) > 0;
    const isAal2 = aalData?.currentLevel === "aal2";
    const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

    if (!hasVerifiedFactor && isProtectedRoute(request.nextUrl.pathname)) {
      if (request.nextUrl.pathname !== "/mfa/setup") {
        const setupUrl = request.nextUrl.clone();
        setupUrl.pathname = "/mfa/setup";
        setupUrl.searchParams.set("next", requestedPath);
        return NextResponse.redirect(setupUrl);
      }
    }

    if (hasVerifiedFactor && !isAal2 && isProtectedRoute(request.nextUrl.pathname)) {
      if (request.nextUrl.pathname !== "/mfa/challenge") {
        const challengeUrl = request.nextUrl.clone();
        challengeUrl.pathname = "/mfa/challenge";
        challengeUrl.searchParams.set("next", requestedPath);
        return NextResponse.redirect(challengeUrl);
      }
    }

    if (isMfaRoute(request.nextUrl.pathname) && hasVerifiedFactor && isAal2) {
      const next = request.nextUrl.searchParams.get("next");
      const destination =
        next && next.startsWith("/") ? next : "/client";
      return NextResponse.redirect(new URL(destination, request.url));
    }
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
