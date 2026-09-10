import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { TokenStorage } from '@/shared/utils/storage';

// --- API URL ---

const prodApiUrl = 'https://api.mindscope.kr';

function getDevApiUrl(): string {
  // 웹: 동일 호스트에서 실행되므로 localhost 사용
  if (Platform.OS === 'web') {
    return 'http://localhost:3502';
  }

  // 네이티브(iOS/Android): Expo 개발 서버의 호스트 IP를 추출하여 사용
  // hostUri 예: "192.168.0.10:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    // 터널 모드일 경우 도메인이 들어오므로 IP가 아니면 무시
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    if (isIp) {
      return `http://${host}:3502`;
    }
  }

  // fallback
  return 'http://localhost:3502';
}

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  (__DEV__ ? getDevApiUrl() : prodApiUrl);

export const API_PREFIX = '/api/v1';

console.log('[API] BASE_URL:', API_BASE_URL);
console.log('[API] FULL_URL:', `${API_BASE_URL}${API_PREFIX}`);

// --- Axios Instance ---

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Request 인터셉터: Bearer 토큰 주입 */
apiClient.interceptors.request.use(async (config) => {
  const token = await TokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 토큰 리프레시 중복 방지 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

/** Response 인터셉터: 401 → 토큰 리프레시 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await TokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const { data } = await axios.post(
        `${API_BASE_URL}${API_PREFIX}/auth/refresh`,
        { refresh_token: refreshToken },
      );

      await TokenStorage.setTokens(data.access_token, data.refresh_token);
      processQueue(null, data.access_token);

      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // store 상태까지 초기화 → 로그인 화면으로 자동 이동
      const { forceLogout } = await import('@/features/auth/store');
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
