import { writable } from 'svelte/store';

import {
	getCookie,
	getLocalStorage,
	removeCookie,
	removeLocalStorage,
	setAccessTokenCookie,
	setLocalStorage,
	setRefreshTokenCookie
} from '$lib/services/storage';
import type { Client } from '$lib/types/client';

// 사용자 정보 타입 정의
interface AuthData {
	accessToken: string;
	refreshToken: string;
	user: Client;
}

// 초기값 설정
const initialToken = getCookie('accessToken');
const initialRefreshToken = getCookie('refreshToken');
const initialUser = getLocalStorage('userInfo');

export const currentUser = writable<string | undefined>(initialToken);
export const currentTenant = writable<string | undefined>(getCookie('accessToken'));

// 사용자 정보 스토어 추가
export const userInfo = writable<Client | null>(initialUser);

// 인증 데이터 전체 관리
export const authData = writable<AuthData | null>(null);

// 토큰 설정 (쿠키와 스토어 동시 업데이트)
export const setCurrentUser = (token: string) => {
	currentUser.set(token);
};

// 사용자 정보 설정
export const setUserInfo = (user: Client) => {
	userInfo.set(user);
	setLocalStorage('userInfo', user);
};

// 로그인 시 인증 데이터 설정 (테넌트 토큰 없음)
export const setLoginAuthData = (data: AuthData) => {
	// 토큰별로 다른 보안 설정 적용
	setAccessTokenCookie(data.accessToken, 1); // 1일
	setRefreshTokenCookie(data.refreshToken, 30); // 30일

	// 사용자 정보는 로컬 스토리지에 저장
	setLocalStorage('userInfo', data.user);

	// 스토어 업데이트 (currentTenant는 설정하지 않음)
	currentUser.set(data.accessToken);
	userInfo.set(data.user);
	authData.set(data);
};

// 센터 선택 후 테넌트 토큰으로 갱신 (테넌트 토큰 포함)
export const setAuthData = (data: AuthData) => {
	// 토큰별로 다른 보안 설정 적용
	setAccessTokenCookie(data.accessToken, 1); // 1일
	setRefreshTokenCookie(data.refreshToken, 30); // 30일

	// 사용자 정보는 로컬 스토리지에 저장
	setLocalStorage('userInfo', data.user);

	// 스토어 업데이트 (테넌트 토큰이므로 currentTenant도 설정)
	// currentUser.set(data.accessToken)
	// currentTenant.set(data.accessToken)
	// userInfo.set(data.user)
	currentUser.set(data.accessToken);
	userInfo.set(data.user);
	authData.set(data);
};

// 로그아웃 처리
export const removeCurrentUser = () => {
	// 쿠키 제거
	removeCookie('accessToken');
	removeCookie('refreshToken');

	// 로컬 스토리지 제거
	removeLocalStorage('userInfo');
	removeLocalStorage('tenantInfo');

	// 스토어 초기화
	currentUser.set(undefined);
	userInfo.set(null);
	authData.set(null);
};

// 토큰 갱신
export const refreshAuthToken = (newAccessToken: string) => {
	setAccessTokenCookie(newAccessToken, 1);
	currentUser.set(newAccessToken);

	// authData 업데이트
	authData.update((data) => {
		if (data) {
			return { ...data, accessToken: newAccessToken };
		}
		return data;
	});
};

// 현재 유효한 토큰 가져오기 (쿠키 우선)
export const getCurrentToken = () => {
	return getCookie('accessToken');
};

// 리프레시 토큰 가져오기
export const getRefreshToken = () => {
	return getCookie('refreshToken');
};

// 인증 상태 확인
export const isAuthenticated = () => {
	const token = getCookie('accessToken');
	return !!token;
};
