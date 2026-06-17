---
description: Build, sanity-check, and deploy the marketplace to Vercel
---

Deploy the Catalyst marketplace to Vercel.

1. Run `npm run build` and fix any type/lint errors before going further.
2. Confirm the two env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are documented and that the user has them set
   in Vercel — the deploy is useless without them.
3. If a Vercel MCP connector is available (look for tools like
   `deploy_to_vercel` / `list_projects`), use it to trigger and monitor the
   deploy, then report the deployment URL and build status. If it isn't, give the
   user the manual steps from `docs/SETUP.md` Step 4.
4. After deploy, remind the user to set the Supabase **Site URL** to the new
   domain so auth emails link correctly.

Extra context / target from the user: $ARGUMENTS
