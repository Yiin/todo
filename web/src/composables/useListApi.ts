import type { ListData } from '@/types'

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(path, init)
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export function createList(): Promise<{ id: string }> {
  return requestJson<{ id: string }>('POST', '/api/lists')
}

export function getList(id: string): Promise<ListData> {
  return requestJson<ListData>('GET', `/api/lists/${encodeURIComponent(id)}`)
}

export function addCategory(listId: string): Promise<{ id: string }> {
  return requestJson<{ id: string }>(
    'POST',
    `/api/lists/${encodeURIComponent(listId)}/categories`,
  )
}

export function renameCategory(
  listId: string,
  catId: string,
  name: string,
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(
    'PATCH',
    `/api/lists/${encodeURIComponent(listId)}/categories/${encodeURIComponent(catId)}`,
    { name },
  )
}

export function deleteCategory(
  listId: string,
  catId: string,
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(
    'DELETE',
    `/api/lists/${encodeURIComponent(listId)}/categories/${encodeURIComponent(catId)}`,
  )
}

export function addTask(
  listId: string,
  categoryId: string,
): Promise<{ id: string }> {
  return requestJson<{ id: string }>(
    'POST',
    `/api/lists/${encodeURIComponent(listId)}/tasks`,
    { category_id: categoryId },
  )
}

export function updateTask(
  listId: string,
  taskId: string,
  patch: { text?: string; completed?: boolean },
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(
    'PATCH',
    `/api/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    patch,
  )
}

export function deleteTask(
  listId: string,
  taskId: string,
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(
    'DELETE',
    `/api/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
  )
}
