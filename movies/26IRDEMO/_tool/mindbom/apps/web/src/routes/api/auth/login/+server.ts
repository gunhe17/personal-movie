import { json, type RequestEvent } from '@sveltejs/kit'
import { setAuthCookies, setInstitutionCookie } from '$lib/server/auth'

export async function POST(event: RequestEvent) {
  const { access_token, refresh_token, institution_id } = await event.request.json()
  const isProduction = event.url.protocol === 'https:'

  setAuthCookies(event.cookies, access_token, refresh_token, isProduction)

  if (institution_id) {
    setInstitutionCookie(event.cookies, institution_id, isProduction)
  }

  return json({ success: true })
}