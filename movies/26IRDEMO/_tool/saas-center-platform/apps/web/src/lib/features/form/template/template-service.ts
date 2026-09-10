import { goto } from '$app/navigation'
import { modalStore, modalUtils } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import {
  postCreateFormTemplate,
  postCloneFormTemplate,
  postGenerateFormDraft,
  putUpdateFormTemplate,
  deleteFormTemplate,
  patchFormTemplateStatus
} from '$lib/hooks/actions/form.action'
import type { FormSchema } from '$lib/hooks/actions/form.action'
import type { QueryClient } from '@tanstack/svelte-query'
import type { TemplateVM } from './view-model'
import NewFormModal from './components/NewFormModal.svelte'
import FormSendModal from './components/FormSendModal.svelte'

export interface TemplateServiceDeps {
  queryClient: QueryClient
}

/** 빈 스키마 (새 템플릿 생성 시 기본값) — canonical */
const EMPTY_SCHEMA: FormSchema = {
  pages: [],
  fields: {
    q1: {
      type: 'text',
      label: '질문 1',
      required: false
    }
  },
  elements: [
    {
      id: 'q1',
      page: 1,
      rect: [0.08, 0.05, 0.84, 0.05],
      z: 1,
      widget: 'text',
      field_refs: ['q1']
    }
  ]
}

export function createTemplateService(deps: TemplateServiceDeps) {
  const { queryClient } = deps

  const invalidateList = () => {
    queryClient.invalidateQueries({
      queryKey: ['getFormTemplates'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getFormTemplate'],
      exact: false
    })
  }

  async function createTemplate(name: string) {
    try {
      await postCreateFormTemplate().request({
        centerId: requireCenterId(),
        name,
        schema: EMPTY_SCHEMA
      })
      snackbarStore.success('템플릿이 생성되었습니다.')
      invalidateList()
    } catch {
      snackbarStore.error('템플릿 생성에 실패했습니다.')
    }
  }

  /** AI 초안 생성: 자연어 설명 → FormSchema → 그 스키마로 템플릿 생성 */
  async function generateAndCreate(name: string, description: string) {
    try {
      const { schema } = await postGenerateFormDraft().request({
        centerId: requireCenterId(),
        description
      })
      const created = (await postCreateFormTemplate().request({
        centerId: requireCenterId(),
        name,
        schema
      })) as unknown as { id: string }
      snackbarStore.success('AI 초안으로 양식이 생성되었습니다.')
      invalidateList()
      // 완료 → 생성된 양식 편집기로 이동
      if (created?.id) {
        goto(`/center/form-templates/${created.id}/edit`)
      }
    } catch {
      snackbarStore.error('AI 초안 생성에 실패했습니다.')
    }
  }

  async function cloneTemplate(templateId: string, name: string) {
    try {
      await postCloneFormTemplate().request({
        centerId: requireCenterId(),
        templateId,
        name
      })
      snackbarStore.success('템플릿이 복제되었습니다.')
      invalidateList()
    } catch {
      snackbarStore.error('템플릿 복제에 실패했습니다.')
    }
  }

  async function updateTemplate(
    templateId: string,
    schema: FormSchema
  ): Promise<boolean> {
    try {
      await putUpdateFormTemplate().request({
        centerId: requireCenterId(),
        templateId,
        schema
      })
      snackbarStore.success('양식 구조가 저장되었습니다. (새 버전)')
      invalidateList()
      return true
    } catch {
      snackbarStore.error('양식 저장에 실패했습니다.')
      return false
    }
  }

  async function deactivateTemplate(templateId: string) {
    try {
      await deleteFormTemplate().request({
        centerId: requireCenterId(),
        templateId
      })
      snackbarStore.success('템플릿이 비활성화되었습니다.')
      invalidateList()
    } catch {
      snackbarStore.error('템플릿 비활성화에 실패했습니다.')
    }
  }

  /** 목록 캐시에서 해당 템플릿의 is_active만 갈아끼운다 */
  const patchActiveInCache = (templateId: string, isActive: boolean) => {
    queryClient.setQueriesData(
      { queryKey: ['getFormTemplates'], exact: false },
      (old: any) => {
        if (!Array.isArray(old?.items)) return old
        return {
          ...old,
          items: old.items.map((it: any) =>
            it?.id === templateId ? { ...it, is_active: isActive } : it
          )
        }
      }
    )
  }

  /** 상태 토글 (활성/비활성) — 목록·상세 공용 */
  async function changeStatus(templateId: string, isActive: boolean) {
    try {
      await patchFormTemplateStatus().request({
        centerId: requireCenterId(),
        templateId,
        isActive
      })
      snackbarStore.success(
        isActive ? '활성화되었습니다.' : '비활성화되었습니다.'
      )
      // 재조회 대신 제자리 갱신 — 목록에서 행이 즉시 사라지거나 자리를 옮기지 않게
      // 표시(배지·토글)만 바꾼다. 다른 화면의 양식 피커는 활성만 받으므로
      // stale 표시만 남겨두고, 그 화면이 다시 열릴 때 스스로 재조회하게 한다.
      patchActiveInCache(templateId, isActive)
      queryClient.invalidateQueries({
        queryKey: ['getFormTemplates'],
        exact: false,
        refetchType: 'none'
      })
      queryClient.invalidateQueries({
        queryKey: ['getFormTemplate'],
        exact: false
      })
    } catch {
      snackbarStore.error('상태 변경에 실패했습니다.')
    }
  }

  async function openCreateModal() {
    const name = await modalUtils.prompt(
      '새로운 양식 템플릿의 이름을 입력하세요.',
      '템플릿 생성',
      { placeholder: '예: 사전면담 기록지', confirmText: '생성' }
    )
    if (name) {
      await createTemplate(name)
    }
  }

  async function openCloneModal(template: TemplateVM) {
    const name = await modalUtils.prompt(
      `"${template.name}" 템플릿을 복제합니다. 새 이름을 입력하세요.`,
      '템플릿 복제',
      { placeholder: `${template.name} (복사)`, confirmText: '복제' }
    )
    if (name) {
      await cloneTemplate(template.id, name)
    }
  }

  async function openDeactivateConfirm(template: TemplateVM) {
    const confirmed = await modalUtils.confirm(
      `"${template.name}" 템플릿을 비활성화할까요?\n비활성화된 템플릿은 새 양식에 사용할 수 없습니다.`,
      '템플릿 비활성화',
      { type: 'warning' }
    )
    if (confirmed) {
      await deactivateTemplate(template.id)
    }
  }

  /** 문서 작성 요청 모달 — 내담자 검색/수신자 입력 후 문자 양식으로 전송 */
  function openSendModal(template: { id: string; name: string }) {
    modalStore.open({
      component: FormSendModal,
      props: {
        templateId: template.id,
        formName: template.name,
        onSendComplete: () => {
          queryClient.invalidateQueries({
            queryKey: ['listFormSends'],
            exact: false
          })
        }
      },
      options: { size: 'fit', desktopOnly: true }
    })
  }

  /** 새 양식 모달 — 빈 양식 또는 공개 양식(복제) 선택해서 생성 */
  function openNewFormModal(templates: TemplateVM[]) {
    modalStore.open({
      component: NewFormModal,
      props: {
        templates,
        onCreate: async ({
          template,
          name,
          description
        }: {
          template: TemplateVM | null
          name: string
          description?: string | null
        }) => {
          if (description) {
            await generateAndCreate(name, description)
          } else if (template) {
            await cloneTemplate(template.id, name)
          } else {
            await createTemplate(name)
          }
        }
      },
      options: { size: 'wideXl', customWidth: 640 }
    })
  }

  return {
    invalidateList,
    createTemplate,
    cloneTemplate,
    updateTemplate,
    deactivateTemplate,
    changeStatus,
    openCreateModal,
    openCloneModal,
    openDeactivateConfirm,
    openSendModal,
    openNewFormModal
  }
}
