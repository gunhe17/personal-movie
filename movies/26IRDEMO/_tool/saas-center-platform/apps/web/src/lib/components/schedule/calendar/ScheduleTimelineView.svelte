<style>
  .overlay-scroll-container {
    scrollbar-gutter: stable;
    overflow-y: auto;
  }

  .overlay-scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .overlay-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .overlay-scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  /* 페이지 버튼: '이쪽에 더 있다'는 방향 힌트를 주는 은은한 좌우 nudge */
  .nudge-next {
    animation: nudge-right 1.8s ease-in-out infinite;
  }
  .nudge-prev {
    animation: nudge-left 1.8s ease-in-out infinite;
  }
  @keyframes nudge-right {
    0%,
    55%,
    100% {
      transform: translateX(0);
    }
    30% {
      transform: translateX(3px);
    }
  }
  @keyframes nudge-left {
    0%,
    55%,
    100% {
      transform: translateX(0);
    }
    30% {
      transform: translateX(-3px);
    }
  }
  /* 접근성: 모션 최소화 설정 시 애니메이션 비활성화 */
  @media (prefers-reduced-motion: reduce) {
    .nudge-next,
    .nudge-prev {
      animation: none;
    }
  }
</style>

<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import {
    isSameKstDateTime,
    formatUtcToKst,
    parseUtcToKstTime
  } from '$lib/utils/date'
  import { hexToRgba, getColorFromString } from '$lib/utils/colorConverter'

  import TimeLine from '$lib/components/calendar/TimeLine.svelte'
  import ChevronIcon from '$lib/assets/ChevronIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ScheduleRegisterModal from '$lib/components/modal/ScheduleRegisterModal.svelte'
  import { openScheduleDetailModal } from '$lib/components/modal/openScheduleDetailModal'
  import { modalStore } from '$lib/stores/modal'
  import type { CalendarSchedule } from '$lib/features/schedule/calendar/change-requests'
  import { createReservationsService } from '$lib/features/schedule/reservations/reservations-service'
  import ScheduleChangeRequestModal from '$lib/components/schedule/reservations/ScheduleChangeRequestModal.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import type {
    ScheduleType,
    MappedSchedule
  } from '$lib/hooks/actions/schedule.action'
  import type { RoomItemType } from '$lib/hooks/actions/room.action'
  import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isOperatingHourForDay,
    isBreakHourForDay
  } from '$lib/features/schedule/operating-hours'
  import { ROOM_COLORS } from '$lib/features/schedule/calendar/constants'
  import { portal } from '$lib/utils/positionPortal'
  import Center24Icon from '$lib/assets/Center24Icon.svelte'
  import Counsel24Icon from '$lib/assets/Counsel24Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'

  // hover popover 상태.
  // 팝오버 안에서 승인·반려를 바로 누르려면 블록 → 팝오버로 **마우스가 건너갈 수 있어야** 한다.
  // 블록을 벗어나는 즉시 닫으면 4px 틈을 지나는 동안 팝오버가 사라져 버튼을 누를 수 없다 —
  // 닫기를 짧게 미루고, 그 사이 팝오버에 들어오면 취소한다.
  const POPOVER_CLOSE_DELAY = 120
  let hoveredScheduleId = $state<string | null>(null)
  let hoveredChipRef = $state<HTMLElement | null>(null)
  let popoverCloseTimer: ReturnType<typeof setTimeout> | null = null

  function openPopover(id: string, el: HTMLElement) {
    cancelPopoverClose()
    hoveredScheduleId = id
    hoveredChipRef = el
  }
  function cancelPopoverClose() {
    if (popoverCloseTimer) clearTimeout(popoverCloseTimer)
    popoverCloseTimer = null
  }
  function schedulePopoverClose() {
    cancelPopoverClose()
    popoverCloseTimer = setTimeout(closePopover, POPOVER_CLOSE_DELAY)
  }
  function closePopover() {
    cancelPopoverClose()
    hoveredScheduleId = null
    hoveredChipRef = null
  }

  function isToday(date: Date | null): boolean {
    if (!date) return false
    const today = new Date()
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  interface ColumnItem {
    id: string
    name: string
  }

  interface Props {
    schedules: CalendarSchedule[]
    rooms: RoomItemType[]
    selectedDate: Date | null
    operatingTimes?: OperatingTimeSummary[]
    mode?: 'room' | 'counselor'
    counselors?: ColumnItem[]
  }

  let {
    schedules,
    rooms,
    selectedDate,
    operatingTimes = [],
    mode = 'room',
    counselors = []
  }: Props = $props()

  const queryClient = useQueryClient()

  // 변경 요청이 걸린 블록은 일정 상세가 아니라 요청 상세를 연다 —
  // 대시보드 배너·변경요청 메뉴와 같은 모달·같은 서비스로 수렴시킨다
  const reservationsService = createReservationsService({ queryClient })

  /**
   * 팝오버에서 바로 처리 — 대시보드 배너와 **같은 서비스**를 탄다(확인 다이얼로그·스낵바 포함).
   * 팝오버는 hover로만 떠 있으므로 먼저 닫는다: 확인 모달이 뜬 뒤 마우스가 팝오버를 벗어나면
   * 처리 중인 카드만 허공에 남는다.
   */
  async function runChangeRequestAction(
    schedule: CalendarSchedule,
    action: 'approve' | 'reject'
  ) {
    const request = schedule.changeRequest
    if (!request) return
    closePopover()
    if (action === 'approve') await reservationsService.approve(request.id)
    else await reservationsService.reject(request.id)
  }

  function openChangeRequestModal(schedule: CalendarSchedule) {
    if (!schedule.changeRequest) return false
    modalStore.open({
      component: ScheduleChangeRequestModal,
      props: {
        request: schedule.changeRequest,
        onApprove: reservationsService.approve,
        onReject: reservationsService.reject
      }
    })
    return true
  }

  const mapScheduleToMapped = (s: ScheduleType): MappedSchedule => ({
    id: s.id,
    client: s.client_names?.join(', ') ?? '',
    counselor_color: s.counselor_color ?? null,
    manager: s.counselor_name ?? null,
    date: s.start,
    start_at: formatUtcToKst(s.start, 'HH:mm'),
    start_at_origin: s.start,
    end_at: formatUtcToKst(s.end, 'HH:mm'),
    end_at_origin: s.end,
    title: s.title,
    program_name: s.program_name ?? null,
    schedule_type: s.schedule_type,
    room: s.room_name,
    status: s.has_conflict ?? false,
    session_status: s.session_status ?? null
  })

  const MAX_VISIBLE_COLUMNS = 6

  const displayColumns = $derived.by<ColumnItem[]>(() => {
    const listed: ColumnItem[] =
      mode === 'counselor'
        ? (counselors ?? [])
        : (rooms ?? []).map((r) => ({ id: r.id, name: r.name }))

    // 🔴 목록에 없는 축은 그날 일정에서 되살린다.
    // 컬럼 목록은 **활성** 상담실(`active_only`)·현재 구성원이라, 상담실이 비활성으로
    // 바뀌거나 담당자가 나가면 그 일정을 담을 컬럼이 없어 **일정이 통째로 사라진다**
    // (조용한 누락 — 변경 요청 고스트도 같이 사라져 "요청 날짜 보기를 눌러도 점선이 없다"가 된다).
    // 일정이 실제로 그 상담실에 있으므로, 목록에 없더라도 그날 한정 컬럼을 만든다.
    const listedNames = new Set(listed.map((c) => c.name))
    const extras: ColumnItem[] = []
    let hasUnassigned = false
    for (const s of daySchedules) {
      const name = mode === 'counselor' ? s.counselor_name : s.room_name
      if (!name) {
        hasUnassigned = true
        continue
      }
      if (!listedNames.has(name) && !extras.some((e) => e.name === name)) {
        extras.push({ id: `unlisted:${name}`, name })
      }
    }

    const base = [...listed, ...extras]
    // 축이 비어 있는 센터, 그리고 상담실·담당자가 지정되지 않은 일정의 자리
    if (hasUnassigned || base.length === 0) {
      base.push({ id: 'default', name: '미지정' })
    }

    // 선택한 날짜에 일정이 있는 컬럼(장소/담당자)을 앞으로 정렬한다.
    // → 첫 페이지에 '일정 있는 장소'부터 보이고, 빈 장소는 뒤로 밀린다.
    // 같은 그룹(있음/없음) 안에서는 원래 순서를 유지(안정 정렬).
    return base
      .map((col, index) => ({
        col,
        index,
        hasSchedule: getColumnSchedules(col).length > 0
      }))
      .sort((a, b) =>
        a.hasSchedule === b.hasSchedule
          ? a.index - b.index
          : a.hasSchedule
            ? -1
            : 1
      )
      .map((entry) => entry.col)
  })

  let columnPage = $state(0)
  const totalPages = $derived(
    Math.ceil(displayColumns.length / MAX_VISIBLE_COLUMNS)
  )
  const hasPagination = $derived(displayColumns.length > MAX_VISIBLE_COLUMNS)
  // 현재 페이지 좌/우로 더 남아있는 컬럼 수 (다음/이전 버튼 강조·안내용)
  const hiddenLeftCount = $derived(columnPage * MAX_VISIBLE_COLUMNS)
  const hiddenRightCount = $derived(
    Math.max(0, displayColumns.length - (columnPage + 1) * MAX_VISIBLE_COLUMNS)
  )
  const columnUnitLabel = $derived(mode === 'counselor' ? '담당자' : '장소')
  const visibleColumns = $derived.by(() => {
    return displayColumns.slice(
      columnPage * MAX_VISIBLE_COLUMNS,
      (columnPage + 1) * MAX_VISIBLE_COLUMNS
    )
  })
  const timeSlots = $derived.by(() => {
    const slots: { hour: number; minute: number; label: string }[] = []
    for (let h = 7; h <= 24; h++) {
      slots.push({
        hour: h,
        minute: 0,
        label: `${String(h).padStart(2, '0')}:00`
      })
    }
    return slots
  })

  const getRoomColor = (index: number): string => {
    return ROOM_COLORS[index % ROOM_COLORS.length]
  }

  // 페이지 기반 원본 인덱스 계산 (색상 일관성 유지)
  const getOriginalIndex = (visibleIdx: number): number => {
    return columnPage * MAX_VISIBLE_COLUMNS + visibleIdx
  }

  const isOverlap = (a: CalendarSchedule, b: CalendarSchedule) => {
    const aStart = new Date(a.start).getTime()
    const aEnd = new Date(a.end).getTime()
    const bStart = new Date(b.start).getTime()
    const bEnd = new Date(b.end).getTime()
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
  }

  // 룸별 하루치 스케줄을 겹침 그룹으로 분류하고 각 스케줄에 column index/total 부여
  type ScheduleLayout = {
    schedule: CalendarSchedule
    colIndex: number
    colTotal: number
  }

  const assignColumns = (
    roomSchedules: CalendarSchedule[]
  ): ScheduleLayout[] => {
    if (!roomSchedules.length) return []
    // 시작 시간 순 정렬
    const sorted = [...roomSchedules].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    // 겹치는 클러스터 찾기
    const clusters: CalendarSchedule[][] = []
    let currentCluster: CalendarSchedule[] = [sorted[0]]
    let clusterEnd = new Date(sorted[0].end).getTime()

    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i]
      if (new Date(s.start).getTime() < clusterEnd) {
        currentCluster.push(s)
        clusterEnd = Math.max(clusterEnd, new Date(s.end).getTime())
      } else {
        clusters.push(currentCluster)
        currentCluster = [s]
        clusterEnd = new Date(s.end).getTime()
      }
    }
    clusters.push(currentCluster)

    // 각 클러스터 내에서 컬럼 배정 (greedy)
    const result: ScheduleLayout[] = []
    for (const cluster of clusters) {
      const columns: CalendarSchedule[][] = []
      for (const s of cluster) {
        let placed = false
        for (let c = 0; c < columns.length; c++) {
          const lastInCol = columns[c][columns[c].length - 1]
          if (
            new Date(lastInCol.end).getTime() <= new Date(s.start).getTime()
          ) {
            columns[c].push(s)
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([s])
        }
      }
      const colTotal = columns.length
      for (let c = 0; c < columns.length; c++) {
        for (const s of columns[c]) {
          result.push({ schedule: s, colIndex: c, colTotal })
        }
      }
    }
    return result
  }

  /** 선택한 날짜의 일정 — 컬럼 구성·행 배치가 모두 이 한 집합에서 갈라진다 */
  const daySchedules = $derived.by<CalendarSchedule[]>(() => {
    if (!selectedDate) return []
    const selY = selectedDate.getFullYear()
    const selM = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const selD = String(selectedDate.getDate()).padStart(2, '0')
    const selectedDateStr = `${selY}-${selM}-${selD}`
    return schedules.filter(
      (s) => formatUtcToKst(s.start, 'YYYY-MM-DD') === selectedDateStr
    )
  })

  const getColumnSchedules = (col: ColumnItem): CalendarSchedule[] =>
    daySchedules.filter((s) => {
      const name = mode === 'counselor' ? s.counselor_name : s.room_name
      return name ? name === col.name : col.id === 'default'
    })

  const dayHours = $derived(
    selectedDate
      ? getOperatingHoursForDate(operatingTimes, selectedDate)
      : getOperatingHoursForDate(operatingTimes, new Date())
  )

  const handleRegisterSchedule = (
    hour: number,
    minute: number,
    col?: ColumnItem
  ) => {
    const isRoom = mode === 'room'
    const colId = col && col.id !== 'default' ? col.id : undefined
    const colName = col && col.id !== 'default' ? col.name : undefined
    modalStore.open({
      component: ScheduleRegisterModal,
      props: {
        selectedDate,
        selectedTime: `${hour}:${String(minute).padStart(2, '0')}`,
        selectedRoomId: isRoom ? colId : undefined,
        selectedRoomName: isRoom ? colName : undefined,
        selectedMemberIds: !isRoom && colId ? [colId] : undefined
      },
      options: { customWidth: 540 }
    })
  }

  // 컬럼 수 변경 시 페이지 리셋
  $effect(() => {
    if (displayColumns.length) columnPage = 0
  })
</script>

<div class="w-full h-full overflow-hidden">
  <div
    class="grid grid-cols-[80px_1fr] w-full h-full min-h-0 bg-white relative"
  >
    <!-- 왼쪽: 시간 컬럼 (고정) -->
    <div class="grid grid-rows-[40px_1fr] min-h-0 border-r border-gray-200">
      <!-- 헤더 셀 -->
      <div class="flex-center border-b border-gray-200">
        <Typography color="text-gray-500" variant="body-02-medium">
          {mode === 'counselor' ? '시간/담당자' : '시간/장소'}
        </Typography>
      </div>
      <!-- 시간 슬롯 -->
      <div
        class="grid"
        style="grid-template-rows: repeat({timeSlots.length}, 1fr);"
      >
        {#each timeSlots as slot, idx}
          <div
            class={twMerge(
              'relative flex items-center justify-center',
              idx < timeSlots.length - 1 && 'border-b border-gray-200'
            )}
          >
            <Typography color="text-gray-600" variant="body-02-normal-regular">
              {slot.label}
            </Typography>
          </div>
        {/each}
      </div>
    </div>
    <!-- 오른쪽: 상담실/담당자 컬럼 (페이지네이션) -->
    <div
      class="min-h-0 min-w-0 overflow-hidden relative grid grid-cols-[auto_1fr_auto] h-full"
    >
      <!-- 이전 페이지 버튼 -->
      {#if hasPagination}
        {@const hasPrev = columnPage > 0}
        <button
          class="w-11 flex flex-col items-center justify-center gap-1 border-r transition-colors {hasPrev
            ? 'border-primary-200 bg-primary-50 text-primary-600 hover:bg-primary-100'
            : 'border-gray-200 text-gray-200 cursor-default'}"
          onclick={() => {
            if (hasPrev) columnPage--
          }}
          disabled={!hasPrev}
          aria-label={hasPrev
            ? `이전 ${columnUnitLabel} ${hiddenLeftCount}곳 더 보기`
            : '이전 페이지'}
          title={hasPrev
            ? `이전 ${columnUnitLabel} ${hiddenLeftCount}곳`
            : undefined}
        >
          <span class="flex" class:nudge-prev={hasPrev}>
            <ChevronIcon
              class={hasPrev ? 'w-3 h-5' : 'w-2.5 h-4'}
              strokeColor={hasPrev ? '#256ef4' : '#D1D5DB'}
            />
          </span>
          {#if hasPrev && hiddenLeftCount > 0}
            <span class="text-label-02-normal-medium leading-none"
              >+{hiddenLeftCount}</span
            >
          {/if}
        </button>
      {/if}
      <div
        class={twMerge(
          'flex h-full overflow-hidden',
          !hasPagination && 'col-span-3'
        )}
      >
        {#each visibleColumns as col, colIdx}
          {@const colLayouts = assignColumns(getColumnSchedules(col))}
          <div class="flex flex-col relative flex-1 min-w-0">
            <!-- 헤더 셀 -->
            <div
              class={twMerge(
                'h-10 shrink-0 px-5 border-b border-r last:border-r-0',
                'border-gray-200 flex items-center justify-center gap-2'
              )}
            >
              {#if mode === 'counselor'}
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  style:background-color={getRoomColor(
                    getOriginalIndex(colIdx)
                  )}
                ></span>
              {/if}
              <Typography color="text-gray-600" variant="body-02-normal-medium">
                {col.name}
              </Typography>
            </div>
            <!-- 슬롯 셀 (배경 + 클릭) -->
            <div
              class="grid flex-1 relative"
              style="grid-template-rows: repeat({timeSlots.length}, 1fr);"
            >
              {#each timeSlots as slot, slotIdx}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  onclick={() =>
                    handleRegisterSchedule(slot.hour, slot.minute, col)}
                  class="border-b border-r border-gray-200 transition cursor-pointer bg-white hover:bg-gray-50"
                ></div>
              {/each}
              <!-- 스케줄 블록 (absolute 오버레이) -->
              {#each colLayouts as { schedule, colIndex, colTotal }}
                {@const kstStart = parseUtcToKstTime(schedule.start.toString())}
                {@const kstEnd = parseUtcToKstTime(schedule.end.toString())}
                {@const startHourIdx = kstStart.hour - timeSlots[0].hour}
                {@const topPercent =
                  ((startHourIdx + kstStart.minute / 60) / timeSlots.length) *
                  100}
                {@const durationMin =
                  kstEnd.hour * 60 +
                  kstEnd.minute -
                  (kstStart.hour * 60 + kstStart.minute)}
                {@const heightPercent =
                  (durationMin / 60 / timeSlots.length) * 100}
                {@const gap = 4}
                {@const totalGaps = (colTotal - 1) * gap}
                {@const isInactive = schedule.session_status === 'cancelled'}
                {@const inactiveTextClass = isInactive
                  ? 'line-through opacity-70'
                  : ''}
                {@const clientNames = schedule.client_names ?? []}
                <!-- 한 줄 구성이라 이름을 다 넣지 않는다 — 그룹이면 대표 1명 + "외 N명" -->
                {@const clientLabel =
                  clientNames.length > 1
                    ? `${clientNames[0]} 외 ${clientNames.length - 1}명`
                    : clientNames[0] || schedule.title || '-'}
                <!-- 컬럼으로 이미 보이는 축의 반대편을 붙인다: 장소별→담당자, 담당자별→장소 -->
                {@const subLabel =
                  mode === 'room'
                    ? schedule.counselor_name || ''
                    : schedule.room_name || ''}
                <!-- 변경 요청 오버레이 — ghost는 요청된 자리(점선·미확정), origin은 지금 자리 -->
                {@const changeRequest = schedule.changeRequest}
                {@const isGhost = schedule.changeRequestRole === 'ghost'}
                {@const baseColor =
                  schedule.counselor_color ||
                  getColorFromString(
                    mode === 'room'
                      ? schedule.counselor_name || ''
                      : schedule.room_name || ''
                  )}
                <!-- 고스트 점선은 확정 블록보다 약해야 한다(미확정 신호) — 원색 100%는
                     확정 블록보다 튀어 시선을 먼저 가져갔다. 평상시 선은 면(12%)보다
                     한 단만 진한 25%. 충돌만 예외로 red-300(경고는 묻히면 안 된다). -->
                {@const ghostLineColor = schedule.changeRequestConflict
                  ? 'var(--color-red-300)'
                  : hexToRgba(baseColor, 0.25)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  onclick={(e) => {
                    e.stopPropagation()
                    if (openChangeRequestModal(schedule)) return
                    openScheduleDetailModal(
                      mapScheduleToMapped(schedule),
                      queryClient
                    )
                  }}
                  onmouseenter={(e) =>
                    openPopover(schedule.id, e.currentTarget as HTMLElement)}
                  onmouseleave={schedulePopoverClose}
                  class="absolute z-10 flex items-start gap-2 rounded-lg px-2 py-1 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-200 {isGhost
                    ? 'border border-dashed'
                    : ''} {changeRequest && !isGhost
                    ? 'outline outline-1 outline-dashed outline-white/70 -outline-offset-[3px]'
                    : ''}"
                  style="top: {topPercent}%; height: {heightPercent}%; left: calc(6px + {colIndex} * ((100% - 12px - {totalGaps}px) / {colTotal}) + {colIndex *
                    gap}px); width: calc((100% - 12px - {totalGaps}px) / {colTotal}); background-color: {isGhost
                    ? hexToRgba(baseColor, 0.12)
                    : hexToRgba(baseColor, isInactive ? 0.4 : 0.9)};{isGhost
                    ? ` border-color: ${ghostLineColor};`
                    : ''}"
                >
                  <!-- 아이콘은 별도 열 — 내담자 이름과 시간이 같은 좌측 기준선에 정렬된다 -->
                  <span
                    class="inline-flex shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 {isInactive
                      ? 'opacity-70'
                      : ''}"
                  >
                    {#if schedule.schedule_type === 'assessment'}
                      <AssessmentStack />
                    {:else if schedule.schedule_type === 'counseling'}
                      <Counsel24Icon />
                    {:else}
                      <Center24Icon />
                    {/if}
                  </span>
                  <!-- 한 줄: 내담자 | 장소 (시간은 타임라인 위치가 말해준다) -->
                  <span
                    class="font-pretendard text-[14px] font-normal tracking-[-0.41px] min-w-0 truncate-safe {isGhost
                      ? 'text-gray-800'
                      : 'text-white'} {inactiveTextClass}"
                    style:line-height="1.25"
                  >
                    <!-- 장소별 모드는 컬럼이 곧 장소라, 장소 대신 담당자를 붙인다 -->
                    {clientLabel}{#if subLabel}<span
                        class="mx-2 inline-block h-3 w-px align-middle {isGhost
                          ? 'bg-gray-400'
                          : 'bg-white/40'}"
                      ></span>{subLabel}{/if}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <!-- 다음 페이지 버튼 -->
      {#if hasPagination}
        {@const hasNext = columnPage < totalPages - 1}
        <button
          class="w-11 flex flex-col items-center justify-center gap-1 border-l transition-colors {hasNext
            ? 'border-primary-200 bg-primary-50 text-primary-600 hover:bg-primary-100'
            : 'border-gray-200 text-gray-200 cursor-default'}"
          onclick={() => {
            if (hasNext) columnPage++
          }}
          disabled={!hasNext}
          aria-label={hasNext
            ? `다음 ${columnUnitLabel} ${hiddenRightCount}곳 더 보기`
            : '다음 페이지'}
          title={hasNext
            ? `${columnUnitLabel} ${hiddenRightCount}곳 더 있음`
            : undefined}
        >
          <span class="flex" class:nudge-next={hasNext}>
            <ChevronIcon
              class="rotate-180 {hasNext ? 'w-3 h-5' : 'w-2.5 h-4'}"
              strokeColor={hasNext ? '#256ef4' : '#D1D5DB'}
            />
          </span>
          {#if hasNext && hiddenRightCount > 0}
            <span class="text-label-02-normal-medium leading-none"
              >+{hiddenRightCount}</span
            >
          {/if}
        </button>
      {/if}
    </div>
    <!-- 현재시간 표시: 헤더 아래 전체 영역 오버레이 -->
    <div class="absolute inset-x-0 top-10 bottom-0 pointer-events-none z-20">
      <TimeLine startHour={timeSlots[0].hour} totalRows={timeSlots.length} />
    </div>
  </div>
</div>

<!-- hover 팝오버 (portal) -->
{#if hoveredScheduleId && hoveredChipRef}
  {@const sch = schedules.find((s) => s.id === hoveredScheduleId)}
  {#if sch}
    <!-- 타이틀 = 상담사가 일정을 구분하는 최소단위(내담자 이름). 운영 일정은 내담자가 없어 제목을 쓴다 -->
    {@const popoverTitle =
      sch.schedule_type === 'meeting'
        ? sch.title || '-'
        : (sch.client_names ?? []).length
          ? (sch.client_names ?? [])
              .map((n) => ($isSecretMode ? maskName(n) : n))
              .join(', ')
          : sch.title || '-'}
    {@const programLabel =
      sch.program_name ||
      (sch.schedule_type === 'assessment'
        ? '검사'
        : sch.schedule_type === 'counseling'
          ? '상담'
          : '운영')}
    {#key hoveredScheduleId}
      <div
        use:portal={{
          anchor: hoveredChipRef,
          offset: 4,
          isFitWidth: false
        }}
        onmouseenter={cancelPopoverClose}
        onmouseleave={schedulePopoverClose}
        role="group"
        aria-label="일정 요약"
        class="popover-fade-in p-3 w-60 bg-white rounded-lg shadow-lg z-50"
      >
        <!-- 타이틀 = 일정 구분 최소단위: 타입 아이콘 + 내담자 이름, 그 밑에 시간.
             단 변경 요청이 걸린 일정은 시간을 여기 두지 않는다 — 아래 요청 카드가
             '기존 → 요청'으로 이미 말해서 같은 값이 두 번 나온다. -->
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="shrink-0">
              {#if sch.schedule_type === 'meeting'}
                <Center24Icon />
              {:else if sch.schedule_type === 'counseling'}
                <Counsel24Icon />
              {:else}
                <AssessmentStack />
              {/if}
            </span>
            <Typography
              variant="body-01-reading-semibold"
              className="min-w-0 truncate-safe"
            >
              {popoverTitle}
            </Typography>
            <!-- 취소 배지 = 검사 상세 좌측 패널과 동일 규격
                 (Rectangle S · tag-red, Web_Design.md §Components>badge) -->
            {#if sch.session_status === 'cancelled'}
              <BadgeRectangle
                label="취소"
                color="red"
                size="sm"
                class="ml-auto"
              />
            {/if}
          </div>
          {#if !sch.changeRequest}
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              {formatUtcToKst(sch.start, 'HH:mm')} - {formatUtcToKst(
                sch.end,
                'HH:mm'
              )}
            </Typography>
          {/if}
        </div>
        {#if sch.changeRequest}
          <!-- 변경 요청 — 승인 판단에 필요한 최소 정보(기존 → 요청 · 사유 · 충돌).
               처리는 이 카드 하단의 반려·승인이 소유한다(대시보드 배너와 같은 서비스).
               면은 브랜드 틴트 배경 토큰(bg/brand-subtle) — 일정 변경 요청 모달과 같은 규격 -->
          <div class="mt-3 flex flex-col gap-2 rounded-lg bg-brand-subtle p-3">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
            >
              {sch.changeRequestRole === 'ghost'
                ? '요청된 시간'
                : '변경 요청 중'}
            </Typography>
            <!-- 기존 → 요청. 좁은 팝오버라 한 줄로 눕히고, 화살표도 대시보드 배너와
                 같은 가로 화살표(→)를 쓴다(세로 스택·듀오톤 아이콘은 모달 전용). -->
            <div class="flex items-center gap-2">
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
              >
                {formatUtcToKst(sch.changeRequest.current_start, 'MM.DD HH:mm')}
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-body-subtle"
              >
                →
              </Typography>
              <Typography
                variant="body-02-normal-medium"
                color="text-primary-500"
              >
                {formatUtcToKst(
                  sch.changeRequest.requested_start,
                  'MM.DD HH:mm'
                )}
              </Typography>
            </div>
            {#if sch.changeRequest.reason}
              <Typography
                variant="body-02-reading-regular"
                color="text-gray-800"
                className="min-w-0"
              >
                {sch.changeRequest.reason}
              </Typography>
            {/if}
            {#if sch.changeRequestConflict}
              <Typography
                variant="body-03-normal-regular"
                color="text-status-danger"
              >
                요청한 시간에 다른 일정이 있어요
              </Typography>
            {/if}
          </div>
        {/if}
        <hr class="my-3 border-gray-100" />
        <!-- 레이블 + 데이터 (레이블 폭은 가장 넓은 값 기준 고정, 간격 12) -->
        <div class="space-y-3">
          <div class="flex gap-3">
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="w-16 shrink-0"
            >
              프로그램
            </Typography>
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-800"
              className="min-w-0"
            >
              {programLabel}
            </Typography>
          </div>
          {#if sch.schedule_type !== 'meeting'}
            <div class="flex gap-3">
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                className="w-16 shrink-0"
              >
                담당자
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-800"
                className="min-w-0"
              >
                {#if sch.counselor_names && sch.counselor_names.length > 0}
                  {$isSecretMode
                    ? sch.counselor_names.map((n) => maskName(n)).join(', ')
                    : sch.counselor_names.join(', ')}
                {:else}
                  {$isSecretMode
                    ? maskName(sch.counselor_name || '-')
                    : sch.counselor_name || '-'}
                {/if}
              </Typography>
            </div>
          {/if}
          {#if sch.room_name}
            <div class="flex gap-3">
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                className="w-16 shrink-0"
              >
                장소
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-800"
                className="min-w-0"
              >
                {sch.room_name}
              </Typography>
            </div>
          {/if}
        </div>
        {#if sch.changeRequest}
          <!-- 처리 액션 — 카드를 벗어나지 않고 그 자리에서 끝낸다.
               순서·색은 대시보드 배너와 동일(부정 좌 · 확정 우, §popup 취소/확인과 같은 축) -->
          <hr class="my-3 border-gray-100" />
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation()
                runChangeRequestAction(sch, 'reject')
              }}
              class="flex h-10 flex-1 items-center justify-center rounded-lg border border-red-200 text-body-02-normal-medium text-status-danger transition-colors hover:border-transparent hover:bg-status-danger-bg"
            >
              반려
            </button>
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation()
                runChangeRequestAction(sch, 'approve')
              }}
              class="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary-500 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600"
            >
              승인
            </button>
          </div>
        {/if}
      </div>
    {/key}
  {/if}
{/if}
