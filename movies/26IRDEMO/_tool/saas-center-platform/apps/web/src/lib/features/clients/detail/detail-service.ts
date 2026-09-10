import { t } from '$lib/ontology/terms'
import { goto } from '$app/navigation'
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { modalUtils } from '$lib/stores/modal'
import { requireCenterId } from '$lib/stores/center.store'
import { appInstance } from '$lib/services/api/instances'
import PreAdminssionModal from '$lib/components/modal/PreAdminssionModal.svelte'
import UploadDocumentModal, {
  type UploadedDocumentResult
} from '$lib/components/modal/UploadDocumentModal.svelte'
import {
  getClientRelations,
  putUpdateClient,
  type RelationResponse
} from '$lib/hooks/actions/client.action'
import {
  getFormTemplates,
  getFormTemplate,
  postLinkFormInstance,
  putSaveFormAnswers,
  postSubmitFormInstance
} from '$lib/hooks/actions/form.action'
import { MODAL_SIZES } from './constants'
import type { RelationInfo } from './view-model'
import type { ClientDocumentItem } from '$lib/types/client'

export interface DetailServiceDeps {
  clientId: string
  refetchInstances: () => void
  refetchDocs: () => void
  refetchDetail?: () => void
}

// 프로필 이미지 업로드 제약 (백엔드 upload_image_handler와 동일)
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const AVATAR_MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function createDetailService(deps: DetailServiceDeps) {
  const { clientId, refetchInstances, refetchDocs, refetchDetail } = deps

  // ── 프로필 이미지 변경 (업로드 → 내담자 저장 → 새로고침) ──
  async function changeAvatar(file: File) {
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      snackbarStore.error('JPG, PNG, GIF, WebP 이미지만 올릴 수 있어요.')
      return
    }
    if (file.size > AVATAR_MAX_SIZE) {
      snackbarStore.error('이미지 크기는 10MB까지 가능해요.')
      return
    }

    const centerId = requireCenterId()
    try {
      // 1. 이미지 업로드 → public URL 획득
      const formData = new FormData()
      formData.append('file', file)
      const query = `?category=client-profile&entity_id=${clientId}`
      const res = await appInstance.post(`/upload/images${query}`, formData)
      const data = (res as any)?.data ?? res
      const url: string | null =
        (data as any)?.url ?? (data as any)?.data?.url ?? null
      if (!url) {
        snackbarStore.error('이미지 업로드에 실패했어요.')
        return
      }

      // 2. 내담자에 프로필 이미지 URL 저장
      await putUpdateClient().request({
        centerId,
        clientId,
        payload: { profile_image_url: url }
      })

      snackbarStore.success('프로필 사진을 변경했어요.')
      refetchDetail?.()
    } catch (err) {
      console.error('Client avatar update failed', err)
      snackbarStore.error('프로필 사진 변경에 실패했어요.')
    }
  }

  // ── 문서 연결/해제 ──

  async function linkClientDocument(documentId: string, resourceType: string) {
    const centerId = requireCenterId()
    const response = await fetch(
      `/api/proxy/centers/${centerId}/clients/${clientId}/documents`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          resource_type: resourceType
        })
      }
    )
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(
        (err as { detail?: string; message?: string }).detail ||
          (err as { detail?: string; message?: string }).message ||
          '문서 연결에 실패했어요.'
      )
    }
  }

  async function unlinkClientDocumentMapping(mappingId: string) {
    const centerId = requireCenterId()
    const response = await fetch(
      `/api/proxy/centers/${centerId}/clients/${clientId}/documents/${mappingId}`,
      {
        method: 'DELETE',
        credentials: 'include'
      }
    )
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(
        (err as { detail?: string; message?: string }).detail ||
          (err as { detail?: string; message?: string }).message ||
          '문서 연결 해제에 실패했어요.'
      )
    }
  }

  // ── 파일 다운로드 ──

  async function fetchDocumentFile(
    document: ClientDocumentItem
  ): Promise<File> {
    const centerId = requireCenterId()
    const res = await fetch(
      `/api/proxy/centers/${centerId}/documents/${document.id}/download`,
      { credentials: 'include' }
    )
    if (!res.ok) throw new Error('문서 로드 실패')

    const blob = await res.blob()
    const fileName = document.originalName || document.title
    return new File([blob], fileName, { type: blob.type })
  }

  async function handleDownloadDocument(
    doc: ClientDocumentItem,
    fileCache: Record<string, File>
  ) {
    try {
      let file = fileCache[doc.id]
      if (!file) {
        file = await fetchDocumentFile(doc)
      }
      const url = URL.createObjectURL(file)
      const a = window.document.createElement('a')
      a.href = url
      a.download = doc.originalName || doc.title
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      snackbarStore.error('파일 다운로드에 실패했습니다.')
    }
  }

  // ── 모달 핸들러 ──

  function openRelationInfoModal(relation: RelationInfo) {
    goto(`/clients/${relation.clientId}`)
  }

  function openChangeClientInfoModal() {
    goto(`/clients/register?editClient=${clientId}`)
  }

  async function handleOnlineRequest(preAdmissionTemplate: any | null) {
    const cid = requireCenterId()
    let summary = preAdmissionTemplate
    if (!summary) {
      const list = await getFormTemplates().request({
        centerId: cid,
        includeSystem: true
      })
      summary =
        list.items.find((t: any) => t.name === '사전기록지' && t.is_active) ??
        null
    }
    if (!summary) {
      snackbarStore.error('템플릿 없음')
      return
    }
    const template = await getFormTemplate().request({
      centerId: cid,
      templateId: summary.id
    })
    modalStore.open({
      component: PreAdminssionModal,
      props: {
        template: { id: template.id, schema: template.schema },
        onSave: async (answers: any) => {
          const result = await postLinkFormInstance().request({
            centerId: cid,
            clientId,
            templateId: template.id
          })
          await putSaveFormAnswers().request({
            centerId: cid,
            instanceId: result.instance.id,
            answers
          })
          await postSubmitFormInstance().request({
            centerId: cid,
            instanceId: result.instance.id
          })
          snackbarStore.success('전송 완료')
          modalStore.close()
          refetchInstances()
        }
      },
      options: MODAL_SIZES.preAdmission
    })
  }

  function openUploadDocumentModal() {
    modalStore.open({
      component: UploadDocumentModal,
      props: {
        onConfirm: async (uploadedDocs: UploadedDocumentResult[]) => {
          for (const doc of uploadedDocs) {
            await linkClientDocument(doc.id, 'other')
          }
          refetchDocs()
        },
        maxFiles: 10
      },
      options: MODAL_SIZES.uploadDocument
    })
  }

  function openSingleUploadDocumentModal(
    preAdmissionDocument: ClientDocumentItem | null
  ) {
    modalStore.open({
      component: UploadDocumentModal,
      props: {
        onConfirm: async (uploadedDocs: UploadedDocumentResult[]) => {
          const uploaded = uploadedDocs[0]
          if (uploaded?.id) {
            if (
              preAdmissionDocument &&
              preAdmissionDocument.id !== uploaded.id
            ) {
              await unlinkClientDocumentMapping(preAdmissionDocument.mappingId)
            }
            await linkClientDocument(uploaded.id, 'pre_admission')
          }
          refetchDocs()
        },
        maxFiles: 1
      },
      options: MODAL_SIZES.uploadSingle
    })
  }

  async function handleDeleteDocument(doc: ClientDocumentItem) {
    const confirmed = await modalUtils.confirm(
      `"${doc.title}" 문서를 삭제하시겠어요?`,
      '문서 삭제', { type: 'danger' })
    if (!confirmed) return

    try {
      await unlinkClientDocumentMapping(doc.mappingId)
      snackbarStore.success('문서가 삭제되었습니다.')
      refetchDocs()
    } catch {
      snackbarStore.error('문서 삭제에 실패했습니다.')
    }
  }

  async function fetchRelations(centerId: string): Promise<RelationInfo[]> {
    // 보호자·형제 관계를 함께 조회 (형제는 등록 시 배치 API가 자동 생성)
    const [guardianRelations, siblingRelations]: [
      RelationResponse[],
      RelationResponse[]
    ] = await Promise.all([
      getClientRelations().request({
        centerId,
        clientId,
        relationCategory: 'guardian'
      }),
      getClientRelations().request({
        centerId,
        clientId,
        relationCategory: 'sibling'
      })
    ])

    const byCreatedAt = (a: RelationResponse, b: RelationResponse) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

    const guardianFiltered = guardianRelations
      .filter(
        (r) => r.relation_type === 'guardian' || r.relation_type === 'child'
      )
      .sort(byCreatedAt)
    // 형제 관계는 relation_type이 없어 category로만 판별
    const siblingFiltered = [...siblingRelations].sort(byCreatedAt)

    if (guardianFiltered.length === 0 && siblingFiltered.length === 0) return []

    // 이름은 관계 응답이 이미 싣고 온다 — 단건 상세(getClientDetail)를 부르면
    // 담당 범위 가드(access_level=own)에 걸려 보호자가 404가 되고, 그 거부가
    // 목록 전체를 무너뜨려 '가족관계' 행이 통째로 사라진다.
    const resolve = (rel: RelationResponse, relationLabel: string) => ({
      clientId: rel.related_client_id,
      name: rel.related_client_name || '',
      relationLabel
    })

    // 라벨 = 상대방의 '역할'. 아동 상세면 '보호자 김은서', 보호자 상세면 '아동 김은지'
    return [
      ...guardianFiltered.map((rel) =>
        resolve(rel, rel.relation_type === 'guardian' ? t('guardian') : t('child'))
      ),
      ...siblingFiltered.map((rel) => resolve(rel, t('sibling')))
    ]
  }

  async function openDocumentPreview(
    doc: ClientDocumentItem,
    fileCache: Record<string, File>
  ): Promise<{ document: ClientDocumentItem; file: File } | null> {
    let file = fileCache[doc.id]
    if (!file) {
      try {
        file = await fetchDocumentFile(doc)
      } catch {
        snackbarStore.error('파일 로드 실패')
        return null
      }
    }
    return { document: { ...doc, file }, file }
  }

  return {
    changeAvatar,
    fetchDocumentFile,
    fetchRelations,
    handleDownloadDocument,
    openRelationInfoModal,
    openChangeClientInfoModal,
    handleOnlineRequest,
    openUploadDocumentModal,
    openSingleUploadDocumentModal,
    handleDeleteDocument,
    openDocumentPreview
  }
}
