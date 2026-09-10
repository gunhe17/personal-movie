/**
 * Credentials Service
 *
 * 모달 열기 + API 호출 + invalidate + 토스트를 캡슐화.
 * 페이지 컴포넌트는 이 서비스의 함수만 호출한다.
 */

import type { QueryClient } from '@tanstack/svelte-query'
import type { Component } from 'svelte'

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'

import {
  createMyCredential,
  deleteAttachment,
  deleteMyCredential,
  requestVerification,
  updateMyCredential,
  uploadAttachment,
  type Credential,
  type CredentialType
} from '$lib/hooks/actions/credential.action'

import {
  ATTACHMENT_ALLOWED_TYPES,
  ATTACHMENT_MAX_SIZE,
  CREDENTIAL_MODAL_SIZES
} from './constants'
import {
  toCareerCreatePayload,
  toCareerForm,
  toCareerUpdatePayload,
  toCertificationCreatePayload,
  toCertificationForm,
  toCertificationUpdatePayload,
  toEducationCreatePayload,
  toEducationForm,
  toEducationUpdatePayload,
  type CareerFormData,
  type CertificationFormData,
  type EducationFormData
} from './query-builders'

import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'

export interface CredentialsDeps {
  queryClient: QueryClient

  /**
   * 항목별 모달 컴포넌트.
   * 페이지에서 라우트 폴더의 components/ 경로로 import 후 주입한다.
   *
   * 각 모달의 인터페이스:
   *   onConfirm: (form: KindFormData) => Promise<void>
   *   initialData?: KindFormData (수정 모달용)
   *   isEditMode: boolean
   */
  modals: {
    education: Component<any>
    career: Component<any>
    certification: Component<any>
  }
}

export function createCredentialsService(deps: CredentialsDeps) {
  const { queryClient, modals } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['listMyCredentials'],
      exact: false
    })

  // ─── 등록 (모든 kind가 첨부 받음) ────────────────────────

  function openCreate(credential_type: CredentialType): void {
    const onConfirm = async (
      form: unknown,
      file: File | null,
      _removeAttachment: boolean
    ) => {
      const payload =
        credential_type === 'education'
          ? toEducationCreatePayload(form as EducationFormData)
          : credential_type === 'career'
            ? toCareerCreatePayload(form as CareerFormData)
            : toCertificationCreatePayload(form as CertificationFormData)

      const created = await createMyCredential().request(payload)
      if (file) {
        await uploadAttachment().request({
          credentialId: created.id,
          file
        })
      }
      snackbarStore.success(`${KIND_KOREAN[credential_type]}이 추가되었어요`)
      invalidateList()
    }

    modalStore.open({
      component: modals[credential_type],
      props: {
        isEditMode: false,
        onConfirm
      },
      options: CREDENTIAL_MODAL_SIZES[credential_type]
    })
  }

  // ─── 수정 (모든 kind가 첨부 처리) ────────────────────────

  function openEdit(credential: Credential): void {
    const credential_type = credential.credential_type

    const onConfirm = async (
      form: unknown,
      file: File | null,
      removeAttachment: boolean
    ) => {
      const updatePayload =
        credential_type === 'education'
          ? toEducationUpdatePayload(form as EducationFormData)
          : credential_type === 'career'
            ? toCareerUpdatePayload(form as CareerFormData)
            : toCertificationUpdatePayload(form as CertificationFormData)

      await updateMyCredential().request({
        credentialId: credential.id,
        payload: updatePayload
      })
      if (removeAttachment && credential.attachment) {
        await deleteAttachment().request({ credentialId: credential.id })
      }
      if (file) {
        await uploadAttachment().request({
          credentialId: credential.id,
          file
        })
      }
      snackbarStore.success(
        `${KIND_KOREAN[credential_type]}이 수정되었어요. 검증이 다시 필요해요.`
      )
      invalidateList()
    }

    const initialData =
      credential_type === 'education'
        ? toEducationForm(credential)
        : credential_type === 'career'
          ? toCareerForm(credential)
          : toCertificationForm(credential)

    modalStore.open({
      component: modals[credential_type],
      props: {
        isEditMode: true,
        initialData,
        existingAttachment: credential.attachment,
        onConfirm
      },
      options: CREDENTIAL_MODAL_SIZES[credential_type]
    })
  }

  const KIND_KOREAN: Record<CredentialType, string> = {
    education: '학력',
    career: '경력',
    certification: '자격증'
  }

  // ─── 삭제 ────────────────────────────────────────────────

  function openDelete(credential: Credential): void {
    const kindLabel = KIND_KOREAN[credential.credential_type]

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: credential.id,
        title: `${kindLabel} 항목을 삭제할까요?`,
        description: `'${credential.title}' 항목이 삭제돼요. 되돌릴 수 없어요.`,
        confirmText: '삭제',
        onConfirm: async () => {
          await deleteMyCredential().request({ credentialId: credential.id })
          snackbarStore.success(`${kindLabel}이 삭제되었어요`)
          invalidateList()
        }
      },
      options: { customWidth: 420 }
    })
  }

  // ─── 검증 요청 ─────────────────────────────────────────────

  async function executeRequestVerification(
    credential: Credential
  ): Promise<void> {
    try {
      await requestVerification().request({ credentialId: credential.id })
      snackbarStore.success(
        '검증 요청을 보냈어요. 결과는 알림으로 알려드릴게요.'
      )
      invalidateList()
    } catch (err) {
      console.error('[requestVerification] failed', err)
      snackbarStore.error('검증 요청에 실패했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  // ─── 첨부 파일 검증 (모달 내부에서 사용) ─────────────────────

  function validateAttachmentFile(file: File): string | null {
    if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
      return 'PDF, JPG, PNG 파일만 업로드할 수 있어요.'
    }
    if (file.size > ATTACHMENT_MAX_SIZE) {
      return '파일 크기는 10MB 이하여야 해요.'
    }
    return null
  }

  // ─── 첨부 파일 다운로드 ──────────────────────────────────
  // 백엔드 프록시 엔드포인트로 받아서 Blob → object URL → 강제 다운로드.
  // S3 직접 접근을 피해 CORS 이슈를 회피.

  async function downloadAttachment(
    credentialId: string,
    filename: string
  ): Promise<void> {
    try {
      const res = await fetch(
        `/api/proxy/persons/me/credentials/${credentialId}/attachment/download`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(`download failed: ${res.status}`)
      const blob = await res.blob()

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      console.error('[downloadAttachment] failed', err)
      snackbarStore.error('파일을 받을 수 없어요. 잠시 후 다시 시도해주세요.')
    }
  }

  return {
    openCreate,
    openEdit,
    openDelete,
    executeRequestVerification,
    validateAttachmentFile,
    downloadAttachment,
    invalidateList
  }
}

export type CredentialsService = ReturnType<typeof createCredentialsService>
