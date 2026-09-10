import { afterEach, expect, it, vi } from 'vitest'
import type { RequestEvent } from '@sveltejs/kit'
import { GET, POST } from './+server'

vi.mock('$lib/server/config', () => ({
  resolveApiUrl: (path: string) => `http://api.test/${path}`
}))
afterEach(() => vi.unstubAllGlobals())
function event(path: string, method = 'GET', token?: string) {
  return {
    params: { linkId: 'link-a', path },
    url: new URL(`http://localhost/api/barolink/link-a/${path}`),
    request: new Request(`http://localhost/api/barolink/link-a/${path}`, {
      method,
      headers: {
        origin: 'http://localhost',
        'Content-Type': 'application/json',
        Authorization: 'Bearer staff-token'
      },
      ...(method === 'POST' ? { body: '{"verification_code":"1234"}' } : {})
    }),
    cookies: {
      get: vi.fn((name: string) =>
        name === 'barolink_link-a' ? token : 'staff-token'
      ),
      set: vi.fn(),
      delete: vi.fn()
    }
  }
}
it('sets a scoped HttpOnly cookie and never returns the access token', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'link-token', tasks: [] }))
      )
  )
  const request = event('verify', 'POST')
  const response = await POST(request as unknown as RequestEvent)
  expect(await response.json()).toEqual({ tasks: [], session_active: true })
  expect(request.cookies.set).toHaveBeenCalledWith(
    'barolink_link-a',
    'link-token',
    expect.objectContaining({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/barolink/link-a',
      maxAge: 7200
    })
  )
  expect(response.headers.get('cache-control')).toBe('no-store')
})
it('uses only the link cookie and does not renew it on restoration', async () => {
  const upstream = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ access_token: '', tasks: [] }))
    )
  vi.stubGlobal('fetch', upstream)
  const request = event('session', 'GET', 'link-token')
  await GET(request as unknown as RequestEvent)
  expect(upstream).toHaveBeenCalledWith(
    'http://api.test/assessment-send-links/link-a/session',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer link-token' })
    })
  )
  expect(request.cookies.set).not.toHaveBeenCalled()
})
it('requires the matching cookie and clears expired sessions', async () => {
  const upstream = vi
    .fn()
    .mockResolvedValue(new Response('{}', { status: 401 }))
  vi.stubGlobal('fetch', upstream)
  expect((await GET(event('session') as unknown as RequestEvent)).status).toBe(
    401
  )
  expect(upstream).not.toHaveBeenCalled()
  const request = event('session', 'GET', 'expired')
  expect((await GET(request as unknown as RequestEvent)).status).toBe(401)
  expect(request.cookies.delete).toHaveBeenCalledWith('barolink_link-a', {
    path: '/api/barolink/link-a'
  })
})
it('rejects cross-origin writes and arbitrary proxy paths', async () => {
  const request = event('verify', 'POST')
  request.request = new Request(request.url, {
    method: 'POST',
    headers: { origin: 'http://evil.test' }
  })
  expect((await POST(request as unknown as RequestEvent)).status).toBe(403)
  expect((await GET(event('../staff') as unknown as RequestEvent)).status).toBe(
    404
  )
})
