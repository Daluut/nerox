import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/about", "/contact", "/pricing", "/security", "/api/stripe/webhook", "/opengraph-image"];

/** Refreshes the Supabase session on every request and guards app routes. */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Once a custom domain is live, send visitors from the old *.vercel.app
  // address to it. Preview deployments and API calls (Stripe) are left alone.
  const canonical = process.env.NEXT_PUBLIC_SITE_URL;
  if (canonical && process.env.VERCEL_ENV === "production" && !pathname.startsWith("/api/")) {
    const host = request.headers.get("host") ?? "";
    try {
      const target = new URL(canonical);
      if (host.endsWith(".vercel.app") && host !== target.host) {
        return NextResponse.redirect(new URL(pathname + request.nextUrl.search, target), 308);
      }
    } catch {
      // A malformed NEXT_PUBLIC_SITE_URL shouldn't take the site down.
    }
  }

  if (!url || !anonKey) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic && pathname !== "/setup") {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (user && (pathname === "/" || pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|product/|.*\\.(?:png|jpg|webp|svg|woff2?|xml|txt)$).*)"],
};
