# KOYDO PAYWALL & ANTI-ABUSE MANDATE

> **Mandatory reading for every agent and every human engineer working on any Koydo app.**
> If you write or modify code that calls a paid AI backend, this document is the rule book.
> Non-compliance is a blocker for merge, for ship, and for the reviewer who let it through.

**Version:** 1.0 — 2026-04-17
**Scope:** All Koydo apps (current 120+, target 800+). Age-tier and locale flavors included without exception.
**Canonical source:** This file. Sibling copies in each repo must stay in sync. When in doubt, this copy wins.

---

## TL;DR — The six rules

1. **No paid AI call without a gate.** Period.
2. **Free-tier quotas must use device+IP fingerprint**, not user-id alone.
3. **Preload first, AI second.** Free users get pre-seeded content whenever possible.
4. **Tiered AI through one resolver.** No hard-coded model names in routes.
5. **Apply migration 466 to your Supabase project** before using the framework.
6. **Reviewers reject PRs that violate any of the above.** No exceptions.

---

## Rule 1 — No expensive AI backend call without a tier gate

Every API route (`src/app/api/**/route.ts`) that invokes **any** of the following MUST have a canonical gate before the paid call fires:

- **OpenAI**: `gpt-*`, `o1`, `o3`, Whisper (`audio.transcriptions`), TTS, DALL·E
- **Anthropic**: `claude-*` (Haiku, Sonnet, Opus) — any `messages.create` or `messages.stream`
- **Google**: `gemini-*`, `generativelanguage.googleapis.com`, Vertex AI
- **Image / video gen**: fal.ai, Replicate, Runway, Kling, Suno, Udio, Veo, Luma
- **Voice**: ElevenLabs, PlayHT, Azure Speech, Google Cloud TTS
- **Any OpenRouter / Together / Groq / Cohere / Mistral** endpoint

### Accepted gates (pick exactly one)

| Helper | Module | When to use |
|---|---|---|
| `requirePaidTier(req)` | `@/lib/forge/tier-gate` | Feature is paid-only. Blocks free tier entirely. |
| `canUseCloudAI(userId)` | `@/lib/forge/tier-gate` | You want to branch: free user gets cached path, paid user gets live AI. |
| `checkFreemiumQuota(feature, req, userId?)` | `@/lib/freemium/quota` | **Freemium with device+IP enforcement.** Required for any feature with a small free daily allowance (photo scan, essay grader demo, tutor demo). |
| `checkPhotoTutorDailyLimit(userId, sb)` | `@/lib/limits/ai-limits` | Photo tutor 3/day free quota — user-id bucket only. |
| `checkTutorDailyLimit(userId, sb)` | `@/lib/limits/ai-limits` | AI tutor daily quota — user-id bucket only. |
| `requireFeature('feature_id', req)` | `@/lib/platform/require-feature` | Full feature-registry gate (kill switch + env override + age tier + paywall + parent override). |

### Prohibited (these are NOT gates — adding only these is a bug)

- Auth check alone (`getUser()`)
- IP rate limit alone (`enforceIpRateLimit`)
- CSRF token alone (`validateCsrf`)
- COPPA age gate alone (`requireCoppaAiProcessing`)

These protect against drive-by abuse but not against:
- A signed-up free user burning tokens (auth alone doesn't stop them)
- VPN rotation (IP rate limit alone doesn't catch it)
- Account deletion + re-signup (user-id bucket alone can be reset)

**You must layer a real tier gate on top of these.**

---

## Rule 2 — Device + IP fingerprint is MANDATORY for free-tier features

User-id-based quotas can be bypassed by:
1. Delete account → sign up with a new email → fresh bucket.
2. Create 20 throwaway emails → farm them in rotation.
3. Log out → continue as anonymous.

The `checkFreemiumQuota` helper solves this by keying on a composite fingerprint:

```
SHA-256(FREEMIUM_FINGERPRINT_SALT | device_id | /24 IP subnet | UA hash | platform)
```

An abuser must change **all three** (device, network, user-agent) simultaneously to reset a bucket — costs more friction than the paid plan.

### Client requirement (non-negotiable)

**Web:** Use `fetchWithFingerprint(url, init)` from `@/lib/freemium/client-fingerprint` for every freemium-gated request. It attaches:
```
X-Koydo-Device-Id: <hex>
X-Koydo-Platform: web
```

**Mobile (Flutter):** Attach headers from `DeviceFingerprint.headers()` at `apps/mobile/lib/core/monetization/device_fingerprint.dart`:
```dart
final headers = await DeviceFingerprint.headers();
```

If the Flutter API client uses interceptors, add these headers to the default interceptor so no route accidentally ships without them.

### Server requirement

Every freemium route does this dance:

```ts
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const quota = await checkFreemiumQuota("photo_tutor", req, user?.id ?? null);
  if (!quota.allowed) return buildFreemiumDeniedResponse(quota);

  // ... paid AI call ...

  await recordFreemiumUsage("photo_tutor", req, user?.id ?? null);
  return NextResponse.json({ /* result */ });
}
```

**Record AFTER success** — never before. Failing to record on success is the main silent-drift bug.

---

## Rule 3 — Preload first, AI second

Free-tier users should never hit paid APIs when the value can be served from a cache, DB table, or bundled JSON.

Examples of the correct pattern:

| Feature | Preloaded source | Live fallback (paid) |
|---|---|---|
| Reading passages (lingua) | `lingua_articles` DB table (Meridian-seeded) | Gemini/OpenAI generation |
| Story time | `stories` table with 200 pre-authored stories/locale | GPT-4o-mini generation |
| Music listen | R2 bucket with 10 free songs/locale | — |
| Flashcards (curated) | `flashcard_catalog_decks` table | GPT-4o-mini deck generator |
| University lessons | `university_lessons` DB cache | GPT-4o-mini, paid-only |

Use `servePreloadFirst({ feature, quota, fetchPreloaded, fetchLive })` from `@/lib/freemium/preload-serve` — it composes the "try cache → 429 free / live AI paid" policy in one call.

**Default posture for new apps:** preload aggressively. Target 95%+ of free-tier requests served from preload, never from live AI.

---

## Rule 4 — Tiered AI through one resolver

**Never** hard-code model names in route handlers. Always:

```ts
import { resolveTieredModel } from "@/lib/freemium/tiered-ai";
const model = resolveTieredModel(quota.tier, "ai_tutor");
// model.provider, model.model, model.maxTokens, model.temperature, model.costBand
```

A tier upgrade or model rev is then a one-file change in `tiered-ai.ts`, not a 50-repo grep.

---

## Rule 5 — Migration 466 must be applied to your Supabase project

The framework reads and writes:
- `public.freemium_usage`
- `public.device_fingerprint_registry`
- `public.freemium_quota_config`
- `public.freemium_increment_usage(...)` RPC
- `public.freemium_detect_abuse(...)` RPC

Migration file: `koydo_web/supabase/migrations/466_freemium_abuse_prevention.sql`.

### If your app uses the shared Koydo Supabase (`osnxbuusohdzzcrakavn`)

Nothing to do — the migration has been applied there.

### If your app uses a dedicated Supabase project

Copy migration 466 into your project's migrations directory and apply it. Numbering must be preserved as the gates reference it by SQL contract.

### Required env var

`FREEMIUM_FINGERPRINT_SALT` (min 16 chars) — set once per Supabase project, treat as a stable secret, do NOT rotate casually (rotating wipes all fingerprint hashes).

---

## Rule 6 — Hard review criteria

For any PR that touches or adds an API route calling a paid AI backend, the reviewer (human or agent) must verify:

- [ ] One of the gates from Rule 1 is present at the top of the POST/GET handler, BEFORE the paid call.
- [ ] Freemium routes call `recordFreemiumUsage` AFTER the paid call succeeds.
- [ ] Model selection goes through `resolveTieredModel` — no raw `"gpt-4o-mini"` strings in the route.
- [ ] Client calls use `fetchWithFingerprint` (web) or `DeviceFingerprint.headers()` (Flutter) for freemium routes.
- [ ] The route does NOT echo raw AI service errors (`err.message` from OpenAI/Anthropic) to the client — use `toSafeErrorRecord` or equivalent sanitizer.

If ANY item fails: reject the PR. No exceptions for "it's just a small endpoint."

---

## Onboarding a new app

### When you create a new Koydo app (age-tier flavor, locale flavor, or subject app):

**Step 1** — Verify the core helpers exist:

```bash
ls src/lib/forge/tier-gate.ts   # canonical tier check
ls src/lib/freemium/            # this framework
```

If `src/lib/freemium/` is missing, run the installer (Step 2). If `tier-gate.ts` is missing, the repo is not using the canonical architecture — STOP and escalate.

**Step 2** — Install freemium if missing:

```bash
# From within the target app repo
bash ../koydo_web/scripts/install-freemium.sh
```

Or manually copy `src/lib/freemium/` from any up-to-date sibling (koydo_web, koydo-matura).

**Step 3** — Add `FREEMIUM_FINGERPRINT_SALT` to:
- `.env.local` (dev)
- Vercel production env
- Any staging env

Generate with `openssl rand -hex 24`.

**Step 4** — Write your first gated route using the template:

```ts
import { checkFreemiumQuota, recordFreemiumUsage, buildFreemiumDeniedResponse } from "@/lib/freemium/quota";
import { resolveTieredModel } from "@/lib/freemium/tiered-ai";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const quota = await checkFreemiumQuota("ai_tutor", req, user?.id ?? null);
  if (!quota.allowed) return buildFreemiumDeniedResponse(quota);

  const model = resolveTieredModel(quota.tier, "ai_tutor");

  // ... expensive call using model.provider / model.model ...

  await recordFreemiumUsage("ai_tutor", req, user?.id ?? null);
  return NextResponse.json({ /* result */ });
}
```

**Step 5** — Add the feature_key to `freemium_quota_config` if it's new:

```sql
INSERT INTO freemium_quota_config (feature_key, free_daily_limit, plus_daily_limit, family_daily_limit, ultra_daily_limit, description)
VALUES ('my_new_feature', 2, 30, 30, 100, 'My new AI-powered widget');
```

### When you create 800 new age/locale flavors of an existing app:

- Flavors that share the same Supabase project need no migration action.
- Flavors that share the same `src/` (generated from a template) inherit `src/lib/freemium/` automatically.
- If your flavor pipeline uses `git subtree`, `yeoman`, or a code generator, the generator MUST include `src/lib/freemium/` and the mandate doc. Update the generator template, not the outputs.

---

## FAQ for future agents

### "Can I just use requireAuth + IP rate limit?"

No. That's exactly what existed before this mandate was written, and a sweep in April 2026 found 27 routes bleeding tokens because of it.

### "The feature has a free daily quota. Which gate do I use?"

`checkFreemiumQuota` — it handles both free and paid tiers, and it's the only gate that enforces device+IP fingerprinting. `checkPhotoTutorDailyLimit` / `checkTutorDailyLimit` are legacy helpers that only bucket by user-id; they're still OK to leave in place if they exist, but for new routes use the freemium helper.

### "The feature is paid-only with no free tier. Which gate?"

`requirePaidTier(req)`. Simpler and matches the canonical pattern.

### "I'm calling an LLM for internal admin tooling."

Use `requireOwnerForApi` or `requireAdmin` — owner/admin-only routes don't need the paywall layer.

### "What if my feature legitimately needs a free daily quota but no device ID?"

Still use `checkFreemiumQuota`. When the client doesn't send `X-Koydo-Device-Id`, the helper falls back to IP + UA alone — less precise, but still better than raw IP rate-limit.

### "The route is anonymous-accessible on purpose (e.g., a public demo)."

Use `checkFreemiumQuota` with `userId = null`. The fingerprint bucket will be keyed on `fp:<hash>`. See `koydo-matura/src/app/api/matura/tutor-demo/route.ts` for the canonical example.

### "What if someone rotates IPs with mobile data + uses a fresh install?"

That's the hardest abuse vector. The mitigations:
1. `freemium_detect_abuse(8)` cron catches fingerprints that accumulate 8+ distinct user_ids in 24h.
2. Per-feature rate limit via `enforceIpRateLimit` caps the damage to a few calls/minute.
3. RevenueCat signup funnel friction (email confirmation, IAP) costs more than a paid plan for a determined abuser.

If a new vector is discovered, escalate — don't work around it silently.

---

## Lineage

- **2026-04-17**: Mandate created after an all-night sweep fixed 27 ungated AI routes across 12 repos and shipped `src/lib/freemium/` + migration 466. The scale (800+ app target) forces a codified rule rather than case-by-case enforcement.

If this file is older than 6 months without a review, treat it as stale and flag to the CRO.
