# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
├── frontend/   # Next.js web interface
└── backend/    # FastAPI conversion API
```

---

## Frontend (`frontend/`)

### Commands

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run format       # Prettier format all TS/TSX files
npm run typecheck    # Type check without emitting
```

### Architecture

**Next.js 16 App Router** project using **React 19**, **TypeScript**, **Tailwind CSS v4**, and **shadcn/ui** components.

- `app/` — App Router pages and layouts. `layout.tsx` wraps everything in a `ThemeProvider`.
- `components/ui/` — shadcn/ui components (add new ones via `npx shadcn add <component>`).
- `components/theme-provider.tsx` — Wraps `next-themes`; binds the `d` key to toggle dark/light mode.
- `lib/utils.ts` — Exports `cn()` (clsx + tailwind-merge) for conditional Tailwind class merging.
- `hooks/` — Custom React hooks.

**Styling:** Tailwind CSS v4 with OKLCH-based CSS variables for semantic colors (defined in `app/globals.css`). Import path alias `@/*` maps to the `frontend/` root.

---

## Backend (`backend/`)

### Commands

```bash
# From backend/ with .venv activated
uvicorn main:app --reload   # Start API server (http://localhost:8000)
```

### Architecture

**FastAPI** app using **Python 3.9+**, **BeautifulSoup4/lxml** for HTML parsing, and **python-docx** for document generation.

- `main.py` — FastAPI server, CORS config, and `/convert` endpoint.
- `exam_parser.py` — Parses Moodle quiz HTML into a structured data model (`ParsedExam`, `Question`, `InfoBlock`).
- `docx_generator.py` — Generates `.docx` from the parsed model using python-docx.
- `requirements.txt` — Python dependencies.

### API

`POST /convert` — accepts `multipart/form-data` with `html_file`, `zip_file`, and `format` (`docx` only); returns the `.docx` as a download.
