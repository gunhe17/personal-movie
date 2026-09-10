<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'

  // Components
  import Typography from '@common/components/Typography.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import ListGridToggleButton from '$lib/components/ListGridToggleButton.svelte'
  import ActiveToggle from '$lib/components/common/ActiveToggle.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'

  // Queries
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getFormTemplates } from '$lib/hooks/actions/form.action'
  import { centerId } from '$lib/stores/center.store'
  import { pageAction } from '$lib/stores/page-action'

  // Feature modules
  import {
    CENTER_PAGE_ACCESS_RULE,
    CENTER_EDIT_RULE
  } from '$lib/features/center/permissions'
  import { buildTemplateListInput } from '$lib/features/form/template/query-builders'
  import {
    mapToTemplateVM,
    type TemplateVM
  } from '$lib/features/form/template/view-model'
  import { createTemplateService } from '$lib/features/form/template/template-service'
  import FormGalleryCard from '$lib/features/form/template/components/FormGalleryCard.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isOverlayMode = $derived(!responsive.isDesktop)

  const queryClient = useQueryClient()
  const service = createTemplateService({ queryClient })

  // 검색 상태 (센터 양식 테이블 필터)
  let searchQuery = $state('')

  // 목록 쿼리 (전역 + 센터 모두)
  const listQuery = $derived(
    queryBuilder(getFormTemplates, () => buildTemplateListInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const isLoading = $derived(listQuery.isLoading)

  const allTemplates: TemplateVM[] = $derived(
    (listQuery.data?.items ?? []).map(mapToTemplateVM)
  )

  // 전역(center_id null) = 공개 양식(검색해서 가져오기) / 센터 소유 = 센터 양식(테이블)
  const globalTemplates = $derived(allTemplates.filter((t) => t.isSystem))
  const centerTemplates = $derived(allTemplates.filter((t) => !t.isSystem))

  function filterByName(list: TemplateVM[]): TemplateVM[] {
    const q = searchQuery.trim().toLowerCase()
    return q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list
  }

  const centerFiltered = $derived(filterByName(centerTemplates))
  const hasActiveFilter = $derived(!!searchQuery.trim())

  // 뷰 모드 (list=테이블 / grid=문서 카드). URL ?view=grid 동기화
  let viewType = $state<'list' | 'grid'>('list')

  onMount(() => {
    if ($page.url.searchParams.get('view') === 'grid') viewType = 'grid'
  })

  function onViewChange(view: 'list' | 'grid') {
    viewType = view
    const url = new URL($page.url)
    if (view === 'grid') url.searchParams.set('view', 'grid')
    else url.searchParams.delete('view')
    goto(url, { replaceState: true, keepFocus: true, noScroll: true })
  }

  // 문서(그리드) 뷰: 1행 6개 고정 · 좌측 정렬 · A4 비율 유지.
  // 영역 높이에서 2행이 딱 맞는 카드 폭을 계산(세로 스크롤 방지).
  const GRID_COLS = 6
  const GRID_GAP = 24 // px (= gap-6)
  const CARD_LABEL_BLOCK = 30 // 라벨+여백 높이 추정
  let gridAreaH = $state(0)
  const cardW = $derived(
    gridAreaH > 0
      ? Math.max(
          80,
          ((gridAreaH - GRID_GAP) / 2 - CARD_LABEL_BLOCK) * (210 / 297)
        )
      : 150
  )

  // 페이지네이션 (클라이언트 측). 그리드 뷰는 2행(=2×6) 단위로 페이징
  const LIST_PAGE_SIZE = 10
  let currentPage = $state(1)
  const pageSize = $derived(
    viewType === 'grid' ? GRID_COLS * 2 : LIST_PAGE_SIZE
  )

  const totalPages = $derived(
    Math.max(1, Math.ceil(centerFiltered.length / pageSize))
  )
  const pagedForms = $derived(
    centerFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  )

  // 검색 변경 시 첫 페이지로
  $effect(() => {
    searchQuery
    currentPage = 1
  })

  // 목록 변화·뷰 전환으로 현재 페이지가 범위를 벗어나면 보정
  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages
  })

  function resetFilters() {
    searchQuery = ''
  }

  function openDetail(id: string) {
    goto(`/center/form-templates/${id}`)
  }

  // 비활성 딤드는 상태 칸을 뺀 셀들에만 — 행 전체에 opacity를 주면 토글·배지까지
  // 흐려져 '비활성'인지 '조작 불가'인지 구분이 안 된다(내담자 목록과 같은 규칙).
  const dimIfInactive = (item: TemplateVM) =>
    item.isActive ? '' : 'opacity-50'

  // 센터 양식 테이블 컬럼
  const columns: TableColumn<TemplateVM>[] = [
    {
      key: 'name',
      label: '양식명',
      cellClass: dimIfInactive,
      render: nameCell
    },
    {
      key: 'version',
      label: '버전',
      width: '104px',
      align: 'center',
      cellClass: dimIfInactive,
      render: versionCell
    },
    {
      key: 'statusLabel',
      label: '상태',
      width: '132px',
      align: 'center',
      stopPropagation: true,
      render: statusCell
    },
    {
      key: 'createdAt',
      label: '생성일',
      width: '140px',
      align: 'right',
      cellClass: dimIfInactive,
      render: dateCell
    }
  ]

  // 타이틀 행 우측 CTA 등록 — 라우트를 떠나면 비운다
  $effect(() => {
    pageAction.set(cta)
    return () => pageAction.set(null)
  })
</script>

<!-- 메인 CTA — 타이틀 행은 /center/+layout.svelte가 소유하므로 스토어로 올려보낸다 -->
{#snippet cta()}
  <PermissionGuard rule={CENTER_EDIT_RULE}>
    <PageActionButton
      label="새 양식 추가"
      onclick={() => service.openNewFormModal(globalTemplates)}
    />
  </PermissionGuard>
{/snippet}

{#snippet nameCell({
  item
}: {
  item: TemplateVM
  index: number
  isChecked: boolean
})}
  <Typography
    variant="body-01-normal-medium"
    color="text-gray-900"
    tag="span"
    className="truncate-safe"
  >
    {item.name}
  </Typography>
{/snippet}

{#snippet versionCell({
  item
}: {
  item: TemplateVM
  index: number
  isChecked: boolean
})}
  <Typography variant="body-02-normal-regular" color="text-gray-500" tag="span">
    v{item.version}
  </Typography>
{/snippet}

{#snippet statusCell({
  item
}: {
  item: TemplateVM
  index: number
  isChecked: boolean
})}
  <div class="flex items-center justify-center gap-2">
    {#if !item.isActive}
      <!-- 딤드 밖이라 행이 흐려진 이유가 읽힌다. 카드/내담자 목록과 같은 tag-gray pill -->
      <BadgeRound
        status="completed"
        label="비활성"
        class="h-6 min-w-0 bg-tag-gray-bg px-2.5 text-tag-gray-fg"
      />
    {/if}
    <ActiveToggle
      active={item.isActive}
      disabled={item.isSystem}
      onToggle={(next) => service.changeStatus(item.id, next)}
    />
  </div>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: TemplateVM
  index: number
  isChecked: boolean
})}
  <Typography variant="body-02-normal-regular" color="text-gray-500" tag="span">
    {item.createdAt}
  </Typography>
{/snippet}

<PermissionGuard rule={CENTER_PAGE_ACCESS_RULE} showError>
  <div
    in:fade
    class="flex h-full w-full flex-col bg-gray-50 xl:overflow-hidden"
  >
    {#if isLoading}
      <div class="flex-center w-full flex-1">
        <p class="text-gray-500">로딩 중...</p>
      </div>
    {:else}
      <!-- 센터 양식 목록 (목록 정본: 필터 → 카운트 헤더 → 리스트) -->
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- 검색 + 필터 초기화 (메인 CTA는 타이틀 행 우측 — pageAction) -->
        <div class="filter-bar mb-3 flex flex-wrap items-center gap-3">
          <div
            class="flex h-11 {isOverlayMode
              ? 'w-full'
              : 'w-90'} items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 duration-200 focus-within:border-border-active"
          >
            <SearchIcon />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="검색어를 입력해주세요"
              class="text-body-01-normal-regular w-full bg-transparent outline-none placeholder:text-placeholder"
            />
          </div>
          <FilterResetButton
            onclick={resetFilters}
            disabled={!hasActiveFilter}
          />
        </div>

        <!-- 카운트 헤더 (영역 높이 44 · 아래 콘텐츠와 4) — 뷰 토글은 이 행 우측 -->
        <div class="mb-1 flex h-11 shrink-0 items-center justify-between">
          <Typography variant="body-01-normal-regular" color="text-gray-700">
            총 {centerFiltered.length}건
          </Typography>
          <ListGridToggleButton bind:viewType {onViewChange} />
        </div>

        <!-- 뷰 (테이블 / 문서 그리드) -->
        {#if centerFiltered.length === 0}
          <NoDataSection
            description={hasActiveFilter
              ? '검색 조건에 맞는 양식이 없어요'
              : '등록된 센터 양식이 없어요'}
          />
        {:else}
          {#if viewType === 'list'}
            <div
              class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
            >
              <Table
                {columns}
                data={pagedForms}
                keyField="id"
                headerClass="bg-white border-b border-gray-200"
                bodyClass="flex-1 min-h-0 overflow-auto"
                hoverEnabled
                onRowClick={(item) => openDetail(item.id)}
              />
            </div>
          {:else}
            <!-- 문서 뷰 (페이지당 2행 그리드 · 실제 스냅샷은 후순위) -->
            <div
              class="min-h-0 flex-1 overflow-hidden"
              bind:clientHeight={gridAreaH}
            >
              <div
                class="grid content-start justify-start gap-6"
                style="grid-template-columns: repeat(6, {cardW}px)"
              >
                {#each pagedForms as template (template.id)}
                  <FormGalleryCard
                    {template}
                    class="w-full"
                    onclick={() => openDetail(template.id)}
                  />
                {/each}
              </div>
            </div>
          {/if}
          <Pagination
            totalItems={centerFiltered.length}
            itemsPerPage={pageSize}
            bind:currentPage
          />
        {/if}
      </div>
    {/if}
  </div>
</PermissionGuard>
