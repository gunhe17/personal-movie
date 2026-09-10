/**
 * 청구서 서비스 (Billable Phase 2)
 * 모달/토스트/invalidate 로직 캡슐화
 */

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  postBillable,
  patchBillable,
  deleteBillable,
  postPayment,
  type BillableTarget,
  type CreateBillablePayload,
  type BillableItemCreatePayload,
  type CreatePaymentPayload
} from '$lib/hooks/actions/billable.action'
import { getPriceListsByReferences } from '$lib/hooks/actions/priceList.action'
import BillingParticipantSelectModal from '$lib/components/modal/BillingParticipantSelectModal.svelte'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import { extractErrorMessage } from '$lib/utils/errorHandler'
import { MODAL_SIZES } from './constants'

/**
 * 청구 모달에 넘기는 내담자 — 아바타(이미지·성별 톤)까지 그리려면
 * ClientSearchDropdown이 읽는 키(profile_image_url·gender)를 함께 넘긴다.
 */
export type BillingClient = {
  id: string
  name: string
  gender?: string | null
  profile_image_url?: string | null
}

export interface BillableDeps {
  queryClient: QueryClient
}

export function createBillableService(deps: BillableDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getBillableList'],
      exact: false
    })

  const invalidateDetail = () =>
    queryClient.invalidateQueries({
      queryKey: ['getBillableDetail'],
      exact: false
    })

  const invalidateByRelated = () =>
    queryClient.invalidateQueries({
      queryKey: ['getBillableByRelated'],
      exact: false
    })

  const invalidateMissing = () =>
    queryClient.invalidateQueries({
      queryKey: ['getTodayMissingBillables'],
      exact: false
    })

  // 청구는 상담/검사 세션의 청구상태를 바꾸므로 연결 도메인 캐시도 무효화
  // (상담현황·케이스상세·내담자상세가 stale 되는 것 방지)
  const invalidateRelatedDomains = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['getCounselingsByCenterId'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getCounselingDetailById'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getClientDetail'],
        exact: false
      })
    ])

  /**
   * 청구서 생성 공통 핸들러 (모든 생성 모달에서 재사용)
   */
  /** 평평한 응답과 ApiResponse 래퍼 둘 다에서 warnings 추출 (v3 비차단 경고용) */
  const extractWarnings = (result: unknown): string[] => {
    if (!result || typeof result !== 'object') return []
    const direct = (result as { warnings?: unknown }).warnings
    if (Array.isArray(direct))
      return direct.filter((w): w is string => typeof w === 'string')
    const nested = (result as { data?: { warnings?: unknown } }).data?.warnings
    if (Array.isArray(nested))
      return nested.filter((w): w is string => typeof w === 'string')
    return []
  }

  const createBillableHandler =
    (successMessage: string) => async (payload: CreateBillablePayload) => {
      try {
        const result = await postBillable().request({
          centerId: requireCenterId(),
          payload
        })
        snackbarStore.success(successMessage)
        // 백엔드가 비차단 경고(잔액 부족 등) 돌려주면 별도 토스트로 안내
        for (const msg of extractWarnings(result)) {
          snackbarStore.error(msg)
        }
        invalidateList()
        invalidateByRelated()
        invalidateMissing()
        invalidateRelatedDomains()
      } catch (error) {
        console.error('[postBillable] failed', error)
        snackbarStore.error(
          extractErrorMessage(error) || '청구서 생성에 실패했습니다'
        )
        throw error
      }
    }

  /**
   * 자유 생성 모달 (목록 페이지에서 사용)
   */
  const openCreateModal = (BillableCreateModal: any) => {
    modalStore.open({
      component: BillableCreateModal,
      props: {
        onConfirm: createBillableHandler('청구서가 생성되었습니다')
      },
      options: MODAL_SIZES.billableCreate
    })
  }

  /**
   * 세션 단건 청구 모달 (상담/검사 세션에서 prefill)
   */
  const openSessionBilling = (
    SessionBillingModal: any,
    params: {
      // 아바타(ClientField→ClientSearchDropdown)가 읽는 키까지 그대로 넘긴다 —
      // id·name만 주면 이미지 없이 이니셜로 떨어진다
      client: BillingClient
      items: any[]
      relatedType: string
      relatedCaseId: string
      /** 세션(일정) 없이 케이스 단위 청구인 경우 undefined 가능 */
      relatedSessionId?: string
    }
  ) => {
    modalStore.open({
      component: SessionBillingModal,
      props: {
        client: params.client,
        items: params.items,
        relatedType: params.relatedType,
        relatedCaseId: params.relatedCaseId,
        relatedSessionId: params.relatedSessionId,
        onConfirm: createBillableHandler('청구서가 생성되었습니다')
      },
      options: MODAL_SIZES.billableCreate
    })
  }

  /**
   * 미청구 대상(BillableTarget)에서 세션 청구 모달 열기 —
   * 단가표 매칭 + 항목 prefill. MissingSessionBanner·미청구 탭 공용.
   */
  const openTargetBilling = async (
    SessionBillingModal: any,
    target: BillableTarget
  ) => {
    if (!target.client_id) return

    const refIds = target.references.map((r) => r.reference_id)
    let priceMap = new Map<string, { unit_price: number; id: string | null }>()
    if (refIds.length > 0) {
      try {
        const matched = await getPriceListsByReferences().request({
          centerId: requireCenterId(),
          referenceIds: refIds
        })
        priceMap = new Map(
          matched
            .filter((p) => p.reference_id)
            .map((p) => [
              p.reference_id!,
              { unit_price: p.unit_price ?? 0, id: p.id ?? null }
            ])
        )
      } catch {
        // 단가 매칭 실패해도 빈 단가로 진행
      }
    }

    const baseItems =
      target.references.length > 0
        ? target.references.map((ref) => {
            const matched = priceMap.get(ref.reference_id)
            return {
              description: ref.label,
              unitPrice: matched?.unit_price ?? 0,
              priceListId: matched?.id ?? null,
              itemType: ref.item_type || 'service'
            }
          })
        : [
            {
              description: target.subtitle
                ? `${target.title} (${target.subtitle})`
                : target.title,
              itemType: 'service'
            }
          ]

    openSessionBilling(SessionBillingModal, {
      client: {
        id: target.client_id,
        name: target.client_name ?? '',
        gender: target.client_gender,
        profile_image_url: target.client_profile_image_url
      },
      items: baseItems,
      relatedType:
        target.type === 'counseling'
          ? 'counseling_session'
          : 'assessment_session',
      relatedCaseId: target.case_id,
      relatedSessionId: target.session_id ?? undefined
    })
  }

  /**
   * 케이스 청구 모달 (회기 선택 → 전량이면 패키지 선결제, 부분이면 회기별 청구)
   */
  const openCaseBilling = (
    CaseBillingModal: any,
    params: {
      client: BillingClient
      /** 케이스 전체 회기 (청구됨·취소 포함 — 모달이 선택 불가로 표시) */
      sessions: any[]
      /** 회기 1건에 적용할 단가/바우처 템플릿 */
      priceTemplate: any
      /** 예: 'counseling_case' — 부분 선택 시 모달이 '_session'으로 전환 */
      caseRelatedType: string
      relatedCaseId: string
    }
  ) => {
    modalStore.open({
      component: CaseBillingModal,
      props: {
        client: params.client,
        sessions: params.sessions,
        priceTemplate: params.priceTemplate,
        caseRelatedType: params.caseRelatedType,
        relatedCaseId: params.relatedCaseId,
        onConfirm: createBillableHandler('청구서가 생성되었습니다')
      },
      options: MODAL_SIZES.billableCreate
    })
  }

  const invalidatePayments = () =>
    queryClient.invalidateQueries({
      queryKey: ['getPaymentList'],
      exact: false
    })

  /**
   * 청구서 상세 모달 열기 (ID 기반, 내부에서 쿼리로 조회)
   */
  const openDetailModal = (
    BillableDetailModal: any,
    billableId: string,
    canWrite: boolean = true,
    client?: {
      name?: string
      birthDate?: string
      gender?: 'male' | 'female'
      profileImageUrl?: string | null
    },
    opts?: { autoOpenPayment?: boolean }
  ) => {
    modalStore.open({
      component: BillableDetailModal,
      props: {
        billableId,
        canWrite,
        autoOpenPayment: opts?.autoOpenPayment,
        clientName: client?.name,
        clientBirthDate: client?.birthDate,
        clientGender: client?.gender,
        clientProfileImageUrl: client?.profileImageUrl,
        onDelete: async () => {
          modalStore.open({
            component: DeleteConfirmModal,
            props: {
              targetId: billableId,
              title: '청구서를 삭제할까요?',
              description: '삭제된 청구서는 복구할 수 없습니다',
              cancelText: '닫기',
              confirmText: '삭제',
              onConfirm: async () => {
                try {
                  await deleteBillable().request({
                    centerId: requireCenterId(),
                    billableId
                  })
                  snackbarStore.success('청구서가 삭제되었습니다')
                  invalidateList()
                  invalidateByRelated()
                  invalidateMissing()
                  modalStore.closeAll()
                } catch (error) {
                  console.error('[deleteBillable] failed', error)
                  snackbarStore.error('청구서 삭제에 실패했습니다')
                }
              }
            },
            options: { customWidth: 420 }
          })
        },
        onUpdateNotes: async (newNotes: string) => {
          try {
            await patchBillable().request({
              centerId: requireCenterId(),
              billableId,
              payload: { notes: newNotes }
            })
            snackbarStore.success('메모가 저장되었습니다')
            invalidateList()
            invalidateDetail()
          } catch (error) {
            console.error('[patchBillable] failed', error)
            snackbarStore.error('메모 저장에 실패했습니다')
          }
        },
        onCreatePayment: async (payload: CreatePaymentPayload) => {
          try {
            await postPayment().request({
              centerId: requireCenterId(),
              billableId,
              payload
            })
            snackbarStore.success('납부 기록이 추가되었습니다')
            invalidateList()
            invalidateDetail()
            invalidatePayments()
            invalidateByRelated()
            // PaymentModal은 자체 closeModal로 닫힘 → 상세 모달은 유지되어 자동 갱신됨
          } catch (error) {
            console.error('[postPayment] failed', error)
            snackbarStore.error('납부 기록 추가에 실패했습니다')
            throw error
          }
        }
      },
      options: MODAL_SIZES.billableDetail
    })
  }

  /**
   * 그룹 청구 허브: 참여자 현황 모달
   * - 청구됨 참여자 → BillableDetailModal로 이동
   * - 미청구 참여자 선택 → 참여자별 Billable 생성
   */
  const openGroupCreateModal = (
    participants: {
      client_id: string
      client_name: string
      attendance_status: string
    }[],
    opts: {
      billedClientIds: string[]
      billableMap: Record<string, string>
      canWrite: boolean
      items: BillableItemCreatePayload[]
      relatedType?: string
      relatedCaseId?: string
      relatedSessionId?: string
      onClose?: () => void
      BillableDetailModal: any
    }
  ) => {
    let navigatingToDetail = false

    modalStore.open({
      component: BillingParticipantSelectModal,
      props: {
        participants,
        billedClientIds: opts.billedClientIds,
        onViewBilling: async (clientId: string) => {
          navigatingToDetail = true
          const billableId = opts.billableMap[clientId]
          if (!billableId) return
          await openDetailModal(
            opts.BillableDetailModal,
            billableId,
            opts.canWrite
          )
        },
        onConfirm: async (
          selected: { client_id: string; client_name: string }[]
        ) => {
          const centerId = requireCenterId()
          let successCount = 0
          const today = new Date()
          const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

          for (const p of selected) {
            try {
              await postBillable().request({
                centerId,
                payload: {
                  client_id: p.client_id,
                  billable_date: dateStr,
                  items: opts.items.map((item) => ({
                    ...item,
                    related_type: opts.relatedType,
                    related_case_id: opts.relatedCaseId,
                    related_session_id: opts.relatedSessionId
                  }))
                }
              })
              successCount++
            } catch {
              // 개별 실패는 건너뜀
            }
          }
          if (successCount > 0) {
            snackbarStore.success(`청구서 ${successCount}개가 생성되었습니다`)
            invalidateList()
            invalidateByRelated()
            invalidateMissing()
          }
          if (successCount < selected.length) {
            snackbarStore.error(
              `청구서 ${selected.length - successCount}개 생성에 실패했습니다`
            )
          }
        }
      },
      options: {
        customWidth: 420,
        onClose: () => {
          if (!navigatingToDetail) {
            opts.onClose?.()
          }
        }
      }
    })
  }

  return {
    invalidateList,
    invalidateDetail,
    invalidateByRelated,
    openCreateModal,
    openSessionBilling,
    openTargetBilling,
    openCaseBilling,
    openDetailModal,
    openGroupCreateModal
  }
}
