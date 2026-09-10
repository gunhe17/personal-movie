import { json, type RequestEvent } from '@sveltejs/kit'
import { resolveApiUrl } from '$lib/server/config'
import { tryRefreshAndSetCookies } from '$lib/server/auth'

const PERMISSION_VERSION_HEADER = 'X-Permission-Version'

/**
 * 범용 API 프록시 서버 라우트
 *
 * 사용법:
 * - /api/proxy/centers/... → API_URL/centers/...
 * - /api/proxy/auth/...    → API_URL/auth/...
 * - /api/proxy/staff/...   → API_URL/staff/...
 *
 * HTTP-Only 쿠키에서 토큰을 읽어 Authorization 헤더에 추가
 * 권한 버전 헤더 전달 (클라이언트 ↔ 백엔드)
 */

/**
 * fetch + 307/308 리다이렉트 수동 처리
 *
 * Node.js fetch는 307 리다이렉트 시 ArrayBuffer body(multipart/form-data)를
 * 재전송하지 못해 예외가 발생한다. redirect: 'manual'로 이를 방지하고
 * 리다이렉트를 직접 처리한다.
 */
async function fetchWithRedirect(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: any }
): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'manual' })

  if (response.status === 307 || response.status === 308) {
    const redirectUrl = response.headers.get('location')
    if (redirectUrl) {
      return fetch(redirectUrl, { ...init, redirect: 'manual' })
    }
  }

  return response
}

async function proxyRequest(event: RequestEvent, method: string) {
  // SvelteKit strips trailing slashes (308 redirect) before the handler runs.
  // FastAPI collection endpoints require trailing slashes (e.g., /centers/applications/).
  // Without it, /centers/applications matches /centers/{center_id} instead.
  // Always append trailing slash — FastAPI's redirect_slashes handles the reverse case.
  const rawPath = event.url.pathname.slice('/api/proxy/'.length)
  const path = rawPath.endsWith('/') || rawPath === '' ? rawPath : rawPath + '/'
  const accessToken = event.cookies.get('accessToken')

  const queryString = event.url.search
  const fullUrl = `${resolveApiUrl(path)}${queryString}`

  const headers: Record<string, string> = {}
  // 기본 Content-Type은 클라이언트 요청의 Content-Type을 그대로 전달하도록 처리합니다.
  const incomingContentType = event.request.headers.get('content-type')
  if (incomingContentType) {
    headers['Content-Type'] = incomingContentType
  } else {
    // 기본적으로 JSON인 경우 명시
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  } else {
    // 로그인 쿠키가 없는 공개 플로우(검사 링크 토큰 등)는 클라이언트가 보낸 Authorization을 그대로 전달
    const incomingAuth = event.request.headers.get('authorization')
    if (incomingAuth) headers['Authorization'] = incomingAuth
  }

  // 클라이언트에서 보낸 권한 버전 헤더 전달
  const permissionVersion = event.request.headers.get(PERMISSION_VERSION_HEADER)
  if (permissionVersion) {
    headers[PERMISSION_VERSION_HEADER] = permissionVersion
  }

  try {
    let body: any = undefined

    if (method !== 'GET' && method !== 'HEAD') {
      // multipart/form-data 등 바이너리 바디는 arrayBuffer로 읽어 그대로 전달
      if (incomingContentType && incomingContentType.startsWith('multipart/form-data')) {
        body = await event.request.arrayBuffer()
      } else {
        const text = await event.request.text()
        if (text) body = text
      }
    }

    let response = await fetchWithRedirect(fullUrl, { method, headers, body })

    // 401 응답 시 토큰 갱신 시도
    if (response.status === 401) {
      const isProduction = event.url.protocol === 'https:'
      const refreshed = await tryRefreshAndSetCookies(
        event.cookies,
        isProduction
      )

      if (refreshed) {
        // 갱신 성공 - 재요청
        const newAccessToken = event.cookies.get('accessToken')
        headers['Authorization'] = `Bearer ${newAccessToken}`

        const retryResponse = await fetchWithRedirect(fullUrl, {
          method,
          headers,
          body
        })

        return handleResponse(retryResponse)
      }

      // 갱신 실패 - 401 반환
      return json(
        { success: false, message: '인증이 만료되었습니다.' },
        { status: 401 }
      )
    }

    return handleResponse(response)
  } catch (error) {
    console.error('Proxy request error:', error)
    return json(
      { success: false, message: '서버 연결에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 응답 처리 - 권한 버전 헤더 포함
 */
async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type')

  // 권한 관련 응답 헤더 추출
  const responseHeaders: Record<string, string> = {}
  const permissionVersion = response.headers.get(PERMISSION_VERSION_HEADER)

  if (permissionVersion) {
    responseHeaders[PERMISSION_VERSION_HEADER] = permissionVersion
  }

  // No Content (204) 처리: 빈 바디로 JSON 파싱 시 예외 발생 방지
  if (response.status === 204) {
    return new Response(null, {
      status: 204,
      headers: {
        ...responseHeaders
      }
    })
  }

  // SSE 스트림: 바디를 읽지 않고 ReadableStream을 그대로 passthrough
  if (contentType?.includes('text/event-stream')) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...responseHeaders
      }
    })
  }

  if (contentType?.includes('application/json')) {
    try {
      const data = await response.json()
      return json(data, {
        status: response.status,
        headers: responseHeaders
      })
    } catch (err) {
      // 빈 바디 또는 파싱 실패 시 안전하게 빈 객체 반환
      console.warn('Failed to parse JSON from upstream response:', err)
      return json({}, { status: response.status, headers: responseHeaders })
    }
  }

  // 바이너리 콘텐츠: text()로 읽으면 깨지므로 arrayBuffer로 그대로 전달
  const isBinary =
    contentType?.includes('application/pdf') ||
    contentType?.includes('application/octet-stream') ||
    contentType?.startsWith('image/') ||
    contentType?.startsWith('audio/') ||
    contentType?.startsWith('video/')
  if (isBinary) {
    const buffer = await response.arrayBuffer()
    return new Response(buffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType!,
        ...responseHeaders
      }
    })
  }

  const text = await response.text()
  return new Response(text, {
    status: response.status,
    headers: {
      'Content-Type': contentType || 'text/plain',
      ...responseHeaders
    }
  })
}

export const config = {
  body: {
    maxSize: '10mb'
  }
}

export async function GET(event: RequestEvent) {
  return proxyRequest(event, 'GET')
}

export async function POST(event: RequestEvent) {
  return proxyRequest(event, 'POST')
}

export async function PUT(event: RequestEvent) {
  return proxyRequest(event, 'PUT')
}

export async function PATCH(event: RequestEvent) {
  return proxyRequest(event, 'PATCH')
}

export async function DELETE(event: RequestEvent) {
  return proxyRequest(event, 'DELETE')
}
