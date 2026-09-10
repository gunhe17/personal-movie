import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = () => {
  redirect(301, '/subscription/ai-usage')
}
