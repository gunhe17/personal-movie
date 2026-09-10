import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { goto } from '$app/navigation';
import { auth } from '$lib/stores/auth';

const setInterceptors = (instance: AxiosInstance) => {
	instance.interceptors.request.use(
		async (config) => {
			let accessToken = getCookie('accessToken');
			const refreshToken = getCookie('refreshToken');

			if (refreshToken && isTokenExpired(refreshToken)) {
				// refreshToken도 만료된 경우
				removeCookie('accessToken');
				removeCookie('refreshToken');
				localStorage.clear();
				auth.logout();
				goto('/login');
				throw new axios.Cancel('Session has expired');
			}

			if (accessToken && isTokenExpired(accessToken)) {
				if (!refreshToken) {
					// refreshToken이 없는 경우
					removeCookie('accessToken');
					auth.logout();
					goto('/login');
					throw new axios.Cancel('No refresh token available');
				}

				// 액세스 토큰 갱신 시도
				try {
					const newAccessToken = await refreshAccessToken(refreshToken);
					if (newAccessToken) {
						accessToken = newAccessToken;
						setAccessTokenCookie(accessToken);
						config.headers['Authorization'] = `Bearer ${accessToken}`;
					} else {
						throw new axios.Cancel('Failed to obtain new access token');
					}
				} catch (error) {
					auth.logout();
					goto('/login');
					return Promise.reject(error);
				}
			} else if (accessToken) {
				config.headers['Authorization'] = `Bearer ${accessToken}`;
			}

			return config;
		},
		(error) => {
			return Promise.reject(error);
		}
	);

	// 응답 인터셉터를 통한 401 처리
	instance.interceptors.response.use(
		(response) => {
			return response;
		},
		async (error) => {
			if (error.response && error.response.status === 401) {
				auth.logout();
				goto('/login');
			}
			return Promise.reject(error);
		}
	);
};

export function isTokenExpired(token: string): boolean {
	const parts = token.split('.');
	if (parts.length !== 3) {
		return false;
	}

	try {
		const payload = JSON.parse(atob(parts[1]));

		if (!payload.exp) {
			return false;
		}

		const now = Math.floor(Date.now() / 1000);

		if (payload.exp < now) {
			return true;
		}

		return false;
	} catch (e) {
		return false;
	}
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
	try {
		const response = await axios.post(
			'/api/accounts/refresh',
			{
				refresh_token: refreshToken
			},
			{
				headers: {
					authorization: `Bearer ${refreshToken}`
				}
			}
		);

		return response.data.data.access_token;
	} catch (error) {
		return '';
	}
}

function getCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
	return null;
}

function removeCookie(name: string): void {
	if (typeof document === 'undefined') return;
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

function setAccessTokenCookie(token: string): void {
	if (typeof document === 'undefined') return;
	const expiresIn = 24 * 60 * 60 * 1000; // 24시간
	const expires = new Date(Date.now() + expiresIn).toUTCString();
	const isProduction = window.location.protocol === 'https:';
	const secureFlag = isProduction ? '; secure' : '';
	document.cookie = `accessToken=${token}; expires=${expires}; path=/${secureFlag}; SameSite=strict`;
}

function setRefreshTokenCookie(token: string): void {
	if (typeof document === 'undefined') return;
	const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7일
	const expires = new Date(Date.now() + expiresIn).toUTCString();
	const isProduction = window.location.protocol === 'https:';
	const secureFlag = isProduction ? '; secure' : '';
	document.cookie = `refreshToken=${token}; expires=${expires}; path=/${secureFlag}; SameSite=strict`;
}

export default setInterceptors;
