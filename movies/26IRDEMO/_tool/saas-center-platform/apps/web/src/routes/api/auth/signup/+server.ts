import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { API_URL } from '$lib/server/config'

interface SignupRequestBody {
	email: string
	password: string
	person: {
		name: string
		phone: string
		birth?: string
		gender?: string
	}
}

interface SignupResponse {
	account: { id: string; email: string; is_verified: boolean; created_at: string }
	person: { id: string; name: string; phone: string }
	access_token: string
	refresh_token: string
	token_type: string
	expires_in: number
}

const signupUrl = `${API_URL.replace(/\/$/, '')}/auth/signup`

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body: SignupRequestBody = await request.json()

		const response = await fetch(signupUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}))
			const rawDetail = errorData.detail ?? errorData.message

			// Pydantic 422 필드별 에러 파싱
			if (response.status === 422 && Array.isArray(rawDetail)) {
				const fieldErrors: Record<string, string> = {}
				for (const err of rawDetail) {
					const loc = (err.loc as string[]) ?? []
					const field = loc[loc.length - 1]
					if (field) {
						const msg = (err.msg as string)?.replace(/^Value error, /, '') ?? ''
						fieldErrors[field] = msg
					}
				}
				return json(
					{ success: false, message: '입력 정보를 확인해 주세요.', fieldErrors },
					{ status: 422 }
				)
			}

			const message =
				typeof rawDetail === 'string'
					? rawDetail
					: Array.isArray(rawDetail) && rawDetail[0]?.msg
						? rawDetail.map((e: { msg?: string }) => e.msg).join(', ')
						: '회원가입에 실패했습니다.'
			return json({ success: false, message }, { status: response.status })
		}

		const data = (await response.json()) as SignupResponse
		if (!data?.access_token || !data?.person?.id) {
			console.error('[signup] Unexpected backend response shape:', data)
			return json(
				{ success: false, message: '회원가입 응답 형식이 올바르지 않습니다.' },
				{ status: 502 }
			)
		}
		const isProduction = url.protocol === 'https:'
		const accessMaxAge = data.expires_in > 0 ? data.expires_in : 60 * 60 * 24

		cookies.set('accessToken', data.access_token, {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: accessMaxAge
		})
		cookies.set('refreshToken', data.refresh_token, {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7
		})

		let role = 'counselor'
		try {
			const payload = JSON.parse(
				Buffer.from(data.access_token.split('.')[1], 'base64').toString('utf-8')
			)
			if (payload.role) role = payload.role
		} catch {
			// ignore
		}

		return json({
			success: true,
			user: {
				id: data.person.id,
				email: data.account.email,
				name: data.person.name,
				phone: data.person.phone,
				role,
				isVerified: data.account.is_verified,
				centers: []
			}
		})
	} catch (error) {
		const err = error as Error
		console.error('[signup]', err.message)
		if (err.cause) console.error('[signup] cause:', err.cause)
		const message =
			err.message?.includes('fetch') || err.message?.includes('ECONNREFUSED')
				? 'API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.'
				: '서버 오류가 발생했습니다.'
		return json({ success: false, message }, { status: 500 })
	}
}
