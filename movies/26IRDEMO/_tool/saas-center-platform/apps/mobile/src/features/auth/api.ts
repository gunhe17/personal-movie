import axios, { type AxiosRequestConfig } from 'axios';
import apiClient, { API_BASE_URL, API_PREFIX } from '@/shared/api/client';
import type { LoginRequest, LoginResponse, RefreshTokenResponse, MeResponse } from './types';

/** 로그인 (토큰 인터셉터 없이 직접 호출) */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await axios.post<LoginResponse>(
    `${API_BASE_URL}${API_PREFIX}/auth/login`,
    data,
  );
  return response.data;
}

/** 토큰 리프레시 */
export async function refreshToken(token: string): Promise<RefreshTokenResponse> {
  const response = await axios.post<RefreshTokenResponse>(
    `${API_BASE_URL}${API_PREFIX}/auth/refresh`,
    { refresh_token: token },
  );
  return response.data;
}

/** 내 정보 조회 (인터셉터를 통해 토큰 주입). 시작 복원 등에서 짧은 timeout 주입 가능. */
export async function getMe(config?: AxiosRequestConfig): Promise<MeResponse> {
  const response = await apiClient.get<MeResponse>('/auth/me', config);
  return response.data;
}
