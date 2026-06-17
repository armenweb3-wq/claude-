---
description: Generate demo founders & investors so the marketplace looks alive
---

Create realistic demo data for the Catalyst marketplace so the client can see a
populated site.

1. Read `data/site.ts` for the available `sectors` and `stages`, and
   `lib/types.ts` / `supabase/schema.sql` for the table shapes.
2. Generate a SQL file `supabase/seed.sql` that inserts ~6 startups and ~6
   investors with believable names, taglines, theses, sectors, stages, locations
   and check sizes.
   - These listings need owner profiles. Either: (a) write the SQL to create
     auth users is NOT possible from SQL — instead insert into `public.profiles`
     with generated UUIDs and matching `startups`/`investors` rows, and note at
     the top that these are demo rows not tied to real logins; or (b) if the user
     prefers, generate instructions to sign up the accounts through the UI.
3. Keep it idempotent where practical and clearly commented.
4. Tell the user to run it in Supabase → SQL Editor, and how to remove it later.

Arguments (optional): $ARGUMENTS may specify how many of each to create.
