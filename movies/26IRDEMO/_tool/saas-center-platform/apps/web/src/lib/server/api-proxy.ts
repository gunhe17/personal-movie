import { json, type RequestEvent } from '@sveltejs/kit';
import { API_URL } from './config';
import { tryRefreshAndSetCookies } from './auth';

export interface ProxyOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	headers?: Record<string, string>;
}

/**
 * 외부 API로 프록시 요청을 보내는 유틸리티
 *
 * - HTTP-Only 쿠키에서 토큰을 추출하여 Authorization 헤더에 추가
 * - 401 응답 시 토큰 갱신 시도
 */
export async function proxyRequest(
	event: RequestEvent,
	endpoint: string,
	options: ProxyOptions = {}
) {
	const { method = 'GET', body, headers = {} } = options;
	const accessToken = event.cookies.get('accessToken');

	const requestHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...headers
	};

	if (accessToken) {
		requestHeaders['Authorization'] = `Bearer ${accessToken}`;
	}

	const url = `${API_URL}${endpoint}`;

	try {
		const response = await fetch(url, {
			method,
			headers: requestHeaders,
			body: body ? JSON.stringify(body) : undefined
		});

		// 401 응답 시 토큰 갱신 시도
		if (response.status === 401) {
			const isProduction = event.url.protocol === 'https:';
			const refreshed = await tryRefreshAndSetCookies(event.cookies, isProduction);

			if (refreshed) {
				// 갱신 성공 - 재요청
				const newAccessToken = event.cookies.get('accessToken');
				requestHeaders['Authorization'] = `Bearer ${newAccessToken}`;

				const retryResponse = await fetch(url, {
					method,
					headers: requestHeaders,
					body: body ? JSON.stringify(body) : undefined
				});

				return handleResponse(retryResponse);
			}

			// 갱신 실패 - 401 반환
			return json({ success: false, message: '인증이 만료되었습니다.' }, { status: 401 });
		}

		return handleResponse(response);
	} catch (error) {
		console.error('Proxy request error:', error);
		return json({ success: false, message: '서버 연결에 실패했습니다.' }, { status: 500 });
	}
}

/**
 * 응답 처리
 */
async function handleResponse(response: Response) {
	const contentType = response.headers.get('content-type');

	if (contentType?.includes('application/json')) {
		const data = await response.json();
		return json(data, { status: response.status });
	}

	const text = await response.text();
	return new Response(text, {
		status: response.status,
		headers: { 'Content-Type': contentType || 'text/plain' }
	});
}

/**
 * GET 프록시 헬퍼
 */
export function proxyGet(event: RequestEvent, endpoint: string, headers?: Record<string, string>) {
	return proxyRequest(event, endpoint, { method: 'GET', headers });
}

/**
 * POST 프록시 헬퍼
 */
export function proxyPost(
	event: RequestEvent,
	endpoint: string,
	body?: unknown,
	headers?: Record<string, string>
) {
	return proxyRequest(event, endpoint, { method: 'POST', body, headers });
}

/**
 * PUT 프록시 헬퍼
 */
export function proxyPut(
	event: RequestEvent,
	endpoint: string,
	body?: unknown,
	headers?: Record<string, string>
) {
	return proxyRequest(event, endpoint, { method: 'PUT', body, headers });
}

/**
 * PATCH 프록시 헬퍼
 */
export function proxyPatch(
	event: RequestEvent,
	endpoint: string,
	body?: unknown,
	headers?: Record<string, string>
) {
	return proxyRequest(event, endpoint, { method: 'PATCH', body, headers });
}

/**
 * DELETE 프록시 헬퍼
 */
export function proxyDelete(
	event: RequestEvent,
	endpoint: string,
	body?: unknown,
	headers?: Record<string, string>
) {
	return proxyRequest(event, endpoint, { method: 'DELETE', body, headers });
}
