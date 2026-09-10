import axios from 'axios';

import type { ApiResponse } from '$lib/types/apiResponse';
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
	timeout: 30000
});
setInterceptors(appInstance);

// 외부 API용 인스턴스 (프록시 경유) - 기존 호환성 유지
const externalInstance = axios.create({
	baseURL: '/external-api',
	timeout: 30000
});
setInterceptors(externalInstance);

// 실제 서버 응답을 그대로 반환 (타입은 제네릭으로 처리)
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

const postRaw = async <T = any>(route: string, params?: object): Promise<T> => {
	const response = await appInstance.post<T>(route, params);
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

// 외부 API용 함수들
const externalGet = async <T = unknown>(route: string): Promise<T> => {
	const response = await externalInstance.get<T>(route);
	return response.data;
};

const externalPost = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await externalInstance.post<ApiResponse<T>>(route, params);
	return response.data;
};

const externalPatch = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await externalInstance.patch<ApiResponse<T>>(route, params);
	return response.data;
};

export { appInstance, externalInstance, get, put, post, postRaw, deleteResource, patch, externalGet, externalPost, externalPatch };
