# AfriConnect — Build Progress

## Current Status (2026-07-20)

**Phase 1 (live messaging):** type-clean ✅
**Phases 2-3 (matches, engagement preconditions):** type-clean ✅
**Phase 4 (engagement data room):** in progress 🚧
**State-machine migration of project routes:** code-complete ⏳ (pending `npx tsc --noEmit` verify — Bash classifier was down when finishing)

## What's done

- Engagement-documents **upload/list API** — done
- `MAX_FILE_SIZE` bumped to **50MB** — done
- Engagement-document **download route** (`GET /engagements/{id}/documents/{docId}`) — done (signed URL + audit)
- Engagement-document **soft-delete** (`DELETE`) — done
- **Data-room UI** (`EngagementDataRoom`) — mounted + realtime — done
- **Data-room UI hardening** — classification selector (PUBLIC/RESTRICTED/CONFIDENTIAL), per-doc classification badge + lock icon, drag-and-drop upload zone — done. Type-clean (tsc: 0 errors in touched files).
- **Bugfix: POST /api/messages 500** (`messages↔user_profiles` schema-cache error) — migration `043_messages_sender_to_uuid.sql`. **Root cause was the FK target**, not just the type: the first version pointed `messages.sender_id` at `auth.users(id)`, which fixes referential integrity but gives PostgREST **no direct edge** to `user_profiles` (it doesn't traverse `messages → auth.users ← user_profiles`). Corrected to FK → `user_profiles(id)` (which is itself FK→`auth.users(id)` ON DELETE CASCADE), so the `sender:user_profiles(...)` embed resolves via the direct `messages → user_profiles` edge. Casts `sender_id`/`deleted_by` TEXT→UUID, drops any prior wrong-target FK, orphan-cleanup before the FK, refreshes pgrst cache. **Run the corrected migration in the Supabase SQL editor (or `npm run migrate 043`)** — the earlier run pointed the FK at the wrong table, so re-run to self-correct.

## Next steps

1. **VERIFY this migration**: run `cd web && npx tsc --noEmit` — expect 0 errors. (Could not run during the session; the Bash safety classifier was unavailable. Static review against the already-compiling `submit`/`internal-review` reference routes says it's clean.)
2. **Latent business-logic gaps surfaced (not fixed — separate decisions):**
   - `admin/projects/[id]` `force_state` lets an admin push to *any* status, but `transitionProject` still rejects transitions not in `VALID_TRANSITIONS` (e.g. `draft→archived`). `skipRoleCheck` only skips role ownership, not the transition-validity gate. Decide: is "force" meant to bypass the machine entirely (direct UPDATE + audit) or only skip role checks (then constrain the allowed target set)?
   - `deactivate` allows deactivating from `pending_live`, but `VALID_TRANSITIONS` only allows `live→deactivated` (no `pending_live→deactivated`). Either allow the row or tighten the route's guard.
3. **Migration 045 still does not exist on disk.** `submit`/`internal-review` route comments and the state-machine header say `submitted`/`returned`/`validated`/`under_review`/`rejected` rows must be backfilled to the trimmed set via migration 045 — that migration is referenced but was never written. Without it, any pre-existing DB rows in the old statuses won't match the CHECK constraint / `ProjectStatus` type. **Write `045_backfill_project_statuses.sql`** (or confirm rows were already migrated).
4. (Optional) Add a `GET …/documents/{docId}/audit` route + UI showing per-doc download/view history.

## File map (Phase 4)

- Upload/list API: `web/src/app/api/engagements/[id]/documents/route.ts`
- Per-document route: `web/src/app/api/engagements/[id]/documents/[docId]/route.ts` (download to be added here)
- Engagement room UI: `web/src/app/dashboard/engagements/[id]/page.tsx`
- Data room component: `web/src/components/engagement/EngagementDataRoom.tsx`
- Documents migration: `web/supabase/migrations/041_engagement_documents.sql`
- Storage provider: `web/src/lib/storage-provider.ts`
- API helpers: `web/src/lib/api-helpers.ts`
