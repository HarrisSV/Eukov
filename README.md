# EUKOV — Management Portal

EUKOV is a full-stack publishing platform where authors write and publish work, admins review submissions, and readers discover, issue, and read books in a 3D flipbook reader.

The **Management Portal** (`/dashboard`) provides role-based navigation for readers, authors, admins, and super admins — with a global library, universal docket, inbox, and audit tooling.

## Stack

- **Frontend:** Next.js 15+, TypeScript, Tailwind CSS, Zustand, TanStack Query, TipTap, StPageFlip
- **Backend:** Go (Gin), GORM, PostgreSQL 16, Zap
- **AI (optional):** Hugging Face Inference API — Qwen 2.5 7B Instruct
- **Infra:** Docker Compose, GitHub Actions

## Project Structure

```text
Eukov/
├── frontend/          # Next.js Management Portal + reader
├── backend/           # Gin API, migrations, AI service
├── scripts/           # Seed/backfill utilities
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
# Edit .env — set JWT_SECRET, SUPER_ADMIN_PASSWORD, and optional HUGGINGFACE_API_TOKEN
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

Start PostgreSQL and run migrations:

```bash
docker compose up postgres -d
docker compose run --rm migrate
```

Backend:

```bash
set -a && source .env && set +a
cd backend && go run ./cmd/server
```

Frontend:

```bash
cd frontend
export NEXT_PUBLIC_API_URL="http://localhost:8080/api/v1"
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) |
| `SUPER_ADMIN_EMAIL` | Yes | Bootstrap super-admin email |
| `SUPER_ADMIN_PASSWORD` | Yes | Bootstrap super-admin password |
| `HUGGINGFACE_API_TOKEN` | No | Enables AI recommendations, proofread, summaries |
| `HUGGINGFACE_MODEL` | No | Default: `Qwen/Qwen2.5-7B-Instruct` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Google Drive import (Picker + Drive API) |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | No | Google Drive import |
| `TIPTAP_PRO_TOKEN` | No | TipTap Pages Pro pagination in editor |

See `.env.example` for the full list.

## User Flows

| Route | Description |
|-------|-------------|
| `/register` | Create account |
| `/onboarding/genres` | Genre questionnaire |
| `/dashboard` | Profile, role summary, admin tools (role-dependent) |
| `/dashboard/docket` | Universal workspace — drafts, published works, issued books |
| `/dashboard/docket/editor` | Rich-text editor with autosave, DOCX import/export, AI proofread |
| `/dashboard/library` | Global library — search, filters, AI recommendations, issue books |
| `/dashboard/read/[id]` | 3D flipbook reader — bookmarks, in-book search, TTS, AI summary |
| `/dashboard/inbox` | Author/admin messaging |
| `/dashboard/admin` | Author review queue (Admin+) |
| `/dashboard/super-admin` | Access keys, takedowns, audit logs (Super Admin) |
| `/dashboard/settings` | Profile & security |

## Features

### Management Portal UI

- Header branding (EUKOV / Management Portal), theme toggle, inbox bell, user menu
- Collapsible sidebar navigation
- Footer with copyright, Privacy Policy, and live **API Status** indicator

### 3D Book Reader

- StPageFlip page-turn animation with HTML content rendering
- Reading progress sync and **Continue reading** from saved bookmarks
- In-book search with yellow highlight and clickable page links
- Browser TTS and chapter navigation
- **Quick summary** (library preview) and **AI Summary** full-book scan modal

### Docket Editor

- TipTap rich-text editor with page layout, images, and DOCX round-trip
- 30s autosave and save-on-exit checkpoints
- Google Drive import (optional)
- **AI check** — grammar and rephrase suggestions via Qwen

### AI (Hugging Face — optional)

When `HUGGINGFACE_API_TOKEN` is set:

- **Recommendations** — reranks library picks using reading history and genre preferences
- **Proofread** — `POST /api/v1/ai/proofread` (Author+)
- **Quick summary** — `GET /api/v1/documents/:id/ai-summary`
- **Full summary** — `GET /api/v1/documents/:id/ai-full-summary` (chunked book scan)

Without a token, AI endpoints return graceful fallbacks; core publishing and reading still work.

## API Overview

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | Public | Health check |
| POST | `/api/v1/auth/register` | Public | Register |
| POST | `/api/v1/auth/login` | Public | Login |
| GET | `/api/v1/auth/me` | Auth | Current user |
| GET | `/api/v1/docket` | Reader+ | Docket workspace |
| POST | `/api/v1/documents` | Author+ | Create draft |
| PUT | `/api/v1/documents/:id` | Author+ | Update draft |
| POST | `/api/v1/documents/:id/publish` | Author+ | Publish |
| GET | `/api/v1/library` | Reader+ | Browse catalog |
| GET | `/api/v1/library/recommended` | Reader+ | AI-aware recommendations |
| POST | `/api/v1/documents/:id/issue` | Reader+ | Issue book to docket |
| GET | `/api/v1/documents/:id/pages/:page` | Reader+ | Paginated page content |
| POST | `/api/v1/progress` | Reader+ | Save reading progress |
| POST | `/api/v1/ai/proofread` | Author+ | AI grammar/rephrase |
| GET | `/api/v1/documents/:id/ai-summary` | Reader+ | Quick AI summary |
| GET | `/api/v1/documents/:id/ai-full-summary` | Reader+ | Full-book AI summary |
| GET | `/api/v1/admin/author-activity` | Admin+ | Author metrics |
| GET | `/api/v1/audit-logs` | Super Admin | Audit trail |

See phase sections below for the complete endpoint history.

## Testing

Backend:

```bash
cd backend && go test ./... -cover
```

Frontend unit tests:

```bash
cd frontend && npm run test
```

Frontend E2E (requires Postgres migrations, backend on :8080):

```bash
# Terminal 1 — backend
set -a && source .env && set +a
cd backend && go run ./cmd/server

# Terminal 2 — Phase 3 E2E
cd frontend && npm run test:e2e:phase3
```

Ensure `.env` has the same `SUPER_ADMIN_PASSWORD` the backend used on first bootstrap.

## Phase History

### Phase 1 — Foundation

Project scaffold, PostgreSQL migrations, Gin API, Next.js shell, registration, genre questionnaire, health API, themes, CI.

### Phase 2 — Access Layer

JWT auth, RBAC (Reader / Author / Admin / Super Admin), access keys, author applications, audit logging.

Migrations: `000006`–`000009`

### Phase 3 — Universal Docket & Publishing

Universal docket for all users, draft editor, publish/unpublish workflow, admin author activity, super-admin draft review.

Migrations: `000010`–`000016`

Files: `./uploads/dockets/{author_id}/{document_id}.txt` (atomic writes).

### Phase 4 — Global Library & Reader

Library discovery, author subscriptions, book issuance, paginated reading, TTS, reading progress, SQL recommendations.

Migrations: `000017`–`000020`

### Phase 5 — Reader Experience, Editor & AI

- 3D StPageFlip reader with HTML/Gutenberg content support
- Bookmarks, in-book search, chapter nav, continue reading
- Management Portal UI refresh (header, sidebar, footer)
- DOCX import/export, Google Drive import, cover URLs, author names on metadata
- Hugging Face Qwen integration for recommendations, proofread, and summaries

Migrations: `000021`–`000026`

Utility scripts:

```bash
node scripts/seed-public-library.mjs      # Seed public-domain titles
node scripts/backfill-author-names.mjs    # Backfill author metadata
node scripts/backfill-published-docx.mjs  # Regenerate published DOCX files
```
