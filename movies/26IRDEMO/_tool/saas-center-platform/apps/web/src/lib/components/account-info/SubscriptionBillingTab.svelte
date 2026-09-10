<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import {
    getPaymentHistory,
    getPlans,
    type PaymentSummary,
    type PlanInfo
  } from '$lib/hooks/actions/subscription.action'
  import { mapToPaymentVM } from '$lib/features/subscription/view-model'
  import { SUBSCRIPTION_STALE_TIME } from '$lib/features/subscription/constants'
  import type { MeCenterSummary } from '$lib/hooks/actions/auth.action'

  interface Props {
    centers: MeCenterSummary[]
  }

  let { centers }: Props = $props()

  // 현재 선택된 센터 (결제 내역 조회 대상)
  // NOTE: 지금은 현재 센터 1곳만 조회. 소속 센터 전체(크로스센터) 집계는 후속 과제.
  const currentCenter = $derived(
    centers.find((c) => c.id === $centerId) ?? null
  )

  // ── 쿼리 ──
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
    (paymentsQuery.data as PaymentSummary[] | undefined) ?? []
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

  // 최신순 정렬 + VM 변환
  const rows = $derived(
    [...payments]
      .sort((a, b) => {
        const da = new Date(a.paid_at ?? a.created_at).getTime()
        const db = new Date(b.paid_at ?? b.created_at).getTime()
        return db - da
      })
      .map((p) => mapToPaymentVM(p, plans))
  )

  // 결제 내역 테이블 — 공용 Table(헤더 52 · 셀 인셋 24) 규격을 그대로 쓴다
  const columns: TableColumn<(typeof rows)[number]>[] = [
    { key: 'date', label: '결제일', width: '140px', render: dateCell },
    { key: 'planLabel', label: '플랜', render: planCell },
    {
      key: 'amount',
      label: '금액',
      width: '140px',
      align: 'right',
      render: amountCell
    },
    { key: 'method', label: '결제 수단', width: '160px', render: methodCell },
    {
      key: 'statusLabel',
      label: '상태',
      width: '100px',
      align: 'right',
      render: statusCell
    }
  ]
</script>

{#snippet dateCell({ item }: { item: any })}
  <Typography variant="body-01-normal-regular" color="text-gray-900" tag="span">
    {item.date}
  </Typography>
{/snippet}

{#snippet planCell({ item }: { item: any })}
  <Typography variant="body-01-normal-regular" color="text-gray-900" tag="span">
    {item.planLabel}
  </Typography>
{/snippet}

{#snippet amountCell({ item }: { item: any })}
  <Typography variant="body-01-normal-medium" color="text-gray-900" tag="span">
    {item.amount}
  </Typography>
{/snippet}

{#snippet methodCell({ item }: { item: any })}
  <Typography variant="body-02-normal-regular" color="text-gray-500" tag="span">
    {item.method}
  </Typography>
{/snippet}

{#snippet statusCell({ item }: { item: any })}
  <span class="text-body-02-normal-medium {item.statusColor}">
    {item.statusLabel}
  </span>
{/snippet}

<div>
  {#if paymentsQuery.isLoading}
    <div class="flex-center p-12">
      <p class="text-body-02-normal-regular text-gray-500">로딩 중...</p>
    </div>
  {:else if paymentsQuery.isError}
    <div class="flex-center p-12">
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        결제 내역을 불러오지 못했어요
      </Typography>
    </div>
  {:else}
    <!-- 센터 그룹 헤더 (소속 센터 구분) -->
    <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
      {#if currentCenter?.logo_url}
        <img
          src={currentCenter.logo_url}
          alt={currentCenter.name}
          class="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      {:else}
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500"
        >
          <Typography variant="body-02-normal-semibold">
            {currentCenter?.name?.charAt(0) ?? ''}
          </Typography>
        </div>
      {/if}
      <Typography variant="title-01-semibold" color="text-gray-900">
        {currentCenter?.name ?? '현재 센터'}
      </Typography>
      {#if currentCenter?.role_name}
        <BadgeRectangle
          label={currentCenter.role_name}
          color="gray"
          size="sm"
        />
      {/if}
    </div>

    {#if rows.length === 0}
      <div class="flex-center p-12">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          결제 내역이 없어요
        </Typography>
      </div>
    {:else}
      <!-- 결제 내역 테이블 -->
      <Table {columns} data={rows} keyField="id" />
    {/if}
  {/if}
</div>
