---
description: Produce the SQL to promote a registered user to platform admin
---

The owner wants to grant admin rights (access to `/admin`) to a registered user.

The email is: $ARGUMENTS

Output the exact SQL for them to paste into Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = '<EMAIL>');
```

Substitute the email. Remind them the person must have registered on the site
first, and that the "Admin" link appears after they refresh. If no email was
given in the arguments, ask for it.
