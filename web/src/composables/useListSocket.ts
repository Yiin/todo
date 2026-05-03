import { onBeforeUnmount, watch, type Ref } from 'vue'
import type { ListData } from '@/types'
import type { WsClientMessage, WsServerMessage } from '@/lib/ws'

let sharedSocket: WebSocket | null = null
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

type Listener = (list: ListData) => void
const listeners = new Set<Listener>()
const subscribers = new Set<() => string | null>()

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws`
}

function openSocket(): WebSocket {
  if (sharedSocket && sharedSocket.readyState <= WebSocket.OPEN) return sharedSocket
  const ws = new WebSocket(getWsUrl())
  sharedSocket = ws
  ws.addEventListener('open', () => {
    reconnectAttempts = 0
  })
  ws.addEventListener('message', (evt) => {
    let data: WsServerMessage | null = null
    try {
      data = JSON.parse(evt.data)
    } catch {
      return
    }
    if (data?.type === 'list' && data.list) {
      for (const fn of listeners) fn(data.list)
    }
  })
  ws.addEventListener('close', () => {
    if (sharedSocket === ws) sharedSocket = null
    if (listeners.size === 0) return
    const delay = Math.min(5000, 250 * 2 ** reconnectAttempts) + Math.random() * 250
    reconnectAttempts++
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      const next = openSocket()
      for (const getId of subscribers) {
        const id = getId()
        if (id) sendWhenReady(next, { type: 'subscribe', listId: id })
      }
    }, delay)
  })
  return ws
}

function sendWhenReady(ws: WebSocket, msg: WsClientMessage) {
  const payload = JSON.stringify(msg)
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(payload)
  } else {
    ws.addEventListener('open', () => ws.send(payload), { once: true })
  }
}

export function useListSocket(
  listIdRef: Ref<string | null> | Ref<string>,
  onList: (list: ListData) => void,
) {
  const listener: Listener = (list) => {
    if (listIdRef.value && list.id === listIdRef.value) {
      onList(list)
    }
  }
  listeners.add(listener)

  let subscribedId: string | null = null
  const currentIdGetter = () => subscribedId
  subscribers.add(currentIdGetter)

  const stop = watch(
    () => listIdRef.value,
    (id) => {
      const ws = openSocket()
      if (subscribedId && subscribedId !== id) {
        sendWhenReady(ws, { type: 'unsubscribe', listId: subscribedId })
      }
      if (id) {
        sendWhenReady(ws, { type: 'subscribe', listId: id })
        subscribedId = id
      } else {
        subscribedId = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    listeners.delete(listener)
    subscribers.delete(currentIdGetter)
    if (subscribedId && sharedSocket) {
      sendWhenReady(sharedSocket, { type: 'unsubscribe', listId: subscribedId })
    }
    if (listeners.size === 0 && reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stop()
  })
}
