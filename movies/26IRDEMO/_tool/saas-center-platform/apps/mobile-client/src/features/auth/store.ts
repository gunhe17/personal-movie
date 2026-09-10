import axios from 'axios';
import { create } from 'zustand';
import { login as loginApi, signup as signupApi, getMe } from './api';
// index가 아니라 push를 직접 — index의 hooks가 이 store를 다시 import해 순환이 된다
import {
  registerForPushNotifications,
  unregisterCurrentPushToken,
} from '@/features/notification/push';
import { TokenStorage } from '@/shared/utils/storage';
import { queryClient } from '@/shared/api/queryClient';
import type { LoginRequest, SignupRequest } from './types';

/** 계정이 바뀔 때(로그아웃·강제 로그아웃·토큰 무효) 이전 계정의 흔적을 모두 지운다. */
function clearSessionState() {
  queryClient.clear();
}

/** 시작 복원용 /app/me 호출의 짧은 timeout (기본 15s는 스플래시를 너무 길게 잡음) */
const HYDRATE_TIMEOUT_MS = 7000;
/** 일시적 네트워크 오류 시 추가 시도 횟수 (총 2회) */
const HYDRATE_RETRIES = 1;
const HYDRATE_RETRY_DELAY_MS = 800;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 토큰이 실제로 무효임을 뜻하는 인증 오류(401/403)인지 판별.
 * 네트워크/타임아웃/5xx 는 토큰 문제가 아니므로 false → 토큰을 보존한다.
 */
function isAuthError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === 401 || status === 403;
}

interface AuthState {
  isAuthenticated: boolean;
  isHydrated: boolean;

  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isHydrated: false,

  login: async (data) => {
    const response = await loginApi(data);
    // 이전 세션 캐시가 남아 있을 수 있어 토큰 저장 전에 비운다.
    clearSessionState();
    await TokenStorage.setTokens(response.access_token, response.refresh_token);
    set({ isAuthenticated: true });
    void registerForPushNotifications();
  },

  signup: async (data) => {
    const response = await signupApi(data);
    clearSessionState();
    await TokenStorage.setTokens(response.access_token, response.refresh_token);
    set({ isAuthenticated: true });
    void registerForPushNotifications();
  },

  logout: async () => {
    // 토큰을 지우기 전에 — 해제 API 호출에 인증이 필요하다.
    // 빠뜨리면 공용 기기에서 이전 계정이 계속 푸시를 받는다.
    await unregisterCurrentPushToken();
    await TokenStorage.clear();
    clearSessionState();
    set({ isAuthenticated: false });
  },

  hydrate: async () => {
    const accessToken = await TokenStorage.getAccessToken();

    if (!accessToken) {
      set({ isAuthenticated: false, isHydrated: true });
      return;
    }

    // 토큰이 있으면 /app/me로 세션 유효성 확인.
    // 일시적 네트워크 오류(타임아웃·끊김·5xx)로는 토큰을 삭제하지 않는다 —
    // 짧게 재시도하고, 그래도 실패하면 토큰은 보존한 채 스플래시만 해제.
    for (let attempt = 0; ; attempt++) {
      try {
        const me = await getMe({ timeout: HYDRATE_TIMEOUT_MS });
        queryClient.setQueryData(['me'], me);
        set({ isAuthenticated: true, isHydrated: true });
        // 재실행도 로그인과 같은 세션 시작 — 여기서 빠지면 기기 토큰이 갱신되지 않고
        // 로그아웃 때 해제할 대상도 사라진다(공용 기기 누수).
        void registerForPushNotifications();
        return;
      } catch (err) {
        // 토큰이 실제로 무효(401/403) → 로그아웃 처리
        if (isAuthError(err)) {
          await TokenStorage.clear();
          clearSessionState();
          set({ isAuthenticated: false, isHydrated: true });
          return;
        }
        // 네트워크/타임아웃/5xx → 짧게 재시도
        if (attempt < HYDRATE_RETRIES) {
          await delay(HYDRATE_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        // 재시도 후에도 실패 → 토큰은 보존, 스플래시만 해제
        set({ isAuthenticated: false, isHydrated: true });
        return;
      }
    }
  },
}));

/**
 * 인터셉터에서 refresh 실패 시 호출.
 * store 외부에서 직접 호출 가능하도록 분리.
 */
export function forceLogout() {
  // 세션 만료도 로그아웃 — 기기 토큰을 남기면 다음 사용자에게 알림이 간다
  void unregisterCurrentPushToken();
  TokenStorage.clear();
  useAuthStore.setState({ isAuthenticated: false });
  clearSessionState();
}
