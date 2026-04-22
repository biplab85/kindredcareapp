# Frontend — Next.js 16

## Critical Warning
This is Next.js 16 — APIs, conventions, and file structure differ from earlier versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Mandatory: Use `frontend-design` Skill
Every frontend task (components, pages, layouts, any UI) must use the `frontend-design` skill. Invoke it via the Skill tool before writing code. No exceptions.

## Framework Rules
- **App Router only** — no Pages Router
- **Server Components by default** — add `"use client"` only when the component uses hooks, event handlers, or browser APIs
- **React 19** — no `setState` inside `useEffect`. Use `useSyncExternalStore` for external state (localStorage, window events)
- **TypeScript strict** — run `npm run typecheck` before reporting any task as done

## shadcn/ui v4 (base-ui)
This version uses `@base-ui/react`, NOT `@radix-ui`. Key differences:
- **No `asChild` prop** — use `render` prop for component composition
- **`TooltipProvider`** uses `delay`, not `delayDuration`
- **Always read the component source** in `src/components/ui/` before using — APIs differ from online shadcn docs
- Components installed: Button, Input, Textarea, Select, Checkbox, Dialog, Card, Badge, Avatar, Alert, Skeleton, Progress, Separator, Dropdown Menu, Label, Switch, Tooltip, Sonner

## Custom Components
- `src/components/ui/star-rating.tsx` — 1-5 stars, readonly + interactive modes
- `src/components/ui/step-indicator.tsx` — Multi-step progress for onboarding/gig creation
- `src/components/ui/large-text-toggle.tsx` — Accessibility toggle, persists to localStorage

## Design Tokens
- All brand colors in `src/app/globals.css` — derived from the logo (`public/logo.png`)
- Primary = Trust Blue (`oklch(0.56 0.13 240)`)
- Accent = Heart Red (`oklch(0.60 0.20 25)`)
- Success = Leaf Green (`oklch(0.58 0.14 155)`)
- Font: DM Sans (variable `--font-sans`)
- Large text mode: `.large-text` class on `<html>`
- Dark mode: `.dark` class on `<html>`
- Preview all components: `http://localhost:3000/design-system`

## API Integration
- Axios instance at `src/lib/api.ts` — use this for ALL API calls
- `withCredentials: true` + `withXSRFToken: true` for Laravel Sanctum cookie auth
- Base URL from `NEXT_PUBLIC_API_URL` env var (default: `http://localhost:8000`)
- CSRF cookie: `GET /sanctum/csrf-cookie` before auth requests

## Quality Checklist
Before any task is done:
1. `npm run lint` — passes
2. `npm run typecheck` — passes
3. `npm run format` — applied
4. Tested in browser on desktop and mobile widths
5. Keyboard navigation works
6. WCAG 2.1 AA contrast ratios met

## Environment
- Dev server: `npm run dev` → `http://localhost:3000`
- Env file: `.env.local` (gitignored)
- Backend API: `http://localhost:8000` (run `php artisan serve` in `backend/`)
