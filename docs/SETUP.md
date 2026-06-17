# Catalyst — setup & launch guide

Catalyst is the startup ⇄ investor marketplace that lives at `/` in this repo.
(The original Mkhitaryan property site still exists, now at `/property`.)

This guide takes you from zero to a live site. No prior experience needed —
follow it top to bottom.

---

## What you'll end up with

- A public website where **founders** and **investors** register, build a
  profile, browse the other side, and connect.
- A private **admin dashboard** (only you can see it) showing who registered.
- All data stored in your own **Supabase** database.
- Hosted on **Vercel**.

---

## Step 1 — Create the Supabase project (the backend)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**. Give it a name (e.g. `catalyst`), set a database password
   (save it somewhere), pick the region closest to your users, **Create**.
3. Wait ~2 minutes for it to provision.

### 1a. Load the database schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the **entire** file, paste it
   into the editor, and click **Run**.
3. You should see "Success". This creates all the tables, security rules, and the
   trigger that gives every new sign-up a profile automatically.

### 1b. Get your API keys

1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon public** key.

---

## Step 2 — Connect the keys locally

1. In the repo, copy `.env.local.example` to `.env.local`.
2. Paste your values:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

3. Run the site:

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>. Register a test account — it should appear in
   Supabase under **Table Editor → profiles**.

---

## Step 3 — Make yourself the admin

The first time, do this so you can see the admin dashboard:

1. Register on the site with your real email.
2. In Supabase → **SQL Editor**, run (use your email):

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Refresh the site. An **Admin** link now appears in the top navigation, and
   `/admin` shows your owner dashboard.

> **Email confirmation:** By default Supabase emails a confirmation link on
> sign-up. For quick testing you can turn this off at
> **Authentication → Providers → Email → "Confirm email" = off**. Turn it back
> on before launch.

---

## Step 4 — Deploy to Vercel (go live)

1. Push this repo to GitHub (already done if you're reading this there).
2. Go to <https://vercel.com> → **Add New… → Project** → import this repo.
3. Under **Environment Variables**, add the same two values from `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy**. In ~1 minute you get a live `*.vercel.app` URL.
5. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to
   your Vercel URL so confirmation emails link back correctly.

That's it — the platform is live.

---

## Where things are (for whoever edits the code)

| You want to change…             | Edit…                                            |
| ------------------------------- | ------------------------------------------------ |
| Brand name, tagline, sectors    | `data/site.ts`                                   |
| Landing page                    | `app/(marketplace)/page.tsx`                     |
| The guide / roadmap page        | `app/(marketplace)/guide/page.tsx`               |
| Database tables & security      | `supabase/schema.sql`                            |
| Sign-up / login logic           | `app/(marketplace)/auth/actions.ts`              |
| Listing forms                   | `components/marketplace/ListingForms.tsx`        |
| Admin dashboard                 | `app/(marketplace)/admin/page.tsx`               |

---

## A note on regulation

Catalyst is a **matchmaking** platform: it introduces founders and investors but
never holds or moves money. That deliberately keeps it clear of securities and
payments regulation. **If you ever decide to process real investments on the
platform, get legal advice first** — that changes the legal picture
significantly.
