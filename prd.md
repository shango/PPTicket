# Product Requirements Document
## PDO Experts — Internal Kanban Ticketing System
**Version:** 1.1  
**Status:** Implementation Complete  
**Date:** 2026-04-11  
**Owner:** TBD  

---

## Implementation Status Legend

| Symbol | Meaning |
|--------|---------|
| :white_check_mark: BUILT | Feature is fully implemented and functional |
| :large_orange_diamond: MODIFIED | Feature was built but differs from original spec |
| :x: NOT BUILT | Feature from the original spec that was not implemented |
| :star: ADDED | Feature not in original spec that was built |

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
14. [Features Added Beyond Original Spec](#14-features-added-beyond-original-spec)

---

## 1. Overview

An internal web application for the PDO Experts team that combines a **decision maker ticket submission portal** with a **developer-facing kanban board**. The system enables non-technical stakeholders to submit requests into a structured backlog, while developers manage, prioritize, and track work through a drag-and-drop kanban interface.

Access is restricted exclusively to `@pdoexperts.fb.com` accounts. All backend logic runs on **Cloudflare Workers** with **Cloudflare D1** (SQLite) as the database. The frontend is a **React SPA** deployed via **Cloudflare Pages**.

---

## 2. Goals & Non-Goals

### Goals

- :white_check_mark: Provide a clean, minimal-friction ticket submission form for decision makers
- :white_check_mark: Give developers a fully interactive kanban board (drag-and-drop, filtering, ticket detail)
- :white_check_mark: Enforce role-based access so each user type sees only what they need
- :white_check_mark: Restrict access to `@pdoexperts.fb.com` accounts only
- :white_check_mark: Keep the entire stack within Cloudflare's free/affordable tier
- :white_check_mark: Send email notifications on key events (new ticket, new user signup, assignments)

### Non-Goals (v1)

- :white_check_mark: Public-facing ticket intake — all users must authenticate
- :white_check_mark: Slack or webhook integrations — not built
- :white_check_mark: Mobile-native app — responsive web only
- :large_orange_diamond: Custom kanban column configuration — **was listed as a non-goal but was actually built**. Admins can add, rename, reorder, set colors, and delete columns.
- :white_check_mark: Time tracking or sprint/milestone management — not built
- :white_check_mark: Self-hosted email server — uses Resend transactional email API

---

## 3. User Roles & Permissions

### :white_check_mark: BUILT — All roles and permissions implemented as specified.

| Permission | Viewer | Decision Maker | Dev | Admin |
|---|---|---|---|---|
| View kanban board | :white_check_mark: Read-only | :white_check_mark: Read-only | :white_check_mark: Full | :white_check_mark: Full |
| Submit tickets | :x: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Move tickets between columns | :x: | :x: | :white_check_mark: | :white_check_mark: |
| Edit ticket fields | :x: | Own tickets only | :white_check_mark: | :white_check_mark: |
| Delete tickets | :x: | :x: | :x: | :white_check_mark: |
| Add comments | :x: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Assign tickets | :x: | :x: | :white_check_mark: | :white_check_mark: |
| Manage user roles | :x: | :x: | :x: | :white_check_mark: |
| View admin panel | :x: | :x: | :x: | :white_check_mark: |

:large_orange_diamond: **Default on first login:** The original spec called for automatic account creation on first Google OAuth login with `Viewer` role. Since Google OAuth was not implemented, users are instead created manually by an Admin via the Admin Panel, with an explicit role assignment at creation time. The initial admin is created via a one-time `/auth/setup` endpoint.

:star: **Added:** `suspended` role — a soft-delete state that prevents login.

---

## 4. Authentication & Access Control

### Provider

:large_orange_diamond: **MODIFIED** — Google OAuth 2.0 was specified but **not implemented**. Authentication uses **email + password** login instead.

- `POST /auth/login` — Email/password authentication
- `POST /auth/setup` — One-time initial admin account creation
- `POST /auth/change-password` — Password change (mandatory on first login)

### Domain Restriction
:white_check_mark: **BUILT** — Only `@pdoexperts.fb.com` email addresses are permitted. Enforced at login and user creation.

### Session Management
:white_check_mark: **BUILT** — Sessions managed via signed JWT cookies.
- :large_orange_diamond: Session TTL: **30 days** (spec said 8 hours)
- :white_check_mark: HttpOnly, Secure, SameSite cookies
- :white_check_mark: HS256 HMAC signing with secret stored in Cloudflare Workers Secrets
- :white_check_mark: JWT validated on each request; user role checked from D1
- :star: Also supports Bearer token authentication for cross-origin scenarios

### First Login Flow
:large_orange_diamond: **MODIFIED** — Since there is no Google OAuth:
1. Admin creates the user account via the Admin Panel with a temporary password.
2. User logs in with email + password at `/login`.
3. If `must_change_password` flag is set → redirected to `/change-password`.
4. User sets their own password and optionally a notification email.
5. Redirected to role-appropriate landing page.

### Role-Based Landing Pages
:white_check_mark: **BUILT** as specified.

| Role | Landing Page |
|---|---|
| Viewer | `/board` (read-only) |
| Decision Maker | `/submit` |
| Dev | `/board` |
| Admin | `/board` |

---

## 5. Architecture

### :white_check_mark: BUILT as specified.

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
│                                       │                │
│                            ┌──────────▼───────────┐   │
│                            │   Cloudflare R2       │   │
│                            │   (File Storage)      │   │
│                            └──────────────────────┘   │
└────────────────────────────────────────────────────────┘
                         │
              ┌──────────▼───────────┐
              │  Transactional Email │
              │  (Resend)            │
              └──────────────────────┘
```

### Stack Summary

| Layer | Specified | Implemented | Status |
|---|---|---|---|
| Frontend | React 18 + Vite + TypeScript | React + Vite + TypeScript | :white_check_mark: |
| Styling | Tailwind CSS + shadcn/ui | Tailwind CSS v4 (custom components, no shadcn) | :large_orange_diamond: |
| Drag & Drop | `@dnd-kit/core` | `@dnd-kit/core` + `@dnd-kit/sortable` | :white_check_mark: |
| Routing | React Router v6 | React Router v6 | :white_check_mark: |
| State Management | Zustand or React Query | Zustand | :white_check_mark: |
| API | Cloudflare Workers (Hono recommended) | Cloudflare Workers with Hono | :white_check_mark: |
| Database | Cloudflare D1 (SQLite) | Cloudflare D1 | :white_check_mark: |
| Auth | Google OAuth 2.0, JWT | Email/password, JWT | :large_orange_diamond: |
| Email | Resend (preferred) or Mailgun | Resend | :white_check_mark: |
| Deployment | Cloudflare Pages + Workers | Cloudflare Pages + Workers | :white_check_mark: |
| CI/CD | GitHub Actions → `wrangler deploy` | GitHub Actions → `wrangler deploy` | :white_check_mark: |
| Fonts | Inter (Google Fonts) | DM Sans + JetBrains Mono | :large_orange_diamond: |

---

## 6. Data Models

### `users` — :white_check_mark: BUILT with extensions

**Original spec fields — all present:**
- `id` (TEXT PRIMARY KEY, UUID) :white_check_mark:
- `email` (TEXT UNIQUE NOT NULL) :white_check_mark:
- `name` (TEXT NOT NULL) :large_orange_diamond: Split into `first_name` + `last_name`
- `avatar_url` (TEXT) :x: NOT BUILT — no avatar URLs stored
- `role` (TEXT NOT NULL DEFAULT 'viewer') :white_check_mark: + added `suspended` state
- `created_at` (INTEGER NOT NULL) :white_check_mark:
- `last_login` (INTEGER) :white_check_mark:

**:star: Added fields beyond spec:**
- `password_hash` (TEXT) — bcrypt hashed password
- `must_change_password` (INTEGER DEFAULT 1) — force password change on first login
- `first_name` / `last_name` (TEXT) — split name fields
- `theme` (TEXT DEFAULT 'dark') — dark/light theme preference
- `ticket_size` (TEXT DEFAULT 'small') — card size preference
- `notification_email` (TEXT) — separate email for notifications
- `notify_ticket_created` (INTEGER DEFAULT 1) — email preference toggle
- `notify_ticket_assigned` (INTEGER DEFAULT 1) — email preference toggle
- `notify_ticket_done` (INTEGER DEFAULT 1) — email preference toggle
- `notify_ticket_comment` (INTEGER DEFAULT 1) — email preference toggle
- `notify_user_registered` (INTEGER DEFAULT 1) — email preference toggle

### `tickets` — :white_check_mark: BUILT with extensions

**Original spec fields — all present:**
- `id` (TEXT PRIMARY KEY) :white_check_mark:
- `ticket_number` (INTEGER UNIQUE NOT NULL) :white_check_mark:
- `title` (TEXT NOT NULL) :white_check_mark:
- `description` (TEXT) :white_check_mark:
- `status` (TEXT NOT NULL DEFAULT 'backlog') :white_check_mark:
- `priority` (TEXT NOT NULL DEFAULT 'p2') :white_check_mark:
- `assignee_id` :large_orange_diamond: Replaced by `ticket_assignees` junction table (supports multiple assignees)
- `submitter_id` (TEXT NOT NULL REFERENCES users(id)) :white_check_mark:
- `due_date` :large_orange_diamond: Renamed to `edc` (estimated delivery/completion)
- `sort_order` (REAL NOT NULL) :white_check_mark:
- `created_at` (INTEGER NOT NULL) :white_check_mark:
- `updated_at` (INTEGER NOT NULL) :white_check_mark:

**:star: Added fields beyond spec:**
- `product_id` (TEXT REFERENCES products(id)) — links to product/project
- `product_version` (TEXT) — version string
- `ticket_type` (TEXT DEFAULT 'bug') — bug or feature classification

### `ticket_tags` — :white_check_mark: BUILT as specified.

### `comments` — :white_check_mark: BUILT as specified.

### `attachments` — :white_check_mark: BUILT as specified.

### `audit_log` — :large_orange_diamond: Table created in migrations but not actively populated or displayed in the UI.

### :star: Additional tables added beyond spec:

**`columns`** — Custom workflow column definitions:
```sql
- id, name, sort_order, color, is_initial, is_terminal, created_at
- Pre-seeded: backlog, todo, in_progress, in_review, done
```

**`products`** — Project/product catalog:
```sql
- id, name, abbreviation, color, default_owner_id, created_at
- Pre-seeded: Genie, Genman, Picker
```

**`ticket_assignees`** — Multi-assignee junction table:
```sql
- ticket_id, user_id (composite primary key)
```

**`push_subscriptions`** — Browser push notification subscriptions:
```sql
- id, user_id, endpoint, p256dh, auth, created_at
```

**`ticket_last_seen`** — Track when users last viewed tickets:
```sql
- ticket_id, user_id, last_seen_at (composite primary key)
```

---

## 7. Feature Specifications

### 7.1 Authentication Flow

**Routes:**
- :x: `GET /auth/google` — Not built (no Google OAuth)
- :x: `GET /auth/google/callback` — Not built (no Google OAuth)
- :white_check_mark: `POST /auth/logout` — Clears the session cookie
- :x: `GET /auth/error` — Not built (errors handled inline on login page)

**:star: Routes added:**
- `POST /auth/login` — Email/password authentication
- `POST /auth/setup` — One-time initial admin creation
- `POST /auth/change-password` — Password change + notification email setup

**Frontend:**
- :white_check_mark: Unauthenticated users on any route are redirected to `/login`
- :large_orange_diamond: `/login` page shows email/password form (not Google sign-in button)
- :white_check_mark: No Google OAuth UI anywhere in the application

**Error states:**
- :large_orange_diamond: Domain mismatch → enforced at user creation by admin, not at OAuth callback
- :x: New user pending role holding page — not needed since admins create accounts with assigned roles

---

### 7.2 Ticket Submission (Decision Maker Portal)

**Route:** `/submit` — :white_check_mark: BUILT

**Access:** :white_check_mark: Decision Maker, Dev, Admin. Viewers cannot access.

**Submission Form Fields:**

| Field | Spec | Status | Notes |
|---|---|---|---|
| Title | Text input, max 200 chars | :white_check_mark: BUILT | |
| Description | Textarea, markdown, min 20 chars | :white_check_mark: BUILT | |
| Priority | Dropdown P0–P3, default P2 | :white_check_mark: BUILT | |
| Tags | Multi-select, comma-separated, max 5 | :white_check_mark: BUILT | |
| Due Date | Date picker, future date | :large_orange_diamond: BUILT as "EDC" (Estimated Delivery/Completion) | |
| Attachments | File upload, max 3, 10MB each | :white_check_mark: BUILT | R2 storage with presigned URLs |
| :star: Product | Dropdown | ADDED | Select from admin-defined products |
| :star: Product Version | Text input | ADDED | Version string |
| :star: Ticket Type | Bug / Feature | ADDED | Classification field |
| :star: Assignees | Multi-select | ADDED | Assign one or more devs/admins |

**Priority Labels:** :white_check_mark: All four levels implemented with color coding.

**On Submit:**
1. :white_check_mark: Worker creates ticket in D1 with status `backlog` (or initial column).
2. :white_check_mark: Ticket number auto-assigned sequentially (`PDO-1`, `PDO-2`, etc.).
3. :white_check_mark: Success feedback shown to submitter.
4. :white_check_mark: Email notification sent to devs/admins (respecting individual preferences).

**My Submissions View:**
- :x: NOT BUILT as specified — there is no "My Submissions" table below the form on the submit page. However, the board's "My Tickets" filter achieves similar functionality.

---

### 7.3 Kanban Board (Dev View)

**Route:** `/board` — :white_check_mark: BUILT

**Access:** :white_check_mark: All roles (Viewers/Decision Makers read-only, Devs/Admin full interaction).

#### Board Layout — :white_check_mark: BUILT

:large_orange_diamond: Originally specified as five fixed columns. Actual implementation uses **dynamic columns** managed by admins, pre-seeded with the five specified columns (Backlog, To Do, In Progress, In Review, Done).

#### Ticket Cards — :white_check_mark: BUILT

| Element | Status | Notes |
|---|---|---|
| Ticket number (e.g., `PDO-42`) | :white_check_mark: | Top of card |
| Title (bold, truncated) | :white_check_mark: | |
| Priority badge (color-coded) | :white_check_mark: | P0=red, P1=orange, P2=indigo, P3=gray |
| Assignee avatar | :large_orange_diamond: | Shows initials (no uploaded avatar images), supports multiple assignees |
| Due date (red if overdue) | :white_check_mark: | Shown as "EDC", green when in terminal column |
| Comment count | :x: | Not shown on card |
| Attachment count | :x: | Not shown on card |
| Tag chips (max 2, +N) | :white_check_mark: | Max 5 shown with +N overflow |
| :star: Product badge | ADDED | Color-coded abbreviation |
| :star: Ticket type badge | ADDED | Bug (red) / Feature (green) |
| :star: Created date | ADDED | Shown on card |
| :star: Two card sizes | ADDED | Small/large toggle, per-user preference |

#### Drag & Drop — :white_check_mark: BUILT

- :white_check_mark: Devs and Admins can drag cards between columns using `@dnd-kit`
- :white_check_mark: Card order preserved using fractional indexing on `sort_order`
- :white_check_mark: Optimistic UI update on drop
- :white_check_mark: Viewers and Decision Makers cannot drag cards
- :star: Active drag overlay shown during drag
- :star: Custom collision detection (pointerWithin + rectIntersection)

#### Ticket Detail Modal — :white_check_mark: BUILT

- :white_check_mark: All form fields editable inline (Devs/Admin only)
- :white_check_mark: Assignee selector (searchable, supports multiple assignees)
- :white_check_mark: Status selector (changing status moves the card)
- :white_check_mark: Comments thread with input box
- :white_check_mark: Attachment list with download links and upload button
- :x: Audit trail timeline — not shown in modal (table exists but not wired to UI)
- :star: @Mentions in comments with autocomplete

#### Filtering & Search — :large_orange_diamond: PARTIALLY BUILT

| Filter | Status | Notes |
|---|---|---|
| Search (title/description) | :white_check_mark: BUILT | |
| Assignee filter | :x: NOT BUILT | Not as a standalone filter on the toolbar |
| Priority filter | :white_check_mark: BUILT | Multi-select P0–P3 |
| Tag filter | :x: NOT BUILT | API supports it, but no UI filter |
| My tickets toggle | :white_check_mark: BUILT | Shows tickets assigned to current user |
| Clear filters | :white_check_mark: BUILT | Resets all |
| :star: Product filter | ADDED | Single-select dropdown |

---

### 7.4 Admin Panel

**Route:** `/admin` — :white_check_mark: BUILT

**Access:** :white_check_mark: Admin only. Other roles cannot access.

#### User Management — :white_check_mark: BUILT

| Feature | Status | Notes |
|---|---|---|
| Table of all users | :white_check_mark: | Name, Email, Role, Last Login, Joined Date |
| Inline role change | :white_check_mark: | Dropdown with confirmation |
| Cannot demote last Admin | :white_check_mark: | Guarded in both UI and API |
| Remove user (soft-delete) | :white_check_mark: | Sets role to `suspended` |
| :star: Create user | ADDED | Admin can create accounts with email, name, temp password, role |
| :star: Edit user | ADDED | Admin can edit name, email, role |
| :star: Permanent delete | ADDED | Full deletion with FK cascade cleanup |

#### System Stats
- :large_orange_diamond: Basic stats available on a separate `/stats` page (not embedded in admin panel). Shows ticket counts, completion rates, project breakdown.

#### :star: Project/Product Management — ADDED (not in original spec)

- List products with abbreviation, color, default owner
- Create/edit/delete products
- Color picker and owner selector
- Guard: cannot delete product with assigned tickets

#### :star: Column/Status Management — ADDED (not in original spec)

- List columns with sort order and color
- Create/edit/delete columns
- Reorder columns via admin UI
- Initial/terminal column flags
- Guards: cannot delete column with tickets, must keep at least one initial and one terminal column

---

### 7.5 Notifications

#### Email — :white_check_mark: BUILT

All emails sent via **Resend** from `PDO Kanban <noreply@pre-pro.cc>`.

| Event | Spec | Status | Notes |
|---|---|---|---|
| New ticket submitted | All Devs + Admins | :white_check_mark: BUILT | Also notifies product default owner |
| New user signed up | All Admins + Devs | :large_orange_diamond: BUILT | Triggered when admin creates user, sent to admins with notification pref enabled |
| Ticket assigned to me | Assignee only | :white_check_mark: BUILT | |
| Ticket moved to In Review | Submitter only | :large_orange_diamond: BUILT | Generic status change email for any column move, not just In Review |
| Ticket moved to Done | Submitter only | :large_orange_diamond: BUILT | Generic status change email for any column move, not just Done |
| :star: New comment posted | | ADDED | Sent to submitter + other assignees |

**:star: Notification Preferences — ADDED (not in original spec)**
- 5 per-user toggles: ticket created, assigned, done, comments, user registered
- Separate notification email address (optional, falls back to login email)
- All preferences respected before sending

**Implementation:**
- :white_check_mark: Fire-and-forget from the Worker (non-blocking)
- :white_check_mark: HTML email templates with inline styles
- :white_check_mark: Subject line sanitization (HTML escaping, length capping)

#### :star: Web Push Notifications — ADDED (not in original spec)

- Service worker (`sw.js`) for push event handling
- VAPID authentication with key generation
- AES-128-GCM encryption
- Browser Notification API integration
- Per-user subscription management via API
- Push sent for: new ticket, assignment, comment, status change
- Deep linking on notification click

---

## 8. UI/UX Guidelines

### Design Principles — :white_check_mark: All principles followed.

- :white_check_mark: Clean and dense — optimized for power users
- :white_check_mark: Dark mode first — dark neutral base with light text
- :white_check_mark: Minimal chrome — no unnecessary sidebars or decorative elements
- :white_check_mark: Fast feel — optimistic UI updates, no full-page reloads

### Color Palette

:large_orange_diamond: **MODIFIED** — Uses a warm slate palette instead of zinc, with a desaturated indigo accent (`#7c7fdf`) instead of standard indigo-500.

| Element | Spec | Implemented |
|---|---|---|
| App background | `#09090b` (zinc-950) | Warm dark slate (custom) |
| Cards/surfaces | `#18181b` (zinc-900) | Custom dark surface |
| Accent | `#6366f1` (indigo-500) | `#7c7fdf` (desaturated indigo) |
| P0 badge | Red | :white_check_mark: Red |
| P1 badge | Orange | :white_check_mark: Orange |
| P2 badge | Indigo | :white_check_mark: Indigo |
| P3 badge | Gray | :white_check_mark: Gray |

### Typography

:large_orange_diamond: **MODIFIED:**
- Spec: **Inter** — Implemented: **DM Sans** (primary) + **JetBrains Mono** (monospace)
- :white_check_mark: Smooth font rendering with antialiasing

### Component Library

:large_orange_diamond: **MODIFIED:**
- Spec called for **shadcn/ui** — **not used**. All components are custom-built with Tailwind CSS v4.

### Responsive Behavior
- :white_check_mark: Kanban board is primarily desktop. Columns handle small screens.
- :white_check_mark: Submission form and admin panel are responsive.
- :star: Dark/light theme toggle (spec said dark-only in v1, but both themes were built)

---

## 9. API Specification

All endpoints served from Cloudflare Worker. Base path: `/api/v1`

All authenticated endpoints require valid JWT cookie. Invalid/missing JWT → `401 Unauthorized`.

### Auth

| Method | Path | Spec | Status |
|---|---|---|---|
| `GET` | `/auth/google` | Redirect to Google OAuth | :x: NOT BUILT |
| `GET` | `/auth/google/callback` | OAuth callback | :x: NOT BUILT |
| `POST` | `/auth/logout` | Clear session cookie | :white_check_mark: BUILT |
| `POST` | `/auth/login` | :star: | ADDED — email/password auth |
| `POST` | `/auth/setup` | :star: | ADDED — initial admin creation |
| `POST` | `/auth/change-password` | :star: | ADDED — password change + notification email |

### Users

| Method | Path | Role | Spec | Status |
|---|---|---|---|---|
| `GET` | `/api/v1/users/me` | Any | Get current user | :white_check_mark: BUILT |
| `GET` | `/api/v1/users` | Admin | List all users | :white_check_mark: BUILT |
| `PATCH` | `/api/v1/users/:id/role` | Admin | Change role | :white_check_mark: BUILT |
| `DELETE` | `/api/v1/users/:id` | Admin | Suspend/delete user | :white_check_mark: BUILT |
| `POST` | `/api/v1/users` | Admin | :star: | ADDED — create user |
| `PATCH` | `/api/v1/users/:id` | Admin | :star: | ADDED — edit user |
| `PATCH` | `/api/v1/users/me/theme` | Any | :star: | ADDED — set theme preference |
| `PATCH` | `/api/v1/users/me/ticket-size` | Any | :star: | ADDED — set card size preference |
| `PATCH` | `/api/v1/users/me/profile` | Any | :star: | ADDED — update name, email |
| `PATCH` | `/api/v1/users/me/email-preferences` | Any | :star: | ADDED — notification toggles |
| `GET` | `/api/v1/users/names` | Any | :star: | ADDED — user names for @mentions |

### Tickets

| Method | Path | Role | Spec | Status |
|---|---|---|---|---|
| `GET` | `/api/v1/tickets` | Any | List tickets (filtered) | :white_check_mark: BUILT |
| `POST` | `/api/v1/tickets` | DM+ | Create ticket | :white_check_mark: BUILT |
| `GET` | `/api/v1/tickets/:id` | Any | Get ticket detail | :white_check_mark: BUILT |
| `PATCH` | `/api/v1/tickets/:id` | Dev+ / own | Update ticket | :white_check_mark: BUILT |
| `PATCH` | `/api/v1/tickets/:id/move` | Dev+ | Move + reorder | :white_check_mark: BUILT |
| `DELETE` | `/api/v1/tickets/:id` | Admin | Delete ticket | :white_check_mark: BUILT |

### Comments

| Method | Path | Role | Spec | Status |
|---|---|---|---|---|
| `GET` | `/api/v1/tickets/:id/comments` | Any | List comments | :white_check_mark: BUILT |
| `POST` | `/api/v1/tickets/:id/comments` | DM+ | Add comment | :white_check_mark: BUILT |
| `PATCH` | `/api/v1/comments/:id` | Author/Admin | Edit comment | :white_check_mark: BUILT |
| `DELETE` | `/api/v1/comments/:id` | Author/Admin | Delete comment | :white_check_mark: BUILT |

### Attachments

| Method | Path | Role | Spec | Status |
|---|---|---|---|---|
| `POST` | `/api/v1/tickets/:id/attachments/upload-url` | DM+ | Presigned R2 URL | :white_check_mark: BUILT |
| `POST` | `/api/v1/tickets/:id/attachments` | DM+ | Register attachment | :white_check_mark: BUILT |
| `DELETE` | `/api/v1/attachments/:id` | Admin/uploader | Delete attachment | :white_check_mark: BUILT |
| `PUT` | `/api/v1/tickets/:id/attachments/upload` | DM+ | :star: | ADDED — direct upload to R2 |
| `GET` | `/api/v1/tickets/:id/attachments` | Any | :star: | ADDED — list attachments |

### :star: Columns (ADDED — not in original spec)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/columns` | Any | List columns |
| `POST` | `/api/v1/columns` | Admin | Create column |
| `PATCH` | `/api/v1/columns/:id` | Admin | Edit column |
| `POST` | `/api/v1/columns/reorder` | Admin | Batch reorder |
| `DELETE` | `/api/v1/columns/:id` | Admin | Delete column |

### :star: Projects/Products (ADDED — not in original spec)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/projects` | Any | List products |
| `POST` | `/api/v1/projects` | Admin | Create product |
| `PATCH` | `/api/v1/projects/:id` | Admin | Edit product |
| `DELETE` | `/api/v1/projects/:id` | Admin | Delete product |

### :star: Push Notifications (ADDED — not in original spec)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/push/vapid-key` | Any | Get public VAPID key |
| `POST` | `/api/v1/push/subscribe` | Any | Register push subscription |
| `DELETE` | `/api/v1/push/unsubscribe` | Any | Unregister subscription |

### Response Format — :white_check_mark: BUILT as specified.

```json
{ "data": { ... }, "error": null }
```

---

## 10. Deployment

### Repository Structure — :white_check_mark: BUILT as specified.

```
/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── pages/     # LoginPage, BoardPage, SubmitPage, AdminPage, etc.
│   │   ├── components/# KanbanColumn, TicketCard, TicketDetailModal, etc.
│   │   ├── store.ts   # Zustand state management
│   │   └── main.tsx
│   ├── public/
│   │   └── sw.js      # Service worker for push notifications
│   └── vite.config.ts
├── worker/            # Cloudflare Worker (Hono)
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/    # auth, tickets, comments, attachments, users, columns, projects, push
│   │   ├── middleware/ # auth middleware
│   │   ├── email.ts   # Resend email service
│   │   └── push.ts    # Web push service
│   └── wrangler.toml
├── migrations/        # 16 D1 SQL migration files (0001–0016)
└── .github/
    └── workflows/
        └── deploy.yml
```

### `wrangler.toml` — :white_check_mark: BUILT

- :white_check_mark: D1 database binding configured
- :white_check_mark: R2 bucket binding for attachments
- :white_check_mark: Frontend URL environment variable
- :white_check_mark: Secrets via `wrangler secret put` (JWT_SECRET, EMAIL_API_KEY, VAPID keys)
- :x: Google OAuth client ID/secret not configured (not needed — no OAuth)

### Cloudflare Pages — :white_check_mark: BUILT

- :white_check_mark: Vite build for frontend
- :white_check_mark: `VITE_API_BASE_URL` environment variable

### CI/CD — :white_check_mark: BUILT

GitHub Actions workflow on push to `main`:
1. :white_check_mark: Type-check (tsc for frontend + worker)
2. :white_check_mark: Build (Vite frontend)
3. :white_check_mark: D1 migrations applied before deploy
4. :white_check_mark: `wrangler deploy` for the Worker
- :x: Lint step not included
- :x: Unit tests not included (none written)

### D1 Migrations — :white_check_mark: BUILT

- 16 numbered SQL migration files in `/migrations/`
- Applied via `wrangler d1 migrations apply`

---

## 11. Out of Scope (v1)

| Item | Status |
|---|---|
| Slack or webhook integrations | :white_check_mark: Stayed out of scope |
| Customizable kanban columns | :large_orange_diamond: **Was built** — admins can add/edit/reorder/delete columns |
| Sprint or milestone planning | :white_check_mark: Stayed out of scope |
| Time tracking or logged hours | :white_check_mark: Stayed out of scope |
| SLA tracking | :white_check_mark: Stayed out of scope |
| Two-factor authentication | :white_check_mark: Stayed out of scope |
| Dark/light mode toggle | :large_orange_diamond: **Was built** — both themes with per-user toggle |
| Ticket watching / subscriptions | :white_check_mark: Stayed out of scope |
| Public read-only board sharing | :white_check_mark: Stayed out of scope |
| CSV/Excel export | :white_check_mark: Stayed out of scope |

---

## 12. Future Phases

### Phase 2

| Item | Status |
|---|---|
| Admin-configurable kanban columns | :white_check_mark: **Already built in v1** |
| Slack notifications | :x: Not built |
| Dark/light mode toggle | :white_check_mark: **Already built in v1** |
| Ticket watching | :x: Not built |

### Phase 3

| Item | Status |
|---|---|
| Sprint/milestone grouping | :x: Not built |
| Burn-down or velocity charts | :x: Not built (basic stats page exists) |
| Bulk ticket operations | :x: Not built |
| Ticket dependencies / blocking | :x: Not built |
| CSV export from Admin panel | :x: Not built |

---

## 13. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | What transactional email provider? | Infrastructure | **Resolved — Resend** |
| 2 | Should Done auto-archive after N days? | Product | Open |
| 3 | Intended subdomain? | Infrastructure | **Resolved — pdo-kanban.pages.dev (Cloudflare Pages)** |
| 4 | Expected peak concurrent users? | Engineering | Open |
| 5 | Can DMs edit tickets after moved off Backlog? | Product | Open |
| 6 | Tag taxonomy or free-form? | Product | **Resolved — Free-form tags, max 5 per ticket** |

---

## 14. Features Added Beyond Original Spec

The following significant features were built but were not part of the original PRD:

### Product/Project Management
- Products table with name, abbreviation, color, and default owner
- Tickets linked to products for categorization
- Product filter on the Kanban board
- Admin CRUD for products

### Multi-Assignee Support
- Original spec had single `assignee_id` — implementation uses a junction table supporting multiple assignees per ticket
- Searchable multi-select assignee picker in ticket forms

### Ticket Type Classification
- Bug vs Feature classification with color-coded badges on cards

### List View (Alternative to Kanban)
- Full table-based view with sortable columns (7 sort keys)
- Inline editing for title, description, EDC, and assignees
- Toggle between Kanban and List view on the board page

### Web Push Notifications
- Full service worker implementation with VAPID authentication
- AES-128-GCM encryption for push payloads
- Deep linking on notification click
- Per-user subscription management

### @Mentions in Comments
- Autocomplete user names when typing `@` in comments
- Visual highlighting of mentions

### Profile Page
- Dedicated `/profile` page for user settings
- Password change (self-service)
- Notification email configuration
- Email notification preference toggles (5 categories)
- Theme preference (dark/light)
- Card size preference (small/large)
- Push notification subscription management

### Stats Page
- Dedicated `/stats` page with ticket statistics
- Completion rates and project breakdown

### Admin User Creation
- Admins can create user accounts directly (with temporary password)
- Mandatory password change on first login
- Permanent user deletion with FK cascade cleanup (in addition to soft-delete/suspend)

### Column Management
- Admin-configurable workflow columns (originally listed as Phase 2)
- Column colors, ordering, and initial/terminal flags
- Guards preventing deletion of columns with tickets

### Dark/Light Theme Toggle
- Originally listed as Phase 2 / out-of-scope for v1
- Both themes fully implemented with per-user persistence
