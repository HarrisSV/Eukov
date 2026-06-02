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

Frontend E2E (requires backend + DB running):

```bash
cd frontend && npx playwright test
```

## Phase 1 Scope

**Included:** Project structure, DB schema, migrations, UI shell, registration, genre questionnaire, local upload dirs, health API, themes, tests, CI.

**Excluded:** JWT auth, RBAC, publishing, subscriptions, analytics, cloud storage.
