# AFEON Books

AFEON Books is a TypeScript monorepo for the AFEON Books storefront, admin dashboard, point-of-sale tools, and Express API.

## Stack

- React and Vite for the storefront and admin applications
- Express 5 for the API
- PostgreSQL with Drizzle ORM
- TypeScript, Zod, TanStack Query, and pnpm workspaces
- Cloudflare Worker routing for the production site and API

## Repository Layout

| Path | Purpose |
| --- | --- |
| `artifacts/site` | Public storefront and customer account pages |
| `artifacts/admin` | Admin editor, order management, POS, and dev tools |
| `artifacts/api-server` | Express API server |
| `lib/db` | Drizzle database package and schema |
| `lib/api-spec` | OpenAPI specification and code generation |
| `lib/api-client-react` | Generated React API client |
| `worker.js` | Production Cloudflare routing and API forwarding |

## Requirements

- Node.js 24
- pnpm
- PostgreSQL

Install dependencies from the repository root:

```bash
pnpm install
```

The workspace enforces a 24-hour minimum package release age and only permits approved dependency build scripts. Do not disable these protections without a specific security review.

## Development

Run the API with a required port and database connection:

```bash
PORT=5000 DATABASE_URL=postgres://user:password@localhost:5432/afeonbooks \
	pnpm --filter @workspace/api-server run dev
```

Run the storefront in another terminal:

```bash
pnpm --filter @workspace/site run dev
```

Run the admin application in another terminal:

```bash
API_URL=https://api.afeonbooks.com \
	pnpm --filter @workspace/admin run dev
```

The admin Vite server proxies `/api` requests to `API_URL`. For a local API, set `API_URL=http://localhost:5000` instead. The site and admin Vite ports can be overridden with `PORT`.

## Common Commands

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/site run typecheck
pnpm --filter @workspace/admin run typecheck
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

`db run push` is intended for development databases. Review schema changes before applying them to production.

## Production API

The canonical API origin is:

```text
https://api.afeonbooks.com
```

The production Cloudflare Worker forwards `/api/*` requests from the main site to that origin. The previous Render API hostname should not be used.

## Admin Access

The admin editor requires the four-digit PIN configured in the `site_content.admin_pin` database field. Open the admin application at `/admin/` in production or `/editor` in the Vite development app.

The admin-only development testing API is:

```http
POST /api/dev-testing/start
POST /api/dev-testing/stop
GET  /api/dev-testing/status
```

It snapshots orders, order items, and products, then restores them when the ten-minute session ends or is stopped.

## Loyalty Points

Checkout displays estimated points, but points are not credited when an order is first placed. The API awards points when staff changes the order status to `delivered` or `completed`.

The current award formula is:

```text
floor(total in cents / 100) * 50 points
```

Customers can view their balance and transactions through `GET /api/auth/loyalty` while signed in.

## API Code Generation

When the OpenAPI contract changes, regenerate the client and Zod types:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Generated files live under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`.
