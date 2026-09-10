import { comparisons } from '$lib/server/comparisons'
import { input, respond } from '$lib/server/http'
import { StoreError } from '$lib/server/store'
import type { RequestHandler } from './$types'
export const GET: RequestHandler = ({ params, url }) =>
  respond(() => {
    const id = url.searchParams.get('id')
    return id
      ? comparisons.get(params.planId, id)
      : comparisons.list(params.planId)
  })
export const POST: RequestHandler = ({ params, request }) =>
  respond(async () => {
    const value = await input(request)
    if (value.action === 'start')
      return comparisons.start(
        params.planId,
        value.selection,
        value.revision,
        value.implementation
      )
    if (value.action === 'save' && typeof value.id === 'string')
      return comparisons.save(params.planId, value.id, value.checks)
    throw new StoreError(400, '비교 요청을 확인하세요.')
  })
