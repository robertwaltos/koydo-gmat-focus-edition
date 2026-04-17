/**
 * Preload-first serving helper.
 *
 * Canonical pattern for every freemium feature: prefer pre-seeded content
 * over live AI. Free users should never hit paid APIs if the same value
 * can be served from a cache.
 *
 * Each route provides:
 *   - fetchPreloaded(): Promise<T | null>  — DB lookup, JSON bundle, R2 object, etc.
 *   - fetchLive():      Promise<T>         — the paid AI path
 *
 * This helper composes the policy:
 *   1. Always try preloaded first.
 *   2. Free users + quota exhausted → return preloaded even if stale; if
 *      nothing preloaded, return 429 with upgrade URL.
 *   3. Paid users: fall through to live AI when preload misses.
 */

import { NextResponse } from "next/server";
import {
  buildFreemiumDeniedResponse,
  type FreemiumCheckResult,
} from "./quota";

export type PreloadServeOptions<T> = {
  feature: string;
  quota: FreemiumCheckResult;
  fetchPreloaded: () => Promise<T | null>;
  fetchLive?: () => Promise<T>;
  /** Marker added to the response envelope so clients can distinguish. */
  preloadSource?: string;
  /** If true, even paid users try preload first (cache warmth). Default true. */
  preferPreloadForPaid?: boolean;
};

export type PreloadServeResult<T> =
  | { ok: true; data: T; source: "preload" | "live"; tier: string; upsell: false; response: Response }
  | { ok: true; data: T; source: "preload"; tier: string; upsell: true;  response: Response }
  | { ok: false; response: Response };

export async function servePreloadFirst<T extends object>(
  opts: PreloadServeOptions<T>,
): Promise<PreloadServeResult<T>> {
  const { quota, fetchPreloaded, fetchLive, preloadSource, preferPreloadForPaid = true } = opts;

  // 1. Try preloaded first.
  if (preferPreloadForPaid || quota.tier === "free") {
    try {
      const hit = await fetchPreloaded();
      if (hit) {
        const body = {
          ...hit,
          source: preloadSource ?? "preload",
          tier: quota.tier,
          limit: quota.limit,
          remaining: quota.remaining,
        };
        return {
          ok: true,
          data: hit,
          source: "preload",
          tier: quota.tier,
          upsell: false,
          response: NextResponse.json(body),
        };
      }
    } catch (err) {
      console.warn("[freemium/preload] fetchPreloaded failed:", err);
    }
  }

  // 2. Free user + no preload + quota exhausted → 429 with upsell.
  if (quota.tier === "free" && !quota.allowed) {
    return { ok: false, response: buildFreemiumDeniedResponse(quota) };
  }

  // 3. Free user + no preload + quota available → live AI (consumes quota).
  // 4. Paid user + no preload → live AI.
  if (!fetchLive) {
    // Caller didn't provide a live fallback; treat as empty.
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Content unavailable",
          source: "none",
          tier: quota.tier,
          upgradeUrl: quota.tier === "free" ? "/pricing" : undefined,
        },
        { status: 503 },
      ),
    };
  }

  try {
    const live = await fetchLive();
    const body = {
      ...live,
      source: "live",
      tier: quota.tier,
      limit: quota.limit,
      remaining: Math.max(0, quota.remaining - 1),
    };
    return {
      ok: true,
      data: live,
      source: "live",
      tier: quota.tier,
      upsell: false,
      response: NextResponse.json(body),
    };
  } catch (err) {
    console.error("[freemium/preload] fetchLive failed:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "AI service temporarily unavailable", source: "error" },
        { status: 502 },
      ),
    };
  }
}
