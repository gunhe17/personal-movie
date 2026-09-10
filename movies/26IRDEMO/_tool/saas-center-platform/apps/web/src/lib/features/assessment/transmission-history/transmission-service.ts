import { snackbarStore } from '$lib/stores/snackbar'
import { resendTransmission } from '$lib/hooks/actions/transmission.action'
import type { QueryClient } from '@tanstack/svelte-query'

export interface TransmissionServiceDeps {
	centerId: string
	queryClient: QueryClient
}

export function createTransmissionService(deps: TransmissionServiceDeps) {
	const { centerId, queryClient } = deps

	// 쿼리 무효화
	const invalidateList = () =>
		queryClient.invalidateQueries({
			queryKey: ['getTransmissionHistory'],
			exact: false
		})

	// 재전송 실행
	async function handleResend(transmissionId: string): Promise<boolean> {
		try {
			const action = resendTransmission()
			const result = await action.request({
				centerId,
				transmissionId
			})

			if (result.success) {
				snackbarStore.success(result.message || '재전송되었습니다.')
				invalidateList()
				return true
			} else {
				snackbarStore.error(result.message || '재전송에 실패했습니다.')
				return false
			}
		} catch (error) {
			console.error('[transmission-service] resend error:', error)
			snackbarStore.error('재전송 중 오류가 발생했습니다.')
			return false
		}
	}

	// 새로고침
	function refresh() {
		invalidateList()
	}

	return {
		handleResend,
		refresh,
		invalidateList
	}
}
