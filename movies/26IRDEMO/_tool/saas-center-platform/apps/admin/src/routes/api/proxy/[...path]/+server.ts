import { json, type RequestEvent } from '@sveltejs/kit'
import { resolveApiUrl } from '$lib/server/config'
import { tryRefreshAndSetCookies } from '$lib/server/auth'
import { COOKIE_CONFIG } from '$lib/server/config'

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
  // 클라이언트가 보낸 path를 그대로 forward. trailing slash 강제 추가는 안 함
  // (FastAPI 307 redirect로 인한 불필요한 round-trip 방지).
  const path = event.url.pathname.slice('/api/proxy/'.length)
  const accessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)

  const queryString = event.url.search
  const fullUrl = `${resolveApiUrl(path)}${queryString}`

  const headers: Record<string, string> = {}
  const incomingContentType = event.request.headers.get('content-type')
  if (incomingContentType) {
    headers['Content-Type'] = incomingContentType
  } else {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  try {
    let body: any = undefined

    if (method !== 'GET' && method !== 'HEAD') {
      if (
        incomingContentType &&
        incomingContentType.startsWith('multipart/form-data')
      ) {
        body = await event.request.arrayBuffer()
      } else {
        const text = await event.request.text()
        if (text) body = text
      }
    }

    let response = await fetchWithRedirect(fullUrl, {
      method,
      headers,
      body
    })

    if (response.status === 401) {
      const isProduction = event.url.protocol === 'https:'
      const refreshed = await tryRefreshAndSetCookies(
        event.cookies,
        isProduction
      )

      if (refreshed) {
        const newAccessToken = event.cookies.get(
          COOKIE_CONFIG.accessToken.name
        )
        headers['Authorization'] = `Bearer ${newAccessToken}`

        const retryResponse = await fetchWithRedirect(fullUrl, {
          method,
          headers,
          body
        })

        return handleResponse(retryResponse)
      }

      return json(
        { success: false, message: '인증이 만료되었습니다.' },
        { status: 401 }
      )
    }

    return handleResponse(response)
  } catch (error) {
    console.error('Admin proxy request error:', error)
    return json(
      { success: false, message: '서버 연결에 실패했습니다.' },
      { status: 500 }
    )
  }
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type')

  if (response.status === 204) {
    return new Response(null, { status: 204 })
  }

  if (contentType?.includes('application/json')) {
    try {
      const data = await response.json()
      return json(data, { status: response.status })
    } catch {
      return json({}, { status: response.status })
    }
  }

  const text = await response.text()
  return new Response(text, {
    status: response.status,
    headers: { 'Content-Type': contentType || 'text/plain' }
  })
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
