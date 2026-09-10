import { dev } from '$app/environment'
import type { Handle } from '@sveltejs/kit'
export const handle: Handle = async ({ event, resolve }) => {
  if (!dev)
    return new Response('로컬 개발 모드 전용 기획 도구입니다.', { status: 404 })
  const host = event.request.headers.get('host')
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(event.url.hostname) ||
    host !== event.url.host
  )
    return new Response('로컬 주소로 접속하세요.', { status: 403 })
  if (
    !['GET', 'HEAD'].includes(event.request.method) &&
    event.request.headers.get('origin') !== event.url.origin
  )
    return new Response('기획 화면에서 요청하세요.', { status: 403 })
  const response = await resolve(event)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Cache-Control', 'no-store')
  return response
}
