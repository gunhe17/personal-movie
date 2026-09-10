<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'

  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import Typography from '@common/components/Typography.svelte'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCenterVoucherList,
    getCenterVoucherStats
  } from '$lib/hooks/actions/centerVoucher.action'
  import { centerId } from '$lib/stores/center.store'
  import { hasPermission } from '$lib/stores/permission.view'

  import { createCenterVoucherService } from '$lib/features/voucher/center-voucher/center-voucher-service'
  import { useCenterVoucherFilters } from '$lib/features/voucher/center-voucher/hooks.svelte'
  import { buildCenterVoucherListInput } from '$lib/features/voucher/center-voucher/query-builders'
  import {
    mapToCenterVoucherVMs,
    type CenterVoucherVM
  } from '$lib/features/voucher/center-voucher/view-model'

  import Switch from '$lib/components/Switch.svelte'

  import CenterVoucherFormModal from './components/CenterVoucherFormModal.svelte'
  import CenterVoucherListCard from './components/CenterVoucherListCard.svelte'

  const queryClient = useQueryClient()
  const service = createCenterVoucherService({ queryClient })

  const pathname = page.url.pathname
  const filters = useCenterVoucherFilters(page.url, pathname)

  const canWrite = $derived($hasPermission('write:voucher'))

  const listQuery = $derived(
    queryBuilder(getCenterVoucherList, () =>
      buildCenterVoucherListInput($centerId, filters.buildFilters())
    )
  )

  const allRows = $derived(mapToCenterVoucherVMs(listQuery.data?.items))
  const isLoading = $derived(listQuery.isLoading)

  // 종료된 사업(catalog 만료) 숨기기 토글 — 기본 ON (숨김)
  let hideExpired = $state(true)
  const rows = $derived(
    hideExpired ? allRows.filter((r) => !r.isExpired) : allRows
  )
  const expiredCount = $derived(allRows.filter((r) => r.isExpired).length)
  const total = $derived(rows.length)

  // 통계 (바우처별 사용 내담자 수)
  const statsQuery = $derived(
    queryBuilder(getCenterVoucherStats, () => ({
      centerId: $centerId,
      expiring_window_days: 60
    }))
  )

  // 바우처별 사용 내담자 수 — Map<center_voucher_id, count>
  const clientCountByVoucher = $derived.by(() => {
    const map = new Map<string, number>()
    for (const item of statsQuery.data?.per_voucher ?? []) {
      map.set(item.center_voucher_id, item.active_client_count)
    }
    return map
  })

  function openDetail(item: CenterVoucherVM) {
    goto(`/settings/vouchers/${item.id}`)
  }
</script>

<!-- 카드 그리드 = 페이지 전체 스크롤(내부 스크롤 락 없음) — 내담자·상담현황 목록과 동일 -->
<div in:fade class="flex flex-col">
  <!-- 페이지 타이틀 -->
  <!-- 타이틀 아래가 카운트 헤더(여백 가진 행) → 간격 8 -->
  <PageTitleSection title="바우처 관리" className="mb-2">
    <span slot="extraBtn">
      {#if canWrite}
        <PageActionButton
          label="바우처 등록"
          onclick={() => service.openCreateModal(CenterVoucherFormModal)}
        />
      {/if}
    </span>
  </PageTitleSection>

  <!-- 카운트 헤더 + 종료 사업 숨기기 토글 — 리스트 페이지 공통 규격(h-11 · 아래 gap 4) -->
  <div class="mb-1 flex h-11 shrink-0 items-center justify-between">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      총 {total}개
    </Typography>
    {#if expiredCount > 0}
      <div class="flex items-center gap-3">
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          종료된 사업 숨기기
          <span class="text-gray-400">({expiredCount})</span>
        </Typography>
        <Switch bind:checked={hideExpired} ariaLabel="종료된 사업 숨기기" />
      </div>
    {/if}
  </div>

  <!-- 카드 그리드 -->
  {#if isLoading}
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-400"
      className="block py-10 text-center"
    >
      불러오는 중...
    </Typography>
  {:else if rows.length === 0}
    <div class="flex flex-1 items-center justify-center py-12">
      <NoDataSection description="등록한 바우처가 없어요" />
    </div>
  {:else}
    <div
      class="grid gap-4 pb-4"
      style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));"
    >
      {#each rows as item (item.id)}
        <CenterVoucherListCard
          {item}
          activeClientCount={clientCountByVoucher.get(item.id) ?? 0}
          onOpen={openDetail}
        />
      {/each}
    </div>
  {/if}
</div>
