/**
 * Subscription Service — 결제/플랜 변경 비즈니스 로직 캡슐화
 *
 * - 업그레이드: 토스 결제 위젯 → 결제 확인 → 플랜 즉시 적용
 * - 다운그레이드: 예약 → 현재 기간 만료 시 자동 전환
 */

import { snackbarStore } from '$lib/stores/snackbar'
import { modalUtils } from '$lib/stores/modal'
import { requireCenterId } from '$lib/stores/center.store'
import {
  initiateUpgrade,
  confirmUpgrade,
  reserveDowngrade,
  cancelDowngrade,
  requestPlanChange
} from '$lib/hooks/actions/subscription.action'
import type { PlanCardVM } from './view-model'
import { PLAN_LABELS } from './constants'
import type { QueryClient } from '@tanstack/svelte-query'

export interface SubscriptionServiceDeps {
  queryClient: QueryClient
}

export function createSubscriptionService(deps: SubscriptionServiceDeps) {
  const { queryClient } = deps

  const invalidateSubscription = () => {
    queryClient.invalidateQueries({
      queryKey: ['getSubscription'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getPaymentHistory'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getCreditBalance'],
      exact: false
    })
  }

  /**
   * 업그레이드 처리: 확인 모달 → initiate → 토스 결제 위젯 → redirect
   */
  async function handleUpgrade(card: PlanCardVM) {
    const confirmed = await modalUtils.confirm(
      `${card.label} 플랜으로 업그레이드합니다.\n월 ${card.priceLabel} 결제가 진행됩니다.`,
      '플랜 업그레이드',
      { confirmText: '결제', type: 'info' }
    )
    if (!confirmed) return

    try {
      const centerId = requireCenterId()
      const result = await initiateUpgrade().request({
        centerId,
        plan: card.plan
      })

      if (!result) {
        snackbarStore.error('결제 정보 생성에 실패했습니다.')
        return
      }

      // 토스 결제 위젯으로 리다이렉트
      const { loadTossPayments } = await import('./toss')
      const toss = await loadTossPayments(centerId)
      if (!toss) {
        snackbarStore.error('결제 모듈을 불러올 수 없습니다.')
        return
      }

      await toss.requestPayment('카드', {
        amount: result.amount,
        orderId: result.order_id,
        orderName: `${result.plan_label} 플랜 구독`,
        successUrl: `${window.location.origin}/subscription/success`,
        failUrl: `${window.location.origin}/subscription/fail`
      })
    } catch (err: any) {
      if (err?.code === 'USER_CANCEL') return
      snackbarStore.error(err?.message ?? '결제 처리 중 오류가 발생했습니다.')
    }
  }

  /**
   * 결제 확인 (success 페이지에서 호출)
   */
  async function handleConfirmUpgrade(
    paymentKey: string,
    orderId: string,
    amount: number
  ) {
    try {
      const centerId = requireCenterId()
      await confirmUpgrade().request({
        centerId,
        paymentKey,
        orderId,
        amount
      })
      invalidateSubscription()
      snackbarStore.success('플랜이 업그레이드되었습니다!')
      return true
    } catch (err: any) {
      snackbarStore.error(err?.message ?? '결제 확인 중 오류가 발생했습니다.')
      return false
    }
  }

  /**
   * 다운그레이드 예약: 경고 모달 → reserve API
   */
  async function handleDowngrade(card: PlanCardVM) {
    const confirmed = await modalUtils.confirm(
      `${card.label} 플랜으로 변경을 예약합니다.\n현재 구독 기간이 만료된 후 자동으로 변경됩니다.\n일부 AI 기능이 제한될 수 있습니다.`,
      '다운그레이드 예약',
      { confirmText: '예약', type: 'warning' }
    )
    if (!confirmed) return

    try {
      const centerId = requireCenterId()
      await reserveDowngrade().request({
        centerId,
        plan: card.plan
      })
      invalidateSubscription()
      snackbarStore.success(
        `구독 기간 만료 후 ${card.label} 플랜으로 변경됩니다.`
      )
    } catch (err: any) {
      snackbarStore.error(err?.message ?? '다운그레이드 예약에 실패했습니다.')
    }
  }

  /**
   * 다운그레이드 예약 취소
   */
  async function handleCancelDowngrade() {
    const confirmed = await modalUtils.confirm(
      '다운그레이드 예약을 취소하시겠습니까?\n현재 플랜이 유지됩니다.',
      '예약 취소',
      { confirmText: '예약 취소', type: 'info' }
    )
    if (!confirmed) return

    try {
      const centerId = requireCenterId()
      await cancelDowngrade().request({ centerId })
      invalidateSubscription()
      snackbarStore.success('다운그레이드 예약이 취소되었습니다.')
    } catch (err: any) {
      snackbarStore.error(err?.message ?? '예약 취소에 실패했습니다.')
    }
  }

  /**
   * 구독 해지: 현재 기간 만료 후 Free 전환 (= reserveDowngrade to free)
   */
  async function handleCancelSubscription(periodEnd: string) {
    const endDate = new Date(periodEnd)
    const endLabel = `${endDate.getFullYear()}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${String(endDate.getDate()).padStart(2, '0')}`

    const confirmed = await modalUtils.confirm(
      `구독을 해지하시겠습니까?\n\n현재 결제 기간(${endLabel})까지는 모든 기능을 그대로 사용할 수 있습니다.\n이후 ${PLAN_LABELS['free'] ?? 'Free'} 플랜으로 전환되며 AI 기능이 제한됩니다.`,
      '구독 해지',
      { confirmText: '해지', type: 'warning' }
    )
    if (!confirmed) return

    try {
      const centerId = requireCenterId()
      await reserveDowngrade().request({
        centerId,
        plan: 'free'
      })
      invalidateSubscription()
      snackbarStore.success(
        `구독 기간 만료(${endLabel}) 후 ${PLAN_LABELS['free'] ?? 'Free'} 플랜으로 전환됩니다.`
      )
    } catch (err: any) {
      snackbarStore.error(err?.message ?? '구독 해지에 실패했습니다.')
    }
  }

  /**
   * 플랜 변경 요청 (관리자 승인 대기)
   */
  async function handleRequestPlanChange(card: PlanCardVM) {
    const confirmed = await modalUtils.confirm(
      `${card.label} 플랜으로 변경을 요청합니다.\n관리자 승인 후 플랜이 변경됩니다.`,
      '플랜 변경 요청',
      { confirmText: '요청', type: 'info' }
    )
    if (!confirmed) return

    try {
      const centerId = requireCenterId()
      await requestPlanChange().request({
        centerId,
        plan: card.plan
      })
      invalidateSubscription()
      snackbarStore.success(
        `${card.label} 플랜으로의 변경이 요청되었습니다. 관리자 승인을 기다려주세요.`
      )
    } catch (err: any) {
      snackbarStore.error(err?.message ?? '플랜 변경 요청에 실패했습니다.')
    }
  }

  return {
    handleUpgrade,
    handleConfirmUpgrade,
    handleDowngrade,
    handleCancelDowngrade,
    handleCancelSubscription,
    handleRequestPlanChange,
    invalidateSubscription
  }
}
