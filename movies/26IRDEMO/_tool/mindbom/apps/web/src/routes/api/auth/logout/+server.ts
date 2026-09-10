import { json, type RequestEvent } from '@sveltejs/kit'
import { clearAuthCookies } from '$lib/server/auth'

export async function POST(event: RequestEvent) {
  clearAuthCookies(event.cookies)
  return json({ success: true })
}
