# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # Run ESLint
npm run format       # Prettier format all TS/TSX files
npm run typecheck    # Type check without emitting
```

## Architecture

This is a **Next.js 16 App Router** project using **React 19**, **TypeScript**, **Tailwind CSS v4**, and **shadcn/ui** components.

- `app/` — Next.js App Router pages and layouts. `layout.tsx` wraps everything in a `ThemeProvider`.
- `components/ui/` — shadcn/ui components (add new ones via `npx shadcn add <component>`).
- `components/theme-provider.tsx` — Wraps `next-themes`; also binds the `d` key to toggle dark/light mode.
- `lib/utils.ts` — Exports `cn()` (clsx + tailwind-merge) for conditional Tailwind class merging.
- `hooks/` — Custom React hooks.

**Styling:** Uses Tailwind CSS v4 with OKLCH-based CSS variables for semantic colors (defined in `app/globals.css`). Import path alias `@/*` maps to the project root.

**Adding shadcn components:** `npx shadcn add <component-name>` — components are placed in `components/ui/`.
