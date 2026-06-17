---
description: Add a new field to a startup or investor listing, end to end
---

Add a new field to the marketplace listings consistently across every layer.
The field to add is described in: $ARGUMENTS
(e.g. "add a 'pitch_deck_url' to startups" or "add 'team_size' to startups").

Touch ALL of these so nothing drifts out of sync:

1. **Database** — add the column (with a migration snippet) to
   `supabase/schema.sql`, and output a standalone `ALTER TABLE` the user can run
   on their existing Supabase project.
2. **Types** — add the field to the matching type in `lib/types.ts`.
3. **Save action** — read & persist it in
   `app/(marketplace)/dashboard/actions.ts` (`saveStartup` or `saveInvestor`).
4. **Form** — add an input to `components/marketplace/ListingForms.tsx`.
5. **Display** — show it on the detail page
   (`app/(marketplace)/startups/[id]/page.tsx` or `investors/[id]/page.tsx`) and,
   if useful, on the card in `components/marketplace/Cards.tsx`.

Then run `npm run build` to confirm types still pass.
