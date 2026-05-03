import { Database } from "bun:sqlite";
import { join } from "node:path";
import { nanoid } from "nanoid";

const DB_PATH =
  process.env.DB_PATH ?? join(import.meta.dir, "..", "..", "data", "todo.db");

export const db = new Database(DB_PATH, { create: true });

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_categories_list ON categories(list_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);`);

const insertListStmt = db.prepare<void, { $id: string }>(
  "INSERT INTO lists (id) VALUES ($id)",
);

const listExistsStmt = db.prepare<{ one: number }, { $id: string }>(
  "SELECT 1 AS one FROM lists WHERE id = $id",
);

const getListRowStmt = db.prepare<
  { id: string; created_at: string },
  { $id: string }
>(
  "SELECT id, created_at FROM lists WHERE id = $id",
);

const getCategoriesStmt = db.prepare<
  { id: string; name: string; position: number },
  { $list_id: string }
>(
  "SELECT id, name, position FROM categories WHERE list_id = $list_id ORDER BY position ASC, created_at ASC",
);

const getTasksForListStmt = db.prepare<
  {
    id: string;
    category_id: string;
    text: string;
    completed: number;
    position: number;
  },
  { $list_id: string }
>(
  `SELECT t.id, t.category_id, t.text, t.completed, t.position
   FROM tasks t
   JOIN categories c ON c.id = t.category_id
   WHERE c.list_id = $list_id
   ORDER BY t.position ASC, t.created_at ASC`,
);

const insertCategoryStmt = db.prepare<
  void,
  { $id: string; $list_id: string; $name: string; $position: number }
>(
  "INSERT INTO categories (id, list_id, name, position) VALUES ($id, $list_id, $name, $position)",
);

const maxCategoryPositionStmt = db.prepare<
  { max_pos: number | null },
  { $list_id: string }
>(
  "SELECT MAX(position) AS max_pos FROM categories WHERE list_id = $list_id",
);

const renameCategoryStmt = db.prepare<
  void,
  { $id: string; $name: string }
>("UPDATE categories SET name = $name WHERE id = $id");

const deleteCategoryStmt = db.prepare<void, { $id: string }>(
  "DELETE FROM categories WHERE id = $id",
);

const categoryExistsStmt = db.prepare<
  { list_id: string },
  { $id: string }
>("SELECT list_id FROM categories WHERE id = $id");

const countCategoriesForListStmt = db.prepare<
  { n: number },
  { $list_id: string }
>("SELECT COUNT(*) AS n FROM categories WHERE list_id = $list_id");

const insertTaskStmt = db.prepare<
  void,
  { $id: string; $category_id: string; $position: number }
>(
  "INSERT INTO tasks (id, category_id, position) VALUES ($id, $category_id, $position)",
);

const maxTaskPositionStmt = db.prepare<
  { max_pos: number | null },
  { $category_id: string }
>(
  "SELECT MAX(position) AS max_pos FROM tasks WHERE category_id = $category_id",
);

const updateTaskTextStmt = db.prepare<void, { $id: string; $text: string }>(
  "UPDATE tasks SET text = $text WHERE id = $id",
);

const updateTaskCompletedStmt = db.prepare<
  void,
  { $id: string; $completed: number }
>("UPDATE tasks SET completed = $completed WHERE id = $id");

const deleteTaskStmt = db.prepare<void, { $id: string }>(
  "DELETE FROM tasks WHERE id = $id",
);

const taskListIdStmt = db.prepare<
  { list_id: string },
  { $id: string }
>(
  `SELECT c.list_id AS list_id
   FROM tasks t
   JOIN categories c ON c.id = t.category_id
   WHERE t.id = $id`,
);

export type TaskRecord = {
  id: string;
  text: string;
  completed: boolean;
  position: number;
};

export type CategoryRecord = {
  id: string;
  name: string;
  position: number;
  tasks: TaskRecord[];
};

export type ListRecord = {
  id: string;
  created_at: string;
  categories: CategoryRecord[];
};

export function listExists(id: string): boolean {
  return listExistsStmt.get({ $id: id }) !== null;
}

export function createList(): string {
  const id = nanoid(10);
  const catId = nanoid(10);
  db.transaction(() => {
    insertListStmt.run({ $id: id });
    insertCategoryStmt.run({
      $id: catId,
      $list_id: id,
      $name: "",
      $position: 0,
    });
  })();
  return id;
}

export function getList(id: string): ListRecord | null {
  const row = getListRowStmt.get({ $id: id });
  if (!row) return null;

  const cats = getCategoriesStmt.all({ $list_id: id });
  const tasks = getTasksForListStmt.all({ $list_id: id });

  const byCat = new Map<string, TaskRecord[]>();
  for (const c of cats) byCat.set(c.id, []);
  for (const t of tasks) {
    const arr = byCat.get(t.category_id);
    if (!arr) continue;
    arr.push({
      id: t.id,
      text: t.text,
      completed: t.completed === 1,
      position: t.position,
    });
  }

  return {
    id: row.id,
    created_at: row.created_at,
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      tasks: byCat.get(c.id) ?? [],
    })),
  };
}

export function addCategory(listId: string): string | null {
  if (!listExists(listId)) return null;
  const id = nanoid(10);
  const max = maxCategoryPositionStmt.get({ $list_id: listId });
  const pos = (max?.max_pos ?? -1) + 1;
  insertCategoryStmt.run({
    $id: id,
    $list_id: listId,
    $name: "",
    $position: pos,
  });
  return id;
}

export function categoryListId(catId: string): string | null {
  return categoryExistsStmt.get({ $id: catId })?.list_id ?? null;
}

export function renameCategory(catId: string, name: string): boolean {
  if (!categoryListId(catId)) return false;
  renameCategoryStmt.run({ $id: catId, $name: name });
  return true;
}

export function deleteCategory(
  catId: string,
): { ok: true; listId: string } | { ok: false; reason: "not_found" | "last" } {
  const listId = categoryListId(catId);
  if (!listId) return { ok: false, reason: "not_found" };
  const cnt = countCategoriesForListStmt.get({ $list_id: listId });
  if ((cnt?.n ?? 0) <= 1) return { ok: false, reason: "last" };
  deleteCategoryStmt.run({ $id: catId });
  return { ok: true, listId };
}

export function addTask(catId: string): { id: string; listId: string } | null {
  const listId = categoryListId(catId);
  if (!listId) return null;
  const id = nanoid(10);
  const max = maxTaskPositionStmt.get({ $category_id: catId });
  const pos = (max?.max_pos ?? -1) + 1;
  insertTaskStmt.run({
    $id: id,
    $category_id: catId,
    $position: pos,
  });
  return { id, listId };
}

export function taskListId(taskId: string): string | null {
  return taskListIdStmt.get({ $id: taskId })?.list_id ?? null;
}

export function updateTask(
  taskId: string,
  patch: { text?: string; completed?: boolean },
): string | null {
  const listId = taskListId(taskId);
  if (!listId) return null;
  if (typeof patch.text === "string") {
    updateTaskTextStmt.run({ $id: taskId, $text: patch.text });
  }
  if (typeof patch.completed === "boolean") {
    updateTaskCompletedStmt.run({
      $id: taskId,
      $completed: patch.completed ? 1 : 0,
    });
  }
  return listId;
}

export function deleteTask(taskId: string): string | null {
  const listId = taskListId(taskId);
  if (!listId) return null;
  deleteTaskStmt.run({ $id: taskId });
  return listId;
}

