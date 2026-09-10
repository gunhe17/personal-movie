<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import PlanBadge from '$lib/features/subscription/components/PlanBadge.svelte'
  import StatusBadge from '$lib/features/subscription/components/StatusBadge.svelte'
  import ArcGauge from '$lib/features/subscription/components/ArcGauge.svelte'
  import TimelineEntry from '$lib/features/subscription/components/TimelineEntry.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { modalStore } from '$lib/stores/modal'
  import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
  import { formatDate } from '$lib/utils/format'
  import {
    getCenterSubscriptionTab,
    type CenterSubscriptionTabResponse,
  } from '$hooks/actions/center.action'
  import {
    postChangePlan,
    postAdjustCredit,
  } from '$hooks/actions/subscription.action'
  import {
    getPlanConfigs,
    type PlanConfigItem,
  } from '$hooks/actions/platform-settings.action'
  import {
    PLAN_LABELS,
    FEATURE_LABELS,
    CREDIT_USAGE_THRESHOLDS,
    STATUS_LABELS,
  } from '$lib/features/subscription/constants'
  import PlanChangeModal from '$components/modal/PlanChangeModal.svelte'
  import CreditAdjustModal from '$components/modal/CreditAdjustModal.svelte'
  import { fly } from 'svelte/transition'

  // ─── Props ───
  interface Props {
    centerId: string
  }
  let { centerId }: Props = $props()

  const queryClient = useQueryClient()

  // ─── 쿼리 ───
  const tabQuery = $derived(
    queryBuilder<any, any>(getCenterSubscriptionTab, () => ({ centerId }))
  )

  const planConfigsQuery = $derived(
    queryBuilder<any, any>(getPlanConfigs, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const planConfigs = $derived<PlanConfigItem[]>(planConfigsQuery.data?.items ?? [])
  const planLookup = $derived(new Map(planConfigs.map(p => [p.plan_type, p])))

  const data = $derived<CenterSubscriptionTabResponse | null>(tabQuery.data ?? null)
  const sub = $derived(data?.subscription)
  const credit = $derived(data?.credit)
  const history = $derived(data?.history ?? [])
  const aiUsage = $derived(data?.ai_usage)
  const isLoading = $derived(tabQuery.isPending)

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

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['getCenterSubscriptionTab'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getSubscriptionList'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getSubscriptionStats'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getSubscriptionDetail'], exact: false })
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

  function getTimelineDotColor(item: { from_plan: string | null; to_plan: string; from_status?: string | null; to_status?: string | null }): string {
    if (item.from_status && item.to_status && item.from_plan === item.to_plan) {
      if (item.to_status === 'active') return 'bg-green-500'
      if (item.to_status === 'pending') return 'bg-indigo-500'
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

{#if isLoading}
  <div class="section-border flex items-center justify-center py-16">
    <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
  </div>
{:else if !sub}
  <div class="section-border flex items-center justify-center py-16">
    <Typography variant="body-03-normal-regular" color="text-gray-400">구독 정보를 찾을 수 없습니다</Typography>
  </div>
{:else}
  <!-- 구독 정보 + 크레딧 게이지 -->
  <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
    <!-- 구독 기본 정보 (3/5) -->
    <div class="section-border p-6 md:col-span-3">
      <div class="flex items-center justify-between mb-4">
        <Typography variant="title-01-normal-semibold" color="text-gray-800">구독 정보</Typography>
        {#if sub.status === 'pending'}
          <span class="text-label-01-normal-medium text-primary-600">승인 대기 중</span>
        {:else}
          <Button color="primary" size="sm" content="플랜 변경" onclick={openChangePlan} />
        {/if}
      </div>
      <dl class="space-y-3">
        <div class="flex justify-between">
          <dt class="text-body-03-normal-regular text-gray-500">플랜</dt>
          <dd class="flex items-center gap-2">
            <PlanBadge plan={sub.plan} planConfig={planConfigs.find(p => p.plan_type === sub.plan)} />
            {#if sub.status === 'trial'}
              <span class="text-label-01-normal-regular text-gray-400">무료 이용 중</span>
            {/if}
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-body-03-normal-regular text-gray-500">상태</dt>
          <dd><StatusBadge status={sub.status} /></dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-body-03-normal-regular text-gray-500">크레딧 기간</dt>
          <dd class="text-body-03-normal-medium text-gray-800">
            {formatDate(sub.current_period_start)} ~ {formatDate(sub.current_period_end)}
          </dd>
        </div>
        {#if remainingDays !== null && remainingDays > 0}
          <div class="flex justify-between">
            <dt class="text-body-03-normal-regular text-gray-500">크레딧 갱신</dt>
            <dd class="text-body-03-normal-medium text-gray-600">
              {remainingDays}일 후
            </dd>
          </div>
        {/if}
        {#if sub.status === 'trial' && sub.trial_end}
          <div class="flex justify-between">
            <dt class="text-body-03-normal-regular text-gray-500">이용 종료일</dt>
            <dd class="text-body-03-normal-medium text-blue-600">
              {formatDate(sub.trial_end)}
            </dd>
          </div>
        {/if}
        <div class="flex justify-between items-start">
          <dt class="text-body-03-normal-regular text-gray-500 pt-0.5">제공 기능</dt>
          <dd>
            {#if sub.limits.features.length > 0}
              <div class="flex flex-wrap justify-end gap-1.5">
                {#each sub.limits.features as feat}
                  <span class="rounded-md bg-primary-50 px-2 py-1 text-label-01-normal-medium text-primary-700">
                    {FEATURE_LABELS[feat] ?? feat}
                  </span>
                {/each}
              </div>
            {:else}
              <span class="text-body-03-normal-regular text-gray-400">기본 기능만 제공</span>
            {/if}
          </dd>
        </div>
      </dl>
    </div>

    <!-- 크레딧 게이지 (2/5) -->
    <div class="section-border p-6 md:col-span-2">
      <div class="flex items-center justify-between mb-4">
        <Typography variant="title-01-normal-semibold" color="text-gray-800">크레딧</Typography>
        {#if credit}
          <Button color="stroke-secondary" size="sm" content="조정" onclick={openAdjustCredit} />
        {/if}
      </div>

      {#if credit}
        <div class="flex flex-col items-center">
          <ArcGauge value={creditPct} size={140} />
          <div class="mt-2 w-full space-y-2">
            <div class="flex justify-between">
              <span class="text-body-03-normal-regular text-gray-500">사용량</span>
              <span class="text-body-03-normal-medium tabular-nums text-gray-800">
                {credit.credit_used.toLocaleString()} / {credit.credit_limit.toLocaleString()}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-body-03-normal-regular text-gray-500">잔여</span>
              <span class="text-body-03-normal-medium tabular-nums text-gray-800">{credit.credit_remaining.toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-body-03-normal-regular text-gray-500">크레딧 기간</span>
              <span class="text-body-03-normal-medium text-gray-800">
                {formatDate(credit.period_start)} ~ {formatDate(credit.period_end)}
              </span>
            </div>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-center py-8">
          <Typography variant="body-03-normal-regular" color="text-gray-400">Free 플랜에는 크레딧이 제공되지 않습니다</Typography>
        </div>
      {/if}
    </div>
  </div>

  <!-- AI 기능별 사용량 -->
  {#if aiUsage && aiUsage.by_purpose.length > 0}
    <div class="section-border p-6 mb-4">
      <Typography variant="title-01-normal-semibold" color="text-gray-800" className="mb-4">AI 기능별 사용량</Typography>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {#each aiUsage.by_purpose as item, i}
          <div in:fly={{ y: 8, duration: 250, delay: i * 60 }} class="rounded-lg bg-gray-50 p-4">
            <p class="text-label-01-normal-medium text-gray-500 mb-2">{item.label}</p>
            <p class="text-headline-02-normal-bold tabular-nums text-gray-800">{item.calls.toLocaleString()}<span class="text-body-03-normal-regular text-gray-400">회</span></p>
            <p class="mt-0.5 text-body-03-normal-regular tabular-nums text-gray-500">{item.total_credits.toLocaleString()} 크레딧</p>
          </div>
        {/each}
      </div>
      <div class="mt-3 flex justify-between border-t border-gray-100 pt-3">
        <span class="text-body-03-normal-medium text-gray-800">합계</span>
        <span class="tabular-nums">
          <span class="text-body-03-normal-semibold text-gray-800">{aiUsage.total_calls.toLocaleString()}회</span>
          <span class="mx-1 text-gray-300">·</span>
          <span class="text-body-03-normal-regular text-gray-600">{aiUsage.total_credits.toLocaleString()} 크레딧</span>
        </span>
      </div>
    </div>
  {/if}

  <!-- 변경 이력 (타임라인) -->
  <div class="section-border p-6">
    <Typography variant="title-01-normal-semibold" color="text-gray-800" className="mb-5">플랜 변경 이력</Typography>
    {#if history.length === 0}
      <div class="flex items-center justify-center py-8">
        <Typography variant="body-03-normal-regular" color="text-gray-400">변경 이력이 없습니다</Typography>
      </div>
    {:else}
      <div>
        {#each history as item, i}
          <div in:fly={{ x: -8, duration: 300, delay: i * 80 }}>
            <TimelineEntry
              dotColor={getTimelineDotColor(item)}
              isLast={i === history.length - 1}
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="text-body-03-normal-regular tabular-nums text-gray-400">{formatDate(item.changed_at)}</span>
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
                <span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-regular text-gray-500">{CHANGED_BY_LABELS[item.actor_type] ?? item.actor_type}</span>
              </div>
              {#if item.reason}
                <p class="mt-1 text-label-01-normal-regular text-gray-500">{REASON_LABELS[item.reason] ?? item.reason}</p>
              {/if}
            </TimelineEntry>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
