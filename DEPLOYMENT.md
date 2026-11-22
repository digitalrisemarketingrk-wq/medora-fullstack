# Medora fullstack setup

The React frontend uses strict TypeScript and a typed FastAPI client. The backend provides authenticated workspace persistence, private documents, care access grants, Groq summaries/chat/clinical drafts/transcription and optional Qdrant document retrieval.

## Environment variables and keys

Keep secrets on the **FastAPI host**. Python reads its process environment through Pydantic Settings; Next/Vinext uses `process.env` for the public frontend build settings. Never give a service credential a `NEXT_PUBLIC_` prefix, put one in browser storage, or commit a populated environment file.

| Backend variable | Purpose | Required for |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | Production accounts, database and files |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key, or legacy anon key | Supabase Auth calls |
| `SUPABASE_SECRET_KEY` | Server secret, or legacy service_role JWT | Server database and private Storage calls |
| `GROQ_API_KEY` | Groq server credential | Chat, document explanations, clinical drafts and transcription |
| `QDRANT_URL`, `QDRANT_API_KEY` | Qdrant cluster and credential | Optional semantic document search |
| `EMBEDDING_API_KEY` | OpenAI-compatible embedding provider credential | Optional semantic document search |

One Supabase project handles Auth, Postgres and the private `medora-documents` Storage bucket. A separate Postgres password or storage key is not needed. Groq model names and embedding URL/model/dimensions are configurable in `backend/.env.example`. Qdrant needs embeddings in addition to a chat model; chat remains usable without semantic search.

## Run locally

Use Node 24, pnpm 11.25 and Python 3.12.

```bash
corepack enable
pnpm install --frozen-lockfile
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

For local API development, set `NEXT_PUBLIC_API_BASE_URL=/api/v1` to use Vite's API proxy. Add `http://localhost:5173` and `http://127.0.0.1:5173` to backend `ALLOWED_ORIGINS` if using the default frontend port. A relative URL avoids cookie failures when browser and backend hostnames differ. Start both processes in separate terminals:

```bash
pnpm backend:dev
pnpm dev
```

Local data uses SQLite and private files under `backend/.data`, with demo accounts disabled by default. Set `DEMO_ACCOUNTS_ENABLED=true` only for local development to enable `patient@medora.demo`, `doctor@medora.demo`, and `hospital@medora.demo` with password `Medora123!`. These accounts start with empty private workspaces. Browser-only demo mode (`NEXT_PUBLIC_DATA_MODE=demo`) retains the original fictional data and needs no API keys.

## Supabase setup

1. Create the Supabase project and enable email/password Auth. Configure its site URL and email confirmation policy for your real app.
2. Run `backend/migrations/001_medora.sql` in the project SQL editor. It creates server-managed profiles, versioned JSONB workspaces, access grants, RLS policies, the signup trigger and the **private** document bucket.
3. Run `backend/migrations/002_practice.sql` after migration 001, then `backend/migrations/003_staff_permissions.sql`. These add practice resources, memberships, atomic audited writes, appointment and occupied-bed constraints, financial summaries, expiring access grants, QR-revocation receipts and the supported staff roles. They have not been applied to a live database in this task. Release frontend and backend together: the frontend fails closed when the backend does not provide the current permission contract.
4. Register normal accounts through the app. Every public signup is a patient account; submitted roles and editable Auth metadata never confer professional access.
5. Provision doctor/hospital roles using the administrator-only SQL examples at the end of migration 001. Provision shared-practice memberships using the example at the end of migration 002. Do not expose a role promotion endpoint to browsers.
6. Add the three Supabase settings to the backend host's environment. Do not add the secret key to Vercel's frontend build environment.

The SQL is supplied and reviewed; it has not been executed against your Supabase project because project credentials are not present.

## Deploy on Vercel with Services (Multi-service project)

The repository root includes `vercel.json` configured for Vercel Services. Both the FastAPI `backend` and Next.js `frontend` deploy together in a single Vercel project with shared routing and service bindings:

- **Routing**: Public traffic to `/api/*` rewrites to the `backend` service, while all other paths `/*` route to `frontend`.
- **Service Bindings**: The `frontend` service binds to `backend` using `BACKEND_URL`, allowing server-side functions and rewrites to call the backend internally without public round-trips.
- **Environment**: Set backend secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GROQ_API_KEY`, etc.) and `ALLOWED_ORIGINS=https://your-project.vercel.app` in the project settings.

```bash
# Test multi-service locally with Vercel CLI
vercel dev
```

## Alternative: Deploy as separate Vercel projects

For separate Vercel projects, create a **backend project** with Root Directory `backend` (FastAPI preset) and a **frontend project** with Root Directory `frontend`, setting `BACKEND_URL` to the backend URL.

Deploy `backend/Dockerfile` to a host that runs Docker behind HTTPS. It uses pinned Python dependencies, a non-root user, a configurable `PORT` and no request access logging. No environment files are copied into the image.

```bash
docker build -t medora-api ./backend
docker run --env-file backend/.env -p 8000:8000 medora-api
```

Set these production environment values on the backend project or host:

```dotenv
APP_ENV=production
DEMO_ACCOUNTS_ENABLED=false
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
ALLOWED_ORIGINS=https://your-app.vercel.app
```

Also supply the required Supabase values and the AI/search keys you intend to use. Production fails at startup if Supabase is incomplete, cookies are insecure, demo accounts are enabled, or origins/provider URLs use HTTP. Add each explicit preview/custom origin you authorize; wildcards are rejected. `/api/health` checks API liveness.

The Docker image definition is supplied; building and deploying an image requires your Docker host and provider credentials. Local integration tests execute the ASGI app directly.

## Deploy the frontend on Vercel

Import the repository into Vercel with Root Directory set to `frontend`. Use the **Other** framework preset; `frontend/vercel.ts` supplies the build and static output settings. Set:

```dotenv
NEXT_PUBLIC_DATA_MODE=api
NEXT_PUBLIC_API_BASE_URL=/api/v1
BACKEND_URL=https://your-fastapi-host.example
```

`BACKEND_URL` must be an HTTPS origin without a path or credentials. `vercel.ts` reads it with `process.env` and forwards `/api/*` to FastAPI, preserving the API path. This keeps browser cookies on the frontend domain. Do not use separate unrelated frontend/API domains with third-party cookies as the default deployment.

Deploy and check landing, signup/login, each assigned role, workspace save/reload, document upload/download, AI analysis, and care access grant/revoke. Set Supabase Auth's site URL to the resulting frontend domain. No live deployment or real provider invocation is claimed by this source package.

## Validation commands

```bash
pnpm typecheck
pnpm test:ui
pnpm backend:test
pnpm build
pnpm check:secrets
```

`check:secrets` checks generated client assets against the configured service secret values; CI builds with recognizable non-secret canaries to detect accidental exposure. Never print or upload a populated environment file.

## Implemented behavior and practical limits

- Sessions use HttpOnly cookies with refresh support for Supabase. Local development uses expiring opaque tokens whose hashes are persisted. Identity and role are verified on the server.
- Each account owns a versioned workspace. Appointments, tasks, medications, family records, notes, message drafts, team preferences, queues and programmes persist through authenticated aggregate workspace writes. Conflicting writes return 409; the UI keeps unsaved edits visible and offers retry/reload.
- Patient access grants are for a **whole workspace**, including documents. Only registered doctor/hospital accounts can receive grants. A write grant allows clinical notes and plans while protecting identity, consent, family and medication fields. Revocation is enforced on subsequent API requests; an already issued signed file URL can remain valid for up to 120 seconds.
- Private file uploads validate type/content and size, with a 10 MB maximum. PDFs must be readable, unencrypted and at most 60 pages. Scanned PDFs require OCR; upload a clear image for the vision path. Document analysis requires an explicit user action; the UI requests consent before AI processing.
- Document search always filters by owner and authorized document IDs. Analysis and indexing are separate operations; failed optional indexing leaves the summary saved. Deletion reserves the record before provider cleanup and can be retried if cleanup fails.
- AI outputs and editable transcripts require clinician review. Audio is sent for transcription after explicit consent, capped at 2 minutes in the UI, and not persisted as an original audio file. Chat context uses authorized summaries or retrieved chunks; the current chat conversation is in-memory until the screen is closed.
- Provider listings, NHS/external bookings, EHR links, medication interaction checks, automated refill orders, employer connections, family account permissions and email/SMS delivery still need their own external integrations. Stored appointment entries are internal planning records; slot conflict checks are per workspace, not a global provider calendar. Message buttons save drafts rather than send them.
- The in-process throttle limits abuse in one worker. Add host/WAF limits for a distributed production deployment. The API bounds actual streamed request bodies as well as file content.
- Live Supabase/RLS, Groq, Qdrant, microphone behavior and Vercel routing must be verified in your configured deployment. Automated provider tests use simulated HTTP responses; frontend render checks are not browser visual tests.
