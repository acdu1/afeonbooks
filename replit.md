# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- `site` — Editable children's book e-commerce store ("Totec Books"). Storefront at `/` with Shop (`/shop`), product detail (`/product/:id`), Cart (`/cart`, client-side localStorage), Checkout (`/checkout`, cash-on-delivery only), Order confirmation (`/order/:id`). Admin at `/editor` with four tabs: Site Content (singleton row, includes a Default Shipping Address block), Products (CRUD), Email (visual order-confirmation email editor with live iframe preview, send-test-email button, and an enable/disable toggle — variables `{{customerName}}`, `{{orderId}}`, `{{total}}`, `{{paymentMethod}}`, `{{shippingAddress}}`, `{{classroom}}`, `{{brandName}}`, `{{orderUrl}}` are interpolated), Recent Orders (includes a Source column that surfaces `utm_source · utm_medium` and the campaign name for attributed orders, "Direct" otherwise). Backend tables: `site_content`, `products`, `orders` (with nullable `utm_source / utm_medium / utm_campaign / utm_term / utm_content / referrer / landing_page` columns), `order_items`. Checkout's "Phone Number" field is labelled "Student ID (s100)" but stored as `customer_phone`. It offers two shipping options that mirror the payment method UI: "Ship to default address" (admin-configured address, customer enters only Classroom Number) or "Custom address" (customer enters full address). Order creation is a transaction that decrements stock, hardcodes `payment_method = cash_on_delivery`, copies the saved default address from `site_content` when `useDefaultAddress` is true, persists any captured UTM/referrer/landing-page fields, and (when `email_enabled = "true"` and `RESEND_API_KEY` is set) sends an HTML order confirmation via Resend asynchronously after responding. Email rendering, sending, and the test endpoint live in `artifacts/api-server/src/lib/email.ts` and `artifacts/api-server/src/routes/email.ts`. The client-side live preview shares the same template structure via `artifacts/site/src/lib/email-preview.ts`. UTM tracking is wired through `artifacts/site/src/lib/utm.tsx` (`UtmProvider` wraps the app inside `QueryClientProvider`): on first render it inspects `window.location.search` for `utm_source/utm_medium/utm_campaign/utm_term/utm_content`, and if any are present it captures them along with `document.referrer` and `landing_page` into `localStorage["afeon_utm"]` with a 30-day TTL. Checkout reads them via `useUtm()` + `utmPayload(utm)`, includes them in the `POST /api/orders` body, then calls `clearUtm()` on success so a single visit-source attaches to one order only. Direct/refresh visits leave the stored UTM intact until either checkout or TTL expiry.
