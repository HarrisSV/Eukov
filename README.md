# EUKOV Phase 1 — Foundation Platform

EUKOV is a full-stack publishing platform where authors publish written work and readers discover and consume it.

Phase 1 delivers the technical foundation: monorepo scaffold, PostgreSQL migrations, Gin API, Next.js UI shell, registration flow, genre questionnaire, local storage directories, and CI baseline.

## Stack

- **Frontend:** Next.js 15+, TypeScript, Tailwind CSS, Zustand, TanStack Query, React Hook Form, Zod
- **Backend:** Golang (Gin), GORM, PostgreSQL 16, Zap
- **Infra:** Docker Compose, GitHub Actions

## Project Structure

```text
Build/
├── frontend/          # Next.js app
├── backend/           # Gin API + migrations
├── infra/
│   └── github-actions/
├── docker-compose.yml
└── .env.example
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.24+
- Node.js 22+

### 1. Environment

```bash
cp .env.example .env
```

### 2. Start with Docker

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api/v1
- PostgreSQL: localhost:5432

### 3. Local Development (without Docker for app services)

Start PostgreSQL:

```bash
docker compose up postgres -d
```

Run migrations:

```bash
docker compose run --rm migrate
```

Backend:

```bash
cd backend
export DATABASE_URL="postgres://eukov:eukov_secret@localhost:5432/eukov?sslmode=disable"
go run ./cmd/server
```

Frontend:

```bash
cd frontend
export NEXT_PUBLIC_API_URL="http://localhost:8080/api/v1"
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/auth/register` | Register user |
| GET | `/api/v1/genres` | List genres |
| POST | `/api/v1/user/preferences` | Save genre preferences |
| GET | `/api/v1/user/:userId/preferences` | Get user preferences |

## User Flow

1. `/register` — Create account (email, password)
2. `/onboarding/genres` — Select genre preferences
3. `/dashboard` — Reader dashboard with summary cards

## Testing

Backend:

```bash
cd backend && go test ./... -cover
```

Frontend unit tests:

```bash
cd frontend && npm run test
```

Frontend E2E (requires Postgres migrations, backend on :8080, then Playwright starts the dev server):

```bash
# Terminal 1 — backend
cd backend
export DATABASE_URL="postgres://eukov:eukov_secret@localhost:5432/eukov?sslmode=disable"
export JWT_SECRET="local-dev-jwt-secret-key-32chars-minimum!"
export SUPER_ADMIN_EMAIL="superadmin@eukov.local"
export SUPER_ADMIN_PASSWORD="change-me-super-admin-password"
go run ./cmd/server

# Terminal 2 — Phase 3 E2E (reads SUPER_ADMIN_* from Build/.env automatically)
cd frontend
npm run test:e2e:phase3
```

Ensure `Build/.env` has the same `SUPER_ADMIN_PASSWORD` the backend used on first bootstrap. Optional overrides: `tests/e2e/.env.e2e`.

Phase 3 E2E covers: create/save/publish drafts, metadata validation, unpublish queue approval, reader RBAC denial, and API forbidden for document creation.

## Phase 2 — Access Layer (JWT, RBAC, Admin)

Phase 2 adds authentication, authorization, audit logging, access keys, and author applications.

### New environment variables

```bash
JWT_SECRET=your-random-secret-at-least-32-characters-long
SUPER_ADMIN_EMAIL=superadmin@eukov.local
SUPER_ADMIN_PASSWORD=your-secure-password
```

### Run migrations (000006–000009)

```bash
cd backend
for f in migrations/00000{6,7,8,9}_*.up.sql; do psql "$DATABASE_URL" -f "$f"; done
```

### API endpoints (Phase 2)

| Method | Path | Role |
|--------|------|------|
| POST | `/api/v1/auth/login` | Public — returns JWT + refresh token |
| POST | `/api/v1/auth/refresh` | Public |
| POST | `/api/v1/auth/logout` | Authenticated |
| GET | `/api/v1/auth/me` | Authenticated |
| POST | `/api/v1/author-applications` | Reader+ |
| GET | `/api/v1/author-applications` | Admin+ |
| POST | `/api/v1/author-applications/:id/approve` | Admin+ |
| POST | `/api/v1/access-keys` | Super Admin |
| POST | `/api/v1/access-keys/consume` | Reader+ |
| GET | `/api/v1/audit-logs` | Super Admin |

### Local dev (Phase 2)

Copy and edit `Build/.env` from `.env.example` (includes `JWT_SECRET` and super-admin bootstrap vars). Quote values that contain `&` or `$` if you load the file with `source .env`. Then:

```bash
# Terminal 1 — Postgres (if not already running)
# Terminal 2 — Backend (loads Build/.env via your shell or: set -a && source ../.env && set +a)
cd backend
go run ./cmd/server

# Terminal 3 — Frontend
cd frontend
npm run dev
```

## Phase 3 — Universal Docket & Publishing (PRD v2)

The **Docket** is a universal personal workspace for all users (Readers and Authors). Author writing and publishing are layered on top without restricting Docket access to Authors only.

### Governance

- **Admins** see author metrics and publishing events (`GET /api/v1/admin/author-activity`) — not private draft body text.
- **Super Admins** may review draft content via `POST /api/v1/admin/documents/:id/review` (generates `ADMIN_REVIEWED_DRAFT` audit event).

### Migrations (000010–000016)

```bash
for f in migrations/000010_*.up.sql migrations/000011_*.up.sql migrations/000012_*.up.sql \
         migrations/000013_*.up.sql migrations/000014_*.up.sql migrations/000015_*.up.sql \
         migrations/000016_*.up.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

### User flows

- **Docket** (`/dashboard/docket`) — all Readers: subscriptions/saved placeholders; Authors: drafts, published list, editor, 30s autosave, save on exit
- **Library** (`/dashboard/library`) — browse published catalog
- **Admin** — author activity metrics, unpublish queue (no private draft body)
- **Super Admin** — emergency draft review with audit trail

### Key API

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/docket` | Reader+ |
| POST | `/api/v1/documents` | Author+ |
| PUT | `/api/v1/documents/:id` | Author+ (draft only) |
| POST | `/api/v1/documents/:id/publish` | Author+ |
| POST | `/api/v1/documents/:id/unpublish-request` | Author+ |
| GET | `/api/v1/library/documents` | Authenticated |
| GET | `/api/v1/admin/author-activity` | Admin+ |
| GET | `/api/v1/admin/unpublish-queue` | Admin+ |
| POST | `/api/v1/admin/documents/:id/review` | Super Admin |

Files: `./uploads/dockets/{author_id}/{document_id}.txt` (atomic writes, mutex locking).

## Phase 4 — Global Library, Reader Experience & Discovery

Phase 4 adds the consumer ecosystem: global library discovery, author subscriptions, book issuance, reader docket integration, SQL-based recommendations, paginated reading, browser TTS, and reading progress.

> **Migration numbering:** Phase 3 already uses `000015`–`000016`. Phase 4 migrations are **`000017`–`000020`** (not the PRD’s `000015`–`000018`).

### Migrations (000017–000020)

```bash
for f in migrations/000017_*.up.sql migrations/000018_*.up.sql \
         migrations/000019_*.up.sql migrations/000020_*.up.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Tables: `author_subscriptions`, `issued_books`, `reading_progress`, `reader_activity`.

### User flows

- **Library** (`/dashboard/library`) — search, genre filter, sort, recommendations, issue book, follow author
- **Reader** (`/dashboard/read/[id]`) — paginated text (3000 chars/page), progress sync, Web Speech API audio
- **Docket** (`/dashboard/docket`) — issued books with continue-reading links

### Key API

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/library` | Reader+ |
| GET | `/api/v1/library/recommended` | Reader+ |
| POST | `/api/v1/authors/:id/subscribe` | Reader+ |
| DELETE | `/api/v1/authors/:id/unsubscribe` | Reader+ |
| POST | `/api/v1/documents/:id/issue` | Reader+ |
| GET | `/api/v1/documents/:id/pages/:page` | Reader+ (issued or author) |
| POST | `/api/v1/progress` | Reader+ |
| GET | `/api/v1/docket/books` | Reader+ |

## Phase 1 Scope

**Included:** Project structure, DB schema, migrations, UI shell, registration, genre questionnaire, local upload dirs, health API, themes, tests, CI.

**Excluded:** Publishing, subscriptions, analytics, cloud storage (later phases).
