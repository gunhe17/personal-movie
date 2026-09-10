<script lang="ts">
  import QuickLinkFilter from '$lib/components/filter/QuickLinkFilter.svelte'
  import QuickLinkListSended from '$lib/components/list/QuickLinkListSended.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import { fade } from 'svelte/transition'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getAssessmentSendLinksByCenterId,
    type AssessmentSendLinkType
  } from '$lib/hooks/actions/quickLinks'
  import { centerId } from '$lib/stores/center.store'

  // 쿼리 파라미터 상태 관리
  let activeTabName = $state<'미전송' | '전송됨'>('미전송')
  let sortOrder = $state<'newest' | 'oldest'>('oldest')
  let searchQuery = $state('')
  let currentPage = $state(1)
  let pageSize = $state(10)

  // queryBuilder를 사용한 API 호출 (효율적인 패턴)
  const quickLinksQuery = queryBuilder(
    getAssessmentSendLinksByCenterId,
    () => ({
      centerId: $centerId ?? '',
      has_accessed: activeTabName === '전송됨' ? true : false, // 미전송/전송됨 필터
      page: currentPage,
      page_size: pageSize,
      sort: sortOrder === 'newest' ? 'created_at_desc' : 'created_at_asc'
      // session_uid 필터는 필요시 추가
    }),
    () => ({ enabled: !!$centerId })
  )

  // 쿼리 결과를 반응형으로 추출
  const isLoading = $derived(quickLinksQuery.isLoading)
  const queryData = $derived(quickLinksQuery.data)
  const linksList = $derived.by((): AssessmentSendLinkType[] => {
    if (!queryData?.data) return []
    return queryData.data
  })
  const totalCount = $derived(queryData?.pagination?.total || 0)

  // 탭 카운트 계산 (전체 데이터 조회 필요 시)
  // bind를 사용하려면 $state로 선언해야 함
  let tabs = $state([
    { name: '미전송', count: 0, active: activeTabName === '미전송' },
    { name: '전송됨', count: 0, active: activeTabName === '전송됨' }
  ])

  // activeTabName이 변경될 때 tabs 업데이트
  $effect(() => {
    tabs = [
      { name: '미전송', count: 0, active: activeTabName === '미전송' },
      { name: '전송됨', count: 0, active: activeTabName === '전송됨' }
    ]
  })

  function handleTabChange(tabName: string) {
    console.log('Tab changed:', tabName)
    activeTabName = tabName as '미전송' | '전송됨'
    currentPage = 1 // 탭 변경 시 첫 페이지로
  }

  function handleSearch(query: string) {
    searchQuery = query
    currentPage = 1
  }

  function handleSortChange(order: 'newest' | 'oldest') {
    sortOrder = order
    currentPage = 1
  }

  function handleCheckChange(selectedIds: string[]) {
    console.log('Selected IDs:', selectedIds)
    // TODO: 선택된 항목 처리 로직
  }

  // 디버깅용
  $effect(() => {
    console.log('Links list:', linksList)
  })
</script>

<div in:fade class="mx-auto flex max-w-[1200px] flex-col pt-8 pb-[66px]">
  <div class="mb-4 h-11 place-content-center">
    <h1 class="text-headline-01-normal-semibold text-gray-800">바로 링크</h1>
  </div>

  <div class="rounded-2xl bg-white">
    <!-- 필터 컴포넌트 -->
    <QuickLinkFilter
      bind:tabs
      bind:sortOrder
      onTabChange={handleTabChange}
      onSearch={handleSearch}
      onSortChange={handleSortChange}
    />

    <!-- 로딩 상태 -->
    {#if isLoading}
      <div class="flex items-center justify-center py-20">
        <p class="text-body-01-normal-regular text-gray-500">로딩 중...</p>
      </div>
    {:else}
      <!-- 링크 목록 -->
      <!-- TODO: QuickLinkListSended를 AssessmentSendLinkType 용으로 수정 필요 -->
      <QuickLinkListSended
        items={linksList as any}
        onCheckChange={handleCheckChange}
        onSendComplete={() => quickLinksQuery.refetch()}
      />

      <!-- 페이지네이션 -->
      <div class="flex justify-center py-6">
        <Pagination
          bind:currentPage
          totalItems={totalCount}
          itemsPerPage={pageSize}
        />
      </div>
    {/if}
  </div>
</div>
