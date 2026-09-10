import type { RequestHandler } from '@sveltejs/kit'

/**
 * S3 presigned URL 동일-오리진 프록시.
 *
 * pdf.js 등은 파일 바이트를 fetch 로 읽는데, S3 presigned URL 은 CORS 가
 * 막혀 브라우저에서 직접 읽지 못한다("Failed to fetch"). 이 라우트가 서버에서
 * 대신 받아 같은 오리진으로 스트리밍한다.
 *
 * 보안:
 *  - 관리자 인증 필요 (locals.user)
 *  - SSRF 방지: amazonaws.com(S3) 호스트만 허용
 *  - presigned URL 자체가 시간제한 capability
 *
 * Range 헤더를 그대로 전달해 pdf.js 의 부분 요청(206)을 지원한다.
 */
const PASS_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified'
]

export const GET: RequestHandler = async ({ url, request, locals }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const target = url.searchParams.get('url')
  if (!target) {
    return new Response('url query required', { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return new Response('invalid url', { status: 400 })
  }

  // SSRF 가드 — S3(amazonaws.com) 호스트만 허용
  if (
    parsed.protocol !== 'https:' ||
    !/(^|\.)amazonaws\.com$/i.test(parsed.hostname)
  ) {
    return new Response('forbidden host', { status: 403 })
  }

  const range = request.headers.get('range')
  let upstream: Response
  try {
    upstream = await fetch(target, {
      headers: range ? { Range: range } : {},
      redirect: 'follow'
    })
  } catch {
    return new Response('upstream fetch failed', { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response('upstream error', { status: 502 })
  }

  const headers = new Headers()
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/octet-stream')
  }
  headers.set('cache-control', 'private, max-age=300')

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  })
}
