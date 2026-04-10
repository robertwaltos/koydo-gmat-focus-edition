import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function resilientFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let attempt = 0;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, init);
      if (!response.ok && [503, 504].includes(response.status)) {
        throw new Error(`Upstream saturated: ${response.status}`);
      }
      return response;
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Resilient fetch exhausted.");
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: resilientFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Read-only during SSR page render — safe to swallow.
          }
        },
      },
    },
  );
}
