# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A checklist management system with template creation, project organization, and team collaboration. Users create template types, build templates with checklist items, organize them in hierarchical folders within projects, and track completion status. Includes ClickUp integration, audit logging, and PDF/Excel reporting.

## Monorepo Structure

Turborepo monorepo with npm workspaces: `backend/`, `frontend/`, `shared/`.

- **Backend**: NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis (BullMQ for jobs)
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui
- **Shared**: TypeScript types/constants shared between packages (`ApiResponse<T>`, `APP_NAME`)

## Running the Project (Docker)

**Prerequisite**: Docker Desktop must be running before executing any docker commands. On macOS: `open -a Docker` and wait for it to start.

```bash
# Start all services (postgres, redis, backend, frontend)
npm run docker:up

# Rebuild & restart after code changes (rebuilds both frontend and backend)
npm run docker:rebuild

# Check container status
docker-compose -f docker/docker-compose.yml ps

# View logs (all services)
npm run docker:logs
# View logs for a specific service (container names: checklist_backend, checklist_frontend, checklist_db, checklist_redis)
docker logs checklist_backend -f

# Stop all services
npm run docker:down

# Full reset (wipes volumes/DB — use when migrating schema from scratch)
docker-compose -f docker/docker-compose.yml down -v && npm run docker:up
```

Once running:
- **Frontend**: http://localhost:3006
- **Backend API**: http://localhost:3005/api/v1
- **Health check**: http://localhost:3005/api/v1/health
- **Swagger docs**: http://localhost:3005/docs
- **Login**: `admin@checklist.local` / `Admin@123456`

The backend container automatically runs Prisma migrations and seeds the database on startup.

## Common Commands

```bash
# Local development (without Docker — requires local postgres + redis)
npm run dev

# Run only backend or frontend
npm run dev --workspace=backend    # NestJS on port 3001
npm run dev --workspace=frontend   # Next.js on port 3006

# Build
npm run build

# Database
npm run db:migrate    # prisma migrate dev
npm run db:seed       # ts-node prisma/seed.ts
npm run db:studio     # prisma studio GUI
npm run generate --workspace=backend  # regenerate Prisma client after schema changes

# Tests (Jest configured but no test files written yet)
npm run test
npm run test --workspace=backend
npm run test:cov --workspace=backend
# Run a single test file or pattern (run from backend/ directory or use --workspace)
npx jest --testPathPattern=auth --workspace=backend
# E2E tests
npm run test:e2e --workspace=backend

# Linting
npm run lint
npm run lint --workspace=frontend
```

## Architecture

### API Design

All backend routes are prefixed `api/v1/`. Swagger docs at `/docs` (non-production).

**Response envelope**: Every response is wrapped by `TransformInterceptor`:
```json
{ "success": true, "data": ..., "timestamp": "...", "requestId": "..." }
```
Errors wrapped by `AllExceptionsFilter`:
```json
{ "success": false, "error": { "code": "...", "message": "...", "details": ... }, "timestamp": "...", "path": "...", "requestId": "..." }
```

### Authentication

JWT Bearer tokens: access (15 min) + refresh (7 days). Tokens in `localStorage` on frontend.

- Backend: `JwtAuthGuard` is global. Use `@Public()` to skip auth on a route. Redis blacklist for revoked access tokens.
- Frontend: Axios interceptor auto-attaches Bearer token and handles 401 refresh. `useAuth()` hook reads user from localStorage.
- Account lockout after 5 failed login attempts (30 min).
- Default seed credentials: `admin@checklist.local` / `Admin@123456`

### RBAC / Permissions

Permissions are `resource:action` strings (e.g., `templates:create`). JWT payload includes `roles[]` and `permissions[]`.

- Backend: `@Roles()` and `@RequirePermissions()` decorators + `@casl/ability` for fine-grained access
- Frontend: `<Can resource="..." action="...">` component and `useAuth().hasPermission(resource, action)`

### Database

Prisma ORM with PostgreSQL. Schema at `backend/prisma/schema.prisma`. Single initial migration.

**Soft deletes** on User, Project, Folder, Template, ChecklistItem — handled transparently by `PrismaService` middleware that intercepts delete operations and find queries to filter by `deletedAt`. Pass `_bypassSoftDelete: true` in query args to bypass.

**Key relationships**: Project → Folders (hierarchical via `path` string + `parentId`) → Templates → ChecklistItems (nested via `parentId`). Templates can be instantiated from parent templates.

**Checklist item statuses**: `pending | passed | failed | blocked | skipped | na`. Status changes are recorded in the `ItemResponse` model with optional comments and evidence attachments.

**ProjectRole enum**: `owner | admin | member | viewer`

### Backend Modules (`backend/src/modules/`)

| Module | Responsibility |
|--------|---------------|
| `auth` | JWT auth, login/logout, token refresh, account lockout |
| `users` | User CRUD, roles assignment, status management |
| `roles` | RBAC roles and permission mappings (system vs custom) |
| `permissions` | Permission rule definitions |
| `projects` | Project CRUD, project membership via `ProjectUser` junction |
| `folders` | Hierarchical folder tree within projects (path/depth/position) |
| `templates` | Template CRUD, duplication, instantiation, reordering, export |
| `template-types` | Dynamic schema definitions with custom columns/display config |
| `checklist-items` | Item CRUD, status tracking, assignments, response history |
| `invitations` | Project/role invitations (pending → accepted/expired/revoked) |
| `reports` | Report generation queue (PDF/Excel/CSV) — infrastructure exists, not complete |
| `clickup` | ClickUp OAuth, token encryption (AES-256-CBC), user mapping — mock implementation |
| `audit` | Auto-records all user actions via `@AuditLog()` decorator |
| `health` | Health check endpoint |

### Templates: isTemplate vs Instance

`Template.isTemplate = true` = reusable template (lives in project folders or the auto-created "System Templates" project).
`Template.isTemplate = false` = an instance created from a parent template (linked via `parentTemplateId`). Instantiation copies all checklist items. Duplication creates a standalone unlinked copy.

### Frontend Routes (`frontend/src/app/`)

- `(auth)/login` — Login
- `(dashboard)/dashboard` — Home
- `(dashboard)/projects` — Project list / `projects/new` / `projects/[id]`
- `(dashboard)/templates` — Template list / `templates/[id]`
- `(dashboard)/reports` — Reports
- `(dashboard)/settings/profile` — User profile
- `(dashboard)/settings/integrations` — ClickUp integration
- `(dashboard)/admin/users` — User management (admin)
- `(dashboard)/admin/roles` / `roles/[id]` — Role management (admin)
- `(dashboard)/admin/template-types` — Template type management

### Frontend Patterns

- **App Router** with route groups: `(auth)` for login, `(dashboard)` for authenticated pages
- **No global state library** — auth data in localStorage, component-level state with `useState`
- **UI components**: shadcn/ui in `frontend/src/components/ui/` (new-york style)
- **Form validation**: react-hook-form + zod schemas in `frontend/src/lib/validations/`
- **API client**: Axios instance at `frontend/src/lib/api/client.ts` with auth interceptor
- **Drag-and-drop**: `@dnd-kit` used for reordering templates and checklist items
- **Path alias**: `@/*` maps to `frontend/src/*`

### Backend Patterns

- **Module structure**: Each feature in `backend/src/modules/<feature>/` with controller, service, module, DTOs
- **Common utilities**: `backend/src/common/` has decorators (`@Public`, `@CurrentUser`, `@AuditLog`), guards, interceptors, exception classes
- **Audit logging**: `@AuditLog()` decorator + `AuditInterceptor` auto-records actions
- **Config**: Typed config factory at `backend/src/config/configuration.ts` reads all env vars
- **Validation**: class-validator DTOs with global `ValidationPipe` using `whitelist: true, forbidNonWhitelisted: true` — unknown fields are stripped/rejected, so all accepted fields must be declared in the DTO
- **Export**: PDFKit for PDF generation (dynamic page sizing A4/A3, portrait/landscape), ExcelJS for spreadsheets — in `template-export.service.ts`
- **Exception classes**: Use typed exceptions from `backend/src/common/exceptions/`: `ResourceNotFoundException`, `ResourceAlreadyExistsException`, `InsufficientPermissionsException`, `InvalidCredentialsException`, `TokenExpiredException`, `InvalidTokenException`, `AccountLockedException`, `ValidationException`, `DeletedResourceFoundException`. All extend `BusinessException` which extends `HttpException`.
- **ChecklistItem content**: The `content` field is `Json` — its structure is dynamic and defined by the associated `TemplateType.schema`. Not validated at the DB level.

### Implementation Status Notes

- **Reports**: BullMQ queue infrastructure exists but async report generation is not fully wired
- **ClickUp**: OAuth flow and token encryption implemented; API calls use mock data
- **Tests**: Jest is configured but no test files exist yet
- **Template import**: Export is implemented; import is incomplete

### Ports

| Service    | Local Dev | Docker |
|------------|-----------|--------|
| Frontend   | 3006      | 3006   |
| Backend    | 3001      | 3005   |
| PostgreSQL | 5432      | 5432   |
| Redis      | 6379      | 6379   |

### Environment Variables

Backend env vars defined in `backend/.env` (see `backend/.env.example`). Key vars: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY` (64-char hex string for ClickUp token encryption, AES-256-CBC).

Frontend: `NEXT_PUBLIC_API_URL` (default `http://localhost:3005/api/v1`), `NEXT_PUBLIC_APP_NAME`.
