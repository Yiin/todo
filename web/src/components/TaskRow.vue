<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import type { Task } from '@/types'
import { useListStore } from '@/stores/list'
import { useDebouncedField } from '@/composables/useDebouncedField'

const props = defineProps<{
  task: Task
  categoryId: string
}>()

const emit = defineEmits<{
  (e: 'enter', taskId: string): void
  (e: 'backspace-empty', taskId: string): void
  (e: 'tab-last', taskId: string): void
  (e: 'shift-tab-first', taskId: string): void
}>()

const store = useListStore()
const inputRef = ref<HTMLInputElement | null>(null)

const { local: localText, hasPending, onInput: onFieldInput, flush } =
  useDebouncedField(
    () => props.task.text,
    (next) => store.updateTaskText(props.task.id, next),
  )

function onInput(e: Event) {
  onFieldInput((e.target as HTMLInputElement).value)
}

function onBlur() {
  void flush()
}

function onToggle() {
  void flush()
  void store.toggleTask(props.task.id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault()
    void flush()
    emit('enter', props.task.id)
    return
  }
  if (
    e.key === 'Backspace' &&
    localText.value === '' &&
    !hasPending.value
  ) {
    e.preventDefault()
    emit('backspace-empty', props.task.id)
    return
  }
  if (e.key === 'Tab' && !e.shiftKey) {
    emit('tab-last', props.task.id)
    return
  }
  if (e.key === 'Tab' && e.shiftKey) {
    emit('shift-tab-first', props.task.id)
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    onToggle()
    return
  }
}

onBeforeUnmount(() => {
  void flush()
})

defineExpose({
  focus: async () => {
    await nextTick()
    inputRef.value?.focus()
  },
  focusEnd: async () => {
    await nextTick()
    const el = inputRef.value
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  },
})
</script>

<template>
  <div class="flex items-start gap-3 py-1">
    <button
      type="button"
      class="checkbox-btn"
      :aria-label="task.completed ? 'mark task incomplete' : 'mark task complete'"
      @click="onToggle"
    >
      <svg viewBox="0 0 18 18" fill="none" stroke="var(--ink-soft)" stroke-width="1.2">
        <path
          d="M2.4 2.7 Q9 1.9 15.6 2.5 Q15.4 9 15.7 15.4 Q9 15.5 2.5 15.6 Q1.9 9 2.4 2.7 Z"
          fill="transparent"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          v-if="task.completed"
          d="M4.2 9.6 Q6.2 11.4 7.6 13.1 Q10.5 8.6 14.2 4.6"
          fill="none"
          stroke="var(--accent)"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <input
      ref="inputRef"
      class="todo-input"
      :class="{ 'todo-input--done': task.completed }"
      :value="localText"
      type="text"
      placeholder=""
      autocomplete="off"
      spellcheck="false"
      @input="onInput"
      @blur="onBlur"
      @keydown="onKeydown"
    />
  </div>
</template>
