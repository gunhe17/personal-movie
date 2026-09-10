import { error, type RequestEvent } from '@sveltejs/kit'

// 공개 S3 이미지(child-drawing-image 버킷 등)를 동일 출처로 중계한다.
// 목적: 종합보고서 PDF 생성 시 html2canvas가 크로스오리진 S3 이미지의
// 픽셀을 읽지 못하는(CORS) 문제 해결. 이미지 자체는 public-read라 서버가
// 인증 없이 가져올 수 있다.
//
// SSRF 방지: amazonaws.com 호스트만 허용.
function isAllowedHost(hostname: string): boolean {
  return hostname === 'amazonaws.com' || hostname.endsWith('.amazonaws.com')
}

export async function GET(event: RequestEvent) {
  const raw = event.url.searchParams.get('url')
  if (!raw) throw error(400, 'url 파라미터가 필요합니다.')

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    throw error(400, '잘못된 url 입니다.')
  }
  if (target.protocol !== 'https:' || !isAllowedHost(target.hostname)) {
    throw error(400, '허용되지 않은 이미지 호스트입니다.')
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString())
  } catch (e) {
    console.error('[img proxy] fetch 실패', e)
    throw error(502, '이미지를 가져오지 못했습니다.')
  }
  if (!upstream.ok || !upstream.body) {
    throw error(upstream.status || 502, '이미지를 가져오지 못했습니다.')
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
  const buffer = await upstream.arrayBuffer()
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300'
    }
  })
}
