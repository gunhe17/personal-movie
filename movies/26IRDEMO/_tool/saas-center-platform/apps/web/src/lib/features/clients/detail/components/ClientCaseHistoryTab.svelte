<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { createInfiniteQuery } from '@tanstack/svelte-query'
  import { centerId } from '$lib/stores/center.store'
  import { getCounselingsByCenterId } from '$lib/hooks/actions/counseling.action'
  import { getAssessmentCasesByClient } from '$lib/hooks/actions/case.action'
  import {
    toCounselingHistoryPage,
    toAssessmentByClientPage,
    type CaseHistoryItem,
    type CaseHistoryKind,
    type CaseHistoryPage
  } from '$lib/features/clients/detail/case-history'
  import Typography from '@common/components/Typography.svelte'
  import Counsel20Icon from '$lib/assets/Counsel20Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import CaseHistoryCard from './CaseHistoryCard.svelte'

  interface Props {
    clientId: string
  }

  let { clientId }: Props = $props()

  const PAGE_SIZE = 20

  // 서브 필터 (전체 / 상담 / 검사). 전체는 두 소스를 병합해 보여준다.
  type SubFilter = 'all' | CaseHistoryKind
  let activeSub = $state<SubFilter>('all')

  const SUBFILTERS: { value: SubFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'counseling', label: '상담' },
    { value: 'assessment', label: '검사' }
  ]

  // 슬라이딩 활성 배경의 위치 (세그먼트 인덱스)
  const activeIndex = $derived(
    SUBFILTERS.findIndex((f) => f.value === activeSub)
  )

  // ── 상담 스크롤 ──
  const counselingInfinite = createInfiniteQuery(() => ({
    queryKey: ['clientCaseHistory', 'counseling', $centerId, clientId],
    // 둘 다 활성화: 비활성 서브탭도 첫 페이지를 받아 헤더 건수를 항상 표시.
    enabled: !!$centerId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CaseHistoryPage> => {
      const resp = await getCounselingsByCenterId().request({
        centerId: $centerId!,
        queryParams: {
          clientId,
          page: pageParam as number,
          size: PAGE_SIZE,
          sort: 'desc' as const
        }
      })
      return toCounselingHistoryPage(resp)
    },
    getNextPageParam: (last: CaseHistoryPage, pages: CaseHistoryPage[]) =>
      last.hasNext ? pages.length + 1 : undefined
  }))

  // ── 검사 (by-client: 페이지네이션 없는 전체 배열 → 단일 페이지) ──
  const assessmentInfinite = createInfiniteQuery(() => ({
    queryKey: ['clientCaseHistory', 'assessment', $centerId, clientId],
    enabled: !!$centerId,
    initialPageParam: 1,
    queryFn: async (): Promise<CaseHistoryPage> => {
      const resp = await getAssessmentCasesByClient().request({
        centerId: $centerId!,
        clientId
      })
      return toAssessmentByClientPage(resp)
    },
    // hasNext가 항상 false라 다음 페이지를 요청하지 않는다.
    getNextPageParam: (last: CaseHistoryPage, pages: CaseHistoryPage[]) =>
      last.hasNext ? pages.length + 1 : undefined
  }))

  // 서브탭별 전체 건수 (첫 페이지의 total). 아직 안 불러왔으면 null → '-' 표시.
  const counselingTotal = $derived(
    (counselingInfinite.data?.pages?.[0] as CaseHistoryPage | undefined)
      ?.total ?? null
  )
  const assessmentTotal = $derived(
    (assessmentInfinite.data?.pages?.[0] as CaseHistoryPage | undefined)
      ?.total ?? null
  )
  const subCounts = $derived<Record<SubFilter, number | null>>({
    all:
      counselingTotal == null && assessmentTotal == null
        ? null
        : (counselingTotal ?? 0) + (assessmentTotal ?? 0),
    counseling: counselingTotal,
    assessment: assessmentTotal
  })

  // 무한 스크롤 페이지네이션은 상담 소스가 담당 (검사 by-client는 단일 페이지).
  // 전체 모드도 상담이 추가 로드를 끌고, 검사는 처음에 전부 로드돼 병합된다.
  const paginated = $derived(
    activeSub === 'assessment' ? assessmentInfinite : counselingInfinite
  )

  const isLoading = $derived(
    activeSub === 'all'
      ? counselingInfinite.isLoading || assessmentInfinite.isLoading
      : paginated.isLoading
  )
  const isFetchingNext = $derived(paginated.isFetchingNextPage)
  const hasNext = $derived(paginated.hasNextPage ?? false)

  // 소스별 누적 아이템 (페이지 flat)
  const counselingItems = $derived(
    ((counselingInfinite.data?.pages ?? []) as CaseHistoryPage[]).flatMap(
      (p) => p.items
    )
  )
  const assessmentItems = $derived(
    ((assessmentInfinite.data?.pages ?? []) as CaseHistoryPage[]).flatMap(
      (p) => p.items
    )
  )

  // 활성 필터에 맞는 아이템. 전체는 createdAt 내림차순으로 병합.
  const items = $derived.by((): CaseHistoryItem[] => {
    if (activeSub === 'counseling') return counselingItems
    if (activeSub === 'assessment') return assessmentItems
    return [...counselingItems, ...assessmentItems].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    )
  })

  // 드릴다운: 케이스 상세로 이동
  const goDetail = (item: CaseHistoryItem) => {
    const base =
      item.kind === 'counseling' ? '/counseling/status' : '/assessment/status'
    goto(`${base}/${item.caseId}`)
  }

  // ── 스크롤 패치 트리거 ──
  let sentinel = $state<HTMLDivElement | null>(null)
  let scrollEl = $state<HTMLDivElement | null>(null)
  let isSentinelVisible = $state(false)

  $effect(() => {
    if (!browser || !sentinel || !scrollEl) return
    const observer = new IntersectionObserver(
      (entries) => {
        isSentinelVisible = entries[0]?.isIntersecting ?? false
      },
      { root: scrollEl, rootMargin: '120px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })

  $effect(() => {
    if (isSentinelVisible && hasNext && !isFetchingNext) {
      paginated.fetchNextPage()
    }
  })
</script>

<div in:fade class="flex h-full flex-col">
  <!-- 서브 필터 = 세그먼트 토글 (전체 / 상담 / 검사) — DateRangeToggle 하우스 스타일 -->
  <div
    class="relative mb-4 flex shrink-0 items-center rounded-xl bg-gray-50 p-2"
  >
    <!-- 슬라이딩 활성 배경 — 컨테이너 여백 8, 중첩 radius 12 ⊃ 8 -->
    <div
      class="absolute top-2 left-2 h-11 rounded-lg bg-white shadow-sm transition-all duration-200 ease-out motion-reduce:transition-none"
      style="width: calc((100% - 16px) / {SUBFILTERS.length}); transform: translateX({activeIndex *
        100}%);"
      aria-hidden="true"
    ></div>
    {#each SUBFILTERS as f (f.value)}
      {@const isActive = activeSub === f.value}
      <button
        type="button"
        onclick={() => (activeSub = f.value)}
        aria-pressed={isActive}
        class="relative z-10 flex h-11 flex-1 items-center justify-center gap-2 rounded-lg"
      >
        {#if f.value === 'counseling'}
          <Counsel20Icon />
        {:else if f.value === 'assessment'}
          <span class="inline-flex items-center [&>svg]:h-5 [&>svg]:w-5">
            <AssessmentStack />
          </span>
        {/if}
        <Typography
          variant="body-02-normal-medium"
          color={isActive ? 'text-gray-900' : 'text-gray-500'}
          className="transition-colors duration-200 motion-reduce:transition-none"
        >
          {f.label}
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color={isActive ? 'text-primary-500' : 'text-gray-400'}
          className="transition-colors duration-200 motion-reduce:transition-none"
        >
          {subCounts[f.value] ?? '-'}
        </Typography>
      </button>
    {/each}
  </div>

  <!-- 목록 (스크롤바 숨김 + 위/아래 fade·화살표로 스크롤 가능 표시) -->
  <ScrollFadeArea
    fadeHeight={48}
    bounceArrow
    deps={[items, activeSub]}
    bindScrollEl={(el) => (scrollEl = el)}
  >
    {#if isLoading}
      <div class="flex h-full items-center justify-center">
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          불러오는 중...
        </Typography>
      </div>
    {:else if items.length === 0}
      <!-- 빈 상태 = 문서 탭과 동일한 공용 NoDataSection (아이콘 44 → gap 20 → 문구) -->
      <NoDataSection description="진행 내역이 없어요" />
    {:else}
      <!-- 아코디언 카드 목록 (코드·제목·담당/상담실·진행률 + 펼치면 회기/검사 목록) -->
      <!-- 2열 그리드 (바우처 그리드와 동일 규격). 같은 행의 카드는 높이를 맞춘다 -->
      <ul class="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {#each items as item (item.kind + item.caseId)}
          <li class="h-full">
            <CaseHistoryCard {item} onNavigate={goDetail} />
          </li>
        {/each}
      </ul>

      <!-- 스크롤 패치 sentinel + 로딩 표시 -->
      <div bind:this={sentinel} class="h-px"></div>
      {#if isFetchingNext}
        <div class="flex justify-center py-3">
          <Typography variant="body-02-normal-regular" color="text-gray-400">
            더 불러오는 중...
          </Typography>
        </div>
      {/if}
    {/if}
  </ScrollFadeArea>
</div>
