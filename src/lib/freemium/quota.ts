import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkPremiumAccessServer } from "@/lib/domains/billing/entitlement-check";
import {
  computeFingerprintHash,
  extractFingerprintSignals,
  hashUa,
  normalizeIpToSubnet,
  type DeviceFingerprintSignals,
} from "./device-fingerprint";

export type FreemiumTier = "free" | "plus" | "family" | "ultra" | "school";

export type FreemiumCheckResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  tier: FreemiumTier;
  periodKey: string;
  fingerprintHash: string;
  bucketKey: string;
  reason?: "over_limit" | "blocked_abuse" | "not_configured";
  upgradeUrl?: string;
};

type QuotaRow = {
  free_daily_limit: number;
  free_monthly_limit: number | null;
  plus_daily_limit: number | null;
  family_daily_limit: number | null;
  ultra_daily_limit: number | null;
  school_daily_limit: number | null;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveLimitForTier(tier: FreemiumTier, row: QuotaRow): number {
  const pick =
    tier === "ultra"  ? row.ultra_daily_limit  :
    tier === "family" ? row.family_daily_limit :
    tier === "plus"   ? row.plus_daily_limit   :
    tier === "school" ? row.school_daily_limit :
    row.free_daily_limit;
  if (pick === null || pick === undefined) return row.free_daily_limit;
  return pick;
}

function mapPlanToTier(plan: string | null | undefined): FreemiumTier {
  if (!plan) return "plus";
  const p = plan.toLowerCase();
  if (p.includes("ultra"))  return "ultra";
  if (p.includes("family")) return "family";
  if (p.includes("school")) return "school";
  return "plus";
}

/**
 * Check a freemium quota. Must be called BEFORE any expensive AI backend call.
 *
 *   const q = await checkFreemiumQuota("photo_tutor", req, user?.id ?? null);
 *   if (!q.allowed) return buildFreemiumDeniedResponse(q);
 *   // ... expensive work ...
 *   await recordFreemiumUsage("photo_tutor", req, user?.id ?? null);
 */
export async function checkFreemiumQuota(
  featureKey: string,
  req: Request,
  userId?: string | null,
): Promise<FreemiumCheckResult> {
  const admin = createSupabaseAdminClient();
  const signals = extractFingerprintSignals(req);
  const fingerprintHash = computeFingerprintHash(signals);
  const periodKey = todayKey();

  // 1. Resolve tier
  let tier: FreemiumTier = "free";
  if (userId) {
    const entitlement = await checkPremiumAccessServer(admin, userId);
    if (entitlement.active) {
      tier = mapPlanToTier(entitlement.plan);
    }
  }

  // 2. Load quota config
  const { data: quotaRow } = await admin
    .from("freemium_quota_config")
    .select("free_daily_limit, free_monthly_limit, plus_daily_limit, family_daily_limit, ultra_daily_limit, school_daily_limit")
    .eq("feature_key", featureKey)
    .maybeSingle<QuotaRow>();

  const bucketKey = userId ? `u:${userId}` : `fp:${fingerprintHash}`;

  if (!quotaRow) {
    // Unknown feature — fail closed for anon, fail open for authed.
    return {
      allowed: Boolean(userId),
      used: 0,
      limit: 0,
      remaining: 0,
      tier,
      periodKey,
      fingerprintHash,
      bucketKey,
      reason: "not_configured",
    };
  }

  const limit = resolveLimitForTier(tier, quotaRow);

  // -1 is our sentinel for "unlimited".
  if (limit === -1) {
    return {
      allowed: true,
      used: 0,
      limit: -1,
      remaining: Number.MAX_SAFE_INTEGER,
      tier,
      periodKey,
      fingerprintHash,
      bucketKey,
    };
  }

  // 3. Abuse block check — device-side only (user-side quotas still apply
  //    per-feature if a paid subscription exists).
  if (!userId) {
    const { data: reg } = await admin
      .from("device_fingerprint_registry")
      .select("blocked_until")
      .eq("fingerprint_hash", fingerprintHash)
      .maybeSingle();
    if (reg?.blocked_until && new Date(reg.blocked_until) > new Date()) {
      return {
        allowed: false,
        used: limit,
        limit,
        remaining: 0,
        tier,
        periodKey,
        fingerprintHash,
        bucketKey,
        reason: "blocked_abuse",
        upgradeUrl: "/pricing",
      };
    }
  }

  // 4. Current usage
  const { data: row } = await admin
    .from("freemium_usage")
    .select("used")
    .eq("fingerprint_hash", bucketKey)
    .eq("feature_key", featureKey)
    .eq("period_key", periodKey)
    .maybeSingle<{ used: number }>();

  const used = row?.used ?? 0;
  const allowed = used < limit;

  return {
    allowed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    tier,
    periodKey,
    fingerprintHash,
    bucketKey,
    reason: allowed ? undefined : "over_limit",
    upgradeUrl: allowed ? undefined : "/pricing",
  };
}

/**
 * Increment the usage counter after a successful paid AI call. Also updates
 * the device registry so we can correlate and abuse-score across requests.
 *
 * Safe to fire-and-forget; it logs on failure but doesn't throw.
 */
export async function recordFreemiumUsage(
  featureKey: string,
  req: Request,
  userId?: string | null,
): Promise<number | null> {
  const admin = createSupabaseAdminClient();
  const signals = extractFingerprintSignals(req);
  const fingerprintHash = computeFingerprintHash(signals);
  const periodKey = todayKey();
  const bucketKey = userId ? `u:${userId}` : `fp:${fingerprintHash}`;
  const ipSubnet = normalizeIpToSubnet(signals.ip);
  const uaHash = hashUa(signals.userAgent);

  let newUsed: number | null = null;
  try {
    const { data } = await admin.rpc("freemium_increment_usage", {
      p_bucket_key: bucketKey,
      p_feature_key: featureKey,
      p_period_key: periodKey,
      p_user_id: userId ?? null,
      p_ip_subnet: ipSubnet,
      p_ua_hash: uaHash,
    });
    newUsed = (data as number | null) ?? null;
  } catch (err) {
    console.error("[freemium] increment_usage failed:", err);
  }

  // Registry upsert — best effort, ignore failures.
  try {
    await admin.from("device_fingerprint_registry").upsert(
      {
        fingerprint_hash: fingerprintHash,
        last_seen_at: new Date().toISOString(),
        linked_user_ids: userId ? [userId] : [],
        ip_subnets: [ipSubnet],
        ua_hashes: [uaHash],
        platform: signals.platform ?? null,
      },
      { onConflict: "fingerprint_hash", ignoreDuplicates: false },
    );
  } catch (err) {
    console.error("[freemium] registry upsert failed:", err);
  }

  return newUsed;
}

/** Canonical 429 response for a freemium denial. */
export function buildFreemiumDeniedResponse(result: FreemiumCheckResult): Response {
  const body = {
    error:
      result.reason === "blocked_abuse"
        ? "This device has been temporarily blocked due to unusual activity."
        : result.reason === "not_configured"
          ? "This feature is not currently available."
          : "You've reached today's free limit for this feature.",
    tier: result.tier,
    used: result.used,
    limit: result.limit,
    remaining: result.remaining,
    periodKey: result.periodKey,
    reason: result.reason,
    upgradeUrl: result.upgradeUrl ?? "/pricing",
  };
  return NextResponse.json(body, {
    status: 429,
    headers: {
      "Retry-After": "3600",
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
    },
  });
}

export { type DeviceFingerprintSignals };
