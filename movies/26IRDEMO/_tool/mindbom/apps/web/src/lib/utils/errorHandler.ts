import { snackbarStore } from '$lib/stores/snackbar'

const extractErrorMessage = (error: any): string => {
  if (error?.response?.data?.detail) {
    return error.response.data.detail
  }
  if (error?.response?.data?.message) {
    return error.response.data.message
  }
  if (error?.message) {
    return error.message
  }
  return '요청 처리 중 오류가 발생했습니다.'
}

export const showErrorSnackbar = (
  error: any,
  defaultMessage: string = '요청 처리 중 오류가 발생했습니다.'
) => {
  const errorMessage = extractErrorMessage(error)
  snackbarStore.error(errorMessage)
}

export const showSuccessSnackbar = (message: string) => {
  snackbarStore.success(message)
}
