import { onMounted, watch, type Ref } from 'vue'

/**
 * Auto-resize a <textarea> to fit its content.
 *
 * - Resizes on initial mount.
 * - Resizes when the value getter changes (e.g. WS reconciliation, programmatic edits).
 * - Returns a `resize` function callable from input handlers for synchronous sizing.
 */
export function useAutoResize(
  elRef: Ref<HTMLTextAreaElement | null>,
  getValue: () => string,
): { resize: () => void } {
  function resize() {
    const el = elRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  onMounted(() => {
    resize()
  })

  watch(getValue, () => {
    // Wait for the bound value to flush into the DOM before measuring.
    queueMicrotask(resize)
  })

  return { resize }
}
