import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, url }) => {
	const isProduction = url.protocol === 'https:';

	// 쿠키를 만료시켜서 삭제 (Set-Cookie 헤더로 직접 설정)
	// maxAge: 0 또는 과거 날짜로 설정하면 브라우저가 쿠키 삭제
	const deleteOptions = {
		path: '/',
		maxAge: 0,
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict' as const
	};

	// HTTP-Only 쿠키 삭제 (실제 로그인)
	cookies.set('accessToken', '', deleteOptions);
	cookies.set('refreshToken', '', deleteOptions);

	// non-HTTP-Only 쿠키도 삭제 (개발용 mock 로그인)
	cookies.set('accessToken', '', { ...deleteOptions, httpOnly: false });
	cookies.set('refreshToken', '', { ...deleteOptions, httpOnly: false });

	return json({
		success: true,
		message: '로그아웃되었습니다.'
	});
};
