<script setup lang="ts">
import { onMounted, ref, toRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useListStore } from '@/stores/list'
import { useListSocket } from '@/composables/useListSocket'
import Category from '@/components/Category.vue'
import ShareUrl from '@/components/ShareUrl.vue'

const props = defineProps<{ listId: string }>()

const store = useListStore()
const { list, loading } = storeToRefs(store)

const error = ref<string | null>(null)
const listIdRef = toRef(props, 'listId')

useListSocket(listIdRef, (next) => {
  store.setList(next)
})

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
    </div>
  </div>
</template>
