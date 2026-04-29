# KindredCare Global

## What Is This Project
A Fiverr-style gig marketplace for senior care in Canada. **Caregivers** publish gigs as productized service listings (each gig = one service, one hourly rate, what's included, photos). **Families** browse the marketplace with manual filters and AI ranking against the care recipient's profile, then book a chosen gig — the booking carries the date/time, address, and any recurrence. Background-checked caregivers, payment flows through the platform at 7.5% commission. MVP targets Durham Region, Ontario with non-medical services only (companionship, errands, tech help, gardening, walking companion).

> **Note on direction**: a chunk of the existing code (`gigs` table with `family_profile_id`, `/gigs/new` family wizard, `/jobs` caregiver feed, `MatchingEngine::matchesFor(Gig)`) was built around an inverted "family posts a gig" model. That's legacy — it's pending migration to the Fiverr direction described above. Default to the Fiverr model when planning new work.

## Tech Stack
- **Backend:** Laravel 12 (PHP 8.3) — API only, no Blade views
- **Frontend:** Next.js 16 (React 19, TypeScript, Tailwind CSS v4, shadcn/ui v4)
- **Database:** MySQL 8.0+ (spatial index for geo queries)
- **Auth:** Laravel Sanctum (SPA cookie auth + API tokens)
- **Real-time:** Laravel Reverb (WebSocket)
- **Payments:** Stripe Connect via Laravel Cashier
- **Identity verification:** Veriff
- **Background checks:** Certn (CPIC, AML, references)
- **SMS:** Twilio
- **Maps:** Mapbox
- **Email:** Brevo or Resend (log driver in dev)

## Local Development Environment
- **PHP:** `php artisan serve` (built-in PHP dev server). Run from `backend/` via `php artisan serve` — starts on port 8000.
- **MySQL:** DBngin — database `kindredcare_v2`, root user, no password
- **Backend URL:** `http://localhost:8000` (artisan serve)
- **Frontend URL:** `http://localhost:3000` (Next.js dev server)
- **No Docker.** Everything runs natively on macOS.
- **No Redis.** File-based cache, database queue driver.
- **No S3.** Local disk storage. S3 deferred to v1.1.

## Repository Structure
```
kindredcare_v2/
├── backend/              # Laravel 12 API
├── frontend/             # Next.js 16 app
├── .github/workflows/    # CI/CD (GitHub Actions)
├── .husky/               # Git hooks (lint-staged)
├── mvp-requirements.md   # Source of truth for MVP scope
├── build-plan.md         # Phased build plan with task checkboxes
└── package.json          # Root — husky + lint-staged only
```

## Git Rules
- Create a new branch for every feature or task: `feature/short-description`
- Never commit directly to `main`
- Push branch, create PR, then merge to main
- Never use `--force`, `--no-verify`, `reset --hard`, or destructive commands without explicit permission
- Never commit `.env`, credentials, API keys, or secrets
- Commit messages: explain the "why", not just the "what"
- Husky pre-commit hook runs lint-staged automatically — don't bypass it

## Code Quality Commands
### Backend
```bash
cd backend
composer format          # Auto-fix code style (Laravel Pint)
composer format:check    # Check without fixing (CI)
composer analyse         # Static analysis (Larastan level 5)
composer test            # Run tests (Pest/PHPUnit)
```

### Frontend
```bash
cd frontend
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier auto-fix
npm run format:check     # Prettier check (CI)
npm run typecheck        # TypeScript type check
npm run build            # Production build
```

Always run linters and typecheck before reporting a task as done.

## Frontend Work — MANDATORY RULE
**Always use the `frontend-design` skill when working on any frontend task.** This includes components, pages, layouts, landing page, design system, or any UI code. Invoke it via the Skill tool before writing frontend code. No exceptions.

## Brand Identity
Logo at `frontend/public/logo.png`. Three brand colors derived from it:
- **Primary — Trust Blue** `oklch(0.56 0.13 240)` → buttons, links, nav, focus rings
- **Accent — Heart Red** `oklch(0.60 0.20 25)` → CTAs, care moments, "New" badges
- **Success — Leaf Green** `oklch(0.58 0.14 155)` → verified, cleared, confirmed states
- All tokens in `frontend/src/app/globals.css`
- Font: DM Sans
- Design system preview: `http://localhost:3000/design-system`

## API Architecture
- Backend API base: `http://localhost:8000/api/`
- Frontend Axios client: `frontend/src/lib/api.ts` (withCredentials for Sanctum)
- CORS: `backend/config/cors.php` allows `localhost:3000`
- Sanctum stateful domains include `localhost:3000`
- Health check: `GET /api/health` → `{"status":"ok","app":"KindredCare","version":"0.1.0"}`

## Key Reference Files
- `mvp-requirements.md` — Full MVP spec: scope, features, data model, integrations, budget, timeline
- `build-plan.md` — 20-phase build plan with 120+ tasks. Check off tasks as completed.
- `backend/.env.example` — All environment variables with placeholders
- `frontend/src/app/globals.css` — Design tokens and color palette

## Things NOT to Do
- Don't add Docker, Redis, or S3 — local dev uses Herd + DBngin + local disk
- Don't suggest or create README.md files unless explicitly asked
- Don't add features beyond `mvp-requirements.md` scope without asking first
- Don't use third-party Laravel packages when Laravel has a built-in solution (Sanctum over Passport, built-in notifications over third-party, etc.)
- Don't run `migrate:fresh` without asking — it drops all tables
- Don't modify `.env` without mentioning it — the user may have custom values

## Known Gotchas
- shadcn/ui v4 uses **base-ui**, not Radix. No `asChild` prop — use `render` prop instead.
- `TooltipProvider` uses `delay` prop, not `delayDuration`
- Components import from `@base-ui/react`, not `@radix-ui`
- React 19 ESLint: no `setState` inside `useEffect` — use `useSyncExternalStore` for external state
- Next.js 16 has breaking changes — read `node_modules/next/dist/docs/` before using unfamiliar APIs
- Herd auto-updates `APP_URL` in `.env` when linking — don't overwrite it
- Port 3000 may be occupied by other projects — kill stale Node processes if needed
