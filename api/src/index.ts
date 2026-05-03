import { resolve, join, normalize } from "node:path";
import {
  createList,
  listExists,
  getList,
  addCategory,
  renameCategory,
  deleteCategory,
  addTask,
  updateTask,
  deleteTask,
} from "./db.ts";

const PORT = Number(process.env.PORT ?? 3001);
const DIST_DIR = resolve(process.env.STATIC_DIR ?? "./public");
const INDEX_HTML = join(DIST_DIR, "index.html");
const DIST_DIR_EXISTS = await Bun.file(INDEX_HTML).exists();

const server = Bun.serve({
  port: PORT,

  routes: {
    "/api/lists": {
      POST: () => {
        const id = createList();
        return Response.json({ id });
      },
    },

    "/api/lists/:id": {
      GET: (req) => {
        const list = getList(req.params.id);
        if (!list) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json(list);
      },
    },

    "/api/lists/:id/categories": {
      POST: (req) => {
        const listId = req.params.id;
        const id = addCategory(listId);
        if (!id) return Response.json({ error: "not found" }, { status: 404 });
        publishList(listId);
        return Response.json({ id });
      },
    },

    "/api/lists/:id/categories/:cid": {
      PATCH: async (req) => {
        const listId = req.params.id;
        const catId = req.params.cid;
        if (!listExists(listId)) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        const body = await req.json().catch(() => null);
        const name = parseStringField(body, "name");
        if (name === null) {
          return Response.json({ error: "missing name" }, { status: 400 });
        }
        if (!renameCategory(catId, name)) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        publishList(listId);
        return Response.json({ ok: true });
      },
      DELETE: (req) => {
        const listId = req.params.id;
        const catId = req.params.cid;
        if (!listExists(listId)) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        const result = deleteCategory(catId);
        if (!result.ok) {
          if (result.reason === "last") {
            return Response.json(
              { error: "cannot delete last category" },
              { status: 400 },
            );
          }
          return Response.json({ error: "not found" }, { status: 404 });
        }
        publishList(listId);
        return Response.json({ ok: true });
      },
    },

    "/api/lists/:id/tasks": {
      POST: async (req) => {
        const listId = req.params.id;
        if (!listExists(listId)) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        const body = await req.json().catch(() => null);
        const catId = parseStringField(body, "category_id");
        if (!catId) {
          return Response.json(
            { error: "missing category_id" },
            { status: 400 },
          );
        }
        const result = addTask(catId);
        if (!result || result.listId !== listId) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        publishList(listId);
        return Response.json({ id: result.id });
      },
    },

    "/api/lists/:id/tasks/:tid": {
      PATCH: async (req) => {
        const listId = req.params.id;
        const taskId = req.params.tid;
        if (!listExists(listId)) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        const body = await req.json().catch(() => null);
        const patch = parseTaskPatch(body);
        if (!patch) {
          return Response.json(
            { error: "invalid patch" },
            { status: 400 },
          );
        }
        const updatedListId = updateTask(taskId, patch);
        if (!updatedListId || updatedListId !== listId) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        publishList(listId);
        return Response.json({ ok: true });
      },
      DELETE: (req) => {
        const listId = req.params.id;
        const taskId = req.params.tid;
        if (!listExists(listId)) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        const deletedListId = deleteTask(taskId);
        if (!deletedListId || deletedListId !== listId) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        publishList(listId);
        return Response.json({ ok: true });
      },
    },

    "/ws": ((req, server): Response | undefined => {
      if (server.upgrade(req)) return undefined;
      return new Response("websocket upgrade failed", { status: 400 });
    }),
  },

  async fetch(req) {
    if (!DIST_DIR_EXISTS) {
      return new Response("not found", { status: 404 });
    }

    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
      return new Response("not found", { status: 404 });
    }

    const requested = normalize(join(DIST_DIR, decodeURIComponent(url.pathname)));
    if (requested.startsWith(DIST_DIR) && requested !== DIST_DIR) {
      const file = Bun.file(requested);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    return new Response(Bun.file(INDEX_HTML), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },

  websocket: {
    message(ws, message) {
      const raw = typeof message === "string" ? message : message.toString();
      let msg: { type?: string; listId?: string } | null = null;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "subscribe" && typeof msg.listId === "string") {
        ws.subscribe(`list:${msg.listId}`);
        const list = getList(msg.listId);
        if (list) {
          ws.send(JSON.stringify({ type: "list", list }));
        }
        return;
      }

      if (msg.type === "unsubscribe" && typeof msg.listId === "string") {
        ws.unsubscribe(`list:${msg.listId}`);
        return;
      }
    },
  },
});

function publishList(id: string) {
  const list = getList(id);
  if (!list) return;
  server.publish(`list:${id}`, JSON.stringify({ type: "list", list }));
}

function parseStringField(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as Record<string, unknown>)[key];
  if (typeof v !== "string") return null;
  return v;
}

function parseTaskPatch(
  body: unknown,
): { text?: string; completed?: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const out: { text?: string; completed?: boolean } = {};
  if ("text" in b) {
    if (typeof b.text !== "string") return null;
    out.text = b.text;
  }
  if ("completed" in b) {
    if (typeof b.completed !== "boolean") return null;
    out.completed = b.completed;
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}

console.log(`todo-api listening on http://localhost:${server.port}`);
