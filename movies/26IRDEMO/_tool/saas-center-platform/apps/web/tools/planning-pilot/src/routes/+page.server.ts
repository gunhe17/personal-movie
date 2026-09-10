import { store } from '$lib/server/store'
export const load = async () => ({
  ...(await store.list()),
  ai: store.ai!,
  thread: store.thread
})
