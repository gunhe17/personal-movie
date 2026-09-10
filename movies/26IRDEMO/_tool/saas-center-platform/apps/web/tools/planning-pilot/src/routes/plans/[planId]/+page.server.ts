import { error } from '@sveltejs/kit'
import { store, revisionOf } from '$lib/server/store'
import type { PageServerLoad } from './$types'
export const load: PageServerLoad = async ({ params }) => {
  try {
    const plan = await store.getPlan(params.planId)
    return {
      plan,
      revision: revisionOf(plan),
      ai: store.ai!,
      thread: store.thread,
      records: await store.recordEntries(plan.id)
    }
  } catch (reason) {
    error(
      404,
      reason instanceof Error ? reason.message : '기획을 찾을 수 없습니다.'
    )
  }
}
