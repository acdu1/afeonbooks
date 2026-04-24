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

- `site` — Editable children's book e-commerce store ("Totec Books"). Storefront at `/` with Shop (`/shop`), product detail (`/product/:id`), Cart (`/cart`, client-side localStorage), Checkout (`/checkout`, cash-on-delivery only), Order confirmation (`/order/:id`). Admin at `/editor` with three tabs: Site Content (singleton row, includes a Default Shipping Address block), Products (CRUD), Recent Orders. Backend tables: `site_content`, `products`, `orders`, `order_items`. Checkout offers two shipping options that mirror the payment method UI: "Ship to default address" (admin-configured address, customer enters only Classroom Number) or "Custom address" (customer enters full address). Order creation is a transaction that decrements stock, hardcodes `payment_method = cash_on_delivery`, and—when `useDefaultAddress` is true—copies the saved default address from `site_content` onto the order.
