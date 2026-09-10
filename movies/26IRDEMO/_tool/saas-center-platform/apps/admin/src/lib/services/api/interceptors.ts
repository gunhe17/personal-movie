import type { AxiosInstance } from 'axios';
import { goto } from '$app/navigation';
import { auth } from '$stores/auth';
import { browser } from '$app/environment';

/**
 * HTTP-Only 쿠키 환경용 인터셉터
 *
 * 토큰 관리:
 * - 토큰은 HTTP-Only 쿠키에 저장되어 JavaScript에서 접근 불가
 * - 토큰 검증 및 갱신은 서버 사이드에서 처리 (hooks.server.ts, proxy route)
 * - 클라이언트는 401 응답만 처리
 */
const setInterceptors = (instance: AxiosInstance) => {
	// 응답 인터셉터 - 401 처리
	instance.interceptors.response.use(
		(response) => {
			return response;
		},
		async (error) => {
			if (browser) {
				if (error.response?.status === 401) {
					auth.logout();
					goto('/login');
				}
			}
			return Promise.reject(error);
		}
	);
};

export default setInterceptors;
