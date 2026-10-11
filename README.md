# Lost & Found Matcher

The frontend is a React/Vite app connected to Supabase Auth, Postgres, Row Level Security, Storage, and database functions. It does not require a separate backend server.

## Files

- `supabase/migrations/20261011010000_lost_found_backend.sql` — schema, policies, Storage bucket, profile trigger, matching, claim review, and staff dashboard RPCs.
- `frontend/src/lib/supabase.ts` — browser Supabase client. Uses only the public publishable key.
- `frontend/src/lib/lost-found/` — typed Auth and data access functions plus the canonical values from the installed skills.
- `.env.example` — Vite environment variable names.

The supplied Figma ZIP is preserved at `references/figma-export.zip`; the app keeps its React/Vite layout and Figma styling. The export's TypeScript config included only Node types, which made JSX elements red in the editor. `frontend/tsconfig.json` now explicitly includes the React JSX types.

## Run locally

1. Create `frontend/.env.local` from the root `.env.example` and fill in your Supabase project URL and publishable key.
2. Apply `supabase/migrations/20261011010000_lost_found_backend.sql` to your Supabase project. The migration creates the tables, policies, storage bucket, and matching functions used by the app.
3. Open PowerShell in `frontend/` and run:

   ```sh
   pnpm install
   pnpm dev
   ```

4. Open `http://localhost:8443/`.

If Supabase is not configured yet, the Figma landing and login pages still open and show a setup message. Authentication, reports, matches, and staff pages need a real Supabase Project URL, Publishable key, and the migration applied.

Never put a `service_role` or secret key in Vite variables. The frontend uses only the public publishable key.

If email confirmation is enabled for the Supabase project, signup returns before the user has an active session. Keep the app on its signup/confirmation state until the user confirms and signs in.

## Security model

- Profiles are created by an Auth trigger. New accounts always receive the `user` role; signup metadata cannot assign `staff`.
- Users can read their own lost reports; staff can read all lost reports. Signed-in users can read found items to view matches; only staff can create or update found items.
- All exposed tables have RLS. SQL grants are explicit because new public tables may not automatically be exposed through the Data API.
- The `item-images` bucket is public to match the app skill. Do not upload sensitive identity documents. Authenticated users can upload to their own lost-report path, and only staff can upload to found-item paths.
- The browser uses a publishable key. RLS, database checks, and RPC ownership checks enforce access. There is no service key or standalone backend server in this handoff.
- Matching uses only category, color, location, and time. Images are never read by the matching function.

## Create the first staff account

Register the account through the app as an ordinary user, then promote it from the Supabase SQL Editor using the intended email:

```sql
update public.profiles
set role = 'staff'
where email = 'staff@example.com';
```

Have the staff member sign out and sign in again so the profile is loaded for the new session. Do not add staff-role selection to public signup.

## Matching rules implemented

- Category mismatch is filtered out before scoring.
- Category: 35; exact color: 25; either color `หลายสี`: 15; exact location: 25; same building: 15; time in range: 15, then 12/8/4/0 for distance up to 1/3/7/>7 days.
- Results below 50 are omitted and remaining results sort by score descending.

## Backups

Run this in PowerShell from the project root to create a timestamped source ZIP and SHA-256 sidecar in `backups/`:

```powershell
./scripts/backup-project.ps1
```

The archive excludes `.env.local`, other local environment files, linked-project state, dependencies, generated builds, and previous backups. It verifies each ZIP entry and does not delete older archives.

To include the connected Supabase database export and Storage objects, install and sign in to the Supabase CLI, initialize/link the intended project from the repository root, then run:

```powershell
./scripts/backup-project.ps1 -IncludeSupabaseSnapshot
```

This exports the schema/data supported by `supabase db dump` and copies the `item-images` bucket. Supabase CLI logical dumps exclude platform-managed schemas such as Auth and Storage, so this is not a full project backup for restoring Auth accounts. Use a Supabase Dashboard backup on a plan that supports it, or an authorized full database export, if user accounts must also be recoverable. Storage object bytes are separate from the database backup. Keep all database and Storage archives in a restricted location; this script never puts Supabase credentials or `.env.local` into the ZIP.

To restore the source, extract the ZIP into a new folder, copy `.env.example` to `frontend/.env.local`, apply the saved migration to the intended Supabase project, and install frontend dependencies. Review SQL before restoring it to a database. Restore Auth accounts with a full Auth-capable backup and copy the archived bucket files back to `item-images` separately.

