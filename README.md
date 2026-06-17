# Catalyst — startup ⇄ investor marketplace

A two-sided marketplace where **founders** list their startups and **investors**
publish their thesis, then discover and connect with each other. Built with
Next.js 14 (App Router), Tailwind, and Supabase (auth + Postgres).

- Public landing, **Startups** and **Investors** directories
- Email/password accounts; register as a founder or an investor
- Dashboard to build your listing and manage connection requests
- Owner-only **/admin** dashboard (registrations, totals, recent members)
- **/guide** — a plain-language roadmap for the owner and new members

> The original Mkhitaryan Developers property site still lives here at
> **`/property`**. The live-scores GitHub Action is unrelated (see `scripts/`).

## Quick start

```bash
npm install
cp .env.local.example .env.local   # then add your Supabase keys
npm run dev                        # http://localhost:3000
```

**Full setup — Supabase, admin access, and Vercel deploy — is in
[`docs/SETUP.md`](docs/SETUP.md).** The site runs without keys and shows
"connect Supabase" placeholders until you add them.

## Handy commands (Claude Code)

`/seed` · `/add-field` · `/make-admin` · `/deploy` — see `.claude/commands/`.
