# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Four unrelated things share this repo:

1. **Catalyst — the startup ⇄ investor marketplace** (primary) — a Next.js App
   Router app served at `/`. Accounts (Supabase auth), founder/investor listings,
   a connection/matchmaking flow, an owner-only admin dashboard, and a `/guide`
   roadmap. Full setup in `docs/SETUP.md`. This is what most work targets now.
2. **The Mkhitaryan Developers website** — the original cinematic, scroll-driven
   landing page for a Paphos, Cyprus luxury property developer. Still here, now
   served at `/property` (relocated into `app/(property)/`).
3. **Hustle Blends — the barbershop booking page** (`hustleblends.cc`) — a
   self-contained dark/brass landing + reservation flow served at `/barber`
   (`app/(barber)/`). No Supabase or external deps: content lives in
   `data/barber.ts`, sections in `components/barber/`, and the multi-step booking
   widget POSTs to `app/api/barber/booking/route.ts` (a stub — wire to a real
   backend before going live). Placeholder imagery is SVGs in `public/barber/`.
4. **A live-scores automation** — `scripts/fetch-scores.mjs` plus
   `.github/workflows/scores.yml`, a standalone GitHub Action unrelated to the
   websites. It is *not* part of the Next.js build (it's excluded in `tsconfig`).

`npm run dev/build` operates on all three web apps together.

## Marketplace (Catalyst) — architecture

- **Two root layouts.** There is no `app/layout.tsx`. Instead the repo uses
  Next.js multiple-root-layouts: `app/(marketplace)/layout.tsx` (the marketplace,
  at `/`) and `app/(property)/layout.tsx` (the property site, at `/property`).
  Each renders its own `<html>`/`<body>`. Don't reintroduce a single root layout.
- **Supabase** powers auth + Postgres. Clients live in `lib/supabase/`
  (`client.ts` browser, `server.ts` server components/actions, `middleware.ts`
  session refresh + route guards). `lib/supabase/config.ts` exposes
  `isSupabaseConfigured` — every data path is guarded by it so the site renders
  (with "connect Supabase" placeholders) before keys exist. Keep that guard.
- **Schema + RLS** live in `supabase/schema.sql` (run it in the Supabase SQL
  editor). One listing per user (unique `owner_id`); admin access flows through a
  `SECURITY DEFINER` `is_admin()` function to avoid policy recursion.
- **Brand/config** is centralized in `data/site.ts` (name, tagline, sectors,
  stages) — the intended single edit point.
- **Roles:** `founder | investor | admin`. `admin` is assigned by SQL, never
  self-selected; the admin dashboard is `/admin`.
- Project slash commands live in `.claude/commands/` (`/seed`, `/add-field`,
  `/make-admin`, `/deploy`).

## Website — commands

```bash
npm install        # once
npm run dev        # local dev server (localhost:3000)
npm run build      # production build + type check + lint
npm run lint       # eslint (next/core-web-vitals)
npm start          # serve the production build
```

## Website — architecture

- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind v3, GSAP + ScrollTrigger,
  Lenis smooth scroll, `next/image`. Fonts via `next/font` (Cormorant Garamond serif
  + Inter sans, exposed as `--font-serif` / `--font-sans` CSS vars).
- **`app/page.tsx`** composes six sections top-to-bottom: `Hero` → `Journey` →
  `WhyPaphos` → `FullService` → `Portfolio` → `Contact`.
- **`components/SmoothScroll.tsx`** is the animation backbone: it runs Lenis and
  bridges it to GSAP via `gsap.ticker` + `ScrollTrigger.update`. It wraps the whole
  app in `app/layout.tsx`. **All ScrollTrigger pinning depends on this bridge** —
  don't reintroduce native smooth-scroll or a second raf loop.
- **`lib/gsap.ts`** is the *only* place ScrollTrigger is registered, and exports
  `prefersReducedMotion()`. Every animated component early-returns on reduced motion;
  `Journey` additionally renders a separate static stacked fallback. Honor this
  pattern when adding animation.
- **`components/sections/Journey.tsx`** is the cinematic centerpiece: a pinned stage
  that cross-dissolves through developments and climaxes on the flagship. It reads
  `data/developments.ts` in array order and treats the entry flagged
  `flagship: true` as the climax — **keep the flagship last**.
- **Content & assets live in `data/`** (`developments.ts`, `content.ts`) — these are
  the intended edit/swap points. Imagery is placeholder **SVGs** under
  `public/assets/` served through `next/image` (`dangerouslyAllowSVG` is enabled in
  `next.config.mjs` for this reason). Swap in real `.jpg`/`.mp4` by replacing files
  and updating the paths in `data/developments.ts`; tighten the image CSP afterward.
- The contact form (`Contact.tsx`) has **no backend** — `handleSubmit` just toggles a
  thank-you state. Wire it to an API route / CRM before production.

## Running locally

`scripts/fetch-scores.mjs` is a standalone ESM script run with plain Node (uses
the built-in global `fetch`, so Node 18+; CI pins Node 20). It takes no install step.

```bash
FOOTBALL_DATA_TOKEN=<your-free-api-key> node scripts/fetch-scores.mjs
```

It reads/writes `live.json` in the current working directory. The token is a free
key from football-data.org; in CI it comes from the `FOOTBALL_DATA_TOKEN` repo secret.

## Architecture / things to know

- **Two-stage change detection.** The script only treats the run as a *score*
  change when the `matches` array differs from the previous `live.json`; otherwise
  it still rewrites the file (refreshing `updatedAt`) and exits 0. The
  workflow's separate `git diff --quiet -- live.json` check is what actually
  decides whether to commit — so a pure `updatedAt` bump never produces a commit.
  Keep both halves of this logic in sync if you change the output shape.

- **The data window is yesterday → tomorrow (UTC)** so a run catches recently
  finished, in-play, and upcoming matches. Match `status` values from the API are
  `SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED`.

- **The workflow commits to a different branch than the default.**
  `.github/workflows/scores.yml` checks out and pushes to
  `claude/world-cup-betting-strategy-tsvivl` (not `main`), runs every 5 minutes
  on a best-effort cron, and can be triggered manually via `workflow_dispatch`.
  Commits use `[skip ci]` and a `concurrency` group to avoid overlapping/looping
  runs. If you rename the target branch, update the `ref:` in the checkout step.
