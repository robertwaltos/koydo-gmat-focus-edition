import { type NextRequest, NextResponse } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Public routes that do NOT require authentication.
 * Everything else (learn, practice, results, etc.) requires a logged-in user.
 */
const PUBLIC_PREFIXES = ["/auth", "/api", "/pricing", "/privacy", "/terms", "/sampler"];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);

  // Gate protected routes — redirect unauthenticated users to sign-in
  if (!isPublicRoute(request.nextUrl.pathname) && !user) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)",
  ],
};
