import axios from 'axios';

import type { ApiResponse } from '$types/apiResponse';
import setInterceptors from './interceptors';

/**
 * 메인 API 인스턴스
 *
 * HTTP-Only 쿠키 환경:
 * - 모든 요청은 /api/proxy/... 로 전송되어 SvelteKit 서버에서 처리
 * - 서버가 쿠키에서 토큰을 읽어 Authorization 헤더 추가
 * - 401 응답 시 서버에서 자동으로 토큰 갱신 시도
 */
const appInstance = axios.create({
	baseURL: '/api/proxy',
	timeout: 30000,
	// 빈 문자열/null/undefined는 query에서 제외 — 백엔드의 strict 검증으로 인한 422 방지.
	paramsSerializer: {
		serialize: (params: Record<string, unknown>) => {
			const usp = new URLSearchParams();
			for (const [key, value] of Object.entries(params ?? {})) {
				if (value === undefined || value === null || value === '') continue;
				if (Array.isArray(value)) {
					for (const v of value) {
						if (v === undefined || v === null || v === '') continue;
						usp.append(key, String(v));
					}
				} else {
					usp.append(key, String(value));
				}
			}
			return usp.toString();
		}
	}
});
setInterceptors(appInstance);

const get = async <T = any>(
	route: string,
	params?: Record<string, string | number | boolean | null | undefined> | URLSearchParams
): Promise<T> => {
	const response = await appInstance.get<T>(route, { params });
	return response.data;
};

const put = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await appInstance.put<ApiResponse<T>>(route, params);
	return response.data;
};

const post = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await appInstance.post<ApiResponse<T>>(route, params);
	return response.data;
};

const patch = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await appInstance.patch<ApiResponse<T>>(route, params);
	return response.data;
};

const deleteResource = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await appInstance.delete<ApiResponse<T>>(route, {
		data: params
	});
	return response.data;
};

export { appInstance, get, put, post, deleteResource, patch };
