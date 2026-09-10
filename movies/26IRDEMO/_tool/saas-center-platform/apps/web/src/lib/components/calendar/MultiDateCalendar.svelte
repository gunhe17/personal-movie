<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import ChevronIcon from '../../assets/ChevronIcon.svelte'
  import { slide } from 'svelte/transition'
  import { cubicInOut } from 'svelte/easing'

  interface Props {
    selectedDates: Date[]
    onToggleDate: (date: Date) => void
    singleDate?: boolean
    /** 기존 일정 등 하이라이트 표시용 날짜 (bg-primary-100) */
    highlightedDates?: Date[]
    /** 과거 날짜 선택 비활성 (일정 등록/변경은 미래만) */
    disablePast?: boolean
    /** 날짜 셀 한 변(px). 좌측 컬럼 폭에 맞춰 호출부가 정한다 —
        한 줄 폭 = 7*cellSize + 6*4 이므로 컨테이너가 이보다 좁으면 넘친다 */
    cellSize?: number
    /** 접힘 — 월 네비게이션만 남기고 날짜 그리드를 감춘다 */
    collapsed?: boolean
    /** 헤더 클릭으로 접기/펼치기 (미전달 시 토글 UI 없음) */
    onToggleCollapsed?: () => void
    /** 날짜 그리드 영역의 최소 높이(px 문자열). 6주 월에서도 높이가 튀지 않게 예약한다.
        접힘 애니메이션의 주체가 slide 하나가 되도록 바깥이 아니라 여기(접히는 블록)에 건다 */
    gridMinHeight?: string | null
  }

  let {
    selectedDates,
    onToggleDate,
    singleDate = false,
    highlightedDates = [],
    disablePast = false,
    cellSize = 40,
    collapsed = false,
    onToggleCollapsed,
    gridMinHeight = null
  }: Props = $props()

  // Tailwind 임의값은 런타임 변수로 못 만들므로 인라인 style로 트랙·셀을 잡는다
  const cellStyle = $derived(`height:${cellSize}px;width:${cellSize}px`)
  const trackStyle = $derived(`grid-template-columns:repeat(7,${cellSize}px)`)

  function isHighlighted(y: number, m: number, d: number): boolean {
    return highlightedDates.some(
      (hd) =>
        hd.getFullYear() === y && hd.getMonth() === m && hd.getDate() === d
    )
  }

  const today = new Date()
  // 오늘 0시 기준 (날짜 단위 비교)
  const todayFloor = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime()
  function isPast(y: number, m: number, d: number): boolean {
    return new Date(y, m, d).getTime() < todayFloor
  }
  let year = $state(today.getFullYear())
  let month = $state(today.getMonth())

  // 초기 마운트 시 selectedDates 또는 highlightedDates 가 있으면 해당 월로 자동 이동.
  // (예: 상담 정보 수정 모달에서 예정 회기가 다른 월에 있을 때)
  let initialNavigated = $state(false)
  $effect(() => {
    if (initialNavigated) return
    const candidate =
      selectedDates.length > 0
        ? selectedDates
        : highlightedDates.length > 0
          ? highlightedDates
          : null
    if (!candidate) return
    const earliest = candidate.reduce((min, d) =>
      d.getTime() < min.getTime() ? d : min
    )
    // 이미 해당 월을 보고 있으면 이동 불필요
    if (
      earliest.getFullYear() !== today.getFullYear() ||
      earliest.getMonth() !== today.getMonth()
    ) {
      year = earliest.getFullYear()
      month = earliest.getMonth()
    }
    initialNavigated = true
  })

  function goToPrevious() {
    if (month === 0) {
      month = 11
      year -= 1
    } else {
      month -= 1
    }
  }

  function goToNext() {
    if (month === 11) {
      month = 0
      year += 1
    } else {
      month += 1
    }
  }

  const DAYS_FROM_MONDAY = ['월', '화', '수', '목', '금', '토', '일']

  const getDaysInMonth = (y: number, m: number): number =>
    new Date(y, m + 1, 0).getDate()
  // 월요일 시작 기준 offset (월=0, 화=1, ..., 일=6)
  const getStartDay = (y: number, m: number): number => {
    const day = new Date(y, m, 1).getDay()
    return day === 0 ? 6 : day - 1
  }

  function isSelected(y: number, m: number, d: number): boolean {
    return selectedDates.some(
      (sd) =>
        sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d
    )
  }

  function isToday(y: number, m: number, d: number): boolean {
    return (
      today.getFullYear() === y &&
      today.getMonth() === m &&
      today.getDate() === d
    )
  }

  function handleClick(y: number, m: number, d: number) {
    if (singleDate) {
      const clicked = new Date(y, m, d)
      const alreadySelected = isSelected(y, m, d)
      if (alreadySelected) {
        onToggleDate(clicked) // 토글 해제
      } else {
        // 기존 선택 모두 해제 후 새 날짜 선택
        for (const sd of [...selectedDates]) {
          onToggleDate(sd)
        }
        onToggleDate(clicked)
      }
      return
    }
    onToggleDate(new Date(y, m, d))
  }

  const totalCells = $derived(
    Math.ceil((getStartDay(year, month) + getDaysInMonth(year, month)) / 7) * 7
  )
</script>

<!-- 좌우 패딩은 호출부(MultiDateSchedulePicker의 calPadding)가 소유한다 —
     여기서도 px-4를 주면 이중으로 겹쳐 고정폭 트랙이 컨테이너를 넘친다 -->
<div class="flex flex-col bg-white">
  <!-- Header: month navigation -->
  <div class="relative mb-2 flex h-8 items-center justify-center gap-3">
    <button
      type="button"
      onclick={goToPrevious}
      class="flex h-6 w-6 items-center justify-center"
    >
      <ChevronIcon
        class="h-2.5 w-1.5 stroke-[#AAAAAA] transition hover:scale-125"
      />
    </button>
    <Typography variant="title-02-semibold">
      {year}년 {month + 1}월
    </Typography>
    <button
      type="button"
      onclick={goToNext}
      class="flex h-6 w-6 items-center justify-center"
    >
      <ChevronIcon
        class="h-2.5 w-1.5 rotate-180 stroke-[#AAAAAA] transition hover:scale-125"
      />
    </button>
    {#if onToggleCollapsed}
      <!-- 접기/펼치기 — 월 이동 화살표와 헷갈리지 않게 헤더 우측 끝에 둔다 -->
      <button
        type="button"
        onclick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? '달력 펼치기' : '달력 접기'}
        class="absolute right-0 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          class="transition-transform duration-[600ms] ease-[cubic-bezier(0.65,0,0.35,1)] {collapsed
            ? ''
            : 'rotate-180'}"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Day headers + dates grid — 접히면 월 네비게이션만 남는다 -->
  {#if !collapsed}
    <!-- transition: 하나로 쓰면 outro에서 이징이 뒤집혀 접힘/펼침 느낌이 달라진다.
         in/out을 나눠 양방향 모두 같은 곡선으로 재생한다.
         이징이 InOut인 이유 — Figma Slow는 과감쇠 스프링이라 '정지 → 가속 → 감속'으로
         움직인다. quintOut 같은 순수 ease-out은 첫 80ms에 50%가 진행돼 튀어 보인다. -->
    <div
      in:slide={{ duration: 600, easing: cubicInOut }}
      out:slide={{ duration: 600, easing: cubicInOut }}
    >
      <!-- 높이 예약은 slide가 건드리는 요소가 아니라 그 '안쪽'에 둔다 —
           같은 요소에 두면 slide가 넣는 인라인 height가 min-height에 막혀
           애니메이션 대부분이 멈춰 있다가 끝에서 스냅한다 -->
      <div style={gridMinHeight ? `min-height: ${gridMinHeight};` : ''}>
        {#key `${year}-${month}`}
          <!-- 트랙을 cellSize로 고정한다(grid-cols-7의 균등분할 대신).
       균등분할은 컨테이너가 좁아지면 트랙이 셀보다 작아져 원형 배경이 서로 겹친다.
       한 줄 폭 = 7*cellSize + 6*4 → 좌측 컬럼은 이 값 + 패딩을 보장해야 한다. -->
          <div class="grid justify-center gap-1" style={trackStyle}>
            {#each DAYS_FROM_MONDAY as day}
              <div class="flex items-center justify-center" style={cellStyle}>
                <Typography variant="body-02-medium" color="text-gray-500"
                  >{day}</Typography
                >
              </div>
            {/each}

            <!-- Previous month trailing days -->
            {#each Array(getStartDay(year, month)) as _, idx}
              {@const prevMonth = month === 0 ? 11 : month - 1}
              {@const prevYear = month === 0 ? year - 1 : year}
              {@const prevDays = getDaysInMonth(prevYear, prevMonth)}
              {@const day = prevDays - getStartDay(year, month) + idx + 1}
              {@const pSelected = isSelected(prevYear, prevMonth, day)}
              {@const pHighlighted = isHighlighted(prevYear, prevMonth, day)}
              {@const pIsNew = pSelected && !pHighlighted}
              {@const pIsExisting =
                (pSelected && pHighlighted) || (!pSelected && pHighlighted)}
              <div class="flex items-center justify-center" style={cellStyle}>
                <button
                  type="button"
                  onclick={() => handleClick(prevYear, prevMonth, day)}
                  style={cellStyle}
                  class="flex items-center justify-center rounded-full text-sm transition-colors hover:bg-gray-100
            {pIsNew
                    ? 'bg-primary-400 text-white! hover:bg-primary-500'
                    : pIsExisting
                      ? 'bg-primary-100 text-primary-400'
                      : 'text-gray-300'}"
                >
                  {day}
                </button>
              </div>
            {/each}

            <!-- Current month days -->
            {#each Array(getDaysInMonth(year, month)) as _, idx}
              {@const day = idx + 1}
              {@const selected = isSelected(year, month, day)}
              {@const highlighted = isHighlighted(year, month, day)}
              {@const isNew = selected && !highlighted}
              {@const isExisting = selected && highlighted}
              {@const isHighlightOnly = !selected && highlighted}
              {@const todayMark = isToday(year, month, day)}
              {@const pastMuted =
                disablePast &&
                isPast(year, month, day) &&
                !selected &&
                !highlighted}
              <div class="flex items-center justify-center" style={cellStyle}>
                <button
                  type="button"
                  onclick={() => handleClick(year, month, day)}
                  style={cellStyle}
                  class="relative flex items-center justify-center rounded-full text-sm transition-colors
            {pastMuted
                    ? 'text-gray-300 hover:bg-gray-100'
                    : isNew
                      ? 'bg-primary-400 font-semibold text-white hover:bg-primary-500'
                      : isExisting || isHighlightOnly
                        ? 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                        : todayMark
                          ? 'bg-bg-base text-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'}"
                >
                  {day}
                </button>
              </div>
            {/each}

            <!-- Next month leading days -->
            {#each Array(totalCells - getStartDay(year, month) - getDaysInMonth(year, month)) as _, idx}
              {@const nextMonth = month === 11 ? 0 : month + 1}
              {@const nextYear = month === 11 ? year + 1 : year}
              {@const day = idx + 1}
              {@const nSelected = isSelected(nextYear, nextMonth, day)}
              {@const nHighlighted = isHighlighted(nextYear, nextMonth, day)}
              {@const nIsNew = nSelected && !nHighlighted}
              {@const nIsExisting =
                (nSelected && nHighlighted) || (!nSelected && nHighlighted)}
              <div class="flex items-center justify-center" style={cellStyle}>
                <button
                  type="button"
                  onclick={() => handleClick(nextYear, nextMonth, day)}
                  style={cellStyle}
                  class="flex items-center justify-center rounded-full text-sm transition-colors hover:bg-gray-100
            {nIsNew
                    ? 'bg-primary-400 text-white! hover:bg-primary-500'
                    : nIsExisting
                      ? 'bg-primary-100 text-primary-400'
                      : 'text-gray-300'}"
                >
                  {day}
                </button>
              </div>
            {/each}
          </div>
        {/key}
      </div>
    </div>
  {/if}
</div>
