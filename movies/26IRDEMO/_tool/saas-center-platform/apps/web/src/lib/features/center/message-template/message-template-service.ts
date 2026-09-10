/**
 * 문자 양식 서비스
 */

import { modalStore, modalUtils } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  postMessageTemplate,
  patchMessageTemplate,
  deleteMessageTemplate,
  postSetDefault
} from '$lib/hooks/actions/messageTemplate.action'
import { MODAL_SIZES, TEMPLATE_VARIABLES } from './constants'
import MessageTemplateFormModal from './components/MessageTemplateFormModal.svelte'

export interface MessageTemplateDeps {
  queryClient: QueryClient
  onMutationSuccess?: () => void
}

export function createMessageTemplateService(deps: MessageTemplateDeps) {
  const { queryClient, onMutationSuccess } = deps

  const invalidateList = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['getDefaultTemplate'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getMessageTemplates'],
        exact: false
      })
    ])

  const openCreateModal = (initialData?: {
    template_type: string
    name: string
    content: string
    is_default: boolean
  }) => {
    modalStore.open({
      component: MessageTemplateFormModal,
      props: {
        mode: 'create' as const,
        initialData,
        onConfirm: async (data: {
          template_type: string
          name: string
          content: string
          is_default: boolean
        }) => {
          await postMessageTemplate().request({
            centerId: requireCenterId(),
            ...data
          })
          snackbarStore.success('양식이 생성되었습니다.')
          invalidateList()
          onMutationSuccess?.()
        }
      },
      options: MODAL_SIZES.create
    })
  }

  const openEditModal = (template: {
    id: string
    template_type: string
    name: string
    content: string
    is_default: boolean
  }) => {
    modalStore.open({
      component: MessageTemplateFormModal,
      props: {
        mode: 'edit' as const,
        initialData: template,
        onConfirm: async (data: { name?: string; content?: string }) => {
          await patchMessageTemplate().request({
            centerId: requireCenterId(),
            templateId: template.id,
            ...data
          })
          snackbarStore.success('양식이 수정되었습니다.')
          invalidateList()
          onMutationSuccess?.()
        }
      },
      options: MODAL_SIZES.edit
    })
  }

  const handleDelete = async (templateId: string) => {
    const confirmed = await modalUtils.confirm(
      '이 양식을 삭제하시겠습니까?',
      '양식 삭제',
      { type: 'danger' }
    )
    if (!confirmed) return
    try {
      await deleteMessageTemplate().request({
        centerId: requireCenterId(),
        templateId
      })
      snackbarStore.success('양식이 삭제되었습니다.')
      invalidateList()
      onMutationSuccess?.()
    } catch {
      snackbarStore.error('삭제에 실패했습니다.')
    }
  }

  const handleSetDefault = async (templateId: string) => {
    await postSetDefault().request({
      centerId: requireCenterId(),
      templateId
    })
    snackbarStore.success('기본 양식으로 설정되었습니다.')
    invalidateList()
    onMutationSuccess?.()
  }

  return {
    openCreateModal,
    openEditModal,
    handleDelete,
    handleSetDefault,
    invalidateList
  }
}
