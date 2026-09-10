import type { AxiosInstance } from 'axios';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { auth } from '$lib/stores/auth';
import { permissionStore } from '$lib/stores/permission.store';
import { snackbarStore } from '$lib/stores/snackbar';
import { browser } from '$app/environment';

const PERMISSION_VERSION_HEADER = 'x-permission-version';

/**
 * HTTP-Only 쿠키 환경용 인터셉터
 *
 * 토큰 관리:
 * - 토큰은 HTTP-Only 쿠키에 저장되어 JavaScript에서 접근 불가
 * - 토큰 검증 및 갱신은 서버 사이드에서 처리 (hooks.server.ts, proxy route)
 * - 클라이언트는 401 응답만 처리
 *
 * 권한 버전 동기화:
 * - 요청 시 X-Permission-Version 헤더에 현재 버전 전송
 * - 응답에서 버전 불일치 감지 시 권한 재동기화
 */
const setInterceptors = (instance: AxiosInstance) => {
	// 요청 인터셉터 - 권한 버전 헤더 추가
	instance.interceptors.request.use(
		(config) => {
			if (browser) {
				const version = permissionStore.getVersion();
				if (version !== null) {
					config.headers.set('X-Permission-Version', String(version));
				}
			}
			return config;
		},
		(error) => {
			return Promise.reject(error);
		}
	);

	// 응답 인터셉터 - 401 처리 + 권한 버전 체크
	instance.interceptors.response.use(
		(response) => {
			if (browser) {
				// 응답 헤더에서 서버 권한 버전 확인
				const serverVersion = response.headers[PERMISSION_VERSION_HEADER];

				if (serverVersion) {
					const version = parseInt(serverVersion, 10);
					if (!isNaN(version)) {
						// 비동기로 동기화 (응답은 즉시 반환)
						permissionStore.syncIfNeeded(version);
					}
				}
			}
			return response;
		},
		async (error) => {
			if (browser) {
				if (error.response?.status === 401) {
					// 서버에서 토큰 갱신 시도 후에도 401이면 로그아웃
					await auth.logout();
					goto('/login');
				} else if (error.response?.status === 403) {
					// 인증이 만료된 상태에서 403이면 로그인 페이지로 이동
					const { isAuthenticated } = get(auth);
					if (!isAuthenticated) {
						await auth.logout();
						goto('/login');
						return Promise.reject(error);
					}

					// 플랜 제한 403 → 업그레이드 유도 스낵바
					const detail = error.response.data?.detail ?? '';
					const isPlanDenied =
						(typeof detail === 'object' && detail?.code === 'PLAN_FEATURE_DENIED') ||
						(typeof detail === 'string' && (detail.includes('플랜') || detail.includes('plan')));
					if (isPlanDenied) {
						const message =
							typeof detail === 'object' ? detail.message : detail;
						snackbarStore.warning(
							message || '이 기능은 상위 플랜에서 사용할 수 있습니다.',
							{ text: '플랜 업그레이드', href: '/subscription' },
						);
						return Promise.reject(error);
					}

					// 권한 없음 - 권한 재동기화 시도
					const serverVersion = error.response.headers?.[PERMISSION_VERSION_HEADER];
					if (serverVersion) {
						const version = parseInt(serverVersion, 10);
						if (!isNaN(version)) {
							await permissionStore.syncIfNeeded(version);
						}
					}
				} else if (error.response?.status === 429) {
					// 크레딧 부족 (QuotaExceededException)
					const detail = error.response.data?.detail ?? '';
					const message = typeof detail === 'string'
						? detail
						: '이번 달 AI 크레딧이 부족합니다.';
					snackbarStore.error(
						message,
						{ text: '사용량 확인', href: '/subscription/ai-usage' },
						5000,
					);
					return Promise.reject(error);
				}
			}
			return Promise.reject(error);
		}
	);
};

export default setInterceptors;
