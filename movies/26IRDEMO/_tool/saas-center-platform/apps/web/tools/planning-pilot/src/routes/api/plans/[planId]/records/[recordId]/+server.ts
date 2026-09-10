import { store } from '$lib/server/store'
import { respond } from '$lib/server/http'
import type { RequestHandler } from './$types'
export const GET: RequestHandler = ({ params }) =>
  respond(() => store.getRecord(params.planId, params.recordId))
