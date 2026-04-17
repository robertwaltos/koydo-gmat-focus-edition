# AGENT ROUTING — leaf repo

**You are reading this inside a Koydo **leaf** repo** (one of ~150 per-exam or per-app repos under `github.com/robertwaltos/koydo-*`).

**This repo is NOT the main app.** It is a per-exam or per-app scaffold. If you're here to write major code, you are probably in the wrong repo.

---

## Layout (typical leaf)

```
koydo-<slug>/
├── pricing.json            ← per-app pricing (US + PPP), auto-generated
├── src/                    ← Next.js skeleton ("Add minimum-viable Next.js skeleton" commit)
├── public/
├── package.json
├── README.md
└── .gitignore
```

Most leaves are **Next.js scaffolds** that redirect or embed views from the main `koydo-web` app. Some have grown richer (koydo-distill, koydo-matura).

---

## Rule 1 — STAY IN YOUR LANE

You may write to:

- `pricing.json`                          — per-app pricing (canonical at `shared/per_app_pricing.json`; this is a denormalized copy)
- `README.md`, `STORE_LISTING.json`       — per-app metadata
- `src/`, `public/`, `app/` (if Next.js)  — per-app UI scaffolding only
- Per-app `vercel.json`, `package.json`, `next.config.ts`

You must **NEVER** write to:

- Anywhere **outside** this repo's working directory — that's a different repo.
- Shared Koydo systems (Cortex, KoydoSense, Meridian, learner_graph_unified, etc.) — those live in `koydo-web` and are protected or canonical there.

If the work belongs elsewhere, **stop and route**:

| If you are writing… | Go to… |
|---|---|
| Core Next.js app logic, API routes, migrations | `koydo-web` (`/Users/robertwaltos/Koydo/koydo_web`) |
| Flutter / Dart code, mobile package | `koydo-mobile` (`/Users/robertwaltos/Koydo/koydo_mobile`) |
| Strategic docs (flywheel, marketing, NGO, pricing master) | `koydo` umbrella (`/Users/robertwaltos/Koydo/`) |
| Pricing for MULTIPLE apps at once | `koydo` umbrella `shared/per_app_pricing.json` (then regenerate this leaf's `pricing.json` from the master) |

---

## Rule 2 — PULL BEFORE YOU PUSH

```bash
git pull --rebase origin $(git branch --show-current)
```

Default branch varies (`main` in most leaves; `master` in some — check `git branch --show-current` first).

---

## Rule 3 — NEVER FORCE-PUSH + NEVER `git init`

Same rules as the parent repos:

- `git push --force` / `--force-with-lease` banned without explicit human approval.
- Never `git init` inside an existing repo. Check `git rev-parse --show-toplevel` first.

---

## Rule 4 — THIS LEAF IS ALSO A SUBMODULE

This repo is referenced as a git submodule inside the umbrella at `github.com/robertwaltos/koydo`. When you commit + push here, the umbrella's view of this leaf goes stale until someone bumps its pointer.

**You do NOT need to bump the umbrella pointer yourself.** The nightly marathon walks every submodule and bumps pointers on a schedule.

---

## Rule 5 — PRICING FILES

`pricing.json` in this leaf is **derived** from the canonical `shared/per_app_pricing.json` in the umbrella. To update prices:

1. Edit `shared/per_app_pricing.json` in the umbrella.
2. Run `node scripts/flywheel-pricing-per-app.mjs` in `koydo-web` — it regenerates every leaf's `pricing.json`.
3. Each leaf's `pricing.json` is overwritten and committed per-leaf.

**Do not hand-edit this leaf's `pricing.json`** — your edit will be stomped on the next regeneration.

---

## Rule 6 — WHEN IN DOUBT, ASK

If you find yourself wanting to create meaningful new functionality in a leaf repo, stop. 95% of new features belong in `koydo-web` (web) or `koydo-mobile` (mobile), not in a leaf. Ask the human operator before expanding scope here.
