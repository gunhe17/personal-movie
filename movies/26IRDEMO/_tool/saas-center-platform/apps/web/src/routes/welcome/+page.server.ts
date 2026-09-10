import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { API_URL } from '$lib/server/config'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login?redirectTo=/welcome')
	}

	// JWT에 name이 없으므로 /auth/me API로 실제 이름 조회
	let userName = locals.user.name || ''
	if (!userName && locals.accessToken) {
		try {
			const res = await fetch(`${API_URL}/auth/me`, {
				headers: { Authorization: `Bearer ${locals.accessToken}` }
			})
			if (res.ok) {
				const data = await res.json()
				userName = data.person?.name || ''
			}
		} catch (err) {
			console.error('[welcome] Failed to fetch /auth/me:', err)
		}
	}

	return { user: { ...locals.user, name: userName } }
}
