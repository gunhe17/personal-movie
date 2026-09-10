import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = ({ url }) => {
  if (url.hostname === 'app.mindscope.kr') {
    redirect(302, '/')
  }
}
