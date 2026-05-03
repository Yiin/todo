<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useListStore } from '@/stores/list'
import { useListSocket } from '@/composables/useListSocket'
import Category from '@/components/Category.vue'
import ShareUrl from '@/components/ShareUrl.vue'
import { recordRecent, removeRecent } from '@/lib/recent'
import type { ListData } from '@/types'

const props = defineProps<{ listId: string }>()

const store = useListStore()
const { list, loading } = storeToRefs(store)

const error = ref<string | null>(null)
const listIdRef = toRef(props, 'listId')

useListSocket(listIdRef, (next) => {
  store.setList(next)
})

function computeTitle(data: ListData): string | null {
  for (const cat of data.categories) {
    const trimmed = cat.name.trim()
    if (trimmed) return trimmed
  }
  for (const cat of data.categories) {
    for (const task of cat.tasks) {
      const trimmed = task.text.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}

let recentTimer: ReturnType<typeof setTimeout> | null = null
let pendingRecent: { id: string; title: string | null } | null = null

function scheduleRecent(id: string, title: string | null) {
  pendingRecent = { id, title }
  if (recentTimer) return
  recentTimer = setTimeout(() => {
    recentTimer = null
    if (!pendingRecent) return
    const { id: pid, title: ptitle } = pendingRecent
    pendingRecent = null
    if (ptitle === null) {
      removeRecent(pid)
    } else {
      recordRecent(pid, ptitle)
    }
  }, 1000)
}

watch(
  list,
  (next) => {
    if (!next) return
    const title = computeTitle(next)
    scheduleRecent(next.id, title)
  },
  { deep: true },
)

const isMac = computed(() => {
  if (typeof navigator === 'undefined') return false
  return /Mac/i.test(navigator.platform)
})
const modKey = computed(() => (isMac.value ? '⌘' : 'ctrl'))

onMounted(async () => {
  try {
    await store.load(props.listId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'failed to load list'
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-[640px] px-6 pt-12 pb-24">
    <header class="mb-8">
      <h1 class="font-serif italic text-3xl text-[var(--ink)] leading-none">
        todo<span class="text-[var(--accent)]">.</span>
      </h1>
      <div class="mt-2">
        <ShareUrl v-if="list" :list-id="list.id" />
      </div>
    </header>

    <p
      v-if="loading && !list"
      class="font-mono text-sm text-[var(--ink-faint)]"
    >
      loading...
    </p>

    <p v-else-if="error" class="font-mono text-sm text-[var(--accent)]">
      {{ error }}
    </p>

    <div v-else-if="list">
      <Category
        v-for="(cat, i) in list.categories"
        :key="cat.id"
        :category="cat"
        :index="i"
        :can-delete="list.categories.length > 1"
        @delete="store.deleteCategory(cat.id)"
      />

      <button
        type="button"
        class="add-link mt-12 block"
        @click="store.addCategory()"
      >
        + add category
      </button>

      <dl class="keybind-legend mt-24">
        <div class="keybind-row">
          <kbd class="keybind">enter</kbd>
          <span class="keybind-label">new task</span>
        </div>
        <div class="keybind-row">
          <kbd class="keybind">backspace</kbd>
          <span class="keybind-label">delete empty task</span>
        </div>
        <div class="keybind-row">
          <kbd class="keybind">tab</kbd>
          <span class="keybind-label">next field</span>
        </div>
        <div class="keybind-row">
          <kbd class="keybind">{{ modKey }}<span class="keybind-sep"> + </span>↵</kbd>
          <span class="keybind-label">toggle complete</span>
        </div>
      </dl>
    </div>
  </div>
</template>
