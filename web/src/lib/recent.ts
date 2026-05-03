const KEY = 'todo.recent'
const MAX_ENTRIES = 12

export interface RecentList {
  id: string
  title: string
  visitedAt: number
}

export type RecentStore = RecentList[]

function safeRead(): RecentStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RecentList =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.visitedAt === 'number',
    )
  } catch {
    return []
  }
}

function safeWrite(store: RecentStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // ignore (private mode / disabled / quota)
  }
}

export function getRecent(): RecentList[] {
  const store = safeRead()
  return [...store].sort((a, b) => b.visitedAt - a.visitedAt)
}

export function recordRecent(id: string, title: string): void {
  const store = safeRead()
  const filtered = store.filter((entry) => entry.id !== id)
  filtered.unshift({ id, title, visitedAt: Date.now() })
  filtered.sort((a, b) => b.visitedAt - a.visitedAt)
  const capped = filtered.slice(0, MAX_ENTRIES)
  safeWrite(capped)
}

export function removeRecent(id: string): void {
  const store = safeRead()
  const filtered = store.filter((entry) => entry.id !== id)
  safeWrite(filtered)
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
