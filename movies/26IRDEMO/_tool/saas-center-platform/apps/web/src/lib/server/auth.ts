/**
 * 서버 사이드 인증 유틸리티
 *
 * 토큰 검증, 갱신, 사용자 정보 추출 등 공통 인증 로직
 */

import type { Cookies } from '@sveltejs/kit';
import { API_URL, COOKIE_CONFIG } from './config';
import type { UserInfo } from '../../app.d';

/**
 * JWT 토큰 디코딩 (서버사이드)
 */
export function decodeJwt(token: string): Record<string, unknown> | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;

		const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
		return JSON.parse(payload);
	} catch {
		return null;
	}
}

/**
 * 토큰 만료 확인
 */
export function isTokenExpired(token: string): boolean {
	const payload = decodeJwt(token);
	if (!payload || typeof payload.exp !== 'number') return true;

	const now = Math.floor(Date.now() / 1000);
	return payload.exp < now;
}

/**
 * 토큰에서 사용자 정보 추출
 */
export function extractUserFromToken(token: string): UserInfo | null {
	const payload = decodeJwt(token);
	if (!payload) return null;

	return {
		id: (payload.sub as string) || (payload.user_id as string) || '',
		email: (payload.email as string) || '',
		name: (payload.name as string) || '',
		phone: (payload.phone as string) || undefined,
		role: (payload.role as string) || 'counselor'
	};
}

/**
 * 쿠키 옵션 생성
 */
export function getCookieOptions(isProduction: boolean, maxAge: number) {
	return {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict' as const,
		maxAge
	};
}

/**
 * 리프레시 토큰으로 새 액세스 토큰 발급
 */
export async function refreshAccessToken(
	refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn?: number } | null> {
	const url = `${API_URL}/auth/refresh`;
	console.log('[Auth] Calling refresh API:', url);

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`
			},
			body: JSON.stringify({ refresh_token: refreshToken })
		});

		console.log('[Auth] Refresh API response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.log('[Auth] Refresh API error:', errorText);
			return null;
		}

		const data = await response.json();
		console.log('[Auth] Refresh API success, got new tokens');

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token || refreshToken,
			expiresIn: data.expires_in
		};
	} catch (error) {
		console.error('[Auth] Refresh API exception:', error);
		return null;
	}
}

/**
 * 토큰 갱신 및 쿠키 설정
 *
 * @returns 갱신 성공 여부
 */
export async function tryRefreshAndSetCookies(
	cookies: Cookies,
	isProduction: boolean
): Promise<boolean> {
	const refreshToken = cookies.get(COOKIE_CONFIG.refreshToken.name);

	console.log('[Auth] tryRefreshAndSetCookies called');
	console.log('[Auth] refreshToken exists:', !!refreshToken);

	if (!refreshToken) {
		console.log('[Auth] No refresh token, clearing cookies');
		clearAuthCookies(cookies);
		return false;
	}

	// refreshToken이 JWT 형식인 경우에만 클라이언트에서 만료 체크
	// 해시나 opaque 토큰인 경우 서버에서 검증하도록 요청 진행
	const isJwtFormat = refreshToken.split('.').length === 3;
	if (isJwtFormat && isTokenExpired(refreshToken)) {
		console.log('[Auth] Refresh token (JWT) expired, clearing cookies');
		clearAuthCookies(cookies);
		return false;
	}

	console.log('[Auth] Attempting to refresh access token...');
	const newTokens = await refreshAccessToken(refreshToken);

	if (!newTokens) {
		console.log('[Auth] Token refresh failed, clearing cookies');
		clearAuthCookies(cookies);
		return false;
	}

	console.log('[Auth] Token refresh successful!');

	// 새 토큰으로 쿠키 갱신
	const accessMaxAge = newTokens.expiresIn && newTokens.expiresIn > 0
		? newTokens.expiresIn
		: COOKIE_CONFIG.accessToken.maxAge;

	cookies.set(
		COOKIE_CONFIG.accessToken.name,
		newTokens.accessToken,
		getCookieOptions(isProduction, accessMaxAge)
	);

	if (newTokens.refreshToken !== refreshToken) {
		cookies.set(
			COOKIE_CONFIG.refreshToken.name,
			newTokens.refreshToken,
			getCookieOptions(isProduction, COOKIE_CONFIG.refreshToken.maxAge)
		);
	}

	return true;
}

/**
 * 인증 쿠키 삭제
 */
export function clearAuthCookies(cookies: Cookies): void {
	cookies.delete(COOKIE_CONFIG.accessToken.name, { path: '/' });
	cookies.delete(COOKIE_CONFIG.refreshToken.name, { path: '/' });
}

/**
 * 새 토큰 쿠키 설정
 */
export function setAuthCookies(
	cookies: Cookies,
	accessToken: string,
	refreshToken: string,
	isProduction: boolean,
	accessExpiresIn?: number
): void {
	const accessMaxAge = accessExpiresIn && accessExpiresIn > 0
		? accessExpiresIn
		: COOKIE_CONFIG.accessToken.maxAge;

	cookies.set(
		COOKIE_CONFIG.accessToken.name,
		accessToken,
		getCookieOptions(isProduction, accessMaxAge)
	);

	cookies.set(
		COOKIE_CONFIG.refreshToken.name,
		refreshToken,
		getCookieOptions(isProduction, COOKIE_CONFIG.refreshToken.maxAge)
	);
}
