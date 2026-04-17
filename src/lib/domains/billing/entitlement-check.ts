/**
 * Premium entitlement check — pre-canonical variant.
 *
 * Returns whether a user has an active paid subscription. Backed by the
 * standard `subscriptions` table (status + current_period_end + plan_id).
 *
 * This is the minimal portable implementation used by Koydo apps that
 * haven't yet been upgraded to the full canonical billing architecture.
 * Shape matches `checkPremiumAccessServer` in koydo_web, so the freemium
 * framework (src/lib/freemium/quota.ts) can import it without caring
 * whether the host app is canonical or pre-canonical.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EntitlementResult = {
  active: boolean;
  source: "supabase" | "none" | "error";
  plan?: string | null;
  expiresAt?: string | null;
  isInTrial?: boolean;
};

export async function checkPremiumAccessServer(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<EntitlementResult> {
  if (!userId) return { active: false, source: "none" };
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, plan_id, stripe_price_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { active: false, source: "error" };
    }
    if (!data) return { active: false, source: "supabase" };

    if (data.current_period_end) {
      const exp = new Date(data.current_period_end as string);
      if (!Number.isNaN(exp.getTime()) && exp < new Date()) {
        return {
          active: false,
          source: "supabase",
          plan: (data.plan_id as string | null) ?? null,
          expiresAt: data.current_period_end as string,
        };
      }
    }

    const planHint = `${data.plan_id ?? ""} ${data.stripe_price_id ?? ""}`.toLowerCase();
    // Light plan-tier inference from plan_id / stripe_price_id. Apps that need
    // accurate tier mapping should keep their canonical-pricing table wired
    // and override this helper at the app level.
    let plan = (data.plan_id as string | null) ?? "plus";
    if (/ultra/.test(planHint))       plan = "ultra";
    else if (/family/.test(planHint)) plan = "family";
    else if (/school/.test(planHint)) plan = "school";
    else if (/plus/.test(planHint) || !data.plan_id) plan = "plus";

    return {
      active: true,
      source: "supabase",
      plan,
      expiresAt: (data.current_period_end as string | null) ?? null,
      isInTrial: data.status === "trialing",
    };
  } catch {
    return { active: false, source: "error" };
  }
}
