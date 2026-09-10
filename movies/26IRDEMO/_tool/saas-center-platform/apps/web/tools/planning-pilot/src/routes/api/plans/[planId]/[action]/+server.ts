import { store, StoreError } from '$lib/server/store'
import { input, body, respond } from '$lib/server/http'
import type { RequestHandler } from './$types'
export const POST: RequestHandler = ({ params, request }) =>
  respond(async () => {
    if (params.action === 'upload')
      return store.upload(
        params.planId,
        await body(request, 4 * 1024 * 1024),
        request.headers.get('content-type')
      )
    if (params.action === 'generate') {
      const value = await input(request)
      return store.generate(params.planId, value.selection, value.revision)
    }
    if (params.action === 'review-questions') {
      const value = await input(request)
      if (typeof value.recordId !== 'string')
        throw new StoreError(400, '기록 ID가 필요합니다.')
      return store.requestFollowUps(params.planId, value.recordId)
    }
    if (!['save', 'send'].includes(params.action))
      throw new StoreError(404, '요청을 찾을 수 없습니다.')
    const value = await input(request)
    return store.save(
      params.planId,
      value.selection,
      params.action === 'send',
      value.revision
    )
  })
