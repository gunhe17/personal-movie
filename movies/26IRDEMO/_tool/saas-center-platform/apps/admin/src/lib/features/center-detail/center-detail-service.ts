import { modalStore } from '$stores/modal'
import ConfirmModal from '$components/modal/ConfirmModal.svelte'
import WarnModal from '../../../routes/(protected)/center/manage/[centerId]/components/WarnModal.svelte'
import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
import {
  postSuspendCenter,
  postActivateCenter,
  postWarnCenter,
  postTerminateCenter
} from '$hooks/actions/center.action'
import type { QueryClient } from '@tanstack/svelte-query'

export interface CenterDetailDeps {
  queryClient: QueryClient
}

export function createCenterDetailService(deps: CenterDetailDeps) {
  const { queryClient } = deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['getCenterDetail'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getCenterList'], exact: false })
  }

  const suspend = (centerId: string, centerName: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '센터 정지',
        message: `"${centerName}" 센터를 정지하시겠습니까?\n정지된 센터의 사용자는 서비스를 이용할 수 없습니다.`,
        confirmText: '정지',
        type: 'danger',
        onConfirm: async () => {
          try {
            await postSuspendCenter().request({
              centerId,
              reason: '관리자에 의한 정지'
            })
            showSuccessSnackbar('센터가 정지되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const activate = (centerId: string, centerName: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '센터 활성화',
        message: `"${centerName}" 센터를 활성화하시겠습니까?`,
        confirmText: '활성화',
        type: 'info',
        onConfirm: async () => {
          try {
            await postActivateCenter().request({ centerId })
            showSuccessSnackbar('센터가 활성화되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const warn = (centerId: string, centerName: string) => {
    modalStore.open({
      component: WarnModal,
      props: {
        centerName,
        onConfirm: async (reason: string) => {
          try {
            await postWarnCenter().request({
              centerId,
              reason,
              notify: true
            })
            showSuccessSnackbar('경고가 발송되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const terminate = (centerId: string, centerName: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '센터 해지',
        message: `"${centerName}" 센터를 해지하시겠습니까?\n해지 후 30일간 데이터가 보관되며, 이후 완전 삭제됩니다.`,
        confirmText: '해지',
        type: 'danger',
        onConfirm: async () => {
          try {
            await postTerminateCenter().request({
              centerId,
              reason: '관리자에 의한 해지',
              notify_center: true
            })
            showSuccessSnackbar('센터가 해지되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  return { suspend, activate, warn, terminate, invalidate }
}
