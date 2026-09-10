<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getSubscription,
    getPlans,
    getPaymentHistory
  } from '$lib/hooks/actions/subscription.action'
  import type {
    SubscriptionResponse,
    PlanInfo,
    PaymentSummary
  } from '$lib/hooks/actions/subscription.action'
  import { centerId } from '$lib/stores/center.store'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import {
    mapToSubscriptionVM,
    mapToPaymentVM
  } from '$lib/features/subscription/view-model'

  const subQuery = $derived(
    queryBuilder(
      getSubscription,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME,
        refetchInterval: SUBSCRIPTION_REFETCH_INTERVAL
      })
    )
  )
  const subData = $derived(
    subQuery.data as SubscriptionResponse | null | undefined
  )

  const plansQuery = $derived(
    queryBuilder(
      getPlans,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME
      })
    )
  )
  const plans = $derived(plansQuery.data as PlanInfo[] | null | undefined)
  const vm = $derived(subData ? mapToSubscriptionVM(subData, plans) : null)

  const paymentsQuery = $derived(
    queryBuilder(
      getPaymentHistory,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME
      })
    )
  )
  const payments = $derived(
    (paymentsQuery.data as PaymentSummary[] | null | undefined)?.map((p) =>
      mapToPaymentVM(p, plans)
    ) ?? []
  )

  const STATUS_BADGE: Record<string, string> = {
    'text-green-600': 'bg-green-50 text-green-700',
    'text-red-600': 'bg-status-danger-bg text-red-600',
    'text-amber-600': 'bg-amber-50 text-amber-700',
    'text-gray-500': 'bg-gray-100 text-gray-500'
  }
</script>

<div in:fade class="mx-auto flex flex-col pb-8">
  <PageTitleSection title="결제 내역" className="mb-4" />

  {#if subQuery.isLoading}
    <div class="flex items-center justify-center h-full py-16">
      <div class="text-body-02-normal-medium text-gray-500">로딩 중...</div>
    </div>
  {:else if vm}
    <div class="rounded-2xl border border-gray-200 overflow-hidden">
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white"
      >
        <h2 class="text-title-01-normal-semibold text-gray-800">결제 이력</h2>
        {#if payments.length > 0}
          <span class="text-body-03-normal-regular text-gray-400"
            >총 {payments.length}건</span
          >
        {/if}
      </div>

      {#if paymentsQuery.isLoading}
        <div class="flex items-center justify-center py-16">
          <div class="text-body-02-normal-medium text-gray-500">로딩 중...</div>
        </div>
      {:else if payments.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[360px]">
            <thead>
              <tr class="h-[52px] border-b border-gray-200 bg-gray-50/80">
                <th class="px-6 text-left font-normal">
                  <span class="text-body-02-normal-medium text-gray-600"
                    >날짜</span
                  >
                </th>
                <th class="px-6 text-left font-normal">
                  <span class="text-body-02-normal-medium text-gray-600"
                    >플랜</span
                  >
                </th>
                <th class="px-6 text-left font-normal">
                  <span class="text-body-02-normal-medium text-gray-600"
                    >금액</span
                  >
                </th>
                <th class="px-6 text-right font-normal">
                  <span class="text-body-02-normal-medium text-gray-600"
                    >상태</span
                  >
                </th>
              </tr>
            </thead>
            <tbody>
              {#each payments as p (p.id)}
                <tr
                  class="border-b border-gray-100 bg-white last:border-0 transition-colors hover:bg-gray-50"
                >
                  <td class="px-6 py-3">
                    <span
                      class="text-body-02-normal-regular tabular-nums text-gray-600"
                      >{p.date}</span
                    >
                  </td>
                  <td class="px-6 py-3">
                    <span class="text-body-02-normal-regular text-gray-600"
                      >{p.planLabel}</span
                    >
                  </td>
                  <td class="px-6 py-3">
                    <span
                      class="text-body-02-normal-medium tabular-nums text-gray-800"
                      >{p.amount}</span
                    >
                  </td>
                  <td class="px-6 py-3 text-right">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {STATUS_BADGE[
                        p.statusColor
                      ] ?? 'bg-gray-100 text-gray-500'}"
                    >
                      {p.statusLabel}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="flex-center h-full py-16">
          <NoDataSection description="결제 내역이 없어요" />
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-center py-16">
      <div class="text-body-02-normal-medium text-gray-500">
        결제 정보를 불러올 수 없습니다.
      </div>
    </div>
  {/if}
</div>
