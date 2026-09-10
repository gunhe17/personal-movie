<script lang="ts">
  /**
   * 검사 활동 히트맵 — GitHub 잔디 형태.
   *
   * 세로 7칸(요일) × 가로 N주. 그 날 검사가 많을수록 진해진다.
   *
   * 이 자리에 있던 '단계별 평균 소요 시간'을 대체한다. 그 차트는 상태 전이
   * 타임스탬프가 없어 `now - started_at`(= 아직 안 끝난 검사가 방치된 시간)을
   * "소요 시간"이라 부르고 있었다. 아무도 아무것도 안 해도 내일 숫자가 커지고,
   * 완료군의 실제 소요 시간과 나란히 놓여 서로 비교되지 않는 값을 비교하게
   * 만들었다. 반면 일별 건수는 근사가 아니라 실측이고 해석의 여지가 없다.
   *
   * 기준 시각은 scheduled_at 하나다 — 서버 날짜 필터·타임라인과 같은 규약이다.
   * 다른 컬럼을 쓰면 대시보드 안에서 "타임라인엔 있는데 잔디엔 없는" 날이 생긴다.
   *
   * 예전에는 COALESCE(scheduled_at, created_at)를 썼다("앵커"). 그러면 검사일을
   * 정하지 않고 등록한 검사가 등록일에 찍혀, 아무도 그 날로 잡은 적 없는 날에
   * 잔디가 자랐다. 일정이 없으면 놓을 자리도 없는 것으로 남긴다.
   * 자세한 경위는 docs/온톨로지/앵커개념-제거.md.
   */
  import type { ExaminationApiItem } from '$features/timeline/types'

  interface Props {
    items: ExaminationApiItem[]
    /** 오늘 기준 며칠치를 볼지 — 폭에 맞춰 호출부가 줄일 수 있다 */
    weeks?: number
    now?: Date
  }

  let { items, weeks = 26, now = new Date() }: Props = $props()

  const DAY_MS = 86_400_000
  const KOREAN_DOW = ['일', '월', '화', '수', '목', '금', '토']

  function startOfDay(d: Date): Date {
    const s = new Date(d)
    s.setHours(0, 0, 0, 0)
    return s
  }

  function ymd(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  /** 날짜별 건수 — 서버 필터·타임라인과 같은 컬럼(scheduled_at)을 쓴다 */
  let countsByDay = $derived.by(() => {
    const map = new Map<string, number>()
    for (const e of items) {
      // 일정이 없으면 찍을 날이 없다 — created_at으로 대신하지 않는다.
      if (!e.scheduled_at) continue
      const d = new Date(e.scheduled_at)
      if (isNaN(d.getTime())) continue
      const key = ymd(d)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  })

  /**
   * 격자 — 왼쪽이 과거, 오른쪽 끝이 이번 주. 각 열은 일요일 시작 한 주.
   *
   * 미래 날짜도 칸을 그린다. 예정된 검사(scheduled_at)가 앞날에 잡혀 있고
   * 그게 이 잔디의 기준 시각이라, 미래를 비워 두면 "내일 3건 예정"이 보이지
   * 않는다 — 마지막 주 오른쪽이 뚫린 것처럼 보이기도 한다.
   * 대신 오늘 이후는 isFuture로 표시해 옅은 테두리만 준다(아직 지나지 않은
   * 날과 '0건으로 끝난 날'을 구분한다).
   */
  interface Cell {
    date: Date
    count: number
    isFuture: boolean
  }

  let grid = $derived.by(() => {
    const today = startOfDay(now)
    // 이번 주 일요일
    const thisSunday = new Date(today.getTime() - today.getDay() * DAY_MS)
    const cols: Cell[][] = []

    for (let w = weeks - 1; w >= 0; w--) {
      const sunday = new Date(thisSunday.getTime() - w * DAY_MS * 7)
      const col: Cell[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(sunday.getTime() + d * DAY_MS)
        col.push({
          date,
          count: countsByDay.get(ymd(date)) ?? 0,
          isFuture: date.getTime() > today.getTime()
        })
      }
      cols.push(col)
    }
    return cols
  })

  let maxCount = $derived(
    grid.flat().reduce((m, c) => (c.count > m ? c.count : m), 0)
  )

  /**
   * 농도 5단계. 최댓값 기준 비율로 나눈다 — 고정 임계값(1·3·5건…)을 쓰면
   * 기관 규모에 따라 전부 옅거나 전부 진해진다.
   */
  function levelOf(count: number): 0 | 1 | 2 | 3 | 4 {
    if (count === 0) return 0
    if (maxCount <= 1) return 4
    const r = count / maxCount
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  }

  /** primary 램프를 그대로 쓴다 — 이 제품의 활동량은 초록이 아니라 파랑이다 */
  const LEVEL_CLASS = [
    'bg-gray-100',
    'bg-primary-100',
    'bg-primary-300',
    'bg-primary-500',
    'bg-primary-700'
  ] as const

  /** 열 위 월 라벨 — 그 달이 처음 나오는 주에만 */
  let monthLabels = $derived.by(() => {
    const out: Array<{ index: number; label: string }> = []
    let prev = -1
    grid.forEach((col, i) => {
      const m = col[0].date.getMonth()
      if (m !== prev) {
        out.push({ index: i, label: `${m + 1}월` })
        prev = m
      }
    })
    return out
  })

  let total = $derived(grid.flat().reduce((sum, c) => sum + c.count, 0))
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2">
  <!--
    격자 — 열(주)을 가로로 흘린다. 칸 크기를 px로 고정하지 않고
    minmax(0,1fr)로 두어 카드 폭에 맞춰 함께 줄어든다.
  -->
  <div class="flex min-h-0 flex-1 flex-col justify-center gap-1">
    <!-- 월 라벨 -->
    <div
      class="grid gap-0.5 pl-6 text-caption-01-normal-regular text-gray-400"
      style="grid-template-columns: repeat({weeks}, minmax(0, 1fr))"
    >
      {#each grid as _, i (i)}
        {@const label = monthLabels.find((m) => m.index === i)}
        <span class="truncate">{label?.label ?? ''}</span>
      {/each}
    </div>

    <div class="flex gap-1">
      <!-- 요일 라벨 — 월·수·금만 (7개 다 쓰면 칸보다 글자가 커진다) -->
      <div class="flex w-5 shrink-0 flex-col gap-0.5">
        {#each KOREAN_DOW as dow, i (dow)}
          <span
            class="flex flex-1 items-center text-caption-01-normal-regular text-gray-400"
          >
            {i === 1 || i === 3 || i === 5 ? dow : ''}
          </span>
        {/each}
      </div>

      <div
        class="grid min-w-0 flex-1 gap-0.5"
        style="grid-template-columns: repeat({weeks}, minmax(0, 1fr))"
      >
        {#each grid as col, w (w)}
          <div class="flex flex-col gap-0.5">
            {#each col as cell, d (d)}
              <!--
                아직 지나지 않은 날은 0건이어도 옅은 테두리로 둔다 —
                회색으로 칠하면 '그날 아무 일도 없었다'로 읽히는데, 사실은
                아직 오지 않은 날이다. 예정된 검사가 있으면 정상 농도로 칠한다.
              -->
              <div
                class="aspect-square w-full rounded-sm {cell.isFuture &&
                cell.count === 0
                  ? 'border border-dashed border-gray-200'
                  : LEVEL_CLASS[levelOf(cell.count)]}"
                title="{cell.date.getMonth() + 1}월 {cell.date.getDate()}일 ({KOREAN_DOW[
                  d
                ]}) · 검사 {cell.count}건{cell.isFuture ? ' 예정' : ''}"
              ></div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- 범례 -->
  <div
    class="flex shrink-0 items-center justify-between text-caption-01-normal-regular text-gray-400"
  >
    <span>최근 {weeks}주 · 총 {total}건</span>
    <span class="flex items-center gap-1">
      적음
      {#each LEVEL_CLASS as cls (cls)}
        <span class="h-2.5 w-2.5 rounded-xs {cls}"></span>
      {/each}
      많음
    </span>
  </div>
</div>
