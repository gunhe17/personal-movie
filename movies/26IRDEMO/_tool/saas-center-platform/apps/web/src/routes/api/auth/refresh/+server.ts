import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_URL } from '$lib/server/config';

export const POST: RequestHandler = async ({ cookies, url }) => {
	const refreshToken = cookies.get('refreshToken');

	if (!refreshToken) {
		return json(
			{
				success: false,
				message: '리프레시 토큰이 없습니다.'
			},
			{ status: 401 }
		);
	}

	try {
		// 외부 토큰 갱신 API 호출
		const response = await fetch(`${API_URL}/auth/refresh`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`
			},
			body: JSON.stringify({ refresh_token: refreshToken })
		});

		if (!response.ok) {
			// 리프레시 토큰도 만료된 경우 쿠키 삭제
			cookies.delete('accessToken', { path: '/' });
			cookies.delete('refreshToken', { path: '/' });

			return json(
				{
					success: false,
					message: '세션이 만료되었습니다. 다시 로그인해주세요.'
				},
				{ status: 401 }
			);
		}

		const data = await response.json();
		const isProduction = url.protocol === 'https:';

		// 새 토큰으로 쿠키 갱신
		const accessMaxAge = data.expires_in > 0 ? data.expires_in : 60 * 60 * 24;

		cookies.set('accessToken', data.access_token, {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: accessMaxAge
		});

		if (data.refresh_token) {
			cookies.set('refreshToken', data.refresh_token, {
				path: '/',
				httpOnly: true,
				secure: isProduction,
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 * 7
			});
		}

		return json({
			success: true,
			message: '토큰이 갱신되었습니다.'
		});
	} catch (error) {
		console.error('Token refresh error:', error);
		return json(
			{
				success: false,
				message: '토큰 갱신 중 오류가 발생했습니다.'
			},
			{ status: 500 }
		);
	}
};
