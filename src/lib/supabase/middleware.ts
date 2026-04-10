import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export interface SupabaseSessionResult {
  response: NextResponse;
  user: import("@supabase/supabase-js").User | null;
}

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<SupabaseSessionResult> {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response, user: null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            domain: process.env.NODE_ENV === "production" ? ".koydo.app" : undefined,
          }),
        );
      },
    },
  });

  let user: import("@supabase/supabase-js").User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    // Continue as anonymous
  }
  return { response, user };
}
