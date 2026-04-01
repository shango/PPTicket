# PDO Kanban

Internal ticketing system for the PDO Experts team. Decision makers submit tickets, developers manage them on a kanban board.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Cloudflare Workers + Hono
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** Google OAuth 2.0

## Getting Started

```bash
# Install dependencies
npm install
cd worker && npm install

# Run the API locally
cd worker && npm run dev

# Run the frontend locally (proxies API to :8787)
cd frontend && npx vite
```

## Deployment

- **Worker:** `cd worker && npm run deploy`
- **Frontend:** Connected to Cloudflare Pages via GitHub
- **Migrations:** `cd worker && npx wrangler d1 migrations apply pdo-kanban-db`

Set secrets with `wrangler secret put`: `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `EMAIL_API_KEY`.
