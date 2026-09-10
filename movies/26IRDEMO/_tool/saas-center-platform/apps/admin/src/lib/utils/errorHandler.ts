import { snackbarStore } from '$stores/snackbar';

/**
 * axios error / 일반 객체에서 사용자 메시지를 추출.
 * 백엔드 응답 우선순위: meta.message → detail → message → error.message → fallback.
 */
export const extractErrorMessage = (error: unknown): string => {
	const e = error as any;
	if (e?.response?.data?.meta?.message) return e.response.data.meta.message;
	if (e?.response?.data?.detail) return e.response.data.detail;
	if (e?.response?.data?.message) return e.response.data.message;
	if (e?.message) return e.message;
	return '요청 처리 중 오류가 발생했습니다.';
};

// ── 객체 받는 헬퍼 (catch 블록, mutationBuilder 등에서 사용) ──

/** axios error 등 객체에서 메시지 추출 후 error 스낵바 표시. */
export const showErrorSnackbar = (
	error: unknown,
	_defaultMessage?: string
) => {
	snackbarStore.error(extractErrorMessage(error));
};

// ── string 받는 헬퍼 (이미 만들어진 사용자 메시지 표시용) ──

export const showSuccessSnackbar = (message: string) => snackbarStore.success(message);
export const showErrorMessage = (message: string) => snackbarStore.error(message);
export const showWarningMessage = (message: string) => snackbarStore.warning(message);
export const showInfoMessage = (message: string) => snackbarStore.info(message);
