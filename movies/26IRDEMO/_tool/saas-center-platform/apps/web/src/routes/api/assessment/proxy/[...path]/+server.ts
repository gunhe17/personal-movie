import { json, type RequestEvent } from '@sveltejs/kit'
import { resolveApiUrl } from '$lib/server/config'
import {
  ASSESSMENT_COOKIE_CONFIG,
  tryRefreshAndSetAssessmentCookies
} from '$lib/server/assessment-auth'

async function proxyRequest(event: RequestEvent, method: string) {
  const path = event.params.path || ''
  const accessToken = event.cookies.get(ASSESSMENT_COOKIE_CONFIG.accessToken.name)
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
    let body: string | ArrayBuffer | undefined
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

    const response = await fetch(fullUrl, { method, headers, body })

    if (response.status === 401) {
      const isProduction = event.url.protocol === 'https:'
      const refreshed = await tryRefreshAndSetAssessmentCookies(
        event.cookies,
        isProduction
      )

      if (refreshed) {
        const newAccessToken = event.cookies.get(
          ASSESSMENT_COOKIE_CONFIG.accessToken.name
        )
        headers['Authorization'] = `Bearer ${newAccessToken}`
        const retryResponse = await fetch(fullUrl, { method, headers, body })
        return handleResponse(retryResponse)
      }

      return json(
        { success: false, message: '인증이 만료되었습니다.' },
        { status: 401 }
      )
    }

    return handleResponse(response)
  } catch (error) {
    console.error('[Assessment Proxy] request error:', error)
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
    headers: {
      'Content-Type': contentType || 'text/plain'
    }
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
