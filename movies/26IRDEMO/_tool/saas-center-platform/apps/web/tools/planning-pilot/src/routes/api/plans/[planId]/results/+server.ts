import { store } from '$lib/server/store'
import { respond } from '$lib/server/http'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = ({ params, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'no-store' })
  return respond(() => store.results(params.planId))
}
