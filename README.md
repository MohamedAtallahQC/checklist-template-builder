# Checklist Template Builder

A full-stack checklist management system for creating templates, organizing checklists in hierarchical projects, and tracking completion status across teams.

---

## Features

- **Template Management** — Create reusable templates with dynamic checklist items, duplicate or instantiate them per project
- **Hierarchical Organization** — Projects → Folders (nested) → Templates → Checklist Items
- **Dynamic Template Types** — Define custom column schemas and display configs per template type
- **Status Tracking** — Per-item statuses: `pending | passed | failed | blocked | skipped | na` with comment & evidence support
- **RBAC & Permissions** — Role-based access control with fine-grained `resource:action` permissions via CASL
- **Team Collaboration** — Project membership, role invitations, and audit logging of all user actions
- **Reports** — PDF (PDFKit) and Excel (ExcelJS) export with BullMQ job queue infrastructure
- **ClickUp Integration** — OAuth flow with AES-256-CBC token encryption
- **Audit Log** — Automatic action recording via `@AuditLog()` decorator

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | NestJS 10, Prisma 5, PostgreSQL 16, Redis + BullMQ |
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| **Auth** | JWT (access 15m + refresh 7d), bcrypt, Redis token blacklist |
| **Validation** | class-validator (backend), react-hook-form + zod (frontend) |
| **Drag & Drop** | @dnd-kit |
| **Containerization** | Docker + Docker Compose |
| **Monorepo** | Turborepo + npm workspaces |

---

## Project Structure

```
.
├── backend/          # NestJS API (port 3005 in Docker / 3001 local)
├── frontend/         # Next.js app (port 3006)
├── shared/           # Shared TypeScript types & constants
├── docker/           # Docker Compose configs & env
├── turbo.json        # Turborepo pipeline config
└── package.json      # Root workspace
```

### Backend Modules (`backend/src/modules/`)

| Module | Responsibility |
|---|---|
| `auth` | JWT auth, login/logout, token refresh, account lockout |
| `users` | User CRUD, role assignment, status management |
| `roles` | RBAC roles and permission mappings |
| `permissions` | Permission rule definitions |
| `projects` | Project CRUD, project membership |
| `folders` | Hierarchical folder tree (path/depth/position) |
| `templates` | Template CRUD, duplication, instantiation, reordering, export |
| `template-types` | Dynamic schema definitions with custom columns |
| `checklist-items` | Item CRUD, status tracking, assignments, response history |
| `invitations` | Project/role invitations (pending → accepted/expired/revoked) |
| `reports` | Report generation queue (PDF/Excel/CSV) |
| `clickup` | ClickUp OAuth, token encryption |
| `audit` | Auto-records all user actions |
| `health` | Health check endpoint |

### Frontend Routes (`frontend/src/app/`)

```
(auth)/login                     — Login page
(dashboard)/dashboard            — Home
(dashboard)/projects             — Project list / new / [id]
(dashboard)/templates            — Template list / [id]
(dashboard)/reports              — Reports
(dashboard)/settings/profile     — User profile
(dashboard)/settings/integrations — ClickUp integration
(dashboard)/admin/users          — User management
(dashboard)/admin/roles          — Role management
(dashboard)/admin/template-types — Template type management
```

---

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- On macOS: `open -a Docker` and wait for it to start

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd checklist-template-builder

# Copy and configure docker env
cp docker/.env.example docker/.env
# Edit docker/.env with your secrets (DB password, JWT secret, ENCRYPTION_KEY)
```

### 2. Start all services

```bash
npm run docker:up
```

This starts PostgreSQL, Redis, the backend API, and the frontend. The backend automatically runs Prisma migrations and seeds the database on first start.

### 3. Access the app

| Service | URL |
|---|---|
| Frontend | http://localhost:3006 |
| Backend API | http://localhost:3005/api/v1 |
| Swagger Docs | http://localhost:3005/docs |
| Health Check | http://localhost:3005/api/v1/health |

**Default credentials:** `admin@checklist.local` / `Admin@123456`

---

## Docker Commands

```bash
# Start all services
npm run docker:up

# Rebuild & restart after code changes
npm run docker:rebuild

# Check container status
docker-compose -f docker/docker-compose.yml ps

# View logs (all services)
npm run docker:logs

# View logs for a specific service
docker logs checklist_backend -f
docker logs checklist_frontend -f

# Stop all services
npm run docker:down

# Full reset — wipes volumes & database
docker-compose -f docker/docker-compose.yml down -v && npm run docker:up
```

### Dev extras (pgAdmin + Redis Commander)

```bash
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d
```

| Tool | URL |
|---|---|
| pgAdmin | http://localhost:5050 |
| Redis Commander | http://localhost:8081 |

---

## Local Development (without Docker)

Requires a local PostgreSQL 16 and Redis instance.

```bash
# Install dependencies
npm install

# Copy and fill backend env
cp backend/.env.example backend/.env

# Copy and fill frontend env
cp frontend/.env.example frontend/.env

# Run migrations & seed
npm run db:migrate
npm run db:seed

# Start all packages in watch mode
npm run dev

# Or run individually
npm run dev --workspace=backend    # NestJS on port 3001
npm run dev --workspace=frontend   # Next.js on port 3006
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` | Redis host |
| `REDIS_PASSWORD` | Redis password |
| `JWT_SECRET` | JWT signing secret (≥32 chars) |
| `JWT_ACCESS_EXPIRATION` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL (e.g. `7d`) |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-CBC (ClickUp tokens) |
| `CLICKUP_CLIENT_ID` | ClickUp OAuth app client ID |
| `CLICKUP_CLIENT_SECRET` | ClickUp OAuth app client secret |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_APP_NAME` | App display name |

---

## Database

```bash
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed with default admin user & roles
npm run db:studio     # Open Prisma Studio GUI
npm run generate --workspace=backend  # Regenerate Prisma client after schema changes
```

**Key schema notes:**
- Soft deletes on `User`, `Project`, `Folder`, `Template`, `ChecklistItem` — handled transparently by Prisma middleware
- Hierarchical folders via `path` string + `parentId`
- `Template.isTemplate = true` → reusable template; `false` → instance linked via `parentTemplateId`
- Item status changes recorded in `ItemResponse` model with optional comments and evidence attachments

---

## API Design

All routes are prefixed `/api/v1`. Interactive docs available at `/docs` (non-production).

**Success response envelope:**
```json
{
  "success": true,
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "uuid"
}
```

**Error response envelope:**
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "...",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/...",
  "requestId": "uuid"
}
```

---

## Authentication

- JWT Bearer tokens stored in `localStorage`
- Access token: 15 minutes | Refresh token: 7 days
- Axios interceptor auto-attaches token and handles 401 → auto refresh
- Account lockout after 5 failed login attempts (30-minute cooldown)
- Redis blacklist for revoked access tokens

---

## RBAC

Permissions follow the `resource:action` pattern (e.g. `templates:create`, `projects:delete`).

- Backend: `@Roles()` and `@RequirePermissions()` decorators + CASL for fine-grained access
- Frontend: `<Can resource="..." action="...">` component and `useAuth().hasPermission(resource, action)`

---

## Available Scripts (root)

```bash
npm run dev           # Start all packages in dev mode (Turborepo)
npm run build         # Build all packages
npm run lint          # Lint all packages
npm run test          # Run all tests
npm run docker:up     # Start Docker services
npm run docker:rebuild # Rebuild & restart Docker services
npm run docker:down   # Stop Docker services
npm run docker:logs   # Stream all service logs
npm run db:migrate    # Prisma migrate dev
npm run db:seed       # Seed database
npm run db:studio     # Prisma Studio
```

---

## Implementation Status

| Feature | Status |
|---|---|
| Authentication (JWT + refresh) | Complete |
| User & Role Management | Complete |
| Projects & Folders | Complete |
| Templates & Checklist Items | Complete |
| Template Types (dynamic schema) | Complete |
| Status Tracking & Item Responses | Complete |
| Audit Logging | Complete |
| PDF & Excel Export | Complete |
| Report Queue (BullMQ) | Infrastructure ready — async wiring in progress |
| ClickUp OAuth Integration | OAuth + encryption complete — API calls use mock data |
| Template Import | Export complete — import in progress |
| Tests | Jest configured — test files not yet written |

---

## License

MIT
