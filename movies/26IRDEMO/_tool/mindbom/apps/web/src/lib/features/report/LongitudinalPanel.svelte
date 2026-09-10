<script lang="ts">
  // 교차분석 패널 — 검사 간 소견 불일치 시각화.
  // ⚠️ 현재 목업 데이터 기반 (mock-longitudinal.ts). 실기능 전환 시 props로 실데이터 주입.
  //
  // 설계 원칙: 서로 다른 검사의 원점수를 하나의 척도로 환산하지 않는다.
  //   - 표준화 검사(규준 보유) → 백분위 레이더로 정량 비교
  //   - 투사적 검사(규준 없음) → 정성 소견으로만 표시
  //   - 불일치 판단은 점수 차가 아니라 임상적 방향(상승 vs 정상)으로 한다
  import {
    ANALYSIS_AXES,
    MOCK_EXAMS,
    computeDiscrepancies,
    axisMean,
    standardizedExams,
    type MockExam
  } from './mock-longitudinal'

  let { compact = false } = $props<{ compact?: boolean }>()

  const exams = MOCK_EXAMS
  const stdExams = standardizedExams(exams)
  const projExams = exams.filter((e) => e.kind === 'projective')
  const discrepancies = computeDiscrepancies(exams)

  // 레이더에 겹칠 검사 — 규준 점수가 있는 표준화 검사만 대상
  let visible = $state<Set<string>>(new Set(stdExams.map((e) => e.id)))
  function toggleExam(id: string) {
    const next = new Set(visible)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    visible = next
  }
  let shownExams = $derived(stdExams.filter((e) => visible.has(e.id)))

  // ── 레이더 기하 ──
  const SIZE = 340
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R = SIZE / 2 - 58
  const N = ANALYSIS_AXES.length

  function angle(i: number): number {
    return (Math.PI * 2 * i) / N - Math.PI / 2
  }
  function pt(i: number, value: number): [number, number] {
    const a = angle(i)
    const r = (value / 100) * R
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r]
  }
  /** 점수가 없는 축은 폴리곤에서 건너뛴다(0으로 찍으면 없는 소견이 생긴다) */
  function polygonFor(ex: MockExam): string {
    return ANALYSIS_AXES.map((ax, i) => {
      const v = ex.scores.find((s) => s.axisKey === ax.key)?.value
      if (v === null || v === undefined) return null
      const [x, y] = pt(i, v)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
      .filter((p): p is string => p !== null)
      .join(' ')
  }
  const RINGS = [25, 50, 75, 100]
  function ringPolygon(level: number): string {
    return ANALYSIS_AXES.map((_, i) => {
      const [x, y] = pt(i, level)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }
  function labelPos(i: number): { x: number; y: number; anchor: string } {
    const a = angle(i)
    const r = R + 26
    const x = CX + Math.cos(a) * r
    const y = CY + Math.sin(a) * r
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
    return { x, y, anchor }
  }

  /**
   * 축 라벨이 viewBox 밖으로 잘리지 않도록 좌우 여백을 계산한다.
   * 축 개수가 바뀌면 라벨 각도가 전부 달라져 잘림 위치도 변하므로
   * 고정값을 쓰지 않고 실제 라벨 폭으로 매번 구한다.
   * (축 6→7개로 늘렸을 때 '자기개념'이 왼쪽으로 12px 잘렸던 이슈)
   */
  const LABEL_FONT = 12
  let padX = $derived.by(() => {
    let overflow = 0
    ANALYSIS_AXES.forEach((ax, i) => {
      const { x, anchor } = labelPos(i)
      const w = ax.label.length * LABEL_FONT
      const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
      const right = left + w
      overflow = Math.max(overflow, -left, right - SIZE)
    })
    return Math.ceil(Math.max(0, overflow)) + 4 // 4px 안전 여유
  })

  // ── 색 사용 규칙 (종합 AI 리뷰 패널과 동일) ──
  // 색은 '불일치 정도'에만 쓴다. 검사별 색(ex.color)은 레이더 차트에서
  // 어느 선이 어느 검사인지 구분하는 정보이므로 예외.
  const SEVERITY_STYLE: Record<
    string,
    { badge: string; text: string; label: string }
  > = {
    high: {
      badge: 'bg-red-500/10 text-sev-high-fg ring-red-500/25',
      text: 'text-sev-high-fg',
      label: '소견 불일치'
    },
    medium: {
      badge: 'bg-orange-500/10 text-sev-medium-fg ring-orange-500/25',
      text: 'text-sev-medium-fg',
      label: '부분 불일치'
    },
    low: {
      badge: 'bg-chrome-sunken text-chrome-fg-2 ring-chrome-line',
      text: 'text-chrome-fg-2',
      label: '일치'
    }
  }

  let topDiscrepancies = $derived(compact ? discrepancies.slice(0, 3) : discrepancies)
  let conflictCount = $derived(discrepancies.filter((d) => d.severity !== 'low').length)
</script>

<div class="space-y-4">
  <!-- ── 요약 헤더 ── -->
  <!-- 그라디언트는 은은하게 — 색으로 정보를 주는 게 아니라 헤더 구분용이다 -->
  <div
    class="rounded-xl bg-linear-to-br from-primary-500/12 to-sky-600/6 px-3.5 py-3 ring-1 ring-chrome-line"
  >
    <div class="flex items-center gap-2">
      <span class="material-icons-round text-[18px] text-chrome-fg-2">insights</span>
      <h3 class="text-body-02-normal-bold text-chrome-fg">검사 간 교차 비교</h3>
      <!-- 숫자는 아래 통계에서 보여주므로 문장에서는 뺀다 -->
      <span class="ml-auto text-label-02-normal-regular text-chrome-fg-2">
        {ANALYSIS_AXES.length}개 구성개념으로 대조
      </span>
    </div>
    <div class="mt-2.5 grid grid-cols-3 gap-1.5">
      <div class="rounded-lg bg-chrome-inset px-2 py-1.5 text-center">
        <p class="text-body-01-normal-bold text-chrome-fg">{exams.length}</p>
        <p class="mt-1 text-label-02-reading-regular text-chrome-fg-2">검사</p>
      </div>
      <div class="rounded-lg bg-chrome-inset px-2 py-1.5 text-center">
        <p class="text-body-01-normal-bold text-sev-medium-fg">
          {conflictCount}
        </p>
        <p class="mt-1 text-label-02-reading-regular text-chrome-fg-2">불일치 영역</p>
      </div>
      <div class="rounded-lg bg-chrome-inset px-2 py-1.5 text-center">
        <p class="text-body-01-normal-bold text-chrome-fg">{stdExams.length}</p>
        <p class="mt-1 text-label-02-reading-regular text-chrome-fg-2">규준 보유</p>
      </div>
    </div>
  </div>

  <!-- ── 레이더 차트 (표준화 검사 전용) ── -->
  <div class="rounded-xl bg-chrome-raised p-3 ring-1 ring-chrome-line">
    <p class="mb-0.5 text-body-03-reading-semibold uppercase tracking-wide text-chrome-fg-2">
      규준 점수 비교
    </p>
    <p class="mb-1.5 text-label-01-reading-regular text-chrome-fg-3">
      규준이 있는 표준화 검사 {stdExams.length}종의 백분위/T점수만 표시합니다.
    </p>
    <svg
      viewBox="{-padX} 0 {SIZE + padX * 2} {SIZE}"
      class="w-full"
      role="img"
      aria-label="표준화 검사 규준 점수 레이더 차트"
    >
      {#each RINGS as lv}
        <polygon
          points={ringPolygon(lv)}
          fill="none"
          stroke="var(--chrome-line)"
          stroke-width={lv === 100 ? 1.2 : 0.7}
          opacity={lv === 100 ? 0.9 : 0.5}
        />
      {/each}
      {#each ANALYSIS_AXES as _, i}
        {@const [x, y] = pt(i, 100)}
        <line
          x1={CX}
          y1={CY}
          x2={x}
          y2={y}
          stroke="var(--chrome-line)"
          stroke-width="0.7"
          opacity="0.5"
        />
      {/each}

      <!-- 규준 평균선 -->
      <polygon
        points={ANALYSIS_AXES.map((ax, i) => {
          const [x, y] = pt(i, axisMean(ax.key, stdExams))
          return `${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')}
        fill="none"
        stroke="#94a3b8"
        stroke-width="1.4"
        stroke-dasharray="4 3"
        opacity="0.7"
      />

      {#each shownExams as ex (ex.id)}
        <polygon
          points={polygonFor(ex)}
          fill={ex.color}
          fill-opacity="0.13"
          stroke={ex.color}
          stroke-width="2.2"
          stroke-linejoin="round"
        />
        {#each ANALYSIS_AXES as ax, i}
          {@const v = ex.scores.find((s) => s.axisKey === ax.key)?.value}
          {#if v !== null && v !== undefined}
            {@const [x, y] = pt(i, v)}
            <circle cx={x} cy={y} r="3" fill={ex.color} />
          {/if}
        {/each}
      {/each}

      {#each ANALYSIS_AXES as ax, i}
        {@const p = labelPos(i)}
        <text
          x={p.x}
          y={p.y}
          text-anchor={p.anchor}
          dominant-baseline="middle"
          fill="var(--chrome-fg-2)"
          style="font-size:12px;font-weight:600"
        >
          {ax.label}
        </text>
      {/each}
    </svg>

    <div class="mt-2 flex flex-wrap gap-1.5">
      {#each stdExams as ex (ex.id)}
        <button
          type="button"
          onclick={() => toggleExam(ex.id)}
          class="flex items-center gap-1.5 rounded-full px-2 py-1 text-label-01-normal-medium ring-1 transition-all {visible.has(ex.id) ? 'bg-chrome-hover text-chrome-fg ring-chrome-line' : 'text-chrome-fg-3 ring-chrome-line hover:text-chrome-fg-2'}"
        >
          <span
            class="h-2 w-2 rounded-full"
            style="background:{visible.has(ex.id)
              ? ex.color
              : 'var(--chrome-line)'}"
          ></span>
          {ex.code}
        </button>
      {/each}
    </div>
    <p class="mt-1.5 text-label-01-reading-regular text-chrome-fg-3">
      점선 = 표준화 검사 평균 · 검사명을 눌러 표시 전환
    </p>

    <!-- 투사적 검사가 왜 차트에 없는지 명시 -->
    <div class="mt-2.5 flex gap-1.5 rounded-lg bg-chrome-sunken p-2">
      <span class="material-icons-round text-[15px] text-chrome-fg-3">info</span>
      <p class="text-label-01-reading-regular text-chrome-fg-2">
        {projExams.map((e) => e.code).join(' · ')}는 규준 점수가 산출되지 않는 투사적
        검사이므로 정량 비교에서 제외하고, 아래에 정성 소견으로 대조합니다.
      </p>
    </div>
  </div>

  <!-- ── 영역별 소견 대조 ── -->
  <div class="space-y-2.5">
    <p class="text-body-03-reading-semibold uppercase tracking-wide text-chrome-fg-2">
      영역별 소견 대조
    </p>
    {#each topDiscrepancies as d (d.axisKey)}
      {@const sev = SEVERITY_STYLE[d.severity]}
      <div class="rounded-xl bg-chrome-raised p-3 ring-1 ring-chrome-line">
        <div class="flex items-center gap-2">
          <span class="text-title-01-normal-bold text-chrome-fg">{d.axisLabel}</span>
          <span class="rounded-full px-1.5 py-0.5 text-label-01-normal-semibold ring-1 {sev.badge}">
            {sev.label}
          </span>
          {#if d.severity !== 'low'}
            <span class="ml-auto text-label-01-normal-semibold {sev.text}">
              {d.elevated.length} : {d.contrary.length}
            </span>
          {/if}
        </div>

        <!-- 소견 있음 vs 정상 범위 — 양쪽 개수가 5:1처럼 비대칭인 축이 많아
             2열로 두면 한쪽만 길어 빈 공간이 생긴다. 폭도 부족해 줄바꿈이 잦다. -->
        <div class="mt-2.5 space-y-1.5">
          <div class="rounded-lg bg-red-500/8 p-2 ring-1 ring-red-500/20">
            <p class="text-label-01-normal-bold text-sev-high-fg">
              소견 있음 ({d.elevated.length})
            </p>
            <div class="mt-2 space-y-1.5">
              {#each d.elevated as f (f.code)}
                <div class="flex min-h-5 items-center gap-1.5">
                  <span
                    class="h-1.5 w-1.5 shrink-0 rounded-full"
                    style="background:{f.color}"
                  ></span>
                  <span class="shrink-0 text-label-01-normal-semibold text-chrome-fg">{f.code}</span>
                  {#if f.value === null}
                    <span class="shrink-0 rounded bg-chrome-hover px-1 text-label-02-normal-regular text-chrome-fg-2">
                      정성
                    </span>
                  {/if}
                  <!-- 폭이 넉넉해졌으므로 원 척도 표기를 우측 정렬 -->
                  <span class="ml-auto truncate text-right text-label-01-normal-regular text-chrome-fg-2">
                    {f.raw}
                  </span>
                </div>
              {/each}
            </div>
          </div>
          <!-- 정상 범위는 문제 신호가 아니므로 무채색 -->
          <div class="rounded-lg bg-chrome-sunken p-2 ring-1 ring-chrome-line">
            <p class="text-label-01-normal-bold text-chrome-fg-2">
              정상 범위 ({d.contrary.length})
            </p>
            <div class="mt-2 space-y-1.5">
              {#each d.contrary as f (f.code)}
                <div class="flex min-h-5 items-center gap-1.5">
                  <span
                    class="h-1.5 w-1.5 shrink-0 rounded-full"
                    style="background:{f.color}"
                  ></span>
                  <span class="shrink-0 text-label-01-normal-semibold text-chrome-fg">{f.code}</span>
                  {#if f.value === null}
                    <span class="shrink-0 rounded bg-chrome-hover px-1 text-label-02-normal-regular text-chrome-fg-2">
                      정성
                    </span>
                  {/if}
                  <span class="ml-auto truncate text-right text-label-01-normal-regular text-chrome-fg-2">
                    {f.raw}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- 규준 점수가 있는 검사만 정량 막대 -->
        {#if d.quantitative.length >= 2}
          <div class="mt-2.5 space-y-1.5 rounded-lg bg-chrome-sunken p-2">
            <p class="text-label-02-normal-semibold uppercase tracking-wide text-chrome-fg-3">
              규준 점수 (백분위)
            </p>
            {#each d.quantitative as f (f.code)}
              <div class="flex min-h-5 items-center gap-2">
                <span class="w-20 shrink-0 truncate text-label-01-normal-regular text-chrome-fg-2">{f.code}</span>
                <div class="relative h-2.5 flex-1 overflow-hidden rounded-full bg-chrome-sunken">
                  <div
                    class="h-full rounded-full"
                    style="width:{f.value}%;background:{f.color}"
                  ></div>
                </div>
                <span
                  class="w-7 shrink-0 text-right text-label-01-normal-semibold tabular-nums text-chrome-fg-2"
                >
                  {f.value}
                </span>
              </div>
            {/each}
          </div>
        {/if}

        {#if d.note}
          <div class="mt-2 flex gap-1.5 rounded-lg bg-chrome-sunken p-2 ring-1 ring-chrome-line">
            <span class="material-icons-round text-[16px] text-chrome-fg-2">psychology</span>
            <p class="text-label-01-reading-regular text-chrome-fg-2">{d.note}</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <p class="pb-2 text-center text-label-01-reading-regular text-chrome-fg-3">
    AI 교차분석은 보조 자료이며 최종 해석은 임상가의 판단에 따릅니다.
  </p>
</div>
