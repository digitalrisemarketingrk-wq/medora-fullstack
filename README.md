# Medora

A healthcare workspace with patient, doctor and hospital flows. React + strict TypeScript frontend, FastAPI backend, Supabase Auth/Postgres/private Storage, Groq AI and optional Qdrant document search.

The new `/practice` professional workspace adds patient-linked clinical and operational modules, branch/practice switching, audited workflows, financial summaries and clinician AI drafting. See [practice implementation and feature coverage](docs/practice-implementation.md) for implemented behavior, remaining module depth and setup requirements. Apply `backend/migrations/002_practice.sql` after migration 001 before using this version with Supabase.

## Project Structure

- `frontend/`: Next.js / Vinext React frontend with strict TypeScript and Tailwind CSS.
- `backend/`: FastAPI Python application with SQLite / Supabase persistence, Groq AI, and Qdrant integration.

Start with [DEPLOYMENT.md](DEPLOYMENT.md) for local setup, required keys, Supabase migration, Docker and Vercel deployment. Environment templates are `frontend/.env.example` and `backend/.env.example`; populated files stay out of Git and deployment archives.

```bash
pnpm typecheck
pnpm test:ui
pnpm backend:test
pnpm build
```

You can also run frontend and backend commands individually:

```bash
# Frontend
pnpm frontend:dev    # or cd frontend && pnpm dev
pnpm frontend:build  # or cd frontend && pnpm build

# Backend
pnpm backend:dev     # or cd backend && ...
pnpm backend:test    # or cd backend && ...
```

No live credentials are included. Browser-only demo mode remains available; API mode starts with empty authenticated workspaces and saves records on the backend. External booking, delivery and clinical integrations are explicitly documented as future work.
