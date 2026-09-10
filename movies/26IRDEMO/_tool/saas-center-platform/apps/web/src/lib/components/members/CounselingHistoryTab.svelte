<script lang="ts">
  import { fade } from 'svelte/transition'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { createInfiniteQuery } from '@tanstack/svelte-query'
  import { centerId } from '$lib/stores/center.store'
  import { getCounselingsByCenterId } from '$lib/hooks/actions/counseling.action'
  import { getCasesByCenterId } from '$lib/hooks/actions/case.action'
  import {
    toCounselingHistoryPage,
    toAssessmentHistoryPage,
    CASE_HISTORY_SUBTABS,
    type CaseHistoryItem,
    type CaseHistoryKind,
    type CaseHistoryPage
  } from '$lib/features/members'
  import { formatUtcToKst } from '$lib/utils/date'
  import Typography from '@common/components/Typography.svelte'
  import Counsel20Icon from '$lib/assets/Counsel20Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import MemberCaseHistoryCard from './MemberCaseHistoryCard.svelte'

  interface Props {
    memberId: string
  }

  let { memberId }: Props = $props()

  const PAGE_SIZE = 20

  // 서브탭 (상담 / 검사). 단일 소스라 각 탭이 독립 지속 스크롤된다.
  let activeSub = $state<CaseHistoryKind>('counseling')

  // ── 상담 스크롤 ──
  const counselingInfinite = createInfiniteQuery(() => ({
    queryKey: ['memberCaseHistory', 'counseling', $centerId, memberId],
    // 둘 다 활성화: 비활성 서브탭도 첫 페이지를 받아 헤더 건수를 항상 표시.
    // (스크롤 fetchNextPage는 활성 탭에서만 호출되므로 안전)
    enabled: !!$centerId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CaseHistoryPage> => {
      const resp = await getCounselingsByCenterId().request({
        centerId: $centerId!,
        queryParams: {
          counselorIds: [memberId],
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

  // ── 검사 스크롤 ──
  const assessmentInfinite = createInfiniteQuery(() => ({
    queryKey: ['memberCaseHistory', 'assessment', $centerId, memberId],
    enabled: !!$centerId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CaseHistoryPage> => {
      const resp = await getCasesByCenterId().request({
        centerId: $centerId!,
        queryParams: {
          counselor_id: memberId,
          page: pageParam as number,
          size: PAGE_SIZE
        }
      })
      return toAssessmentHistoryPage(resp)
    },
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
  const subCounts = $derived<Record<CaseHistoryKind, number | null>>({
    counseling: counselingTotal,
    assessment: assessmentTotal
  })

  // 슬라이딩 활성 배경의 위치 (세그먼트 인덱스)
  const activeIndex = $derived(
    CASE_HISTORY_SUBTABS.findIndex((t) => t.value === activeSub)
  )

  // 활성 서브탭의 쿼리
  const active = $derived(
    activeSub === 'counseling' ? counselingInfinite : assessmentInfinite
  )

  const isLoading = $derived(active.isLoading)
  const isFetchingNext = $derived(active.isFetchingNextPage)
  const hasNext = $derived(active.hasNextPage ?? false)

  // 누적 아이템 (페이지 flat) → 날짜 그룹 → flat 행
  const items = $derived(
    ((active.data?.pages ?? []) as CaseHistoryPage[]).flatMap((p) => p.items)
  )

  // 다음 일정 표기 (KST) — 상담·검사 공통 "MM.DD HH:mm". 카드에 주입한다.
  const fmtDateTime = (iso: string) => formatUtcToKst(iso, 'MM.DD HH:mm')

  // 드릴다운: 케이스 상세로 이동
  const goDetail = (item: CaseHistoryItem) => {
    const base =
      item.kind === 'counseling' ? '/counseling/status' : '/assessment/status'
    goto(`${base}/${item.caseId}`)
  }

  // ── 스크롤 패치 트리거 ──
  // observer는 "sentinel이 보이는지" 상태만 갱신하고, 실제 fetch는 별도 $effect가
  // (보임 && 다음페이지 있음 && 가져오는 중 아님)을 반응형으로 감시해 호출한다.
  // 이렇게 분리해야: ① 데이터가 화면을 안 채워 sentinel이 계속 보이는 경우
  // (observer 재발화 없음)에도 hasNext가 true로 바뀌면 effect가 다시 평가되고,
  // ② 한 페이지 로드 후에도 sentinel이 여전히 보이면 다음 페이지를 이어 당긴다.
  let sentinel = $state<HTMLDivElement | null>(null)
  let scrollEl = $state<HTMLDivElement | null>(null)
  let isSentinelVisible = $state(false)

  $effect(() => {
    // sentinel은 내부 스크롤 컨테이너 안에서 스크롤되므로 observer root를
    // scrollEl로 지정해야 한다. (root 미지정 시 뷰포트 기준이라 발화 안 됨)
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

  // 보임 상태/페이지 상태가 바뀔 때마다 평가 → 조건 충족 시 다음 페이지 fetch
  $effect(() => {
    if (isSentinelVisible && hasNext && !isFetchingNext) {
      active.fetchNextPage()
    }
  })
</script>

<div in:fade class="flex h-full flex-col">
  <!-- 섹션 타이틀 행 (Web_Design.md §패턴): 아래 콘텐츠와 gap 12.
       타이틀은 정본(headline-02/20)보다 한 단계 작은 title-01(18) — 탭 내부라 한 급 낮춘다.
       행 높이 24는 세 탭 공통(탭 전환 시 첫 줄 위치 고정) -->
  <div class="mb-3 flex h-6 shrink-0 items-center justify-between">
    <Typography variant="title-01-normal-semibold" color="text-gray-900">
      담당 상담 · 검사
    </Typography>
  </div>

  <!-- 서브 필터 = 세그먼트 토글 (상담 / 검사).
       내담자 상세 '진행현황'(ClientCaseHistoryTab)과 동일 규격 — 아이콘 포함. -->
  <div
    class="relative mb-4 flex shrink-0 items-center rounded-xl bg-gray-50 p-2"
  >
    <!-- 슬라이딩 활성 배경 — 컨테이너 여백 8, 중첩 radius 12 ⊃ 8 -->
    <div
      class="absolute top-2 left-2 h-11 rounded-lg bg-white shadow-sm transition-all duration-200 ease-out motion-reduce:transition-none"
      style="width: calc((100% - 16px) / {CASE_HISTORY_SUBTABS.length}); transform: translateX({activeIndex *
        100}%);"
      aria-hidden="true"
    ></div>
    {#each CASE_HISTORY_SUBTABS as tab (tab.value)}
      {@const isActive = activeSub === tab.value}
      <button
        type="button"
        onclick={() => (activeSub = tab.value)}
        aria-pressed={isActive}
        class="relative z-10 flex h-11 flex-1 items-center justify-center gap-2 rounded-lg"
      >
        {#if tab.value === 'counseling'}
          <Counsel20Icon />
        {:else}
          <span class="inline-flex items-center [&>svg]:h-5 [&>svg]:w-5">
            <AssessmentStack />
          </span>
        {/if}
        <Typography
          variant="body-02-normal-medium"
          color={isActive ? 'text-gray-900' : 'text-gray-500'}
          className="transition-colors duration-200 motion-reduce:transition-none"
        >
          {tab.label}
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color={isActive ? 'text-primary-500' : 'text-gray-400'}
          className="transition-colors duration-200 motion-reduce:transition-none"
        >
          {subCounts[tab.value] ?? '-'}
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
      <div class="flex h-full flex-col items-center justify-center gap-2">
        <Typography variant="body-01-normal-medium" color="text-gray-500">
          담당 상담 · 검사가 없습니다
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          {activeSub === 'counseling'
            ? '담당한 상담이 없어요'
            : '담당한 검사가 없어요'}
        </Typography>
      </div>
    {:else}
      <!-- 아코디언 없는 케이스 카드 목록.
           2열 그리드 규격은 내담자 상세 '진행현황'과 동일 (같은 행 카드는 높이를 맞춘다) -->
      <ul class="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {#each items as item (item.kind + item.caseId)}
          <li class="h-full">
            <MemberCaseHistoryCard
              {item}
              onNavigate={goDetail}
              formatNext={fmtDateTime}
            />
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
