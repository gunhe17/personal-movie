import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { canOperate } from '$lib/utils/permissions'

export const load: PageServerLoad = async ({ locals }) => {
  if (!canOperate(locals.user?.role)) {
    throw error(403, '관리자 이상만 접근할 수 있습니다')
  }
  return {}
}
