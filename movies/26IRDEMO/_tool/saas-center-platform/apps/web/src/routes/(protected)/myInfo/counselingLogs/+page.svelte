<script lang="ts">
  import {
    getMyCounselingLogs,
    type MyCounselingResponse
  } from '$lib/hooks/actions/counseling.action'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import CounselingLogsTable from '../components/CounselingLogsTable.svelte'
  import Select from '$lib/components/Select.svelte'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import EmptyDataIcon40 from '$lib/assets/EmptyDataIcon40.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isMobile = $derived(responsive.device === 'mobile')

  let currentPage = $state(1)
  let pageSize = $state(10)
  let selectedPageSize: string | SelectOptionType = $state({
    title: '10개',
    value: '10'
  })
  const pageSizeOptions: SelectOptionType[] = [
    { title: '10개', value: '10' },
    { title: '20개', value: '20' },
    { title: '30개', value: '30' }
  ]

  function handlePageSizeChange(option: SelectOptionType) {
    selectedPageSize = option
    pageSize = Number(option.value)
    currentPage = 1
  }

  const counselingLogsQuery = $derived(
    $centerId
      ? queryBuilder(getMyCounselingLogs, () => ({
          centerId: $centerId!,
          page: currentPage,
          size: pageSize
        }))
      : null
  )

  const counselingLogs = $derived(
    counselingLogsQuery?.data as MyCounselingResponse | undefined
  )

  const items = $derived(counselingLogs?.items ?? [])
  const totalItems = $derived(counselingLogs?.total ?? 0)
</script>

<div in:fade class="xl:h-full xl:min-h-0 bg-gray-50 flex flex-col gap-4">
  <!-- 헤더: 뒤로가기 + 타이틀 -->
  <div class="shrink-0 flex items-center gap-2">
    <button
      onclick={() => goto('/myInfo')}
      class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
      aria-label="내 정보로 돌아가기"
    >
      <ArrowBackIcon />
    </button>

    <Typography variant="headline-01-normal-semibold">상담 이력</Typography>
  </div>

  <!-- Summary: 반응형 카드 그리드 -->
  {#if counselingLogs?.summary}
    <div class="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-white rounded-lg p-4 md:p-5 flex flex-col gap-1">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          총 상담 이력
        </Typography>
        <Typography
          variant="headline-02-normal-semibold"
          color="text-primary-500"
        >
          {counselingLogs.summary.total_completed}회
        </Typography>
      </div>
      <div class="bg-white rounded-lg p-4 md:p-5 flex flex-col gap-1">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          개별 상담
        </Typography>
        <Typography variant="headline-02-normal-semibold" color="text-gray-800">
          {counselingLogs.summary.individual_completed}회
        </Typography>
      </div>
      <div class="bg-white rounded-lg p-4 md:p-5 flex flex-col gap-1">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          그룹 상담
        </Typography>
        <Typography variant="headline-02-normal-semibold" color="text-gray-800">
          {counselingLogs.summary.group_completed}회
        </Typography>
      </div>
      <div class="bg-white rounded-lg p-4 md:p-5 flex flex-col gap-1">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          최근 상담일
        </Typography>
        <Typography
          variant="headline-02-normal-semibold"
          color="text-primary-500"
        >
          {counselingLogs.summary.last_session_date ?? '-'}
        </Typography>
      </div>
    </div>
  {/if}

  <!-- 리스트 영역 -->
  <div
    class="bg-white rounded-2xl overflow-hidden xl:flex-1 xl:min-h-0 flex flex-col"
  >
    {#if items.length > 0}
      <CounselingLogsTable
        {items}
        containerClass="flex-1 min-h-0"
        bodyClass="flex-1 min-h-0 overflow-auto"
      />
    {:else if counselingLogs}
      <!-- 데이터 없음 -->
      <!-- 빈 상태 규격 정본 = FieldNoteEmpty (아이콘 → 12 → 제목 18 SemiBold → 8 → 설명 16) -->
      <div class="flex-1 flex-center flex-col py-20 text-center">
        <EmptyDataIcon40 />
        <Typography
          variant="title-01-reading-semibold"
          color="text-gray-800"
          className="mt-3"
        >
          아직 기록된 상담이 없어요
        </Typography>
        <Typography
          variant="body-01-reading-regular"
          color="text-gray-600"
          className="mt-2"
        >
          상담이 완료되면 이력이 자동으로 쌓여요
        </Typography>
      </div>
    {:else}
      <div class="flex-1 flex-center py-20">
        <Typography variant="body-01-regular" color="text-gray-400">
          불러오는 중...
        </Typography>
      </div>
    {/if}
  </div>

  <!-- 페이지네이션 (테이블 카드 외부, 검사 리스트 패턴) -->
  {#if items.length > 0}
    <div class="shrink-0 flex items-center justify-center py-4 relative">
      <Pagination {totalItems} itemsPerPage={pageSize} bind:currentPage />
      {#if !isMobile}
        <div class="absolute right-4 md:right-6">
          <Select
            options={pageSizeOptions}
            selected={selectedPageSize}
            class="rounded-lg"
            btnClass="px-3 py-2"
            on:change={(e) => handlePageSizeChange(e.detail)}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>
