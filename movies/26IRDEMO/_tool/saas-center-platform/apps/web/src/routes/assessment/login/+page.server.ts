import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url }) => {
  const query = url.search || ''
  throw redirect(302, `/assessment-flow/login${query}`)
}
