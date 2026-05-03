<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createList } from '@/composables/useListApi'
import { getRecent, clearRecent, type RecentList } from '@/lib/recent'

const router = useRouter()
const error = ref<string | null>(null)
const recents = ref<RecentList[]>([])
const ready = ref(false)
const creating = ref(false)

function formatRelative(ts: number): string {
  const now = Date.now()
  const diff = Math.max(0, now - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts))
}

async function createNewList() {
  if (creating.value) return
  creating.value = true
  try {
    const { id } = await createList()
    router.push(`/${id}`)
  } catch (err) {
    creating.value = false
    error.value = err instanceof Error ? err.message : 'failed to create list'
  }
}

function onClearHistory() {
  if (!confirm('clear history?')) return
  clearRecent()
  recents.value = []
}

onMounted(async () => {
  recents.value = getRecent()
  if (recents.value.length === 0) {
    try {
      const { id } = await createList()
      router.replace(`/${id}`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'failed to create list'
      ready.value = true
    }
    return
  }
  ready.value = true
})
</script>

<template>
  <div v-if="!ready" class="min-h-screen flex flex-col items-center justify-center px-6">
    <div class="text-center">
      <h1 class="font-serif italic text-5xl text-[var(--ink)]">
        todo<span class="text-[var(--accent)]">.</span>
      </h1>
      <p v-if="!error" class="mt-6 font-mono text-sm text-[var(--ink-faint)]">
        creating your list...
      </p>
      <p v-else class="mt-6 font-mono text-sm text-[var(--accent)]">
        {{ error }}
      </p>
    </div>
  </div>

  <div v-else class="mx-auto w-full max-w-[640px] px-6 pt-12 pb-24">
    <header class="mb-8">
      <h1 class="font-serif italic text-3xl text-[var(--ink)] leading-none">
        todo<span class="text-[var(--accent)]">.</span>
      </h1>
    </header>

    <div class="mb-10">
      <button
        type="button"
        class="new-list-btn"
        :disabled="creating"
        @click="createNewList"
      >
        + new list
      </button>
      <p v-if="error" class="mt-3 font-mono text-sm text-[var(--accent)]">
        {{ error }}
      </p>
    </div>

    <div v-if="recents.length" class="recent-list">
      <router-link
        v-for="entry in recents"
        :key="entry.id"
        :to="`/${entry.id}`"
        class="recent-row"
      >
        <span class="recent-title">{{ entry.title }}</span>
        <span class="recent-time">{{ formatRelative(entry.visitedAt) }}</span>
      </router-link>
    </div>

    <div class="mt-16">
      <button
        type="button"
        class="clear-history-link"
        @click="onClearHistory"
      >
        clear history
      </button>
    </div>
  </div>
</template>
