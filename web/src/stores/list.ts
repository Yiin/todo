import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Category, ListData, Task } from '@/types'
import * as api from '@/composables/useListApi'

export const useListStore = defineStore('list', () => {
  const list = ref<ListData | null>(null)
  const loading = ref(false)

  async function load(id: string) {
    loading.value = true
    try {
      list.value = await api.getList(id)
    } catch (err) {
      list.value = null
      throw err
    } finally {
      loading.value = false
    }
  }

  function setList(next: ListData) {
    list.value = next
  }

  function findCategory(catId: string): Category | undefined {
    return list.value?.categories.find((c) => c.id === catId)
  }

  function findTask(taskId: string): { cat: Category; task: Task } | undefined {
    if (!list.value) return undefined
    for (const cat of list.value.categories) {
      const task = cat.tasks.find((t) => t.id === taskId)
      if (task) return { cat, task }
    }
    return undefined
  }

  async function addCategory(): Promise<string | null> {
    if (!list.value) return null
    const listId = list.value.id
    const { id } = await api.addCategory(listId)
    return id
  }

  async function renameCategory(catId: string, name: string): Promise<void> {
    if (!list.value) return
    const cat = findCategory(catId)
    if (cat) cat.name = name
    await api.renameCategory(list.value.id, catId, name)
  }

  async function deleteCategory(catId: string): Promise<void> {
    if (!list.value) return
    const idx = list.value.categories.findIndex((c) => c.id === catId)
    if (idx >= 0) list.value.categories.splice(idx, 1)
    await api.deleteCategory(list.value.id, catId)
  }

  async function addTask(catId: string): Promise<string | null> {
    if (!list.value) return null
    const listId = list.value.id
    const { id } = await api.addTask(listId, catId)
    return id
  }

  async function updateTaskText(taskId: string, text: string): Promise<void> {
    if (!list.value) return
    const found = findTask(taskId)
    if (found) found.task.text = text
    await api.updateTask(list.value.id, taskId, { text })
  }

  async function toggleTask(taskId: string): Promise<void> {
    if (!list.value) return
    const found = findTask(taskId)
    if (!found) return
    const next = !found.task.completed
    found.task.completed = next
    await api.updateTask(list.value.id, taskId, { completed: next })
  }

  async function deleteTask(taskId: string): Promise<void> {
    if (!list.value) return
    const found = findTask(taskId)
    if (found) {
      const idx = found.cat.tasks.findIndex((t) => t.id === taskId)
      if (idx >= 0) found.cat.tasks.splice(idx, 1)
    }
    await api.deleteTask(list.value.id, taskId)
  }

  function reset() {
    list.value = null
  }

  return {
    list,
    loading,
    load,
    setList,
    addCategory,
    renameCategory,
    deleteCategory,
    addTask,
    updateTaskText,
    toggleTask,
    deleteTask,
    reset,
  }
})
