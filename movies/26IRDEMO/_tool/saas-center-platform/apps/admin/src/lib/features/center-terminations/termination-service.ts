import { modalStore } from '$stores/modal'
import ConfirmModal from '$components/modal/ConfirmModal.svelte'
import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
import { postRestoreCenter } from '$hooks/actions/center.action'
import { snackbarStore } from '$stores/snackbar'
import type { QueryClient } from '@tanstack/svelte-query'

export interface TerminationDeps {
  queryClient: QueryClient
}

export function createTerminationService(deps: TerminationDeps) {
  const { queryClient } = deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['getTerminatedCenterList'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getCenterList'], exact: false })
  }

  const restore = (centerId: string, centerName: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '해지 철회',
        message: `"${centerName}" 센터의 해지를 철회하시겠습니까?\n센터가 다시 활성화되어 서비스를 이용할 수 있게 됩니다.`,
        confirmText: '해지 철회',
        type: 'info',
        onConfirm: async () => {
          try {
            await postRestoreCenter().request({ centerId })
            showSuccessSnackbar('센터 해지가 철회되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  /** 목업: 데이터 내보내기 요청 */
  const requestExport = () => {
    snackbarStore.info('데이터 내보내기 기능은 준비 중입니다.')
  }

  /** 목업: 데이터 완전 삭제 */
  const purge = () => {
    snackbarStore.info('데이터 삭제 기능은 준비 중입니다.')
  }

  return { restore, requestExport, purge, invalidate }
}
