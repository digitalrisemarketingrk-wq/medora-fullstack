# Supabase and Qdrant setup

The app uses Supabase Auth, private Storage, and server-side Postgres access.
Qdrant is the document search index, with owner and allowed-document filters.
Business records belong in Supabase; they are not copied to Qdrant.

1. In Supabase SQL Editor run `backend/migrations/live_practice_setup.sql` in full.
   This applies existing migrations 002 and 003 to the already-installed 001 schema.
2. From the project root run `pnpm backend:check`, then `pnpm backend:seed`.
   The seed adds one labeled synthetic record in each of 18 modules to the existing
   doctor and hospital sample accounts. Existing records and account roles are preserved.
   A synthetic patient document is stored privately and indexed in Qdrant; scoped
   retrieval and Storage readback are verified. Re-running preserves existing samples.
3. Run `pnpm backend:dev` and `pnpm frontend:dev`. The live launcher refuses to
   start without both services configured. Browser data defaults to API mode;
   frontend-only sample mode requires explicit `NEXT_PUBLIC_DATA_MODE=demo`.
4. Sign in again using your Supabase credentials. Local SQLite sessions are not
   valid Supabase sessions. Do not use sample accounts for actual patient care.

The previous SQLite preview database is retained as an unused local backup.
No provider failures fall back to it. Sample records do not send messages,
submit insurance claims, prescribe medicines, charge payments, or grant consent.
External messaging, payer and video integrations still require implementation.

## Verification on 2026-10-10

Supabase and Qdrant credentials are present. Remote profiles/workspaces are reachable.
Initial check found practice tables and grant expiry missing. The user subsequently
installed the supplied migration; all tables and the expiry column now return 200.
One synthetic training document was added to the existing Supabase patient sample
workspace and private Storage. Its Qdrant index and scoped search both passed.
Re-running the document import preserved it and returned one scoped search match.
The preview backend was replaced with `run_live.py`; the running frontend proxy
reports `mode=supabase`, `document_storage=supabase-private`, and semantic search enabled.
Actual sample-account login and practice bootstrap through the proxy returned 200.
The import created 18 synthetic records in each of the doctor and hospital practices
(36 total). Re-running created zero records and preserved all 36 samples.
`backend/verify_live_data.py` verified all 18 module lists for both practices,
summary, finance, timeline, and audit reads. Anonymous access returned 401;
cross-practice bootstrap returned 403 and foreign record access returned 404.
In a real browser, the hospital clinical-note edit persisted as version 2 with an
Updated audit event; a full page reload retrieved the saved plan and version.
Visual proof: `docs/audit/practice-supabase-save.png`.
The password fallback was removed; wrong-password authentication makes only one
provider request. All 92 backend tests, TypeScript checks, and 26 frontend source/render
checks passed. These live checks cover the implemented practice foundation, not
full feature parity or production readiness. External messaging, payer, analyzer,
and video integrations remain disconnected. Re-authenticate in the browser after
replacing the local backend.
