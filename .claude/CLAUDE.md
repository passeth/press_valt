# Press Vault — Project Guidelines

## Overview
Multi-user knowledge platform: read articles → scrap highlights → collect materials → AI-assisted writing → publish personal press.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 (no tailwind.config — use `@theme {}` in globals.css)
- **AI**: Vercel AI SDK with OpenAI + Anthropic providers
- **State**: Zustand
- **Content**: Markdown files in `content/` → `scripts/sync-content.ts` → Supabase DB

## Architecture
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components organized by domain (ui/, layout/, article/, scrap/, collection/, writing/, press/, admin/)
- `src/lib/` — Utilities (supabase/, ai/)
- `src/types/` — TypeScript types (database.ts is source of truth)
- `src/stores/` — Zustand stores
- `src/hooks/` — Custom React hooks
- `scripts/` — Build scripts (sync-content.ts)
- `content/` — Markdown articles (Obsidian → Git → build sync)
- `docs/` — PRD.md and FSD.md (Korean)

## Conventions
- **Language**: UI text in Korean, code/comments in English
- **Components**: Server Components by default, "use client" only when needed
- **Styling**: Tailwind utility classes, design tokens from globals.css `@theme {}`
- **Types**: Import from `@/types` (re-exports from database.ts)
- **Supabase**: Server → `createClient()` from `@/lib/supabase/server`, Browser → `createClient()` from `@/lib/supabase/client`
- **API Routes**: `src/app/api/[domain]/route.ts` pattern
- **No `as any`**, no `@ts-ignore`, no `@ts-expect-error`

## Design Reference
- Magazine B (https://magazine-b.com/) — minimal editorial aesthetic
- White background, Noto Sans KR + Inter, monochrome with yellow highlights
- Content max-width: 1200px, article prose: 720px

## Key Patterns
- Article blocks have `data-block-id` for scrap anchoring
- Text selection → floating button → ScrapModal (thinkingnote pattern)
- Writing wizard: 6-step agentic pipeline with streaming
- Admin content: Obsidian → Git push → prebuild sync → Supabase upsert

## Commands
- `npm run dev` — Development server
- `npm run build` — Production build (runs sync-content first)
- `npm run sync-content` — Sync markdown to Supabase (requires env vars)
