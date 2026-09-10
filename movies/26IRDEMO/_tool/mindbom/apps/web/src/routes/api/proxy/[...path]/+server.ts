import { json, type RequestEvent } from '@sveltejs/kit'
import { COOKIE_CONFIG, resolveApiUrl } from '$lib/server/config'
import { tryRefreshAndSetCookies } from '$lib/server/auth'

async function proxyRequest(event: RequestEvent, method: string) {
  const rawPath = event.url.pathname.slice('/api/proxy/'.length)
  const path = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath
  const accessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)
  const institutionId = event.cookies.get(COOKIE_CONFIG.institution.name)

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

  // institution_id httpOnly cookie를 백엔드로 forward (path↔cookie 일치 검증용)
  if (institutionId) {
    headers['Cookie'] = `${COOKIE_CONFIG.institution.name}=${institutionId}`
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

    let response = await fetch(fullUrl, { method, headers, body })

    if (response.status === 401) {
      const isProduction = event.url.protocol === 'https:'
      const refreshed = await tryRefreshAndSetCookies(
        event.cookies,
        isProduction
      )

      if (refreshed) {
        const newAccessToken = event.cookies.get('accessToken')
        headers['Authorization'] = `Bearer ${newAccessToken}`
        response = await fetch(fullUrl, { method, headers, body })
        return handleResponse(response)
      }

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

  const isBinary =
    contentType?.includes('application/pdf') ||
    contentType?.includes('application/octet-stream') ||
    contentType?.startsWith('image/') ||
    contentType?.startsWith('audio/')
  if (isBinary) {
    const buffer = await response.arrayBuffer()
    return new Response(buffer, {
      status: response.status,
      headers: { 'Content-Type': contentType! }
    })
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
