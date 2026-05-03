<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ listId: string }>()

const url = computed(() => `${window.location.origin}/${props.listId}`)

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
  } catch {
    copied.value = false
    return
  }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 1200)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <button
    type="button"
    class="share-link"
    :class="{ 'share-status': copied }"
    @click="copy"
  >
    <span v-if="copied">copied.</span>
    <span v-else>{{ url }}</span>
  </button>
</template>
