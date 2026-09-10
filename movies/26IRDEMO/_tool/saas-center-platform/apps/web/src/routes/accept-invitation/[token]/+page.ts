import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

/**
 * 경로 형식 /accept-invitation/[token] → 쿼리 형식 /accept-invitation?token=... 로 리다이렉트
 */
export const load: PageLoad = ({ params }) => {
  const token = params.token ?? ''
  if (!token) throw redirect(302, '/accept-invitation')
  throw redirect(302, '/accept-invitation?token=' + encodeURIComponent(token))
}
