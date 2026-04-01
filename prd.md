# Product Requirements Document
## PDO Experts — Internal Kanban Ticketing System
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-04-01  
**Owner:** TBD  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication & Access Control](#4-authentication--access-control)
5. [Architecture](#5-architecture)
6. [Data Models](#6-data-models)
7. [Feature Specifications](#7-feature-specifications)
   - 7.1 [Authentication Flow](#71-authentication-flow)
   - 7.2 [Ticket Submission (Decision Maker Portal)](#72-ticket-submission-decision-maker-portal)
   - 7.3 [Kanban Board (Dev View)](#73-kanban-board-dev-view)
   - 7.4 [Admin Panel](#74-admin-panel)
   - 7.5 [Notifications](#75-notifications)
8. [UI/UX Guidelines](#8-uiux-guidelines)
9. [API Specification](#9-api-specification)
10. [Deployment](#10-deployment)
11. [Out of Scope (v1)](#11-out-of-scope-v1)
12. [Future Phases](#12-future-phases)
13. [Open Questions](#13-open-questions)

---

## 1. Overview

An internal web application for the PDO Experts team that combines a **decision maker ticket submission portal** with a **developer-facing kanban board**. The system enables non-technical stakeholders to submit requests into a structured backlog, while developers manage, prioritize, and track work through a drag-and-drop kanban interface.

Access is restricted exclusively to `@pdoexperts.fb.com` Google accounts. All backend logic runs on **Cloudflare Workers** with **Cloudflare D1** (SQLite) as the database. The frontend is a **React SPA** deployed via **Cloudflare Pages**.

---

## 2. Goals & Non-Goals

### Goals

- Provide a clean, minimal-friction ticket submission form for decision makers
- Give developers a fully interactive kanban board (drag-and-drop, filtering, ticket detail)
- Enforce role-based access so each user type sees only what they need
- Restrict access to `@pdoexperts.fb.com` Google accounts only
- Keep the entire stack within Cloudflare's free/affordable tier
- Send email notifications on key events (new ticket, new user signup, assignments)

### Non-Goals (v1)

- Public-facing ticket intake (all users must authenticate)
- Slack or webhook integrations
- Mobile-native app (responsive web is sufficient)
- Custom kanban column configuration (fixed 5-column layout in v1)
- Time tracking or sprint/milestone management
- Self-hosted email server (use a transactional email provider via API)

---

## 3. User Roles & Permissions

| Permission | Viewer | Decision Maker | Dev | Admin |
|---|---|---|---|---|
| View kanban board | ✅ Read-only | ✅ Read-only | ✅ Full | ✅ Full |
| Submit tickets | ❌ | ✅ | ✅ | ✅ |
| Move tickets between columns | ❌ | ❌ | ✅ | ✅ |
| Edit ticket fields | ❌ | Own tickets only | ✅ | ✅ |
| Delete tickets | ❌ | ❌ | ❌ | ✅ |
| Add comments | ❌ | ✅ | ✅ | ✅ |
| Assign tickets | ❌ | ❌ | ✅ | ✅ |
| Manage user roles | ❌ | ❌ | ❌ | ✅ |
| View admin panel | ❌ | ❌ | ❌ | ✅ |

**Default on first login:** Any authenticated `@pdoexperts.fb.com` user is automatically assigned the `Viewer` role. An Admin must manually promote them to their intended role. Devs receive an email alert when a new user signs up.

---

## 4. Authentication & Access Control

### Provider
- **Google OAuth 2.0** only. No username/password login. No other OAuth providers.

### Domain Restriction
- Only accounts ending in `@pdoexperts.fb.com` are permitted to authenticate.
- Any Google account outside this domain must be rejected at the OAuth callback with a clear error message: *"Access is restricted to PDO Experts team members."*

### Session Management
- Sessions are managed via **signed JWT cookies** (HttpOnly, Secure, SameSite=Strict).
- Session TTL: **8 hours** (configurable by Admin in a future phase).
- JWTs are signed with a secret stored in **Cloudflare Workers Secrets**.
- On each request, the Worker validates the JWT and checks the user's role from D1.

### First Login Flow
1. User visits the app and is redirected to Google OAuth.
2. Google returns the user's email. Worker verifies the domain is `@pdoexperts.fb.com`.
3. If domain check fails → redirect to `/auth/error?reason=domain`.
4. If domain check passes and user is **new** → create user record with role `viewer`, send email alert to all Admins and Devs (see Section 7.5).
5. If user already exists → look up role from D1, issue JWT, redirect to role-appropriate landing page.

### Role-Based Landing Pages
| Role | Landing Page |
|---|---|
| Viewer | `/board` (read-only) |
| Decision Maker | `/submit` |
| Dev | `/board` |
| Admin | `/board` |

---

## 5. Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Cloudflare Network                    │
│                                                        │
│  ┌──────────────────┐     ┌──────────────────────┐    │
│  │  Cloudflare Pages │     │  Cloudflare Workers  │    │
│  │  (React SPA)      │────▶│  (REST API + Auth)   │    │
│  │                   │     │                      │    │
│  └──────────────────┘     └──────────┬───────────┘    │
│                                       │                │
│                            ┌──────────▼───────────┐   │
│                            │   Cloudflare D1       │   │
│                            │   (SQLite Database)   │   │
│                            └──────────────────────┘   │
└────────────────────────────────────────────────────────┘
                         │
              ┌──────────▼───────────┐
              │  Google OAuth 2.0    │
              │  (accounts.google)   │
              └──────────────────────┘
                         │
              ┌──────────▼───────────┐
              │  Transactional Email │
              │  (Resend or Mailgun) │
              └──────────────────────┘
```

### Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Drag & Drop | `@dnd-kit/core` |
| Routing | React Router v6 |
| State Management | Zustand or React Query |
| API | Cloudflare Workers (Hono framework recommended) |
| Database | Cloudflare D1 (SQLite) |
| Auth | Google OAuth 2.0, JWT via Workers |
| Email | Resend (preferred) or Mailgun |
| Deployment | Cloudflare Pages (frontend) + Workers (API) |
| CI/CD | GitHub Actions → `wrangler deploy` |

---

## 6. Data Models

### `users`
```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,          -- UUID
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer',  -- viewer | decision_maker | dev | admin
  created_at  INTEGER NOT NULL,          -- Unix timestamp
  last_login  INTEGER
);
```

### `tickets`
```sql
CREATE TABLE tickets (
  id           TEXT PRIMARY KEY,         -- UUID
  ticket_number INTEGER UNIQUE NOT NULL, -- Auto-increment display ID (e.g. PDO-42)
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog',  -- backlog | todo | in_progress | in_review | done
  priority     TEXT NOT NULL DEFAULT 'p2',       -- p0 | p1 | p2 | p3
  assignee_id  TEXT REFERENCES users(id),
  submitter_id TEXT NOT NULL REFERENCES users(id),
  due_date     INTEGER,                  -- Unix timestamp, nullable
  sort_order   REAL NOT NULL,            -- Float for fractional indexing (drag-and-drop ordering)
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

### `ticket_tags`
```sql
CREATE TABLE ticket_tags (
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (ticket_id, tag)
);
```

### `comments`
```sql
CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
```

### `attachments`
```sql
CREATE TABLE attachments (
  id         TEXT PRIMARY KEY,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  filename   TEXT NOT NULL,
  url        TEXT NOT NULL,             -- Cloudflare R2 public URL
  mime_type  TEXT,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL
);
```

> **Note on attachments:** File storage uses **Cloudflare R2**. The Worker generates a pre-signed upload URL; the frontend uploads directly to R2, then posts the resulting URL to the API to create the attachment record. R2 should be added as a bound bucket in `wrangler.toml`.

### `audit_log` *(optional for v1, recommended)*
```sql
CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT REFERENCES users(id),
  action     TEXT NOT NULL,             -- e.g. "ticket.moved", "ticket.created"
  target_id  TEXT,                      -- ticket ID or user ID
  payload    TEXT,                      -- JSON blob of changed fields
  created_at INTEGER NOT NULL
);
```

---

## 7. Feature Specifications

### 7.1 Authentication Flow

**Routes:**
- `GET /auth/google` — Redirects to Google's OAuth consent screen
- `GET /auth/google/callback` — Handles OAuth callback, validates domain, issues JWT
- `POST /auth/logout` — Clears the session cookie
- `GET /auth/error` — Renders error page with reason

**Frontend:**
- Unauthenticated users on any route are redirected to `/login`
- `/login` page shows only a "Sign in with Google" button, company logo, and app name
- No username/password fields anywhere in the application

**Error states:**
- Domain mismatch → friendly error: *"This app is only available to PDO Experts team members."*
- New user pending role → show a holding page: *"Your account is pending. You've been assigned Viewer access. A team admin has been notified."*

---

### 7.2 Ticket Submission (Decision Maker Portal)

**Route:** `/submit`

**Access:** Decision Maker, Admin. Devs also have access. Viewers see a read-only list of their own submitted tickets only.

**Submission Form Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Title | Text input | ✅ | Max 200 chars |
| Description | Textarea (markdown-supported) | ✅ | Min 20 chars |
| Priority | Dropdown (P0–P3) | ✅ | Default: P2 |
| Tags | Multi-select / free-text | ❌ | Comma-separated, max 5 |
| Due Date | Date picker | ❌ | Must be future date |
| Attachments | File upload | ❌ | Max 3 files, 10MB each. PDF, PNG, JPG, GIF, DOCX, XLSX accepted |

**Priority Labels:**
- **P0** — Critical / Blocker
- **P1** — High Priority
- **P2** — Normal (default)
- **P3** — Low / Nice to Have

**On Submit:**
1. Worker creates the ticket record in D1 with status `backlog`.
2. Ticket number is auto-assigned sequentially (`PDO-1`, `PDO-2`, etc.).
3. Submitter sees a success state: *"Ticket PDO-42 submitted successfully."* with a link to view it.
4. Email notification sent to all users with `dev` or `admin` role (see Section 7.5).

**My Submissions View:**
- Below the form, Decision Makers see a table of their own submitted tickets.
- Columns: Ticket #, Title, Priority, Status, Created Date.
- Clicking a row opens a read-only ticket detail modal.

---

### 7.3 Kanban Board (Dev View)

**Route:** `/board`

**Access:** All roles (Viewers read-only, Decision Makers read-only, Devs full interaction, Admin full interaction).

#### Board Layout

Five fixed columns displayed horizontally:

```
┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────┐  ┌──────┐
│ Backlog  │  │  To Do   │  │ In Progress │  │ In Review │  │ Done │
├──────────┤  ├──────────┤  ├─────────────┤  ├───────────┤  ├──────┤
│  card    │  │  card    │  │   card      │  │   card    │  │ card │
│  card    │  │  card    │  │   card      │  │           │  │ card │
│  ...     │  │  ...     │  │   ...       │  │           │  │ ...  │
└──────────┘  └──────────┘  └─────────────┘  └───────────┘  └──────┘
```

#### Ticket Cards

Each card displays:
- Ticket number (e.g., `PDO-42`) — muted, top left
- Title — bold, truncated to 2 lines
- Priority badge (color-coded: P0=red, P1=orange, P2=blue, P3=gray)
- Assignee avatar (if assigned)
- Due date (shown in red if overdue)
- Comment count icon + count
- Attachment count icon + count
- Tag chips (max 2 visible, `+N more` if overflow)

#### Drag & Drop

- Devs and Admins can drag cards between columns.
- Card order within a column is preserved using **fractional indexing** on `sort_order`.
- Optimistic UI update on drop; rolled back on API error with toast notification.
- Viewers and Decision Makers cannot drag cards (pointer-events disabled).

#### Ticket Detail Modal

Clicking any card opens a side-panel or modal with full ticket detail:

- All form fields editable inline (Devs/Admin only)
- Assignee selector (searchable dropdown of `dev` and `admin` users)
- Status selector (mirrors column position; changing status moves the card)
- Comments thread with markdown rendering and input box
- Attachment list with download links and upload button
- Audit trail (if implemented): last N status changes shown as timeline

#### Filtering & Search

Toolbar above the board includes:
- **Search** — filters cards by title/description text (client-side, debounced)
- **Assignee filter** — multi-select dropdown
- **Priority filter** — multi-select (P0, P1, P2, P3)
- **Tag filter** — multi-select
- **My tickets** — toggle to show only tickets assigned to the current user
- **Clear filters** — resets all

---

### 7.4 Admin Panel

**Route:** `/admin`

**Access:** Admin only. Attempting to access as any other role returns a 403 page.

#### User Management

- Table of all registered users: Name, Email, Role, Last Login, Joined Date
- Inline role change: dropdown per row, saves on change with confirmation dialog
- Cannot demote or delete the last Admin (guard this in both UI and API)
- "Remove user" action: soft-deletes user (sets `role = 'suspended'`), does not cascade-delete their tickets

#### System Stats (optional for v1)
- Total tickets by status
- Tickets created this week vs last week
- Open P0/P1 count

---

### 7.5 Notifications

All emails are sent from a verified sender address (e.g., `noreply@pdoexperts.fb.com`) via the configured transactional email provider (Resend preferred).

| Event | Recipients | Subject | Body Summary |
|---|---|---|---|
| New ticket submitted | All Devs + Admins | `[PDO-42] New ticket: {title}` | Title, priority, submitter name, link to ticket |
| New user signed up | All Admins + Devs | `New user signed in: {name}` | Name, email, note that they've been assigned Viewer role, link to Admin panel |
| Ticket assigned to me | Assignee only | `You've been assigned PDO-42` | Ticket title, priority, due date, link |
| Ticket moved to In Review | Submitter only | `Your ticket PDO-42 is in review` | Status update, link to ticket |
| Ticket moved to Done | Submitter only | `Your ticket PDO-42 is done` | Status update, link to ticket |

**Implementation notes:**
- Email sends are fire-and-forget from the Worker (non-blocking).
- Failures are logged but do not fail the triggering API request.
- Use environment variables for the email API key: `EMAIL_API_KEY` in `wrangler.toml` secrets.
- Email templates should be simple, plain HTML with inline styles — no external CSS files.

---

## 8. UI/UX Guidelines

### Design Principles
- **Clean and dense** — optimized for power users who live on the board all day
- **Dark mode first** — use a dark neutral base (e.g. `zinc-950`) with light text
- **Minimal chrome** — no unnecessary sidebars, ads, or decorative elements
- **Fast feel** — optimistic UI updates, skeleton loaders, no full-page reloads

### Color Palette (suggested)

| Token | Value | Usage |
|---|---|---|
| `bg-base` | `#09090b` (zinc-950) | App background |
| `bg-surface` | `#18181b` (zinc-900) | Cards, modals, panels |
| `bg-elevated` | `#27272a` (zinc-800) | Hover states, inputs |
| `text-primary` | `#fafafa` (zinc-50) | Headings, primary text |
| `text-muted` | `#71717a` (zinc-500) | Secondary text, metadata |
| `accent` | `#6366f1` (indigo-500) | Buttons, active states, links |
| `p0-color` | `#ef4444` (red-500) | P0 priority badge |
| `p1-color` | `#f97316` (orange-500) | P1 priority badge |
| `p2-color` | `#6366f1` (indigo-500) | P2 priority badge |
| `p3-color` | `#71717a` (zinc-500) | P3 priority badge |

### Typography
- Font: **Inter** (Google Fonts, self-hosted via Cloudflare)
- Base size: 14px
- Headings: 16–24px, font-weight 600

### Component Library
- Use **shadcn/ui** for forms, modals, dropdowns, tooltips, and toasts
- Build custom components only for the kanban board and ticket cards

### Responsive Behavior
- The kanban board is primarily a desktop experience. On screens < 768px, columns stack vertically.
- The submission form and admin panel are fully responsive.

---

## 9. API Specification

All endpoints are served from the Cloudflare Worker. Base path: `/api/v1`

All authenticated endpoints require a valid JWT cookie. Invalid/missing JWT → `401 Unauthorized`.

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Redirect to Google OAuth |
| `GET` | `/auth/google/callback` | OAuth callback, set cookie |
| `POST` | `/auth/logout` | Clear session cookie |

### Users

| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Any | Get current user profile + role |
| `GET` | `/api/v1/users` | Admin | List all users |
| `PATCH` | `/api/v1/users/:id/role` | Admin | Change a user's role |
| `DELETE` | `/api/v1/users/:id` | Admin | Soft-delete (suspend) user |

### Tickets

| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/tickets` | Any | List all tickets (with filters: status, priority, assignee, tag) |
| `POST` | `/api/v1/tickets` | Decision Maker+ | Create a new ticket |
| `GET` | `/api/v1/tickets/:id` | Any | Get ticket detail |
| `PATCH` | `/api/v1/tickets/:id` | Dev+ (or own ticket for DM) | Update ticket fields |
| `PATCH` | `/api/v1/tickets/:id/move` | Dev+ | Move ticket to new column + reorder |
| `DELETE` | `/api/v1/tickets/:id` | Admin | Delete ticket |

### Comments

| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/tickets/:id/comments` | Any | List comments on a ticket |
| `POST` | `/api/v1/tickets/:id/comments` | Decision Maker+ | Add a comment |
| `PATCH` | `/api/v1/comments/:id` | Author or Admin | Edit a comment |
| `DELETE` | `/api/v1/comments/:id` | Author or Admin | Delete a comment |

### Attachments

| Method | Path | Role Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/tickets/:id/attachments/upload-url` | Decision Maker+ | Get pre-signed R2 upload URL |
| `POST` | `/api/v1/tickets/:id/attachments` | Decision Maker+ | Register attachment after R2 upload |
| `DELETE` | `/api/v1/attachments/:id` | Admin or uploader | Delete attachment record + R2 object |

### Response Format

All responses use JSON. Success:
```json
{ "data": { ... }, "error": null }
```
Error:
```json
{ "data": null, "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action." } }
```

---

## 10. Deployment

### Repository Structure (suggested)

```
/
├── frontend/          # React + Vite app
│   ├── src/
│   └── vite.config.ts
├── worker/            # Cloudflare Worker (Hono)
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── db/
│   └── wrangler.toml
├── migrations/        # D1 SQL migration files
└── .github/
    └── workflows/
        └── deploy.yml
```

### `wrangler.toml` (Worker)

```toml
name = "pdo-kanban-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "pdo-kanban-db"
database_id = "<YOUR_D1_DATABASE_ID>"

[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "pdo-kanban-attachments"

[vars]
GOOGLE_CLIENT_ID = "<your-client-id>"
ALLOWED_DOMAIN = "pdoexperts.fb.com"
FRONTEND_URL = "https://kanban.pdoexperts.fb.com"

# Secrets (set via `wrangler secret put`):
# GOOGLE_CLIENT_SECRET
# JWT_SECRET
# EMAIL_API_KEY
```

### Cloudflare Pages (Frontend)

- Connect GitHub repo to Cloudflare Pages
- Build command: `cd frontend && npm run build`
- Output directory: `frontend/dist`
- Set `VITE_API_BASE_URL` environment variable to the Worker URL

### CI/CD

GitHub Actions workflow on push to `main`:
1. Run lint + type-check
2. Run unit tests (if present)
3. `wrangler deploy` for the Worker
4. Cloudflare Pages auto-deploys on push via GitHub integration

### D1 Migrations

- Use numbered SQL migration files in `/migrations/`
- Apply via `wrangler d1 migrations apply pdo-kanban-db`
- Run in CI before deploying the Worker

---

## 11. Out of Scope (v1)

- Slack or webhook integrations
- Customizable kanban columns (fixed 5-column layout)
- Sprint or milestone planning
- Time tracking or logged hours
- SLA tracking
- Two-factor authentication (Google handles this)
- Dark/light mode toggle (dark mode only in v1)
- Ticket watching / subscription model beyond assignee + submitter
- Public read-only board sharing
- CSV/Excel export

---

## 12. Future Phases

### Phase 2
- Admin-configurable kanban columns (add, rename, reorder, archive)
- Slack notifications in addition to email
- Dark/light mode toggle
- Ticket watching: any user can subscribe to a ticket for notifications

### Phase 3
- Sprint/milestone grouping on the board
- Burn-down or velocity charts in the Admin panel
- Bulk ticket operations (re-assign, re-prioritize, move)
- Ticket dependencies / blocking relationships
- CSV export from the Admin panel

---

## 13. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | What transactional email provider does the team already use or prefer? (Resend vs Mailgun vs SendGrid) | Infrastructure | Open |
| 2 | Should the `Done` column auto-archive tickets after N days? | Product | Open |
| 3 | Is `kanban.pdoexperts.fb.com` the intended subdomain, or will this live on a separate domain? | Infrastructure | Open |
| 4 | What is the expected peak number of concurrent users? (Relevant for D1 read replica needs at scale) | Engineering | Open |
| 5 | Should Decision Makers be able to edit or retract a submitted ticket after a Dev has moved it off the Backlog? | Product | Open |
| 6 | Is there a tagging taxonomy to standardize upfront, or are tags completely free-form? | Product | Open |