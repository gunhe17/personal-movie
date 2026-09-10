import { snackbarStore } from '$lib/stores/snackbar';

// 에러 메시지 추출 유틸리티 함수
export const extractErrorMessage = (error: any): string => {
	if (error?.response?.data?.meta?.message) {
		return error.response.data.meta.message;
	}
	if (error?.response?.data?.detail) {
		return error.response.data.detail;
	}
	if (error?.response?.data?.message) {
		return error.response.data.message;
	}
	if (error?.message) {
		return error.message;
	}
	return '요청 처리 중 오류가 발생했습니다.';
};

// 에러를 스낵바로 표시하는 함수
export const showErrorSnackbar = (
	error: any,
	defaultMessage: string = '요청 처리 중 오류가 발생했습니다.'
) => {
	const errorMessage = extractErrorMessage(error);
	snackbarStore.error(errorMessage);
};

// 성공 메시지를 스낵바로 표시하는 함수
export const showSuccessSnackbar = (message: string) => {
	snackbarStore.success(message);
};

// 크레딧 부족 에러인지 판별
export const isQuotaError = (error: any): boolean => {
	return error?.response?.status === 429;
};

// 크레딧 부족 에러를 업그레이드 CTA와 함께 표시
export const showQuotaErrorSnackbar = (
	error: any,
	fallbackMessage: string = '이번 달 AI 크레딧이 부족합니다.'
) => {
	const message = extractErrorMessage(error) || fallbackMessage;
	snackbarStore.error(
		message,
		{ text: '사용량 확인', href: '/subscription/ai-usage' },
		5000,
	);
};
