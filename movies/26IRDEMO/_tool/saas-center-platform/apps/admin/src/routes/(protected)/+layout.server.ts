import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    const redirectTo = url.pathname + url.search
    throw redirect(
      302,
      `/login?redirectTo=${encodeURIComponent(redirectTo)}`
    )
  }

  return {
    user: locals.user
  }
}
