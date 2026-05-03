<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import type { Category } from '@/types'
import { useListStore } from '@/stores/list'
import { useDebouncedField } from '@/composables/useDebouncedField'
import TaskRow from './TaskRow.vue'

const props = defineProps<{
  category: Category
  index: number
  canDelete: boolean
}>()

const emit = defineEmits<{
  (e: 'delete'): void
}>()

const store = useListStore()
const nameInputRef = ref<HTMLInputElement | null>(null)
let taskRefs = new Map<string, InstanceType<typeof TaskRow>>()

const { local: localName, hasPending, onInput: onFieldInput, flush } =
  useDebouncedField(
    () => props.category.name,
    (next) => store.renameCategory(props.category.id, next),
  )

function onNameInput(e: Event) {
  onFieldInput((e.target as HTMLInputElement).value)
}

function onNameBlur() {
  void flush()
}

async function onNameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    await flush()
    await addTaskAtEnd()
    return
  }
  if (
    e.key === 'Backspace' &&
    localName.value === '' &&
    props.category.tasks.length === 0 &&
    props.canDelete &&
    !hasPending.value
  ) {
    e.preventDefault()
    emit('delete')
    return
  }
}

function setTaskRef(id: string, el: InstanceType<typeof TaskRow> | null) {
  if (el) taskRefs.set(id, el)
  else taskRefs.delete(id)
}

async function focusTask(id: string) {
  await nextTick()
  taskRefs.get(id)?.focus()
}

async function focusName() {
  await nextTick()
  nameInputRef.value?.focus()
}

async function addTaskAtEnd() {
  const id = await store.addTask(props.category.id)
  if (id) await focusTask(id)
}

async function addTaskAfter() {
  const id = await store.addTask(props.category.id)
  if (id) await focusTask(id)
}

async function onTaskBackspaceEmpty(taskId: string) {
  const idx = props.category.tasks.findIndex((t) => t.id === taskId)
  const prevTask = idx > 0 ? props.category.tasks[idx - 1] : null
  await store.deleteTask(taskId)
  if (prevTask) {
    await nextTick()
    await taskRefs.get(prevTask.id)?.focusEnd()
  } else {
    await focusName()
  }
}

async function onTaskTabLast(taskId: string) {
  const idx = props.category.tasks.findIndex((t) => t.id === taskId)
  if (idx === props.category.tasks.length - 1) {
    await addTaskAfter()
  }
}

async function onTaskShiftTabFirst(taskId: string) {
  const idx = props.category.tasks.findIndex((t) => t.id === taskId)
  if (idx === 0) {
    await focusName()
  }
}

onBeforeUnmount(() => {
  void flush()
})
</script>

<template>
  <section
    class="cat-enter mt-10"
    :style="{ animationDelay: `${Math.min(index, 6) * 90}ms` }"
  >
    <div class="cat-header flex items-baseline gap-3">
      <input
        ref="nameInputRef"
        class="cat-name"
        :value="localName"
        type="text"
        placeholder="untitled"
        autocomplete="off"
        spellcheck="false"
        @input="onNameInput"
        @blur="onNameBlur"
        @keydown="onNameKeydown"
      />
      <button
        v-if="canDelete"
        type="button"
        class="cat-trash"
        title="delete category"
        @click="emit('delete')"
      >
        delete
      </button>
    </div>
    <div class="cat-rule" />

    <div class="mt-3">
      <TaskRow
        v-for="task in category.tasks"
        :key="task.id"
        :ref="(el) => setTaskRef(task.id, el as InstanceType<typeof TaskRow>)"
        :task="task"
        :category-id="category.id"
        @enter="addTaskAfter"
        @backspace-empty="onTaskBackspaceEmpty"
        @tab-last="onTaskTabLast"
        @shift-tab-first="onTaskShiftTabFirst"
      />
      <button
        type="button"
        class="add-link mt-1"
        @click="addTaskAtEnd"
      >
        + add task
      </button>
    </div>
  </section>
</template>
