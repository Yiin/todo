# todo

Shared todo lists, no auth. Visit `/`, get a fresh list, share the link.
Anyone with the URL can edit. Live updates over WebSocket.

## Dev

```sh
# install deps
cd api && bun install
cd ../web && bun install

# in two terminals from the project root
bun run dev:api   # api on :3001
bun run dev:web   # vite on :5173, proxies /api + /ws to :3001
```

## Build

```sh
cd web && bun run build
```

## Deploy

`Dockerfile` builds the SPA and serves it from the api process at `PORT=3000`.
SQLite database lives at `/data/todo.db`; mount `/data` as a volume.

```sh
docker build -t todo .
docker run -p 3000:3000 -v todo-data:/data todo
```
