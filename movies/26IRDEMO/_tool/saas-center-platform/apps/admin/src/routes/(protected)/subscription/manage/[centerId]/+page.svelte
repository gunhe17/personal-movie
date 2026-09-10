<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import PlanBadge from '$lib/features/subscription/components/PlanBadge.svelte'
  import StatusBadge from '$lib/features/subscription/components/StatusBadge.svelte'
  import ArcGauge from '$lib/features/subscription/components/ArcGauge.svelte'
  import TimelineEntry from '$lib/features/subscription/components/TimelineEntry.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { modalStore } from '$stores/modal'
  import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
  import { formatDate } from '$lib/utils/format'
  import {
    getSubscriptionDetail,
    postChangePlan,
    postAdjustCredit,
    postTransitionStatus,
    postGrantTrial,
    deleteAdminScheduledDowngrade,
    postAdminForceApplyDowngrade,
    getAdminPaymentHistory,
    postCancelPayment,
    postApprovePlanChange,
    postRejectPlanChange,
    type AdminSubscriptionDetailResponse,
    type PaymentListResponse,
    type SubscriptionPaymentSummary,
  } from '$hooks/actions/subscription.action'
  import {
    getPlanConfigs,
    getPlatformSettings,
    type PlanConfigItem,
    type PlatformSettingsResponse,
  } from '$hooks/actions/platform-settings.action'
  import {
    getAiUsageByFeature,
    type FeatureUsageItem,
  } from '$hooks/actions/ai-usage.action'
  import {
    PLAN_LABELS,
    FEATURE_LABELS,
    CREDIT_USAGE_THRESHOLDS,
    STATUS_LABELS,
  } from '$lib/features/subscription/constants'
  import PlanChangeModal from '$components/modal/PlanChangeModal.svelte'
  import CreditAdjustModal from '$components/modal/CreditAdjustModal.svelte'
  import StatusTransitionModal from '$components/modal/StatusTransitionModal.svelte'
  import PaymentCancelModal from '$components/modal/PaymentCancelModal.svelte'
  import ConfirmModal from '$components/modal/ConfirmModal.svelte'
  import GrantTrialModal from '$components/modal/GrantTrialModal.svelte'
  import RejectReasonModal from '$components/modal/RejectReasonModal.svelte'
  import { fade, fly } from 'svelte/transition'

  let isProcessing = $state(false)

  // ─── Purpose 라벨 (AI 사용량 표시용) ───
  const PURPOSE_DISPLAY_LABELS: Record<string, string> = {
    skill_selection: 'AI 에이전트',
    skill_run: '스킬 실행',
    parameter_extraction: '파라미터 추출',
    checkpoint_classification: '체크포인트 분류',
    completion_verification: '완료 검증',
    embedding: '인텐트 매칭',
    field_note_stt_chunk: '음성 전사 (STT)',
    field_note_stt_diarize: '화자분리 전사',
    field_note_refine: '전사 보정',
    field_note_recommendation: 'AI 추천',
    field_note_summarize: 'AI 요약',
    field_note_generate_note: '상담일지 생성',
    case_analysis: '사례 분석',
  }

  const CHANGED_BY_LABELS: Record<string, string> = {
    user: '사용자',
    admin: '관리자',
    system: '시스템',
  }

  const REASON_LABELS: Record<string, string> = {
    initial_creation: '최초 구독 생성',
    trial_creation: '무료 이용 생성',
    trial_granted: '무료 이용 부여',
    upgrade: '업그레이드',
    downgrade_reserved: '다운그레이드 예약',
    downgrade_cancelled: '다운그레이드 예약 취소',
    plan_change: '플랜 변경',
    payment_upgrade: '결제 후 업그레이드',
    force_apply_downgrade: '즉시 다운그레이드 적용',
    scheduled_downgrade_applied: '예약 다운그레이드 적용',
    plan_change_requested: '플랜 변경 요청',
    plan_change_approved: '플랜 변경 승인',
    plan_change_rejected: '플랜 변경 거절',
  }

  const centerId = $derived(page.params.centerId as string)
  const queryClient = useQueryClient()

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder<any, any>(getSubscriptionDetail, () => ({ centerId }))
  )

  // 플랫폼 설정 (plans + settings)
  const planConfigsQuery = $derived(
    queryBuilder<any, any>(getPlanConfigs, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const planConfigs = $derived<PlanConfigItem[]>(planConfigsQuery.data?.items ?? [])
  const planLookup = $derived(new Map(planConfigs.map(p => [p.plan_type, p])))

  const platformSettingsQuery = $derived(
    queryBuilder<any, any>(getPlatformSettings, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const platformSettings = $derived<PlatformSettingsResponse | null>(platformSettingsQuery.data ?? null)

  const detail = $derived<AdminSubscriptionDetailResponse | null>(detailQuery.data ?? null)
  const sub = $derived(detail?.subscription)
  const credit = $derived(detail?.credit)
  const history = $derived(detail?.history ?? [])
  const isLoading = $derived(detailQuery.isPending)

  const creditPct = $derived(
    credit && credit.credit_limit > 0
      ? Math.min(100, Math.round((credit.credit_used / credit.credit_limit) * 100))
      : 0
  )

  // 크레딧 갱신까지 남은 일수
  const remainingDays = $derived.by(() => {
    if (!sub?.current_period_end) return null
    const end = new Date(sub.current_period_end)
    const now = new Date()
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  })

  // ─── AI 사용량 쿼리 (센터별) ───
  const aiUsageQuery = $derived(
    queryBuilder<any, any>(getAiUsageByFeature, () => ({ center_id: centerId }), () => ({ staleTime: 30_000 }))
  )
  const aiUsageItems = $derived<FeatureUsageItem[]>(aiUsageQuery.data?.items ?? [])

  // ─── 결제 이력 쿼리 ───
  let paymentPage = $state(1)
  const paymentQuery = $derived(
    queryBuilder<any, any>(getAdminPaymentHistory, () => ({
      centerId,
      page: paymentPage,
      size: 10,
    }))
  )
  const payments = $derived<PaymentListResponse | null>(paymentQuery.data ?? null)

  // ─── 변경 이력 접기/펼치기 ───
  const HISTORY_COLLAPSE_COUNT = 5
  let historyExpanded = $state(false)
  const visibleHistory = $derived(
    historyExpanded ? history : history.slice(0, HISTORY_COLLAPSE_COUNT)
  )
  const hasMoreHistory = $derived(history.length > HISTORY_COLLAPSE_COUNT)

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['getSubscriptionDetail'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getSubscriptionList'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getSubscriptionStats'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getAdminPaymentHistory'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getCenterSubscriptionTab'], exact: false })
  }

  /** ConfirmModal을 열고 확인 여부 반환 */
  async function openConfirm(opts: {
    title: string
    message: string
    confirmText?: string
    type?: 'info' | 'warning' | 'danger'
  }): Promise<boolean> {
    const result = await modalStore.openWithPromise(ConfirmModal, {
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText ?? '확인',
      type: opts.type ?? 'info',
    }, { size: 'sm' })
    return result === 'confirmed'
  }

  // ─── 플랜 변경 ───
  function openChangePlan() {
    if (!sub) return
    modalStore.open({
      component: PlanChangeModal,
      props: {
        currentPlan: sub.plan,
        plans: planConfigs,
        onConfirm: async (plan: string, reason: string) => {
          try {
            await postChangePlan().request({ centerId, plan, reason })
            showSuccessSnackbar('플랜이 변경되었습니다.')
            invalidateAll()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 크레딧 조정 ───
  function openAdjustCredit() {
    if (!credit) return
    modalStore.open({
      component: CreditAdjustModal,
      props: {
        currentUsed: credit.credit_used,
        currentLimit: credit.credit_limit,
        onConfirm: async (type: 'add' | 'reset', amount: number, reason: string) => {
          try {
            await postAdjustCredit().request({ centerId, adjust_type: type, amount, reason })
            showSuccessSnackbar(type === 'add' ? '크레딧이 추가되었습니다.' : '사용량이 초기화되었습니다.')
            invalidateAll()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 상태 변경 ───
  function openTransitionStatus() {
    if (!sub) return
    modalStore.open({
      component: StatusTransitionModal,
      props: {
        currentStatus: sub.status,
        onConfirm: async (status: string, reason: string, force: boolean) => {
          try {
            await postTransitionStatus().request({ centerId, status, reason, force })
            showSuccessSnackbar('상태가 변경되었습니다.')
            invalidateAll()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 다운그레이드 예약 관리 ───
  async function cancelScheduledDowngrade() {
    if (!sub?.reserved_plan) return
    const confirmed = await openConfirm({
      title: '다운그레이드 예약 취소',
      message: '예약된 다운그레이드를 취소하시겠습니까?\n현재 플랜이 유지됩니다.',
    })
    if (!confirmed) return
    isProcessing = true
    try {
      await deleteAdminScheduledDowngrade().request({ centerId })
      showSuccessSnackbar('다운그레이드 예약이 취소되었습니다.')
      invalidateAll()
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isProcessing = false
    }
  }

  async function forceApplyDowngrade() {
    if (!sub?.reserved_plan) return
    const planLabel = planLookup.get(sub.reserved_plan)?.label ?? PLAN_LABELS[sub.reserved_plan] ?? sub.reserved_plan
    const confirmed = await openConfirm({
      title: '즉시 다운그레이드',
      message: `${planLabel} 플랜으로 즉시 변경합니다.\n크레딧 한도가 조정되며, 이 작업은 되돌릴 수 없습니다.`,
      confirmText: '즉시 적용',
      type: 'danger',
    })
    if (!confirmed) return
    isProcessing = true
    try {
      await postAdminForceApplyDowngrade().request({ centerId })
      showSuccessSnackbar('다운그레이드가 즉시 적용되었습니다.')
      invalidateAll()
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isProcessing = false
    }
  }

  // ─── 결제 취소 ───
  function openCancelPayment(payment: SubscriptionPaymentSummary) {
    modalStore.open({
      component: PaymentCancelModal,
      props: {
        payment,
        onConfirm: async (reason: string) => {
          try {
            await postCancelPayment().request({
              centerId,
              payment_id: payment.id,
              reason,
            })
            showSuccessSnackbar('결제가 취소되었습니다.')
            invalidateAll()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 플랜 변경 요청 승인/거절 ───
  async function approvePlanChange() {
    if (!sub?.reserved_plan) return
    const planLabel = planLookup.get(sub.reserved_plan)?.label ?? PLAN_LABELS[sub.reserved_plan] ?? sub.reserved_plan
    const confirmed = await openConfirm({
      title: '플랜 변경 승인',
      message: `${planLabel} 플랜으로의 변경 요청을 승인합니다.\n크레딧이 새 플랜 기준으로 조정됩니다.`,
      confirmText: '승인',
    })
    if (!confirmed) return
    isProcessing = true
    try {
      await postApprovePlanChange().request({ centerId })
      showSuccessSnackbar('플랜 변경 요청이 승인되었습니다.')
      invalidateAll()
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isProcessing = false
    }
  }

  async function rejectPlanChange() {
    if (!sub) return
    modalStore.open({
      component: RejectReasonModal,
      props: {
        title: '플랜 변경 거절',
        placeholder: '거절 사유를 입력하세요',
        onConfirm: async (reason: string) => {
          isProcessing = true
          try {
            await postRejectPlanChange().request({ centerId, reason: reason || undefined })
            showSuccessSnackbar('플랜 변경 요청이 거절되었습니다.')
            invalidateAll()
          } catch (e: any) {
            showErrorSnackbar(e)
          } finally {
            isProcessing = false
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  // ─── 체험 부여 ───
  async function grantTrial() {
    if (!sub) return
    const trialPlanConfig = planConfigs.find(p => p.plan_type === (platformSettings?.trial_plan ?? 'pro'))
    const result = await modalStore.openWithPromise(GrantTrialModal, {
      trialPlanLabel: trialPlanConfig?.label ?? 'Pro',
      trialCreditLimit: trialPlanConfig?.credit_limit ?? 2500,
      defaultDurationDays: platformSettings?.trial_duration_days ?? 365,
    }, { size: 'sm' })
    if (result === null) return
    const durationDays = parseInt(result as string, 10)
    if (isNaN(durationDays) || durationDays < 1) return
    isProcessing = true
    try {
      await postGrantTrial().request({ centerId, reason: 'trial_granted', duration_days: durationDays })
      showSuccessSnackbar(`무료 이용이 부여되었습니다. (${durationDays}일)`)
      invalidateAll()
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isProcessing = false
    }
  }

  function getTimelineDotColor(item: { from_plan: string | null; to_plan: string; from_status?: string | null; to_status?: string | null }): string {
    if (item.from_status && item.to_status && item.from_plan === item.to_plan) {
      if (item.to_status === 'active') return 'bg-green-500'
      if (item.to_status === 'pending') return 'bg-primary-500'
      if (item.to_status === 'cancelled' || item.to_status === 'expired') return 'bg-red-500'
      if (item.to_status === 'payment_failed') return 'bg-red-400'
      return 'bg-amber-500'
    }
    if (!item.from_plan) return 'bg-blue-500'
    const fromTier = planLookup.get(item.from_plan)?.plan_order ?? 0
    const toTier = planLookup.get(item.to_plan)?.plan_order ?? 0
    if (toTier > fromTier) return 'bg-green-500'
    if (toTier < fromTier) return 'bg-amber-500'
    return 'bg-gray-400'
  }
</script>

<div in:fade class="p-6">
  <!-- 뒤로가기 -->
  <button
    type="button"
    onclick={() => goto('/subscription/list')}
    class="mb-4 flex items-center gap-1 text-body-03-normal-regular text-gray-500 hover:text-gray-700"
  >
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    목록으로
  </button>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
    </div>
  {:else if !sub}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">구독 정보를 찾을 수 없습니다</Typography>
    </div>
  {:else}
    <!-- 헤더 -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Typography variant="headline-01-bold" color="text-gray-900">{detail?.center_name ?? '센터'}</Typography>
        {#if sub.status === 'trial'}
          <StatusBadge status={sub.status} />
        {:else}
          <PlanBadge plan={sub.plan} planConfig={planConfigs.find(p => p.plan_type === sub.plan)} />
          {#if sub.status !== 'active'}
            <StatusBadge status={sub.status} quotaExceeded={sub.is_quota_exceeded} />
          {/if}
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if sub.status !== 'pending'}
          {#if sub.status !== 'trial'}
            <Button color="stroke-secondary" size="md" content="무료 부여" onclick={grantTrial} disabled={isProcessing} />
          {/if}
          <Button color="stroke-secondary" size="md" content="상태 변경" onclick={openTransitionStatus} disabled={isProcessing} />
          <Button color="primary" size="md" content="플랜 변경" onclick={openChangePlan} disabled={isProcessing} />
        {/if}
      </div>
    </div>

    <!-- 구독 정보 + 크레딧 게이지 -->
    <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
      <!-- 구독 기본 정보 (3/5) -->
      <div in:fly={{ y: 12, duration: 350 }} class="section-border p-6 md:col-span-3">
        <Typography variant="title-01-semibold" color="text-gray-800" className="mb-4">구독 정보</Typography>
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <dt class="text-body-03-normal-regular text-gray-500">플랜</dt>
          <dd class="text-body-03-normal-medium text-gray-800 text-right">{planLookup.get(sub.plan)?.label ?? PLAN_LABELS[sub.plan] ?? sub.plan}</dd>
          <dt class="text-body-03-normal-regular text-gray-500">상태</dt>
          <dd class="text-right"><StatusBadge status={sub.status} quotaExceeded={sub.is_quota_exceeded} /></dd>
          <dt class="text-body-03-normal-regular text-gray-500">크레딧 기간</dt>
          <dd class="text-body-03-normal-medium text-gray-800 text-right">
            {formatDate(sub.current_period_start)} ~ {formatDate(sub.current_period_end)}
          </dd>
          {#if remainingDays !== null && remainingDays > 0}
            <dt class="text-body-03-normal-regular text-gray-500">크레딧 갱신</dt>
            <dd class="text-body-03-normal-medium text-gray-600 text-right">
              {remainingDays}일 후
            </dd>
          {/if}
          {#if sub.status === 'trial' && sub.trial_end}
            <dt class="text-body-03-normal-regular text-gray-500">이용 종료일</dt>
            <dd class="text-body-03-normal-medium text-blue-600 text-right">
              {formatDate(sub.trial_end)}
            </dd>
          {/if}
          <dt class="text-body-03-normal-regular text-gray-500 pt-0.5">제공 기능</dt>
          <dd>
            {#if sub.limits.features.length > 0}
              <div class="flex flex-wrap gap-1.5">
                {#each sub.limits.features as feat}
                  <span class="rounded-md bg-primary-50 px-2 py-1 text-label-02-normal-medium text-primary-700">
                    {FEATURE_LABELS[feat] ?? feat}
                  </span>
                {/each}
              </div>
            {:else}
              <span class="text-body-03-normal-regular text-gray-400">기본 기능만 제공</span>
            {/if}
          </dd>
        </dl>
      </div>

      <!-- 크레딧 게이지 (2/5) -->
      <div in:fly={{ y: 12, duration: 350, delay: 80 }} class="section-border p-6 md:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <Typography variant="title-01-semibold" color="text-gray-800">크레딧</Typography>
          {#if credit}
            <Button color="stroke-secondary" size="sm" content="조정" onclick={openAdjustCredit} />
          {/if}
        </div>

        {#if credit}
          <div class="flex flex-col items-center">
            <ArcGauge value={creditPct} size={140} />
            <dl class="mt-2 w-full grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt class="text-body-03-normal-regular text-gray-500">사용량</dt>
              <dd class="text-body-03-normal-medium tabular-nums text-gray-800 text-right">
                {credit.credit_used.toLocaleString()} / {credit.credit_limit.toLocaleString()}
              </dd>
              <dt class="text-body-03-normal-regular text-gray-500">잔여</dt>
              <dd class="text-body-03-normal-medium tabular-nums text-gray-800 text-right">{credit.credit_remaining.toLocaleString()}</dd>
              <dt class="text-body-03-normal-regular text-gray-500">크레딧 기간</dt>
              <dd class="text-body-03-normal-medium text-gray-800 text-right">
                {formatDate(credit.period_start)} ~ {formatDate(credit.period_end)}
              </dd>
            </dl>
          </div>
        {:else}
          <div class="flex items-center justify-center py-8">
            <Typography variant="body-03-normal-regular" color="text-gray-400">이 플랜에는 크레딧이 제공되지 않습니다</Typography>
          </div>
        {/if}
      </div>
    </div>

    <!-- 플랜 변경 승인 대기 -->
    {#if sub.status === 'pending' && sub.reserved_plan}
      <div in:fly={{ y: 12, duration: 350, delay: 120 }} class="mb-4 rounded-xl border border-primary-200 bg-primary-50/50 p-5">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
              <svg class="h-4 w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div>
              <p class="text-body-03-normal-semibold text-primary-800">플랜 변경 승인 대기</p>
              <p class="mt-1 text-body-03-normal-regular text-primary-700">
                센터에서 <span class="font-semibold">{planLookup.get(sub.plan)?.label ?? PLAN_LABELS[sub.plan] ?? sub.plan}</span> →
                <span class="font-semibold">{planLookup.get(sub.reserved_plan)?.label ?? PLAN_LABELS[sub.reserved_plan] ?? sub.reserved_plan}</span> 플랜으로 변경을 요청했습니다.
              </p>
              {#if sub.reserved_at}
                <p class="mt-0.5 text-label-02-normal-regular text-primary-600">요청일: {formatDate(sub.reserved_at)}</p>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button color="stroke-secondary" size="sm" content="거절" onclick={rejectPlanChange} disabled={isProcessing} />
            <Button color="primary" size="sm" content="승인" onclick={approvePlanChange} disabled={isProcessing} />
          </div>
        </div>
      </div>
    {/if}

    <!-- 결제 실패 알림 — 결제 연동 전까지 숨김 -->
    <!-- {#if sub.status === 'payment_failed'} ... {/if} -->

    <!-- 다운그레이드 예약 정보 -->
    {#if sub.reserved_plan && sub.status !== 'pending'}
      <div in:fly={{ y: 12, duration: 350, delay: 120 }} class="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
              <svg class="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div>
              <p class="text-body-03-normal-semibold text-amber-800">다운그레이드 예약됨</p>
              <p class="mt-1 text-body-03-normal-regular text-amber-700">
                다음 크레딧 갱신 시 <span class="font-semibold">{planLookup.get(sub.reserved_plan)?.label ?? PLAN_LABELS[sub.reserved_plan] ?? sub.reserved_plan}</span> 플랜으로 변경됩니다.
              </p>
              {#if sub.reserved_at}
                <p class="mt-0.5 text-label-02-normal-regular text-amber-600">예약일: {formatDate(sub.reserved_at)}</p>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button color="stroke-secondary" size="sm" content="예약 취소" onclick={cancelScheduledDowngrade} disabled={isProcessing} />
            <Button color="stroke-delete" size="sm" content="즉시 적용" onclick={forceApplyDowngrade} disabled={isProcessing} />
          </div>
        </div>
      </div>
    {/if}

    <!-- AI 사용량 (센터별) -->
    <div in:fly={{ y: 12, duration: 350, delay: 160 }} class="mb-4 section-border p-6">
      <Typography variant="title-01-semibold" color="text-gray-800" className="mb-5">AI 사용량 (이번 달)</Typography>
      {#if aiUsageQuery.isPending}
        <div class="flex items-center justify-center py-8">
          <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
        </div>
      {:else if aiUsageItems.length === 0}
        <div class="flex items-center justify-center py-8">
          <Typography variant="body-03-normal-regular" color="text-gray-400">이번 달 AI 사용 내역이 없습니다</Typography>
        </div>
      {:else}
        {@const totalCalls = aiUsageItems.reduce((s, i) => s + i.call_count, 0)}
        {@const totalCredits = aiUsageItems.reduce((s, i) => s + (i.monthly_credits ?? 0), 0)}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/60">
                <th class="py-2.5 pl-4 text-left text-label-02-normal-medium text-gray-500">기능</th>
                <th class="py-2.5 text-right text-label-02-normal-medium text-gray-500">호출</th>
                <th class="py-2.5 pr-4 text-right text-label-02-normal-medium text-gray-500">크레딧</th>
              </tr>
            </thead>
            <tbody>
              {#each aiUsageItems as item}
                <tr class="border-b border-gray-50 last:border-0">
                  <td class="py-2.5 pl-4 text-body-03-normal-regular text-gray-700">
                    {PURPOSE_DISPLAY_LABELS[item.purpose] ?? item.feature ?? item.purpose}
                  </td>
                  <td class="py-2.5 text-right tabular-nums text-body-03-normal-regular text-gray-600">
                    {item.call_count.toLocaleString()}회
                  </td>
                  <td class="py-2.5 pr-4 text-right tabular-nums text-body-03-normal-medium text-gray-800">
                    {(item.monthly_credits ?? 0).toLocaleString()}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="border-t border-gray-200">
                <td class="py-2.5 pl-4 text-body-03-normal-medium text-gray-600">합계</td>
                <td class="py-2.5 text-right tabular-nums text-body-03-normal-semibold text-gray-600">
                  {totalCalls.toLocaleString()}회
                </td>
                <td class="py-2.5 pr-4 text-right tabular-nums text-body-03-normal-semibold text-gray-800">
                  {totalCredits.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      {/if}
    </div>

    <!-- 변경 이력 (타임라인) -->
    <div in:fly={{ y: 12, duration: 350, delay: 200 }} class="section-border p-6">
      <Typography variant="title-01-semibold" color="text-gray-800" className="mb-5">변경 이력</Typography>
      {#if history.length === 0}
        <div class="flex items-center justify-center py-8">
          <Typography variant="body-03-normal-regular" color="text-gray-400">변경 이력이 없습니다</Typography>
        </div>
      {:else}
        <div>
          {#each visibleHistory as item, i}
            <TimelineEntry
              dotColor={getTimelineDotColor(item)}
              isLast={!historyExpanded && i === visibleHistory.length - 1 && !hasMoreHistory}
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="text-body-03-normal-regular tabular-nums text-gray-400">{formatDate(item.changed_at, 'YYYY-MM-DD HH:mm')}</span>
                {#if item.from_status && item.to_status && item.from_plan === item.to_plan}
                  <div class="flex items-center gap-1.5">
                    <span class="text-body-03-normal-regular text-gray-400">{STATUS_LABELS[item.from_status] ?? item.from_status}</span>
                    <svg class="h-3.5 w-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    <span class="text-body-03-normal-medium text-gray-800">{STATUS_LABELS[item.to_status] ?? item.to_status}</span>
                  </div>
                {:else}
                  <div class="flex items-center gap-1.5">
                    <span class="text-body-03-normal-regular text-gray-400">{planLookup.get(item.from_plan ?? '')?.label ?? PLAN_LABELS[item.from_plan ?? ''] ?? item.from_plan ?? '-'}</span>
                    <svg class="h-3.5 w-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    <span class="text-body-03-normal-medium text-gray-800">{planLookup.get(item.to_plan)?.label ?? PLAN_LABELS[item.to_plan] ?? item.to_plan}</span>
                  </div>
                {/if}
                <span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-label-02-normal-regular text-gray-500">{CHANGED_BY_LABELS[item.actor_type] ?? item.actor_type}</span>
              </div>
              {#if item.reason}
                <p class="mt-1 text-label-02-normal-regular text-gray-500">{REASON_LABELS[item.reason] ?? item.reason}</p>
              {/if}
            </TimelineEntry>
          {/each}
        </div>
        {#if hasMoreHistory}
          <button
            type="button"
            class="mt-2 w-full rounded-lg border border-gray-200 py-2 text-body-03-normal-regular text-gray-500 hover:bg-gray-50 transition-colors"
            onclick={() => historyExpanded = !historyExpanded}
          >
            {#if historyExpanded}
              접기
            {:else}
              이전 {history.length - HISTORY_COLLAPSE_COUNT}건 더보기
            {/if}
          </button>
        {/if}
      {/if}
    </div>

    <!-- 결제 이력 -->
    <div class="mt-4 section-border p-6">
      <Typography variant="title-01-semibold" color="text-gray-800" className="mb-5">결제 이력</Typography>
      {#if !payments || payments.items.length === 0}
        <div class="flex flex-col items-center justify-center py-8">
          <p class="text-body-03-normal-regular text-gray-400">결제 이력이 없습니다</p>
          <p class="mt-1 text-label-02-normal-regular text-gray-300">첫 결제가 완료되면 여기에 표시됩니다</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/60">
                <th class="py-2.5 pl-4 text-left text-label-02-normal-medium text-gray-500">날짜</th>
                <th class="py-2.5 text-left text-label-02-normal-medium text-gray-500">플랜</th>
                <th class="py-2.5 text-right text-label-02-normal-medium text-gray-500">금액</th>
                <th class="py-2.5 text-center text-label-02-normal-medium text-gray-500">상태</th>
                <th class="py-2.5 text-left text-label-02-normal-medium text-gray-500">결제수단 / 실패사유</th>
                <th class="py-2.5 pr-4 text-right text-label-02-normal-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {#each payments.items as payment}
                {@const paymentStatusMap: Record<string, { label: string; dot: string; bg: string; text: string }> = {
                  pending: { label: '대기', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' },
                  confirmed: { label: '완료', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
                  failed: { label: '실패', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-600' },
                  cancelled: { label: '취소', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
                }}
                {@const statusStyle = paymentStatusMap[payment.status]}
                {@const isFailed = payment.status === 'failed'}
                <tr class="border-b border-gray-50 last:border-0 {isFailed ? 'bg-red-50/40' : ''}">
                  <td class="py-3 pl-4 tabular-nums text-body-03-normal-regular {isFailed ? 'text-red-700' : 'text-gray-700'}">
                    {formatDate(payment.paid_at ?? payment.created_at, 'YYYY-MM-DD HH:mm')}
                  </td>
                  <td class="py-3 text-body-03-normal-medium {isFailed ? 'text-red-800' : 'text-gray-800'}">
                    {planLookup.get(payment.plan)?.label ?? PLAN_LABELS[payment.plan] ?? payment.plan}
                  </td>
                  <td class="py-3 text-right tabular-nums text-body-03-normal-medium {isFailed ? 'text-red-800' : 'text-gray-800'}">
                    {payment.amount.toLocaleString()}원
                  </td>
                  <td class="py-3 text-center">
                    {#if statusStyle}
                      <span class="inline-flex items-center gap-1 rounded-full {statusStyle.bg} px-2 py-0.5 text-label-02-normal-medium {statusStyle.text}">
                        <span class="h-1.5 w-1.5 rounded-full {statusStyle.dot}"></span>
                        {statusStyle.label}
                      </span>
                    {:else}
                      <span class="text-label-02-normal-regular text-gray-500">{payment.status}</span>
                    {/if}
                  </td>
                  <td class="py-3 text-body-03-normal-regular text-gray-600">
                    {#if isFailed && payment.failed_reason}
                      <span class="text-label-02-normal-regular text-red-600">{payment.failed_reason}</span>
                    {:else}
                      {payment.method ?? '-'}
                    {/if}
                  </td>
                  <td class="py-3 pr-4 text-right">
                    {#if payment.status === 'confirmed'}
                      <button
                        class="text-label-02-normal-medium text-red-500 hover:text-red-600 transition-colors"
                        onclick={() => openCancelPayment(payment)}
                      >
                        환불
                      </button>
                    {/if}
                  </td>
                </tr>
                {#if isFailed && payment.failed_reason}
                  <tr class="bg-red-50/30">
                    <td colspan="6" class="px-4 py-2">
                      <div class="flex items-center gap-2 text-label-02-normal-regular text-red-600">
                        <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span class="text-label-02-normal-medium">실패 사유:</span> {payment.failed_reason}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
        {#if payments.total > 10}
          <div class="mt-3 flex items-center justify-center gap-2">
            <button
              class="rounded-md px-3 py-1.5 text-label-02-normal-medium transition-colors
                {paymentPage > 1 ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}"
              disabled={paymentPage <= 1}
              onclick={() => paymentPage--}
            >
              이전
            </button>
            <span class="text-label-02-normal-regular tabular-nums text-gray-500">{paymentPage} / {Math.ceil(payments.total / 10)}</span>
            <button
              class="rounded-md px-3 py-1.5 text-label-02-normal-medium transition-colors
                {paymentPage < Math.ceil(payments.total / 10) ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}"
              disabled={paymentPage >= Math.ceil(payments.total / 10)}
              onclick={() => paymentPage++}
            >
              다음
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
