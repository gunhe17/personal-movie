import { goto } from '$app/navigation'
import { modalStore } from '$stores/modal'
import ConfirmModal from '$components/modal/ConfirmModal.svelte'
import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
import { patchNotice, deleteNotice, postNotifyUnread } from '$hooks/actions/notice.action'
import type { QueryClient } from '@tanstack/svelte-query'

export interface NoticeDetailDeps {
  queryClient: QueryClient
}

export function createNoticeDetailService(deps: NoticeDetailDeps) {
  const { queryClient } = deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['getNoticeDetail'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getNoticeList'], exact: false })
  }

  const invalidateReadStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['getNoticeReadStatus'], exact: false })
  }

  const publish = (noticeId: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '공지사항 게시',
        message:
          '공지사항을 게시하시겠습니까?\n게시 즉시 모든 센터 사용자에게 노출됩니다.',
        confirmText: '게시',
        onConfirm: async () => {
          try {
            await patchNotice().request({ noticeId, is_published: true })
            showSuccessSnackbar('게시되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const unpublish = (noticeId: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '게시 취소',
        message:
          '공지사항 게시를 취소하시겠습니까?\n센터 사용자에게 더 이상 노출되지 않습니다.',
        confirmText: '게시 취소',
        onConfirm: async () => {
          try {
            await patchNotice().request({ noticeId, is_published: false })
            showSuccessSnackbar('게시가 취소되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const remove = (noticeId: string, isPublished: boolean) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '공지사항 삭제',
        message: isPublished
          ? '이 공지사항을 삭제하시겠습니까?\n게시 중인 공지는 즉시 비노출됩니다.'
          : '이 공지사항을 삭제하시겠습니까?',
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteNotice().request({ noticeId })
            showSuccessSnackbar('삭제되었습니다.')
            invalidate()
            goto('/notices')
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const save = async (noticeId: string, payload: Record<string, any>) => {
    try {
      await patchNotice().request({ noticeId, ...payload })
      showSuccessSnackbar('저장되었습니다.')
      invalidate()
      return true
    } catch (e: any) {
      showErrorSnackbar(e)
      return false
    }
  }

  const notifyUnread = (noticeId: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '미열람자 알림 발송',
        message: '미열람 멤버 전체에게 리마인드 알림을 발송하시겠습니까?',
        confirmText: '발송',
        onConfirm: async () => {
          try {
            const res = await postNotifyUnread().request({ noticeId })
            showSuccessSnackbar(
              `알림 발송이 시작되었습니다. (대상: ${res.data.target_member_count}명)`
            )
            invalidateReadStatus()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  return { publish, unpublish, remove, save, invalidate, notifyUnread }
}
