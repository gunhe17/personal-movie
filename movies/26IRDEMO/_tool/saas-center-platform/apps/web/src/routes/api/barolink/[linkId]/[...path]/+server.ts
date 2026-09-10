import { json, type RequestEvent } from '@sveltejs/kit'
import { resolveApiUrl } from '$lib/server/config'

async function handle(event: RequestEvent) {
  const { linkId = '', path = '' } = event.params
  const method = event.request.method
  const allowed =
    method === 'GET'
      ? /^(session|tasks\/[a-zA-Z0-9-]+(?:\/report)?)$/.test(path)
      : method === 'POST' &&
        /^(verify|tasks\/[a-zA-Z0-9-]+\/submit)$/.test(path)
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(linkId) || !allowed)
    return json({ detail: '지원하지 않는 요청이에요.' }, { status: 404 })
  if (
    method === 'POST' &&
    event.request.headers.get('origin') !== event.url.origin
  )
    return json({ detail: '허용되지 않은 요청이에요.' }, { status: 403 })
  const cookieName = `barolink_${linkId}`
  const cookiePath = `/api/barolink/${linkId}`
  const token = event.cookies.get(cookieName)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token && path !== 'verify') headers.Authorization = `Bearer ${token}`
  if (!token && path !== 'verify')
    return json(
      { detail: '링크 인증이 필요해요.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  try {
    const response = await fetch(
      resolveApiUrl(`assessment-send-links/${linkId}/${path}`),
      {
        method,
        headers,
        body: method === 'POST' ? await event.request.text() : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(30000)
      }
    )
    const raw = await response.json()
    const data = raw?.data ?? raw
    if (response.ok && path === 'verify') {
      if (typeof data.access_token !== 'string' || !data.access_token)
        return json(
          { detail: '인증 응답을 확인하지 못했어요.' },
          { status: 502 }
        )
      event.cookies.set(cookieName, data.access_token, {
        path: cookiePath,
        httpOnly: true,
        secure: event.url.protocol === 'https:',
        sameSite: 'strict',
        maxAge: 7200
      })
    }
    if (
      response.status === 401 ||
      (path === 'session' && [400, 403, 404, 422].includes(response.status))
    )
      event.cookies.delete(cookieName, { path: cookiePath })
    if (response.ok && ['verify', 'session'].includes(path)) {
      delete data.access_token
      data.session_active = true
    }
    return json(response.ok ? data : raw, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch {
    return json(
      { detail: '서버 연결을 확인한 뒤 다시 시도해주세요.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

export const GET = handle
export const POST = handle
