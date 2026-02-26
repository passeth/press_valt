import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Protected routes that require authentication
const PROTECTED_PATHS = [
  "/dashboard",
  "/collections",
  "/write",
  "/my-press",
  "/settings",
  "/admin",
];

// Public paths that don't require authentication
const PUBLIC_PATHS = ["/", "/articles", "/press", "/login", "/signup", "/api"];

function isPublicPath(pathname: string): boolean {
  // Allow all API routes
  if (pathname.startsWith("/api")) {
    return true;
  }

  // Allow exact public paths
  if (PUBLIC_PATHS.some((path) => pathname === path)) {
    return true;
  }

  // Allow /articles/* and /press/* sub-paths
  if (pathname.startsWith("/articles/") || pathname.startsWith("/press/")) {
    return true;
  }

  return false;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths without authentication check
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Update session and check authentication for protected paths
  const { supabaseResponse, user } = await updateSession(request);

  if (isProtectedPath(pathname)) {
    if (!user) {
      // Redirect unauthenticated users to login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }

    // Admin path protection
    if (pathname.startsWith("/admin")) {
      // For MVP: admin role check can be done in page components
      // Future: Add role verification here if needed
      // const { data: profile } = await supabase
      //   .from("profiles")
      //   .select("role")
      //   .eq("id", user.id)
      //   .single();
      // if (profile?.role !== "admin") {
      //   return NextResponse.redirect(new URL("/", request.url));
      // }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
