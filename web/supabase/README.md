# Database Workflow

Three commands, one purpose: keep the dev database in sync with the code.

All commands are run from the `web/` directory.

## Prerequisites

`web/.env.local` must contain:

| Var                          | Where to get it                                                          |
| ---------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`               | Supabase Dashboard → Settings → Database → Connection string → URI       |
| `SUPABASE_URL`               | Supabase Dashboard → Settings → API → Project URL                        |
| `SUPABASE_SERVICE_ROLE_KEY`  | Supabase Dashboard → Settings → API → service_role (secret)              |

## Commands

### `npm run migrate`

Runs all SQL files in `supabase/migrations/` that have not yet been recorded in the `_migrations` table. Idempotent — safe to re-run.

```bash
npm run migrate
npm run migrate -- 041        # run a specific migration by prefix
npm run migrate:status        # show applied vs pending
```

### `npm run db:seed`

Creates the **platform admin** in Supabase Auth and the matching `companies` / `user_profiles` / `company_members` rows. Safe to re-run — uses upserts.

```bash
npm run db:seed
ADMIN_EMAIL=admin@yourco.com ADMIN_PASSWORD='StrongP@ss!' npm run db:seed
```

Default credentials: `admin@test.com` / `Admin1234!` — change before any non-local environment.

### `npm run db:reset`

Wipes **all application data** from the database, then restores the platform company row and (if it exists) the platform admin profile. Supabase Storage is **not** touched.

```bash
CONFIRM_RESET=1 npm run db:reset
ADMIN_EMAIL=admin@yourco.com CONFIRM_RESET=1 npm run db:reset
```

The `CONFIRM_RESET=1` guard is mandatory — without it, the script exits immediately.

### `npm run db:fresh`

The nuclear option: `migrate` → `reset` → `seed`, in one command. Use this when:

- You pull a new branch and want a clean local DB.
- Migrations changed in a way that requires wiping data.
- You're pointing at a brand-new Supabase project for the first time.

```bash
CONFIRM_RESET=1 npm run db:fresh
ADMIN_EMAIL=admin@yourco.com ADMIN_PASSWORD='StrongP@ss!' CONFIRM_RESET=1 npm run db:fresh
```

## Typical flows

**First-time setup against a new Supabase project:**

```bash
# 1. fill in web/.env.local
# 2. run
CONFIRM_RESET=1 npm run db:fresh
```

**After pulling new migrations from `main`:**

```bash
npm run migrate
```

**After a lot of dirty local data and you want a clean slate:**

```bash
CONFIRM_RESET=1 npm run db:fresh
```

**Forgot the admin password:**

```bash
ADMIN_PASSWORD='NewP@ss!' npm run db:seed
# upsert resets the auth password
```

## What is and isn't preserved by `reset` / `fresh`

| Preserved                                | Wiped                                       |
| ---------------------------------------- | ------------------------------------------- |
| `auth.users` (Supabase auth)             | All rows in every `public.*` table          |
| The platform admin user + their profile  | Project documents, engagements, messages    |
| Platform company row (`is_platform_org`) | Storage objects in `project-documents`, etc. |
| Schema (tables, types, RLS)              | Notification / email / audit log rows       |

If you also need to clear Supabase Storage buckets, do it from the Supabase Dashboard → Storage.
