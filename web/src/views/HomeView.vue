<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createList } from '@/composables/useListApi'

const router = useRouter()
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const { id } = await createList()
    router.replace(`/${id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'failed to create list'
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-6">
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
</template>
