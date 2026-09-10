import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_URL } from '$lib/server/config';

interface LoginRequest {
	email: string;
	password: string;
}

interface LoginResponse {
	account: {
		id: string;
		email: string;
		is_verified: boolean;
		created_at: string;
	};
	person: {
		id: string;
		name: string;
		phone: string;
	};
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
	centers: Array<{
		id: string;
		name: string;
		[key: string]: unknown;
	}>;
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body: LoginRequest = await request.json();

		// 외부 로그인 API 호출
		const response = await fetch(`${API_URL}/auth/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return json(
				{
					success: false,
					message: errorData.detail || errorData.message || '로그인에 실패했습니다.'
				},
				{ status: response.status }
			);
		}

		const data: LoginResponse = await response.json();
		const isProduction = url.protocol === 'https:';

		// HTTP-Only 쿠키로 토큰 설정
		const accessMaxAge = data.expires_in > 0 ? data.expires_in : 60 * 60 * 24; // 기본 24시간

		cookies.set('accessToken', data.access_token, {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: accessMaxAge
		});

		cookies.set('refreshToken', data.refresh_token, {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7 // 7일
		});

		// JWT 토큰에서 role 추출 시도
		let role = 'counselor';
		try {
			const payload = JSON.parse(
				Buffer.from(data.access_token.split('.')[1], 'base64').toString('utf-8')
			);
			if (payload.role) {
				role = payload.role;
			}
		} catch {
			// role 추출 실패 시 기본값 사용
		}

		// 클라이언트에게 사용자 정보 반환 (토큰 제외)
		return json({
			success: true,
			user: {
				id: data.person.id,
				email: data.account.email,
				name: data.person.name,
				phone: data.person.phone,
				role,
				isVerified: data.account.is_verified,
				centers: data.centers
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		return json(
			{
				success: false,
				message: '서버 오류가 발생했습니다.'
			},
			{ status: 500 }
		);
	}
};
