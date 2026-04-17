/**
 * FORGE Tier Gate — pre-canonical variant.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  RULE: Free-tier users NEVER hit paid APIs (OpenAI, ElevenLabs, etc).  │
 * │  They receive ONLY pre-recorded / pre-seeded content. Cloud AI is     │
 * │  reserved for paid subscribers.                                        │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * This is the minimal / portable variant of the canonical tier-gate used
 * across every Koydo app. Unlike the full koydo_web version it depends on
 * ONLY the Supabase admin + server clients and a `subscriptions` table with
 * the standard shape (status, current_period_end, plan_id). It does not pull
 * in the canonical entitlements resolver, guided-access-response surface, or
 * elevated-role helpers.
 *
 * Usage in API routes:
 *
 *   import { requirePaidTier } from "@/lib/forge/tier-gate";
 *
 *   export async function POST(req: Request) {
 *     const gate = await requirePaidTier(req);
 *     if (gate) return gate; // 401 / 403 JSON response
 *     // ... proceed with paid AI call
 *   }
 *
 * Or as a boolean:
 *
 *   import { canUseCloudAI } from "@/lib/forge/tier-gate";
 *
 *   const allowed = await canUseCloudAI(userId);
 *   if (!allowed) return cachedFallback(); // serve from DB / JSON / R2
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TierGateResult = {
  allowed: boolean;
  plan: "free" | "monthly" | "annual";
  reason?: string;
};

/**
 * Returns true only for users with an active paid subscription.
 * Safe to call with a null / undefined userId (returns false).
 *
 * Fail-closed on any DB / auth error.
 */
export async function canUseCloudAI(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return false;
    if (data.current_period_end) {
      const exp = new Date(data.current_period_end as string);
      if (!Number.isNaN(exp.getTime()) && exp < new Date()) return false;
    }
    return true;
  } catch (err) {
    console.warn("[forge/tier-gate] canUseCloudAI failed, defaulting to free:", err);
    return false;
  }
}

/**
 * Full tier check with plan details. Same semantics as canUseCloudAI but
 * returns structured info for UI hints.
 */
export async function checkTier(userId: string | null | undefined): Promise<TierGateResult> {
  if (!userId) return { allowed: false, plan: "free", reason: "Not authenticated" };
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("subscriptions")
      .select("status, current_period_end, plan_id, stripe_price_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { allowed: false, plan: "free", reason: "No active subscription" };

    if (data.current_period_end) {
      const exp = new Date(data.current_period_end as string);
      if (!Number.isNaN(exp.getTime()) && exp < new Date()) {
        return { allowed: false, plan: "free", reason: "Subscription expired" };
      }
    }

    // Best-effort plan cadence inference — annual if the price id or plan contains "annual"/"year".
    const planHint = `${data.plan_id ?? ""} ${data.stripe_price_id ?? ""}`.toLowerCase();
    const cadence = /annual|year/.test(planHint) ? "annual" : "monthly";
    return { allowed: true, plan: cadence };
  } catch (err) {
    console.warn("[forge/tier-gate] checkTier failed:", err);
    return { allowed: false, plan: "free", reason: "Entitlement check error" };
  }
}

async function getUserIdFromRequest(_req: Request): Promise<string | null> {
  try {
    const sb = await createSupabaseServerClient();
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (err) {
    console.warn("[forge/tier-gate] getUser failed:", err);
    return null;
  }
}

/**
 * Middleware-style guard for API routes that require a paid subscription.
 * Returns a Response (401 / 403 JSON) if denied, or null if allowed.
 *
 * Canonical 401 shape:
 *   { error: "Authentication required.", upgradeUrl: "/auth/sign-in" }
 *
 * Canonical 403 shape:
 *   { error: "A premium subscription is required.", reason: <string>, upgradeUrl: "/pricing" }
 */
export async function requirePaidTier(req: Request): Promise<Response | null> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(
      JSON.stringify({
        error: "Authentication required.",
        upgradeUrl: "/auth/sign-in",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const tier = await checkTier(userId);
  if (tier.allowed) return null;

  return new Response(
    JSON.stringify({
      error: "A premium subscription is required to use this feature.",
      reason: tier.reason,
      upgradeUrl: "/pricing",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}
