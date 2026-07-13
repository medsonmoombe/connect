# Afri Connect — Developer Setup Guide

A platform connecting renewable energy developers with capital and technical partners across Africa.

**Stack:** Next.js 16 · TypeScript · Supabase (Postgres) · Firebase Auth · Firebase Storage

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Firebase](https://console.firebase.google.com) project with **Authentication** and **Storage** enabled

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd web
npm install
```

---

## 2. Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value. You need credentials from three places:

### Firebase (client-side)
Firebase Console → Project Settings → General → Your apps → Web app config

### Firebase Admin SDK (server-side)
Firebase Console → Project Settings → Service Accounts → **Generate new private key**

This downloads a JSON file. Copy the values into `.env.local`:
```
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```
> The private key must be wrapped in double quotes and keep its literal `\n` characters.

### Supabase
Supabase Dashboard → Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `anon` public key
- `SUPABASE_SERVICE_ROLE_KEY` — `service_role` secret key (**never expose this client-side**)

---

## 3. Database Setup

Run the schema once on your Supabase project.

**Option A — Supabase Dashboard (easiest)**
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/schema.sql`
3. Paste the entire contents and click **Run**

**Option B — Supabase CLI**
```bash
# Install CLI if you haven't
npm install -g supabase

# Link to your project (get project ref from Supabase Dashboard URL)
supabase link --project-ref <your-project-ref>

# Push the schema
supabase db push --db-url "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

---

## 4. Firebase Setup

### Enable Authentication
Firebase Console → Authentication → Sign-in method → Enable **Email/Password** (and **Google** if needed)

### Connect Firebase to Supabase (Third-Party Auth)
This allows Firebase JWTs to be verified by Supabase.

1. Supabase Dashboard → Authentication → Sign In / Up → **Add provider** → **Custom (OIDC)**
2. Set:
   - Issuer URL: `https://securetoken.google.com/<your-firebase-project-id>`
   - Client ID: your Firebase project ID
3. Save — status should show **ENABLED**

### Firebase Storage CORS (for file uploads)
Create a `cors.json` file:
```json
[{
  "origin": ["http://localhost:3000", "https://your-production-domain.com"],
  "method": ["GET", "POST", "PUT", "DELETE"],
  "maxAgeSeconds": 3600
}]
```
Apply it:
```bash
gsutil cors set cors.json gs://<your-storage-bucket>
```

---

## 5. Seed Test Data

The seed script creates test users in Firebase Auth and populates Supabase with companies, projects, and partner profiles.

```bash
cd supabase
npm install

# Place your Firebase service account key at supabase/serviceAccountKey.json
# (Download from Firebase Console → Project Settings → Service Accounts)

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node seed.js
```

**Test accounts** (password: `Test1234!`):

| Role              | Email                  |
|-------------------|------------------------|
| ADMIN             | admin@test.com         |
| DEVELOPER         | developer@test.com     |
| CAPITAL_PARTNER   | capital@test.com       |
| TECHNICAL_PARTNER | technical@test.com     |

> `serviceAccountKey.json` is gitignored — never commit it.

---

## 6. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── api/              # All backend logic lives here (Next.js API routes)
│   │   ├── auth/         # GET/POST /api/auth — fetch or create user
│   │   ├── projects/     # CRUD for projects, scores, documents, matches
│   │   ├── companies/    # CRUD for companies
│   │   ├── partners/     # Capital & technical partner profiles
│   │   ├── engagements/  # Engagement lifecycle + audit logs
│   │   ├── messages/     # Messaging between engagement participants
│   │   ├── onboarding/   # Company setup & role preferences
│   │   └── admin/users/  # Admin user provisioning & verification
│   └── dashboard/        # Frontend pages (developer, investor, admin, etc.)
├── lib/
│   ├── api-client.ts     # Frontend fetch wrapper (attaches Firebase token)
│   ├── api-helpers.ts    # Server-side auth verification helper
│   ├── firebase-admin.ts # Firebase Admin SDK (server-side token verification)
│   ├── supabase-server.ts# Supabase service role client (server-side only)
│   └── firebase.ts       # Firebase client SDK
├── services/             # Frontend service layer (calls API routes)
└── types/                # Shared TypeScript types
```

---

## Architecture

```
Browser
  └── Firebase Auth (login/signup)
  └── fetch /api/* with Authorization: Bearer <firebase-token>
        └── API Route (server-side)
              ├── firebase-admin.verifyIdToken(token)   ← verifies identity
              ├── supabaseAdmin (service role key)       ← bypasses RLS
              └── returns JSON
```

- The browser **never** talks to Supabase directly
- The service role key is **server-side only** — never in `NEXT_PUBLIC_*` vars
- RLS is enabled on all tables as a safety net but is not load-bearing

---

## Common Issues

**`invalid input syntax for type uuid`**
The `users.id` column is `TEXT` (not UUID) to store Firebase UIDs. If you see this error it means something is comparing `auth.uid()` (UUID type) to `users.id` without a `::text` cast. Since the app now uses API routes with the service role key, this should not occur.

**`Unauthorized` from API routes**
- Check that `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` are set correctly in `.env.local`
- The private key must be in double quotes with literal `\n` characters

**`User not found` after login**
The user exists in Firebase but not in Supabase `users` table. Run the seed script or sign up again through the app.

**Firebase Storage upload fails**
Apply the CORS config (step 4) and check Firebase Storage rules allow authenticated writes.
