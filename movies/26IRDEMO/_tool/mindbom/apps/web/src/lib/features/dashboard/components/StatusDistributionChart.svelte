<script lang="ts">
  /**
   * 상태별 분포 도넛.
   *
   * 색은 EXAM_STATUS_VISUAL.hex 단일 출처를 쓴다 — 예전엔 이 파일이 자체 hex 표를
   * 들고 있어서 dotClass와 수동 동기화해야 했고, 실제로 값이 어긋나 있었다.
   *
   * 높이는 컨테이너를 따른다(고정 px 금지). 대시보드가 한 화면에 들어가야 하므로
   * 도넛이 남는 공간을 받아 스스로 줄어들 수 있어야 한다.
   */
  import { goto } from '$app/navigation'
  import type { ExamStatus } from '$features/timeline/types'
  import { EXAM_STATUS_VISUAL } from '$features/examination/common/exam-visual'
  import type { DashboardStats } from '$features/dashboard/dashboard-service'
  import { statsToCounts } from '$features/dashboard/dashboard-service'

  interface Props {
    stats: DashboardStats | null
  }

  let { stats }: Props = $props()

  /** 해당 상태로 필터링된 검사 목록으로 이동 */
  function openStatus(status: ExamStatus) {
    goto(`/examinations?status=${status}`)
  }

  /**
   * 표시 순서 — 상태 머신 그대로다. 조각 하나가 상태 하나에 대응한다.
   *
   * 예전에는 confirmed를 report_generated 조각에 합쳐 '완료군' 하나로 묶고,
   * "목록의 '완료' 필터가 이들을 함께 거른다"를 근거로 삼았다. 그런데 목록
   * 필터는 EXAM_STATUS_ORDER에서 파생돼 **상태별로 따로** 거른다 — 그런
   * 필터는 없다. 그래서 조각을 클릭해 `?status=report_generated`로 넘어가면
   * 화면의 건수가 조각의 숫자보다 적었다(confirmed만큼 차이).
   *
   * 합계가 필요하면 doneCount()가 따로 있다. 도넛은 드릴다운 대상이므로
   * 클릭해 도착한 화면과 숫자가 같아야 한다.
   */
  const ORDER: ExamStatus[] = [
    'created',
    'in_progress',
    'ai_draft_ready',
    'under_review',
    'confirmed',
    'report_generated'
  ]

  let counts = $derived.by((): Record<ExamStatus, number> => {
    if (!stats) {
      return {
        created: 0,
        in_progress: 0,
        ai_draft_ready: 0,
        under_review: 0,
        confirmed: 0,
        report_generated: 0,
        completed: 0
      }
    }
    return statsToCounts(stats)
  })

  /**
   * 과거 completed 건수 — 도넛에는 조각으로 넣지 않는다.
   *
   * 상태 머신에서 빠진 값이라 ORDER에 두면 "만들어질 수 있는 상태"처럼
   * 보인다. 그렇다고 버리면 집계에서 조용히 사라지므로, 있을 때만 범례
   * 아래에 따로 알린다(대개 0이다).
   */
  let legacyDone = $derived(stats?.completed ?? 0)

  let total = $derived(stats?.total ?? 0)

  const RADIUS = 68
  const STROKE = 22
  const HOVER_BUMP = 5
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  /** 조각 사이 간격 — 인접한 색이 붙어 한 덩어리로 읽히는 걸 막는다 */
  const GAP = 1.5

  let slices = $derived.by(() => {
    if (total === 0) return []
    let cumulative = 0
    return ORDER.map((status) => {
      const count = counts[status]
      const fraction = count / total
      const arcLength = Math.max(fraction * CIRCUMFERENCE - GAP, 0.5)
      const offset = -cumulative * CIRCUMFERENCE
      cumulative += fraction
      return {
        status,
        count,
        color: EXAM_STATUS_VISUAL[status].hex,
        arcLength,
        offset
      }
    }).filter((s) => s.count > 0)
  })

  // 라벨은 EXAM_STATUS_VISUAL 하나에서만 온다 — 여기서 문구를 다시 적지 않는다.
  const labelOf = (status: ExamStatus) => EXAM_STATUS_VISUAL[status].label

  let legend = $derived(
    ORDER.map((status) => ({
      status,
      count: counts[status],
      label: labelOf(status),
      visual: EXAM_STATUS_VISUAL[status]
    })).filter((l) => l.count > 0)
  )

  let hovered = $state<ExamStatus | null>(null)

  /** 중앙 표시 — 호버 중이면 해당 상태, 아니면 전체 건수 */
  let center = $derived.by(() => {
    if (hovered == null) {
      return { primary: String(total), label: '전체 검사', sub: '' }
    }
    const count = counts[hovered]
    const percent = total > 0 ? (count / total) * 100 : 0
    // 호버 시 클릭하면 목록으로 간다는 걸 비율 자리에서 알린다
    return {
      primary: String(count),
      label: labelOf(hovered),
      sub: `${percent.toFixed(0)}% · 목록 보기`
    }
  })
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
  <!--
    도넛 — 남는 세로 공간을 받아 스스로 줄어든다.

    ⚠️ min-h로 바닥을 강제하지 않는다. 부모가 그보다 좁으면 그대로 넘쳐
       카드 밖으로 나간다(실제로 그랬다). 세로가 부족한 문제는 여기서
       크기를 지정해 풀 수 없다 — 대시보드가 lg 미만에서 페이지 스크롤을
       허용하도록 바깥에서 고쳤다.
    max-w-full은 폭 상한 — viewBox가 정사각이라 비율은 유지된다.
  -->
  <div class="flex min-h-0 min-w-0 flex-1 items-center justify-center">
    {#if total === 0}
      <p class="text-body-03-reading-regular text-gray-400">표시할 검사가 없습니다</p>
    {:else}
      <svg
        viewBox="0 0 200 200"
        class="h-full max-h-55 w-auto max-w-full"
        onmouseleave={() => (hovered = null)}
        role="img"
        aria-label="검사 상태별 분포"
      >
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="#f3f4f6"
          stroke-width={STROKE}
          pointer-events="none"
        />

        {#each slices as s (s.status)}
          {@const isHover = hovered === s.status}
          {@const dim = hovered != null && !isHover}
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke={s.color}
            stroke-width={isHover ? STROKE + HOVER_BUMP : STROKE}
            stroke-dasharray="{s.arcLength} {CIRCUMFERENCE}"
            stroke-dashoffset={s.offset}
            stroke-linecap="butt"
            transform="rotate(-90 100 100)"
            opacity={dim ? 0.3 : 1}
            style="cursor: pointer; transition: stroke-width 150ms ease, opacity 150ms ease"
            pointer-events="visibleStroke"
            onmouseenter={() => (hovered = s.status)}
            onclick={() => openStatus(s.status)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openStatus(s.status)
              }
            }}
            role="button"
            tabindex="0"
            aria-label="{labelOf(s.status)} {s.count}건 — 목록 보기"
          ></circle>
        {/each}

        <!-- 중앙 — 기본은 전체 건수, 호버 시 해당 상태로 교체 -->
        <text
          x="100"
          y={center.sub ? 96 : 103}
          text-anchor="middle"
          font-size="26"
          font-weight="700"
          fill="#111827"
          style="pointer-events: none; font-variant-numeric: tabular-nums"
          >{center.primary}</text
        >
        <text
          x="100"
          y={center.sub ? 112 : 118}
          text-anchor="middle"
          font-size="11"
          fill="#6b7280"
          style="pointer-events: none">{center.label}</text
        >
        {#if center.sub}
          <text
            x="100"
            y="126"
            text-anchor="middle"
            font-size="10"
            fill="#9ca3af"
            style="pointer-events: none">{center.sub}</text
          >
        {/if}
      </svg>
    {/if}
  </div>

  <!-- 범례 — 값이 있는 상태만. 도넛과 호버 연동 -->
  {#if legend.length > 0}
    <div class="flex shrink-0 flex-wrap gap-x-4 gap-y-1.5">
      {#each legend as l (l.status)}
        {@const isHover = hovered === l.status}
        <a
          href="/examinations?status={l.status}"
          onmouseenter={() => (hovered = l.status)}
          onmouseleave={() => (hovered = null)}
          class="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-all hover:bg-gray-100 {hovered !=
            null && !isHover
            ? 'opacity-40'
            : ''}"
        >
          <span class="h-2 w-2 shrink-0 rounded-full {l.visual.dotClass}"></span>
          <span class="text-label-01-normal-regular text-gray-600">{l.label}</span>
          <span class="text-label-01-normal-semibold tabular-nums text-gray-900"
            >{l.count}</span
          >
        </a>
      {/each}

      <!--
        과거 completed는 도넛 조각으로 넣지 않지만(상태 머신에서 빠진 값이라
        "만들어질 수 있는 상태"처럼 보인다) 집계에서 조용히 사라지게 두지도
        않는다. 있을 때만 뜬다 — 대개 0이다.
      -->
      {#if legacyDone > 0}
        <a
          href="/examinations?status=completed"
          class="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-all hover:bg-gray-100"
          title="상태 머신에서 제외된 과거 데이터입니다"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full {EXAM_STATUS_VISUAL.completed
              .dotClass}"
          ></span>
          <span class="text-label-01-normal-regular text-gray-500"
            >{EXAM_STATUS_VISUAL.completed.label}</span
          >
          <span class="text-label-01-normal-semibold tabular-nums text-gray-500"
            >{legacyDone}</span
          >
        </a>
      {/if}
    </div>
  {/if}
</div>
