import axios from 'axios';
import { create } from 'zustand';
import { login as loginApi, getMe } from './api';
import { TokenStorage } from '@/shared/utils/storage';
import { queryClient } from '@/shared/api/queryClient';
import type { LoginRequest, AccountSummary, PersonSummary, UserCenterSummary } from './types';

/**
 * 계정이 바뀔 때(로그아웃·강제 로그아웃·토큰 무효) 이전 계정의 흔적을 모두 지운다.
 *
 * - React Query 캐시: 검사/상담 등 서버 데이터 캐시. 쿼리 키가 centerId 기준이라
 *   다른 계정이 같은 센터에 들어가면 이전 계정 캐시가 그대로 반환되는 누수를 막는다.
 * - 센터 스토어: 로그아웃 후에도 centerId가 남아 재로그인 시 곧장 같은 센터로 조회되는 것 방지.
 * - 권한 스토어: 이전 계정 권한 컨텍스트 제거.
 *
 * store 간 순환 참조를 피하기 위해 center 스토어들은 지연 require 한다.
 */
function clearSessionState() {
  queryClient.clear();

  const { useCenterStore } = require('@/features/center/store');
  useCenterStore.getState().clearCenter();

  const { usePermissionStore } = require('@/features/center/permission-store');
  usePermissionStore.getState().clearPermissions();
}

/** 시작 복원용 /auth/me 호출의 짧은 timeout (기본 15s는 스플래시를 너무 길게 잡음) */
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
  account: AccountSummary | null;
  person: PersonSummary | null;
  centers: UserCenterSummary[];

  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isHydrated: false,
  account: null,
  person: null,
  centers: [],

  login: async (data) => {
    const response = await loginApi(data);

    // 이전 세션이 logout을 거치지 않고 남았을 수 있어(예: forceLogout 후 바로 재로그인,
    // 토큰 보존 hydrate 실패 경로) 새 계정 데이터를 받기 전에 캐시/스토어를 비운다.
    clearSessionState();

    await TokenStorage.setTokens(response.access_token, response.refresh_token);

    set({
      isAuthenticated: true,
      account: response.account,
      person: response.person,
      centers: response.centers,
    });
  },

  logout: async () => {
    await TokenStorage.clear();
    clearSessionState();
    set({
      isAuthenticated: false,
      account: null,
      person: null,
      centers: [],
    });
  },

  hydrate: async () => {
    const accessToken = await TokenStorage.getAccessToken();

    if (!accessToken) {
      set({ isAuthenticated: false, isHydrated: true });
      return;
    }

    // 토큰이 있으면 /auth/me로 유저 정보 복원.
    // 일시적 네트워크 오류(타임아웃·끊김·5xx)로는 토큰을 삭제하지 않는다 —
    // 과거엔 시작 시 잠깐의 네트워크 불안정으로도 리프레시 토큰까지 잃고 강제
    // 로그아웃되는 결함이 있었다. 짧게 재시도하고, 그래도 실패하면 토큰은 보존한
    // 채 스플래시만 해제(다음 시작/재연결 시 자연 복구).
    for (let attempt = 0; ; attempt++) {
      try {
        const me = await getMe({ timeout: HYDRATE_TIMEOUT_MS });
        set({
          isAuthenticated: true,
          isHydrated: true,
          account: me.account,
          person: me.person,
          centers: me.centers,
        });
        return;
      } catch (err) {
        // 토큰이 실제로 무효(401/403) → 로그아웃 처리 (기존 동작)
        if (isAuthError(err)) {
          await TokenStorage.clear();
          clearSessionState();
          set({
            isAuthenticated: false,
            isHydrated: true,
            account: null,
            person: null,
            centers: [],
          });
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
  TokenStorage.clear();
  useAuthStore.setState({
    isAuthenticated: false,
    account: null,
    person: null,
    centers: [],
  });
  // 쿼리 캐시 + 센터/권한 스토어 일괄 초기화 (이전 계정 데이터 누수 방지)
  clearSessionState();
}
