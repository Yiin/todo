import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export function useDebouncedField(
  remoteValue: () => string,
  save: (next: string) => Promise<void> | void,
  options?: { delay?: number },
): {
  local: Ref<string>
  hasPending: ComputedRef<boolean>
  onInput: (next: string) => void
  flush: () => Promise<void>
} {
  const delay = options?.delay ?? 400
  const local = ref(remoteValue())
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingValue: string | null = null
  const pendingFlag = ref(false)

  const hasPending = computed(() => pendingFlag.value)

  watch(remoteValue, (next) => {
    if (pendingValue !== null) return
    if (next !== local.value) local.value = next
  })

  function onInput(next: string) {
    local.value = next
    pendingValue = next
    pendingFlag.value = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void flush()
    }, delay)
  }

  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (pendingValue === null) return
    const value = pendingValue
    pendingValue = null
    pendingFlag.value = false
    if (value === remoteValue()) return
    try {
      await save(value)
    } catch {
      // ignored: WS reconcile will correct state
    }
  }

  return { local, hasPending, onInput, flush }
}
