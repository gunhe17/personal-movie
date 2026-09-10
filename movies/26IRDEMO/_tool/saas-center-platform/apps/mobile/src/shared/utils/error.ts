import { AxiosError } from 'axios';

export type AppErrorType = 'network' | 'auth' | 'validation' | 'server' | 'unknown';

export interface AppError {
  type: AppErrorType;
  message: string;
  status?: number;
}

/** Axios 에러를 앱 에러로 변환 */
export function parseError(error: unknown): AppError {
  if (error instanceof AxiosError) {
    // 네트워크 에러 (타임아웃, DNS 실패, 연결 거부 등)
    if (!error.response) {
      return {
        type: 'network',
        message: '네트워크 연결을 확인해주세요.',
      };
    }

    const status = error.response.status;
    const detail = error.response.data?.detail;

    switch (status) {
      case 401:
        return {
          type: 'auth',
          status,
          message: detail ?? '이메일 또는 비밀번호가 올바르지 않습니다.',
        };
      case 403:
        return {
          type: 'auth',
          status,
          message: detail ?? '접근 권한이 없습니다.',
        };
      case 422:
        return {
          type: 'validation',
          status,
          message: detail ?? '입력값을 확인해주세요.',
        };
      default:
        if (status >= 500) {
          return {
            type: 'server',
            status,
            message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
          };
        }
        return {
          type: 'unknown',
          status,
          message: detail ?? '알 수 없는 오류가 발생했습니다.',
        };
    }
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
  };
}

/** 이메일 형식 검증 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
