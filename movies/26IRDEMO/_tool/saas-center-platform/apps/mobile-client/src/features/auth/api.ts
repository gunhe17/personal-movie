import apiClient from '@/shared/api/client';
import type {
  LoginRequest,
  MeResponse,
  SignupRequest,
  TokenResponse,
} from './types';

export async function signup(data: SignupRequest): Promise<TokenResponse> {
  const { data: res } = await apiClient.post<TokenResponse>('/app/auth/signup', data);
  return res;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const { data: res } = await apiClient.post<TokenResponse>('/app/auth/login', data);
  return res;
}

export async function getMe(config?: { timeout?: number }): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/app/me', config);
  return data;
}
