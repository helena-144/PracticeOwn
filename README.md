# PracticeOwn

A HIPAA-compliant SaaS platform that helps independent medical practices track credentials, audit
ownership compliance, monitor their independence score, and plan their exit.

## Tech stack

- **Next.js 14** (App Router, TypeScript strict mode, `src/` layout)
- **Tailwind CSS** + **shadcn/ui** (components hand-vendored under `src/components/ui`)
- **Supabase** — Postgres, Auth, Storage, RLS
- **Stripe** — subscription billing (Solo / Group plans)
- **Loops** — transactional email
- **PostHog** — product analytics

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev
```

### Environment variables

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API (server-only, bypasses RLS) |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Developers → Webhooks (after creating the endpoint) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_SOLO_PRICE_ID` / `STRIPE_GROUP_PRICE_ID` | Stripe dashboard → Products |
| `LOOPS_API_KEY` | Loops dashboard → Settings → API |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog project settings |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL (`http://localhost:3000` locally) |

`.env.local` is gitignored — never commit real credentials. `.env.example` documents the required
keys with empty placeholders.

### Supabase setup

This repo does not include SQL migrations. Before running the app against a real Supabase project,
create the following, matching the shapes in `src/types/database.ts`:

1. Tables: `organizations`, `profiles`, `credentials`, `ownership_records`, `independence_scores`,
   `exit_plans`, `documents`, `qa_threads`, `alerts`.
2. Row Level Security policies scoping every table to rows where `organization_id` matches the
   caller's `profiles.organization_id` (via `auth.uid()`).
3. A Storage bucket named `documents` for the Documentation Q&A file uploads.
4. Realtime enabled on the `alerts` table (used by `useAlerts` for live notifications).

### Stripe setup

Create two recurring Prices (Solo, Group) and point `STRIPE_SOLO_PRICE_ID` /
`STRIPE_GROUP_PRICE_ID` at them. Point a webhook endpoint at `/api/stripe/webhook` listening for
`checkout.session.completed`, `customer.subscription.*`, and `invoice.payment_failed`.

### Loops setup

Create transactional email templates matching the IDs in `src/lib/loops.ts`
(`LOOPS_TEMPLATES`), or update that map to your own template IDs.

## Project structure

```
src/
  app/
    (auth)/            # login, signup, forgot-password
    (dashboard)/        # dashboard, credentials, ownership-audit, independence-score,
                         # exit-planner, documentation-qa, settings, billing
    api/stripe/          # webhook, create-checkout, create-portal route handlers
    auth/callback/        # Supabase auth code exchange + first-login provisioning
  components/
    ui/                 # shadcn/ui primitives
    dashboard/          # sidebar, header
    forms/              # auth forms
    modals/             # credential form, confirm dialog
    charts/             # score gauge, category bar chart
    providers/          # theme + PostHog providers
  hooks/                # useCredentials, usePractice, useAlerts
  lib/                  # supabase, stripe, loops, posthog, utils
  types/                # database, practice, credentials
  middleware.ts          # session refresh + route protection
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
