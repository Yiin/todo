import type { ListData } from '@/types'

export type WsClientMessage =
  | { type: 'subscribe'; listId: string }
  | { type: 'unsubscribe'; listId: string }

export type WsServerMessage = { type: 'list'; list: ListData }

export const wsTopicFor = (listId: string) => `list:${listId}`
