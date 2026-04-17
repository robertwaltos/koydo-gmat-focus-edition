import { createHash } from "node:crypto";

/**
 * Inputs to the freemium device fingerprint.
 *
 * The hash combines three things that an abuser would have to change
 * simultaneously to reset a quota bucket:
 *   - deviceId: persisted in IndexedDB on web, secure storage on native
 *   - ip subnet: /24 for IPv4, /64 for IPv6 (normalized from x-forwarded-for)
 *   - UA hash: short SHA-256 of User-Agent
 *
 * A VPN + incognito + reinstall together is the only reliable reset, and
 * that costs friction most real abusers won't pay. For signed-in users the
 * quota is keyed on user_id instead so a paying account is never penalized
 * for roaming onto a café network.
 */
export type DeviceFingerprintSignals = {
  deviceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  platform?: "web" | "ios" | "android" | null;
};

const FP_SALT = process.env.FREEMIUM_FINGERPRINT_SALT ?? "koydo_fp_v1_replace_me_in_prod";

export function normalizeIpToSubnet(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const clean = ip.trim().split(",")[0]?.trim() ?? "";
  if (!clean) return "unknown";
  if (clean.includes(":")) {
    // IPv6 → /64
    const groups = clean.split(":").slice(0, 4);
    return groups.join(":") + "::/64";
  }
  const parts = clean.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  return clean;
}

export function hashUa(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  return createHash("sha256").update(ua, "utf8").digest("hex").slice(0, 16);
}

export function computeFingerprintHash(signals: DeviceFingerprintSignals): string {
  const deviceId = signals.deviceId?.trim() ?? "";
  const subnet = normalizeIpToSubnet(signals.ip);
  const uaHash = hashUa(signals.userAgent);
  const platform = signals.platform ?? "";
  const input = [FP_SALT, deviceId, subnet, uaHash, platform].join("|");
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Extract fingerprint signals from a Next.js / Web Request. */
export function extractFingerprintSignals(req: Request): DeviceFingerprintSignals {
  const h = req.headers;
  return {
    deviceId: h.get("x-koydo-device-id") ?? h.get("x-device-id") ?? null,
    ip: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent"),
    platform: (h.get("x-koydo-platform") ?? null) as DeviceFingerprintSignals["platform"],
  };
}
