# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`todo.yiin.lt` — shared todo lists, no auth. Visit `/`, get a fresh list at `/:id`, share the link. Anyone with the URL can edit. Live sync over WebSocket. Sister project of `~/Projects/meet` (`meet.yiin.lt`); the two share architecture but no code.

## Layout

Two independent Bun packages plus a root scripts wrapper:

- `api/` — Bun.serve HTTP+WS server, `bun:sqlite` for storage. No framework.
- `web/` — Vue 3 + Vite + Tailwind 4 + Pinia + Vue Router SPA.
- `Dockerfile` — multi-stage: install web deps → install api prod deps → `bun run build-only` (Vite, no vue-tsc inside container) → final image runs `bun run api/src/index.ts`, serves the built SPA from `STATIC_DIR=/usr/src/app/public` with SPA fallback.

`api/` and `web/` do **not** import from each other. Shared shapes (`ListData`, WS message types, the `list:<id>` topic format) are duplicated by hand on both sides — keep them in sync.

## Commands

From the project root:

```sh
bun run dev:api          # api on :3001 (bun --hot)
bun run dev:web          # vite on :5173, proxies /api + /ws to :3001
```

Web build (vue-tsc + vite):

```sh
cd web && bun run build           # full type-check + bundle
cd web && bun run build-only      # vite only (matches Docker)
```

Install: `bun install` separately in `api/` and `web/`. There is no root `bun install`.

There are no tests yet; the spec deferred Playwright/Vitest setup.

## Architecture

### Data model (`api/src/db.ts`)

Three tables, all FK-cascaded:

```
lists (id) ─< categories (list_id, position) ─< tasks (category_id, position, completed)
```

`createList()` always inserts one default empty category at `position=0`. IDs are `nanoid(10)` for everything. Statements are `db.prepare()`'d once at module load, not per request.

`getList(id)` returns the full nested shape with two queries (one for categories, one JOIN for tasks bucketed by category_id) — no N+1.

### API + WebSocket (`api/src/index.ts`)

REST routes mutate then call `publishList(id)`, which fetches the fresh list and broadcasts `{type:'list', list}` to subscribers of the `` `list:${id}` `` topic. Clients send `{type:'subscribe', listId}` over WS to join; the server replies with the current snapshot immediately, then pushes on every mutation. Reconnect logic and resubscription live in `web/src/composables/useListSocket.ts` (shared module-level singleton WebSocket; per-component `onBeforeUnmount` cleanup).

The same Bun process serves the built SPA when `STATIC_DIR/index.html` exists, with a path-traversal guard and SPA fallback.

### Frontend state flow (`web/src/stores/list.ts`)

Pattern: optimistic local mutation → API call → WS echo replaces `list.value` with the authoritative snapshot. Vue's `:key="cat.id"` keeps component identity stable across the replacement; do **not** add a `JSON.stringify` equality short-circuit (was tried and removed — Vue handles it).

Inputs use `web/src/composables/useDebouncedField.ts` (400ms debounce + watch-suppression while a save is pending). Components flush on unmount and on blur — important: never skip the unmount flush, or fast navigation drops the last edit.

### Keyboard model

Editing is keyboard-driven:
- `Enter` on a task → create a new task below and focus it.
- `Backspace` on an empty task → delete it and focus the previous task's end (or the category name if first).
- `Tab` from the last task in a category → create + focus a new task.
- `Shift+Tab` from the first task → focus the category name.
- `Cmd/Ctrl+Enter` → toggle completed.

Category and Task components expose `focus()` / `focusEnd()` (set caret to end). Don't expose raw DOM `el()` — it has been removed once already.

## Design system (`web/src/assets/main.css`)

Editorial paper notebook. Single light theme, no dark mode. CSS custom properties on `:root`:

```
--paper        #f5efe4   page background (warm cream)
--paper-deep   #ede5d3   inset / hover
--ink          #1d1a17   primary text
--ink-soft     #5a5347   muted body
--ink-faint    #8a8170   placeholder / completed text
--accent       #b8472f   terracotta — sparingly: brand period, focus rule, checkbox tick
--rule         #c8bfae   hairline dividers
```

Fonts: Instrument Serif (display, italics) + JetBrains Mono (body, tasks, inputs), loaded from Google Fonts in `index.html`. **Do not use Tailwind's slate/gray palette** or generic system fonts; reach for `var(--…)` tokens. No emojis anywhere in code or UI.

Inputs have no visible border by default — a 1px transparent bottom border that becomes `var(--rule)` on focus. The "checkbox" is an inline SVG with a hand-drawn-feel tick path; if you change it, keep the imperfection. A subtle SVG noise filter on `body::before` at ~5% opacity provides paper grain.

## Deployment

Coolify app (uuid `g16klbf14pg73czx99p6q2ct`) on `yiin.lt` server, project `yiin.lt`. Built from `https://github.com/Yiin/todo` `main`, `build_pack: dockerfile`, port 3000. Persistent volume `todo-data:/data` holds the SQLite file (set via `custom_docker_run_options`, not as a Coolify storage mount).

Caddy at the edge handles TLS — store the FQDN as `http://todo.yiin.lt` in Coolify, never `https://` (causes redirect loops; see `~/.claude/skills/use-coolify`).

## Bun conventions (general)

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

### APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile.
- `Bun.$\`ls\`` instead of execa.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
