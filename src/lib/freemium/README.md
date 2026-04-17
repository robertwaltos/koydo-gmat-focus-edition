# Freemium abuse-prevention framework

One coherent system for enforcing free-tier quotas across every app in the Koydo portfolio — auth users, anonymous visitors, and every surface in between. Migration 466 ships the tables and RPC; this folder ships the TypeScript helpers.

## Why this exists

Per-user quotas alone are not enough. An abuser can:

1. Hit the quota → delete account → sign up again → reset bucket.
2. Hit the quota → switch to incognito → keep going.
3. Hit the quota → uninstall + reinstall the app → fresh bucket.
4. Hit the quota → roll through 50 throwaway emails.

None of these bypass a composite fingerprint that combines (device_id, /24 IP subnet, User-Agent hash). Changing all three at once costs friction most real abusers don't pay.

## The three guardrails

Every freemium-gated route applies three checks, in order:

1. **Auth check** — is there a user?
2. **Tier resolution** — free, plus, family, ultra, school?
3. **Quota check** — `checkFreemiumQuota(feature, req, userId)` → returns `{allowed, limit, remaining, reason}`.

After the expensive call, `recordFreemiumUsage(feature, req, userId)` increments the counter atomically via the `freemium_increment_usage` RPC.

## Tables

- `freemium_usage` — counter per `(fingerprint_hash, feature_key, period_key)`.  
  The `fingerprint_hash` column stores either `u:<user_id>` for signed-in users or `fp:<device-fp-hash>` for anonymous — the function picks whichever applies.
- `device_fingerprint_registry` — one row per fingerprint, with abuse score + blocked_until.
- `freemium_quota_config` — per-feature limits per tier, editable without a deploy.

## Server helpers

```ts
import {
  checkFreemiumQuota,
  recordFreemiumUsage,
  buildFreemiumDeniedResponse,
} from "@/lib/freemium/quota";
import { resolveTieredModel } from "@/lib/freemium/tiered-ai";
```

### Route template (freemium feature)

```ts
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Quota BEFORE the paid call.
  const q = await checkFreemiumQuota("photo_tutor", req, user?.id ?? null);
  if (!q.allowed) return buildFreemiumDeniedResponse(q);

  // Pick the right model for this tier.
  const model = resolveTieredModel(q.tier, "photo_tutor");

  // ... expensive AI call using model.provider / model.model ...

  // Record AFTER success.
  await recordFreemiumUsage("photo_tutor", req, user?.id ?? null);

  return NextResponse.json({ /* result */ });
}
```

### Route template (paid-only, no free quota)

For features where even the free tier gets zero calls (e.g. image generation), skip the quota layer and use `requirePaidTier` from `src/lib/forge/tier-gate.ts` instead.

## Client side

### Web

```tsx
import { fetchWithFingerprint } from "@/lib/freemium/client-fingerprint";

const res = await fetchWithFingerprint("/api/photo-tutor/scan", {
  method: "POST",
  body: formData,
});
if (res.status === 429) {
  const { upgradeUrl } = await res.json();
  router.push(upgradeUrl);
}
```

### Mobile (Flutter)

```dart
import 'package:koydo_mobile/core/monetization/device_fingerprint.dart';

final headers = await DeviceFingerprint.headers();
final res = await apiClient.post('/photo-tutor/scan', body: bytes, headers: headers);
if (res.statusCode == 429) {
  // Show upgrade CTA — server returns upgradeUrl in body.
}
```

## Tiered AI

`resolveTieredModel(tier, feature)` returns `{provider, model, maxTokens, temperature, costBand}`. Use it instead of hard-coding model names in route handlers, so a platform-wide model upgrade is a one-file change.

| Tier | Photo Tutor | AI Tutor | Essay Grader | Music Create |
|------|-------------|----------|--------------|--------------|
| free | haiku 4.5   | gpt-4o-mini | gpt-4o-mini | gpt-4o-mini |
| plus | haiku 4.5   | gpt-4o   | sonnet 4.6   | gpt-4o-mini |
| family | haiku 4.5 | sonnet 4.6 | sonnet 4.6 | gpt-4o-mini |
| ultra | sonnet 4.6 | opus 4.7 | opus 4.7    | gpt-4o     |

## Preload-first policy

Free users should never hit paid APIs if the same value can be served from a preloaded cache. Examples:

- **lingua/reader** — DB table of 5k pre-graded Meridian articles. AI generation is premium-only.
- **music listen** — 10 curated free songs per language, served from R2.
- **story-time** — 200 pre-authored stories in each locale.

Always prefer: try DB → try cache → if free user, return with `requiresUpgrade: true` → if paid user, fall back to live AI.

## Abuse detection cron

Every hour a background job runs:

```sql
SELECT freemium_detect_abuse(8); -- threshold: 8+ distinct user_ids on same fp
```

Fingerprints that exceed the threshold are blocked for 24h. A support tool can manually lift the block by nulling `blocked_until` on the registry row.

## Rotating the fingerprint salt

`FREEMIUM_FINGERPRINT_SALT` is a server env var. Changing it invalidates all existing fingerprint hashes (all anonymous users reset to zero usage). Do not rotate casually.

## What this does NOT do

- **Does not replace** tier-specific subscription checks for purely premium features. Use `requirePaidTier` for those.
- **Does not work for pre-rendered pages** — the fingerprint header is attached on the fetch, not on HTML navigation. Static pages remain fully public.
- **Does not de-dup across browsers on the same machine** — Chrome vs. Safari look like two devices. That's acceptable; the IP + UA tuple collapses them when quota is really the bottleneck.
