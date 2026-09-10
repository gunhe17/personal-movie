import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = ({ url }) => {
  const search = url.search
  redirect(301, `/subscription/fail${search}`)
}
