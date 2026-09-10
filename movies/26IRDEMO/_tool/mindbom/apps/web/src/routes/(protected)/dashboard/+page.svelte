<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { institutionId, requireInstitutionId } from '$stores/institution.store'
  import { postRaw } from '$lib/services/api/instances'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import ExamCreateModal from '$features/examination/common/components/ExamCreateModal.svelte'
  import { fetchTimelineExams, dayWindow } from '$features/timeline/services'
  import { startOfDay, addDays } from '$features/timeline/day-view'
  import { examinationsToTimeline } from '$features/timeline/transforms'
  import type { ExaminationApiItem, TimelineItem } from '$features/timeline/types'
  import TimelineCanvas from '$features/timeline/components/TimelineCanvas.svelte'
  import TimelineList from '$features/timeline/components/TimelineList.svelte'
  import TimelineToolbar from '$features/timeline/components/TimelineToolbar.svelte'
  import StatCard from '$features/dashboard/components/StatCard.svelte'
  import StatusDistributionChart from '$features/dashboard/components/StatusDistributionChart.svelte'
  import ActivityHeatmap from '$features/dashboard/components/ActivityHeatmap.svelte'
  import { examProgressPath } from '$features/examination/common/exam-route'
  import { EXAM_STATUS_VISUAL } from '$features/examination/common/exam-visual'
  import {
    fetchDashboardStats,
    type DashboardStats
  } from '$features/dashboard/dashboard-service'

  let loading = $state(true)
  let error = $state<string | null>(null)
  let rawItems = $state<ExaminationApiItem[]>([])
  let timeline = $state<TimelineItem[]>([])
  let stats = $state<DashboardStats | null>(null)
  let statsError = $state<string | null>(null)
  let loadedFor = $state<string | null>(null)

  /** 타임라인이 보고 있는 날짜 (0시로 정규화) */
  let viewDay = $state(startOfDay(new Date()))

  /**
   * 활동 히트맵용 표본 — 타임라인과 분리해서 들고 있다.
   *
   * 타임라인이 하루치만 받으므로 rawItems로는 추세를 못 그린다. 날짜 화살표를
   * 누를 때마다 잔디가 흔들려서도 안 된다 — 잔디는 특정 날짜의 지표가 아니라
   * 최근 구간의 분포다.
   */
  let activitySample = $state<ExaminationApiItem[]>([])

  /** 잔디에 그릴 주 수 — 조회 구간과 반드시 같이 움직여야 한다 */
  const HEATMAP_WEEKS = 26

  // 모든 지표는 서버 집계(기관 전체 기준)를 쓴다.
  // 목록 일부(최근 50건)에서 세면 그 범위 밖의 건이 빠져 목록 페이지 숫자와 어긋난다.

  // institutionId 는 (protected) layout 의 /api/auth/check 응답으로
  // 비동기 hydrate 됨. onMount 에서 동기 조회 시 race 가 발생하므로
  // $effect 로 값이 들어오면 자동 로드.
  $effect(() => {
    const inst = $institutionId
    if (!inst || loadedFor === inst) return
    loadedFor = inst
    load(inst)
  })

  async function load(inst: string) {
    loading = true
    error = null
    statsError = null

    // 둘을 Promise.all로 묶으면 한쪽 실패가 다른 쪽까지 죽인다.
    // 집계가 실패해도 타임라인은 보여야 하므로 개별로 처리한다.
    // 카드·도넛 숫자는 목록이 아니라 서버 집계(stats)에서 온다.
    // 잔디가 그리는 구간과 조회 구간을 같은 값에서 파생시킨다 — 따로 적으면
    // 주 수만 늘렸을 때 왼쪽이 조용히 빈 채로 그려진다.
    // 앞뒤로 7일 여유: 뒤는 이번 주 일요일까지 거슬러 올라가는 몫,
    // 앞은 이번 주 남은 요일(예정된 검사가 잔디에 찍히려면 조회돼야 한다).
    const recent = {
      from: addDays(startOfDay(new Date()), -(HEATMAP_WEEKS * 7 + 7)),
      to: addDays(startOfDay(new Date()), 8)
    }
    const [listRes, statsRes, activityRes] = await Promise.allSettled([
      fetchTimelineExams(inst, dayWindow(viewDay)),
      fetchDashboardStats(inst),
      fetchTimelineExams(inst, recent)
    ])

    if (listRes.status === 'fulfilled') {
      rawItems = listRes.value.items
      timeline = examinationsToTimeline(listRes.value.items)
    } else {
      error =
        listRes.reason instanceof Error
          ? listRes.reason.message
          : '검사 목록을 불러오지 못했습니다.'
    }

    if (statsRes.status === 'fulfilled') {
      stats = statsRes.value
    } else {
      console.error('[dashboard] 집계 조회 실패', statsRes.reason)
      statsError = '집계를 불러오지 못했습니다.'
    }

    if (activityRes.status === 'fulfilled') {
      activitySample = activityRes.value.items
    } else {
      console.error('[dashboard] 활동 표본 조회 실패', activityRes.reason)
    }

    loading = false
  }

  function handleItemClick(id: string) {
    const item = rawItems.find((i) => i.id === id)
    if (!item) return
    goto(examProgressPath(item.id, item.exam_type))
  }

  // ── 날짜 이동 ──
  // 하루치만 보므로 날짜가 바뀌면 그 날 것만 새로 받는다.
  // 화살표를 연타하면 응답이 순서 없이 도착할 수 있어, 마지막 요청의
  // 결과만 반영하도록 토큰으로 거른다.
  let dayRequestToken = 0

  async function loadDay(day: Date) {
    const inst = $institutionId
    if (!inst) return

    const token = ++dayRequestToken
    try {
      const res = await fetchTimelineExams(inst, dayWindow(day))
      if (token !== dayRequestToken) return // 더 최신 요청이 있다 — 버린다
      rawItems = res.items
      timeline = examinationsToTimeline(res.items)
      error = null
    } catch (e) {
      if (token !== dayRequestToken) return
      console.error('[dashboard] 날짜 조회 실패', e)
      error = '검사 목록을 불러오지 못했습니다.'
    }
  }

  function goToDay(day: Date) {
    viewDay = startOfDay(day)
    loadDay(viewDay)
  }

  /**
   * 새 검사 등록 모달.
   *
   * 검사 목록 페이지와 같은 모달·같은 등록 규칙(단일/배터리)을 쓴다.
   * 등록 후에는 보고 있는 날짜와 집계를 다시 받는다 — 등록한 검사가
   * 오늘이 아닌 날로 예정될 수 있어 타임라인만 갱신하면 카드 숫자가 어긋난다.
   */
  function openCreateModal() {
    modalStore.open({
      component: ExamCreateModal,
      props: {
        onConfirm: async (data: {
          client_id: string
          examiner_id: string
          exam_types: string[]
          scheduled_at?: string
          note?: string
        }) => {
          const instId = requireInstitutionId()
          const { exam_types, ...rest } = data

          if (exam_types.length <= 1) {
            await postRaw(`/institutions/${instId}/examinations`, {
              ...rest,
              exam_type: exam_types[0]
            })
            snackbarStore.success('검사가 등록되었습니다.')
          } else {
            await postRaw(`/institutions/${instId}/examinations/battery`, {
              ...rest,
              exam_types
            })
            snackbarStore.success(`${exam_types.length}개 검사가 등록되었습니다.`)
          }

          // 등록한 검사가 예정된 날로 옮겨 가서 바로 확인할 수 있게 한다
          if (rest.scheduled_at) {
            viewDay = startOfDay(new Date(rest.scheduled_at))
          }
          await Promise.all([loadDay(viewDay), reloadStats(instId)])
        }
      },
      options: { size: 'md' }
    })
  }

  /** 집계만 다시 받는다 (등록 직후 카드 숫자 갱신용) */
  async function reloadStats(inst: string) {
    try {
      stats = await fetchDashboardStats(inst)
      statsError = null
    } catch (e) {
      console.error('[dashboard] 집계 갱신 실패', e)
    }
  }

  /**
   * 타임라인 막대 영역 높이.
   * 대시보드는 한 화면에 들어가야 하므로 세로 예산을 고정으로 잡고,
   * 남는 공간은 위쪽 차트가 flex로 가져간다.
   */
  const TIMELINE_HEIGHT = 200
  /** TimelineAxis의 h-12 — 목록 높이를 타임라인 전체(본문+축)에 맞춘다 */
  const AXIS_HEIGHT = 48

  /** 목록↔타임라인 상호 강조 (둘 중 어디에 호버해도 반대편이 켜진다) */
  let hoveredId = $state<string | null>(null)

  let today = $derived(
    new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(new Date())
  )
</script>

<!--
  🔴 한 화면 고정은 lg 이상에서만.
     상단(제목·카드)은 고정 높이, 아래 차트/타임라인이 남는 공간을 flex로 배분한다.

     lg 미만에서는 이 규칙을 풀고 페이지가 스크롤하게 둔다. 태블릿에서는
     차트 2단이 1열로 쌓이면서 세로 요구가 두 배가 되는데, h-full로 묶어 두면
     그 요구가 각 카드에 눌려 도넛이 90px까지 쪼그라들었다. 세로가 부족한 게
     원인이므로 크기를 억지로 지정해 봐야 이번엔 카드 밖으로 삐져나온다
     — 스크롤을 허용하는 게 진짜 해법이다.
-->
<div
  in:fade
  class="flex flex-col gap-4 p-4 md:p-6 lg:h-full lg:min-h-0 lg:p-8"
>
  <!-- 헤더 -->
  <div class="flex shrink-0 items-end justify-between gap-4">
    <div>
      <h1 class="text-headline-01-normal-bold text-gray-900">대시보드</h1>
      <p class="mt-1 text-body-03-reading-regular text-gray-500">{today}</p>
    </div>

    {#if (stats?.stale_reviews ?? 0) > 0}
      <a
        href="/examinations?status=under_review"
        class="flex shrink-0 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 transition-colors hover:bg-orange-100"
      >
        <span class="material-icons-round text-[18px]! leading-none text-orange-500"
          >warning</span
        >
        <span class="text-label-01-normal-medium text-orange-800">
          5일 이상 미검토 <span class="font-bold">{(stats?.stale_reviews ?? 0)}</span>건
        </span>
        <span class="material-icons-round text-[18px]! leading-none text-orange-400"
          >chevron_right</span
        >
      </a>
    {/if}
  </div>

  {#if statsError}
    <div
      class="flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
    >
      <span class="material-icons-round text-[18px]! leading-none text-red-500"
        >error_outline</span
      >
      <span class="text-label-01-normal-medium text-red-700">{statsError}</span>
      <button
        type="button"
        onclick={() => {
          const inst = $institutionId
          if (inst) load(inst)
        }}
        class="ml-auto text-label-01-normal-medium text-red-700 underline"
      >
        다시 시도
      </button>
    </div>
  {/if}

  <!-- 요약 카드 — 계산해두고 화면에 없던 지표들 -->
  <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
    <StatCard
      label="오늘 예정"
      value={stats?.today_scheduled ?? 0}
      icon="event"
      accent={EXAM_STATUS_VISUAL.created.hex}
      href="/examinations?status=created"
    />
    <StatCard
      label="진행 중"
      value={stats?.in_progress ?? 0}
      icon="autorenew"
      accent={EXAM_STATUS_VISUAL.in_progress.hex}
      href="/examinations?status=in_progress"
    />
    <StatCard
      label="검토 필요"
      value={stats?.under_review ?? 0}
      icon="rate_review"
      accent={EXAM_STATUS_VISUAL.under_review.hex}
      alert={(stats?.stale_reviews ?? 0) > 0}
      href="/examinations?status=under_review"
    />
    <StatCard
      label="이번 주 완료"
      value={stats?.week_completed ?? 0}
      icon="task_alt"
      accent={EXAM_STATUS_VISUAL.completed.hex}
      href="/examinations?status=completed"
    />
  </div>

  <!--
    차트 2단 — lg 이상에서만 남는 세로를 나눠 갖는다.
    lg 미만에서는 1열로 쌓이므로 각 카드가 내용에 맞는 높이(min-h-72=288)를
    갖고, 페이지가 스크롤한다.
  -->
  <div class="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-5">
    <section
      class="flex min-h-72 flex-col rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2 lg:min-h-0"
    >
      <h2 class="mb-2 shrink-0 text-body-02-normal-semibold text-gray-900">상태별 분포</h2>
      <StatusDistributionChart {stats} />
    </section>

    <section
      class="flex min-h-72 flex-col rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-3 lg:min-h-0"
    >
      <h2 class="mb-2 shrink-0 text-body-02-normal-semibold text-gray-900">
        검사 활동
      </h2>
      <ActivityHeatmap items={activitySample} weeks={HEATMAP_WEEKS} />
    </section>
  </div>

  <!-- 검사 일정 -->
  <section
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white"
  >
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
      <div class="flex items-center gap-3">
        <h2 class="text-body-02-normal-semibold text-gray-900">검사 일정</h2>
        <!-- 날짜 컨트롤을 헤더로 올린다 — 아래가 목록/타임라인 둘로 나뉘어
             어느 한쪽에 붙이면 다른 쪽과 어긋난다 -->
        {#if !loading && !error}
          <TimelineToolbar day={viewDay} onDayChange={goToDay} />
        {/if}
      </div>
      <a
        href="/examinations"
        class="text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700"
      >
        전체 보기
      </a>
    </div>

    {#if loading}
      <div class="flex items-center justify-center" style="height: {TIMELINE_HEIGHT}px">
        <div
          class="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600"
        ></div>
      </div>
    {:else if error}
      <div
        class="flex flex-col items-center justify-center gap-2"
        style="height: {TIMELINE_HEIGHT}px"
      >
        <p class="text-body-03-reading-regular text-red-600">{error}</p>
        <button
          type="button"
          onclick={() => {
            const inst = $institutionId
            if (inst) load(inst)
          }}
          class="rounded-lg border border-gray-300 px-4 py-1.5 text-label-01-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          다시 시도
        </button>
      </div>
    {:else}
      <!--
        좌: 시간순 목록 / 우: 가로 타임라인.
        같은 items·day를 공유한다 — 목록이 자기 데이터를 따로 불러오면
        두 화면이 어긋나도 아무도 모른다.
        호버는 양방향으로 연결해 "목록의 이 건이 하루 중 어디쯤인지"를 잇는다.
        좁은 화면(lg 미만)에서는 목록을 감춘다 — 세로로 쌓으면 대시보드가
        지나치게 길어지고, 타임라인만으로도 하루 파악은 된다.
      -->
      <div class="flex border-t border-gray-200">
        <div class="hidden w-65 shrink-0 border-r border-gray-200 lg:block">
          <TimelineList
            items={timeline}
            day={viewDay}
            onItemClick={handleItemClick}
            {hoveredId}
            onHover={(id) => (hoveredId = id)}
            height={TIMELINE_HEIGHT + AXIS_HEIGHT}
          />
        </div>

        <div class="relative min-w-0 flex-1">
          <!-- 날짜 전환에는 로딩 바를 두지 않는다 — 하루치 조회는 순식간에 끝나서
               막대가 스쳐 지나가듯 깜빡이기만 하고 정보를 주지 못한다. -->
          <TimelineCanvas
            items={timeline}
            day={viewDay}
            onItemClick={handleItemClick}
            onDayChange={goToDay}
            onCreateExam={openCreateModal}
            bodyHeight={TIMELINE_HEIGHT}
            {hoveredId}
            onHover={(id) => (hoveredId = id)}
            hideToolbar
          />
        </div>
      </div>
    {/if}
  </section>
</div>
