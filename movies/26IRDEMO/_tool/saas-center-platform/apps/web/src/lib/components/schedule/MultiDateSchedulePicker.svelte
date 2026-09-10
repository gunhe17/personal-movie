<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import TimeSelect from '../TimeSelect.svelte'
  import Select from '../Select.svelte'
  import MultiDateCalendar from '../calendar/MultiDateCalendar.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'
  import {
    getOperatingHoursForDate,
    formatOperatingHoursRange
  } from '../../features/schedule/operating-hours'
  import {
    detectDatePattern,
    generateDatesFromPattern
  } from '../../utils/detectDatePattern'
  import type { DetectedPattern } from '../../utils/detectDatePattern'
  import {
    postValidateDatesSchedules,
    type DatesScheduleValidationResponse
  } from '../../hooks/actions/schedule.action'
  import { DAYS_IN_KOREA } from '../../utils/date'
  import SemacticNoticeBang16 from '../../assets/SemacticNoticeBang16.svelte'
  import WarbingCircleIcon16 from '../../assets/WarningCircleIcon16.svelte'
  import WarningCircleIcon16 from '../../assets/WarningCircleIcon16.svelte'
  import DeleteCircleIcon20 from '../../assets/DeleteCircleIcon20.svelte'

  interface Props {
    selectedDates: Date[]
    startTime: string
    endTime: string
    operatingTimes?: any[]
    /** 충돌 검증용 센터 ID (없으면 검증 스킵) */
    centerId?: string | null
    /** 충돌 검증용 장소 ID (없으면 검증 스킵) */
    roomId?: string | null
    /** 충돌 검증용 담당자 Member ID (선택). 제공 시 담당자 시간 중복까지 경고로 감지 */
    memberId?: string | null
    /** 수정 시 자기 자신의 스케줄 ID (충돌 검증에서 제외) */
    excludeScheduleId?: string | null
    showTitle?: boolean
    title?: string
    required?: boolean
    emptyMessage?: string
    enablePatternDetection?: boolean
    defaultFillCount?: number
    height?: string
    singleDate?: boolean
    /** 캘린더 사이즈: 'page' (772) | 'modal-large' (592) | 'modal' (기존 compact) */
    calendarSize?: 'page' | 'modal-large' | 'modal'
    /** 기존 일정 하이라이트 표시용 날짜 (bg-primary-100) */
    highlightedDates?: Date[]
    /** 프로그램 시간 적용 버튼 클릭 핸들러 */
    onApplyDuration?: (() => void) | null
    /** 프로그램 시간 적용 버튼 라벨 (예: "CBT 50분 적용") */
    durationLabel?: string | null
    /** 프로그램 시간(분) — 현재 시간과 비교하여 적용 상태 표시용 */
    durationMinutes?: number | null
    /** 충돌이 있는 장소명 (외부에서 읽기용, bindable) */
    conflictRoomName?: string | null
    /**
     * 전체 충돌에서 우세한 reason. 컨펌 모달 문구 분기용 (외부 bindable).
     * both > member > room 우선순위. 충돌 없으면 null.
     */
    conflictReason?: 'room' | 'member' | 'both' | null
  }

  let {
    selectedDates = $bindable([]),
    startTime = $bindable('10:00'),
    endTime = $bindable('11:00'),
    operatingTimes = [],
    centerId = null,
    roomId = null,
    memberId = null,
    excludeScheduleId = null,
    showTitle = true,
    title = '일정',
    required = true,
    emptyMessage = '날짜를 선택해주세요',
    enablePatternDetection = true,
    defaultFillCount = 8,
    height = '430px',
    singleDate = false,
    calendarSize = 'modal',
    highlightedDates = [],
    onApplyDuration = null,
    durationLabel = null,
    durationMinutes = null,
    conflictRoomName = $bindable(null),
    conflictReason = $bindable(null)
  }: Props = $props()

  const isPageSize = $derived(calendarSize === 'page')
  const isModalLarge = $derived(calendarSize === 'modal-large')
  const isExpandedMode = $derived(isPageSize || isModalLarge)

  // 모달 사이즈별 시간 UI 크기
  const timeH = $derived(isModalLarge ? 'h-10' : 'h-12')
  const timeW = $derived(isModalLarge ? 'w-[56px]' : 'w-[68px]')
  const selectW = $derived(isModalLarge ? 'w-[56px]' : 'w-[68px]')
  // page:        전체 772, 좌 308(달력) + 우 flex-1(선택된 날짜)
  // modal-large: 전체 100%(모달 740), 좌 308 + 우 flex-1
  // modal:       기존 300px 좌 + flex 우, height prop 사용

  // 좌측(달력) 컬럼 폭 — 표면별로 다르다: page 400 / modal-large 360.
  // 달력 한 줄 = 7*44 + 6*4 = 332. 컬럼이 그보다 넓은 만큼은 grid의 justify-center가
  // 좌우 여백으로 나눠 갖는다. 좌우 패딩까지 더한 값이 컬럼 폭을 넘으면 트랙이 잘리므로
  // modal-large(360)만 패딩을 px-3(24)으로 줄인다 — 332 + 24 = 356 ≤ 360.
  const calPadding = $derived(
    isModalLarge ? 'px-3 py-4' : isExpandedMode ? 'px-4 py-4' : 'p-3'
  )
  const sizeConfig = $derived(
    isPageSize
      ? responsive.breakpoint === '2xl'
        ? {
            width: '772px',
            leftWidth: '400px',
            calHeight: '406px',
            timeHeight: 'auto',
            // 좌측이 줄어든 만큼 우측(선택된 날짜)이 넓어지도록 flex-1
            rightWidth: null,
            minHeight: '702px',
            vertical: false
          }
        : responsive.breakpoint === 'xl' || responsive.breakpoint === 'lg'
          ? {
              // lg~xl (1024~1535): 좌측 308 고정, 우측 flex-1
              width: '100%',
              leftWidth: '400px',
              calHeight: '406px',
              timeHeight: 'auto',
              rightWidth: null,
              minHeight: '702px',
              vertical: false
            }
          : responsive.breakpoint === 'md'
            ? {
                // md 태블릿 (768~1023): 좌측 308 고정, 우측 flex-1
                width: '100%',
                leftWidth: '400px',
                calHeight: '406px',
                timeHeight: '316px',
                rightWidth: null,
                minHeight: '702px',
                vertical: false
              }
            : {
                // sm 모바일 (<768): 세로 배치
                width: '100%',
                leftWidth: '100%',
                calHeight: 'auto',
                timeHeight: 'auto',
                rightWidth: null,
                minHeight: 'auto',
                vertical: true
              }
      : isModalLarge
        ? {
            width: '100%',
            leftWidth: '360px',
            calHeight: '350px',
            timeHeight: '270px',
            rightWidth: null,
            minHeight: '620px'
          }
        : null
  )

  /* ---------- 운영시간 라벨 ---------- */

  const currentDayHours = $derived(
    getOperatingHoursForDate(
      operatingTimes,
      selectedDates.length > 0 ? selectedDates[0] : new Date()
    )
  )
  const operatingHoursLabel = $derived(
    formatOperatingHoursRange(currentDayHours)
  )

  /* ---------- 프로그램 시간 적용 상태 ---------- */

  const isDurationApplied = $derived.by(() => {
    if (!durationMinutes || !startTime || !endTime) return false
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const diffMin = eh * 60 + em - (sh * 60 + sm)
    return diffMin === durationMinutes
  })

  /* ---------- 날짜 선택 ---------- */

  let manualDates = $state<Date[]>([])

  function isSameDate(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  function handleToggleDate(date: Date) {
    const idx = selectedDates.findIndex((d) => isSameDate(d, date))
    if (idx >= 0) {
      selectedDates = selectedDates.filter((_, i) => i !== idx)
      manualDates = manualDates.filter((d) => !isSameDate(d, date))
    } else {
      selectedDates = [...selectedDates, date].sort(
        (a, b) => a.getTime() - b.getTime()
      )
      manualDates = [...manualDates, date].sort(
        (a, b) => a.getTime() - b.getTime()
      )
    }
  }

  function removeDate(date: Date) {
    selectedDates = selectedDates.filter((d) => !isSameDate(d, date))
    manualDates = manualDates.filter((d) => !isSameDate(d, date))
  }

  /* ---------- 캘린더 접기 ---------- */
  // 날짜를 고르고 나면 다음 초점은 시작시간이다. 캘린더가 화면을 다 차지하고 있으면
  // 그 흐름이 안 보이므로, 첫 선택 시 그리드를 접어 시작시간을 끌어올린다.
  // 자동 접힘은 0개 → 1개가 되는 최초 한 번뿐 — 펼친 뒤 다중 선택을 계속할 때
  // 클릭마다 접히면 오히려 방해가 된다. 그 뒤로는 헤더 토글로만 여닫는다.
  let isCalendarCollapsed = $state(false)

  // 접히는 시점 = '날짜 입력이 끝났다'는 의도 신호. 선택 개수로 판단하면
  // 다중 선택 중에 접혀 방해가 되므로, 아래 세 신호로만 접는다.
  //   ① singleDate — 클릭이 곧 확정이라 더 고를 게 없다
  //   ② 패턴 자동 채우기 실행 — 회차를 한 번에 확정한 것
  //   ③ 시간 영역 조작 — 다음 단계로 넘어간 것
  // 어느 경우든 헤더 토글로 언제든 다시 펼쳐 재선택할 수 있다.
  let pickerEl = $state<HTMLDivElement | null>(null)

  function collapseCalendar() {
    if (selectedDates.length > 0) isCalendarCollapsed = true
  }

  // 접히고 나면 시간 영역까지 한 화면에 들어와야 다음 단계가 보인다.
  // 접수 플로우의 다른 자동 스크롤은 전부 제거했지만, 이 전환만은 예외 —
  // 접힘으로 레이아웃이 크게 줄어드는 순간이라 사용자가 위치를 잃지 않게 맞춰준다.
  // 애니메이션(600ms)이 끝난 뒤의 최종 높이를 기준으로 삼는다.
  let wasCollapsed = false
  $effect(() => {
    const collapsed = isCalendarCollapsed
    if (collapsed === wasCollapsed) return
    wasCollapsed = collapsed
    if (!collapsed || !browser) return
    const el = pickerEl
    const timer = setTimeout(() => {
      // block:'nearest' = 안 보이는 만큼만 최소로 움직인다.
      // 'end'는 이미 보이는 경우에도 하단 정렬을 강행해, 스크롤 여유가 없는 페이지에서
      // 내려갔다가 최대 스크롤로 되돌아오는(튀는) 움직임을 만든다.
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 620)
    return () => clearTimeout(timer)
  })

  $effect(() => {
    if (selectedDates.length === 0) {
      // 전체삭제 등으로 비면 다시 펼친다
      isCalendarCollapsed = false
    } else if (singleDate) {
      isCalendarCollapsed = true
    }
  })

  /* ---------- 패턴 감지 & 자동 채우기 ---------- */

  const detectedPattern = $derived<DetectedPattern | null>(
    enablePatternDetection && selectedDates.length >= 2
      ? detectDatePattern(selectedDates)
      : null
  )

  // 과거 날짜가 선택됐는지 — 소급 기록 경고용(차단은 아님)
  const hasPastSelected = $derived.by(() => {
    const now = new Date()
    const floor = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime()
    return selectedDates.some((d) => d.getTime() < floor)
  })

  let isAutoFilled = $state(false)
  let fillCount = $state(defaultFillCount)

  const fillPreview = $derived(() => {
    if (!detectedPattern || selectedDates.length === 0)
      return { dates: [] as Date[], label: '' }
    const lastDate = selectedDates[selectedDates.length - 1]
    const dates = generateDatesFromPattern(detectedPattern, lastDate, fillCount)
    const totalCount = selectedDates.length + dates.length
    const lastGenDate = dates.length > 0 ? dates[dates.length - 1] : lastDate
    const dayLabel = DAYS_IN_KOREA[lastGenDate.getDay()]
    const label = `총 ${totalCount}회, 마지막 회기 ${lastGenDate.getFullYear()}-${String(lastGenDate.getMonth() + 1).padStart(2, '0')}-${String(lastGenDate.getDate()).padStart(2, '0')} (${dayLabel})`
    return { dates, label }
  })

  /** 자동 채우기 직전의 selectedDates 스냅샷 (되돌리기용) */
  let preFillDates = $state<Date[]>([])

  function handleAutoFill() {
    const preview = fillPreview()
    if (preview.dates.length > 0) {
      preFillDates = [...selectedDates]
      selectedDates = [...selectedDates, ...preview.dates].sort(
        (a, b) => a.getTime() - b.getTime()
      )
      isAutoFilled = true
      collapseCalendar()
    }
  }

  function handleKeepManualOnly() {
    selectedDates =
      preFillDates.length > 0 ? [...preFillDates] : [...manualDates]
    isAutoFilled = false
  }

  /* ---------- 충돌 검증 (validate-dates 단일 호출) ---------- */

  /** 날짜 인덱스 → 충돌 정보 맵 */
  interface ConflictInfo {
    roomName: string | null
    titles: string[]
    /**
     * 날짜 단위 대표 reason. 같은 날짜에 여러 건이 있을 때 우선순위는
     * both > member > room. UI가 배너 문구를 분기할 때 사용.
     */
    reason: 'room' | 'member' | 'both'
  }
  let conflictMap = $state<Record<number, ConflictInfo>>({})
  let validateTimer: ReturnType<typeof setTimeout> | null = null

  function pickDominantReason(
    reasons: (string | undefined | null)[]
  ): 'room' | 'member' | 'both' {
    if (reasons.some((r) => r === 'both')) return 'both'
    if (reasons.some((r) => r === 'member')) return 'member'
    return 'room'
  }

  $effect(() => {
    // reactive 의존성 읽기 — 모두 effect body 상단에서 읽어야 Svelte 5 runes가
    // 의존성으로 추적함 (setTimeout closure 내부 참조는 추적 안 됨).
    const dates = selectedDates
    const sTime = startTime
    const eTime = endTime
    const center = centerId
    const room = roomId
    const member = memberId
    const excludeId = excludeScheduleId

    // 필수 조건 체크 (member/excludeId는 선택이라 포함되지 않음)
    if (!center || !room || dates.length === 0 || !sTime || !eTime) {
      conflictMap = {}
      conflictRoomName = null
      return
    }

    // 디바운스 (400ms) — member/excludeId 변경도 디바운스 재설정
    if (validateTimer) clearTimeout(validateTimer)
    validateTimer = setTimeout(async () => {
      try {
        const validator = postValidateDatesSchedules()

        const result: DatesScheduleValidationResponse = await validator.request(
          {
            center_id: center,
            room_id: room,
            dates: dates.map((d) => {
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              return `${y}-${m}-${day}T00:00:00`
            }),
            start_time: sTime,
            end_time: eTime,
            ...(excludeId ? { exclude_schedule_id: excludeId } : {}),
            ...(member ? { member_id: member } : {})
          }
        )

        const map: Record<number, ConflictInfo> = {}
        if (result.has_conflicts) {
          for (const conflict of result.conflicts) {
            const idx = conflict.session_number - 1
            // highlightedDates에 해당하는 날짜는 기존 회기이므로 충돌에서 제외
            const date = dates[idx]
            if (
              date &&
              highlightedDates.some(
                (hd) =>
                  hd.getFullYear() === date.getFullYear() &&
                  hd.getMonth() === date.getMonth() &&
                  hd.getDate() === date.getDate()
              )
            ) {
              continue
            }
            // 방어적 필터 — 혹시 BE에서 exclude_id 누락되더라도 FE에서 자기 자신 제거
            const filtered = excludeId
              ? conflict.conflicting_schedules.filter((s) => s.id !== excludeId)
              : conflict.conflicting_schedules
            if (filtered.length === 0) continue

            const first = filtered[0]
            const reason = pickDominantReason(
              filtered.map((s) => s.conflict_reason)
            )
            map[idx] = {
              roomName: first?.room_name ?? null,
              titles: filtered.map((s) => s.title || '일정'),
              reason
            }
          }
        }
        conflictMap = map
        // 첫 번째 충돌의 장소명을 외부에 노출 (기존 호환)
        const firstConflict = Object.values(map)[0]
        conflictRoomName = firstConflict?.roomName ?? null
      } catch {
        conflictMap = {}
        conflictRoomName = null
      }
    }, 400)
  })

  const conflictCount = $derived(Object.keys(conflictMap).length)

  /**
   * 전체 충돌 중 "우세한" 이유. both > member > room.
   * 배너 문구 분기(B2)와 외부 컨펌 모달 문구 분기에 사용.
   */
  const dominantConflictReason = $derived<'room' | 'member' | 'both'>(
    conflictCount === 0
      ? 'room'
      : pickDominantReason(Object.values(conflictMap).map((c) => c.reason))
  )

  // 외부 bindable conflictReason 동기화 (호출처의 컨펌 모달이 참조).
  $effect(() => {
    conflictReason = conflictCount === 0 ? null : dominantConflictReason
  })

  /* ---------- page 사이즈 시간 UI 상태 ---------- */

  const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  )
  const MINUTE_OPTIONS = ['00', '15', '30', '45'] as const
  const DURATION_PRESETS = [30, 50, 90, 120, 180] as const

  // "HH:MM" → { h, m }
  function parseTime(t: string) {
    const [h, m] = t.split(':').map(Number)
    return { h: h || 0, m: m || 0 }
  }

  // 시작/종료에서 파생되는 시/분 상태
  const startParsed = $derived(parseTime(startTime))
  const endParsed = $derived(parseTime(endTime))

  // 총 시간 계산 (startTime/endTime 에서 도출 — 단일 소스)
  const totalMinutes = $derived.by(() => {
    const s = startParsed.h * 60 + startParsed.m
    const e = endParsed.h * 60 + endParsed.m
    return Math.max(0, e - s)
  })
  const totalTimeLabel = $derived(
    totalMinutes >= 60 && totalMinutes % 60 > 0
      ? `${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`
      : totalMinutes >= 60
        ? `${Math.floor(totalMinutes / 60)}시간`
        : `${totalMinutes}분`
  )

  // 현재 소요시간 (totalMinutes 기반). 외부 바인딩(startTime/endTime)에도 자동 반영됨.
  const currentDuration = $derived<number | null>(
    totalMinutes > 0 ? totalMinutes : null
  )

  // "직접 입력" 모드 (custom input UI 표시용)
  let customDurationInput = $state('')
  let isCustomDuration = $state(false)

  function setStartHour(h: string) {
    // startTime 변경 전에 현재 duration 을 캡처해야 함.
    // currentDuration 은 startTime/endTime 에서 derived 되므로
    // startTime 을 먼저 바꾸면 totalMinutes 가 꼬여서 duration 을 잃어버린다.
    const prevDuration = currentDuration
    const hour = Number(h)
    startTime = `${String(hour).padStart(2, '0')}:${String(startParsed.m).padStart(2, '0')}`
    if (prevDuration) applyDuration(prevDuration)
  }
  function setStartMinute(m: string) {
    const prevDuration = currentDuration
    startTime = `${String(startParsed.h).padStart(2, '0')}:${m}`
    if (prevDuration) applyDuration(prevDuration)
  }

  function applyDuration(minutes: number) {
    const startTotal = startParsed.h * 60 + startParsed.m
    const endTotal = Math.min(startTotal + minutes, 24 * 60)
    endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
  }

  function selectDuration(minutes: number) {
    isCustomDuration = false
    applyDuration(minutes)
  }

  function handleCustomDuration() {
    isCustomDuration = true
    customDurationInput = currentDuration ? String(currentDuration) : ''
  }

  function applyCustomDuration() {
    const minutes = Number(customDurationInput)
    if (minutes > 0) {
      isCustomDuration = false
      applyDuration(minutes)
    }
  }

  /* ---------- 유틸 ---------- */

  function formatDateDisplay(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dayLabel = DAYS_IN_KOREA[date.getDay()]
    return `${y}-${m}-${d} (${dayLabel})`
  }
</script>

<div class="space-y-3">
  {#if showTitle}
    <Typography
      variant={isPageSize
        ? 'title-01-normal-semibold'
        : 'body-02-normal-medium'}
      color="text-gray-700"
    >
      {title}
      {#if required}<span class="field-required">*</span>{/if}
    </Typography>
  {/if}

  <div
    bind:this={pickerEl}
    class="flex overflow-hidden rounded-xl border border-gray-200 {sizeConfig?.vertical
      ? 'flex-col'
      : 'flex-col md:flex-row'}"
    style={sizeConfig ? `width: ${sizeConfig.width};` : `height: ${height};`}
  >
    <!-- 좌: 캘린더 + 시간.
         justify-start — between으로 두면 컨테이너 min-height로 컬럼이 늘어났을 때
         캘린더와 시간 섹션 사이가 벌어져, 접어도 구분선이 아래에 남는다.
         남는 높이는 컬럼 하단으로 흘려보낸다 -->
    <div
      class="flex flex-col justify-start border-b border-gray-200 md:border-b-0 md:border-r shrink-0"
      style="width: {sizeConfig ? sizeConfig.leftWidth : '336px'}"
    >
      <!-- 캘린더 -->
      <!-- 높이 예약(min-height)은 접히는 그리드 블록 자신이 갖는다(gridMinHeight).
           바깥에 두고 접힘에 따라 켰다 끄면, CSS min-height 전환과 slide가 같은 높이를
           각자 애니메이션해 컨테이너가 두 곡선의 max로 계산되고 구분선이 튄다. -->
      <div class={calPadding}>
        <MultiDateCalendar
          {selectedDates}
          cellSize={44}
          gridMinHeight={null}
          collapsed={isCalendarCollapsed}
          onToggleCollapsed={() => (isCalendarCollapsed = !isCalendarCollapsed)}
          onToggleDate={handleToggleDate}
          {singleDate}
          {highlightedDates}
          disablePast
        />
        {#if hasPastSelected}
          <!-- 안내 배너 — 아이콘 + 타이틀(14/500) / 보조문(13/400), 간격 4 · 패딩 12x10.
               두 줄은 같은 색(컨테이너의 text-status-warning 상속)이고 위계는 굵기로만
               가른다 — 색을 두 개 쓰면 한 배너 안에서 목소리가 갈린다. 타이틀에
               <strong>(Bold)을 섞지 않는 것도 같은 이유(Medium 고정). -->
          <div
            class="mt-2 flex flex-col gap-2 rounded-lg bg-status-warning-bg px-3 py-3 text-status-warning"
          >
            <div class="flex items-center gap-2">
              <WarningCircleIcon16 />
              <Typography variant="body-02-normal-medium" color="text-current">
                이미 지난 날짜를 선택했어요
              </Typography>
            </div>
            <Typography variant="body-02-normal-regular" color="text-current">
              지난 회기를 등록하려는 게 아니라면 날짜를 다시 확인해주세요.
            </Typography>
          </div>
        {/if}
      </div>

      <!-- 시간 -->
      {#if isExpandedMode}
        <!-- 높이는 내용만큼(hug) — 고정 높이를 주면 시간 UI 아래로 빈 여백이 남는다.
             상한은 바깥 컨테이너의 max-height가 갖고, 넘치면 우측 목록이 스크롤된다 -->
        <div class="border-t border-gray-200 flex flex-col">
          <!-- 사방 패딩 16 · 시작 시간 ↔ 소요시간 간격 20(space-y-5).
               flex-1을 주지 않는다 — 주면 총 시간 요약이 영역 최하단으로 밀려
               접었을 때 소요시간 버튼과 멀어진다 -->
          <div class="p-4 space-y-5">
            <!-- 시작 시간 — 레이블↔내용 12.
                 여기를 건드리는 순간이 '날짜 입력 종료' 신호라 캘린더를 접는다.
                 소요시간까지 트리거로 묶으면 프리셋을 고를 때마다 접혀
                 위 콘텐츠가 줄어들며 스크롤이 튄다 -->
            <div class="space-y-3" onpointerdowncapture={collapseCalendar}>
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle">시작 시간</Typography
              >
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  <Select
                    options={HOUR_OPTIONS}
                    selected={String(startParsed.h).padStart(2, '0')}
                    initialScrollValue={String(startParsed.h).padStart(2, '0')}
                    on:change={(e) => setStartHour(e.detail)}
                    class="{timeH} rounded-lg"
                  />
                </div>
                <span class="text-gray-400">:</span>
                <div class="flex-1">
                  <Select
                    options={[...MINUTE_OPTIONS]}
                    selected={String(startParsed.m).padStart(2, '0')}
                    initialScrollValue={String(startParsed.m).padStart(2, '0')}
                    on:change={(e) => setStartMinute(e.detail)}
                    class="{timeH} rounded-lg"
                  />
                </div>
              </div>
            </div>
            <!-- 소요시간 — 레이블 우측에 프로그램 기본 시간 적용 버튼 (예: "놀이치료 90분 적용").
                 레이블↔내용 12 (시작 시간과 동일) -->
            <div class="space-y-3">
              <div class="flex items-baseline justify-between gap-2">
                <Typography
                  variant="body-02-normal-medium"
                  color="text-title-subtitle">소요시간</Typography
                >
                {#if onApplyDuration && durationLabel}
                  <button
                    type="button"
                    onclick={onApplyDuration}
                    class="text-body-03-normal-regular whitespace-nowrap transition-colors {isDurationApplied
                      ? 'text-primary-500'
                      : 'text-gray-400 hover:text-primary-500'}"
                  >
                    {durationLabel}
                  </button>
                {/if}
              </div>
              <div class="grid grid-cols-3 gap-2">
                {#each DURATION_PRESETS as dur}
                  <button
                    type="button"
                    onclick={() => selectDuration(dur)}
                    class="{timeH} rounded-lg border text-sm transition-colors {currentDuration ===
                      dur && !isCustomDuration
                      ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
                  >
                    {dur}분
                  </button>
                {/each}
                <button
                  type="button"
                  onclick={handleCustomDuration}
                  class="{timeH} rounded-lg border text-sm transition-colors {isCustomDuration ||
                  (currentDuration &&
                    !DURATION_PRESETS.includes(currentDuration as any))
                    ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
                >
                  {currentDuration &&
                  !DURATION_PRESETS.includes(currentDuration as any) &&
                  !isCustomDuration
                    ? `${currentDuration}분`
                    : '직접 입력'}
                </button>
              </div>
              {#if isCustomDuration}
                <div class="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    bind:value={customDurationInput}
                    placeholder="분 단위로 입력"
                    class="{timeH} flex-1 rounded-lg border border-gray-200 px-2.5 text-sm text-gray-700 focus:border-border-active focus:outline-none"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') applyCustomDuration()
                    }}
                  />
                  <button
                    type="button"
                    onclick={applyCustomDuration}
                    class="{timeH} px-4 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    확인
                  </button>
                </div>
              {/if}
            </div>
          </div>
          <!-- 총 시간 요약 — 배경은 sunken 면 토큰(bg/base, 연그레이).
               브랜드 틴트(primary 6%)는 강조 앵커라 여기서는 쓰지 않는다.
               레이블 = §Typography '레이블 표준' body-02-md(15/500) + gray-600.
               두 지표를 균등 분할하고 각각 가운데 정렬, 사이는 세로 구분선 -->
          <div
            class="mx-4 mb-4 flex h-20 items-center rounded-lg bg-bg-base px-5"
          >
            {#if currentDuration !== null}
              <!-- 레이블 14(body-03) · 레이블↔데이터 간격 12(space-y-3) -->
              <div class="flex-1 space-y-3 text-center">
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-600">선택된 시간</Typography
                >
                <Typography
                  variant="title-01-normal-medium"
                  color="text-gray-800"
                >
                  {startTime} ~ {endTime}
                </Typography>
              </div>
              <!-- 두 지표 사이 세로 구분선 — 양쪽이 flex-1이라 정확히 가운데에 놓인다 -->
              <span
                class="h-8 w-px shrink-0 bg-border-strong"
                aria-hidden="true"
              ></span>
              <div class="flex-1 space-y-3 text-center">
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-600">총 시간</Typography
                >
                <Typography
                  variant="title-01-normal-medium"
                  color="text-gray-800"
                >
                  {totalTimeLabel}
                </Typography>
              </div>
            {:else}
              <div class="flex w-full items-center justify-center">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-subtle"
                >
                  소요시간을 선택해주세요
                </Typography>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="border-t border-gray-200 px-3 py-3 space-y-2">
          <div class="flex items-center justify-between">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle">시간</Typography
            >
            <Typography variant="body-02-regular" color="text-gray-400"
              >운영 시간 {operatingHoursLabel}</Typography
            >
          </div>
          <div class="flex w-full items-center gap-2">
            <div class="flex-1">
              <TimeSelect
                bind:value={startTime}
                onChange={(v: string) => (startTime = v)}
              />
            </div>
            <span class="text-gray-400 shrink-0">~</span>
            <div class="flex-1">
              <TimeSelect
                bind:value={endTime}
                minTime={startTime}
                onChange={(v: string) => (endTime = v)}
              />
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- 우: 패턴 감지 + 선택 날짜 목록 -->
    <!-- width 만 지정. 높이는 flex align-items: stretch (default) 로 부모 높이에
         자동으로 맞춰지므로, 좌측 캘린더가 6주 월에서 늘어나면 함께 늘어난다. -->
    <div
      class="flex-1 flex flex-col min-w-0 {sizeConfig?.vertical
        ? ''
        : 'min-h-0 overflow-hidden'}"
      style={sizeConfig && sizeConfig.rightWidth
        ? `width: ${sizeConfig.rightWidth};`
        : ''}
    >
      <!-- 헤더 — 사방 16 (아래 목록도 px-4 pb-4로 통일) -->
      <div class="shrink-0 p-4 flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle">선택된 날짜</Typography
          >
          {#if !singleDate && selectedDates.length > 0}
            <Typography variant="body-02-normal-medium" color="text-primary-500"
              >{selectedDates.length}개</Typography
            >
          {/if}
        </div>
        {#if !singleDate && selectedDates.length > 0}
          <button
            type="button"
            onclick={() => {
              selectedDates = []
              manualDates = []
              isAutoFilled = false
            }}
            class="shrink-0 text-sm text-gray-500 underline hover:text-gray-700"
          >
            전체삭제
          </button>
        {/if}
      </div>

      {#if selectedDates.length === 0}
        <!-- 세로 중앙보다 위쪽에 둔다 — 목록이 채워질 자리(상단)를 가리키게 -->
        <!-- in만 건다 — 목록에 out:fade를 걸면 사라지는 동안 빈 메시지와 둘이 함께
             레이아웃을 차지해 한 겹 더 깔린 것처럼 보인다. 한 번에 하나만 존재시키고
             들어오는 쪽만 그 자리에서 부드럽게 나타나게 한다 -->
        <div
          class="flex flex-1 justify-center pt-16 min-h-[120px]"
          in:fade={{ duration: 220 }}
        >
          <Typography variant="body-01-normal-medium" color="text-body-subtle">
            {emptyMessage}
          </Typography>
        </div>
      {:else}
        <!-- 목록만 상한을 갖는다 — 컨테이너는 내용 높이(hug)를 따르고,
             날짜가 많아 상한을 넘을 때만 여기서 스크롤한다 -->
        <div
          class="flex-1 overflow-y-auto min-h-0 px-4 pb-4 space-y-3"
          style={sizeConfig && sizeConfig.minHeight !== 'auto'
            ? `max-height: ${parseInt(sizeConfig.minHeight, 10) - 100}px;`
            : ''}
        >
          <!-- 충돌 경고 배너 (conflict_reason에 따라 문구 분기) -->
          {#if conflictCount > 0}
            {@const roomLabel = conflictRoomName ?? '선택한 장소'}
            <div
              class="flex flex-col gap-2 rounded-lg bg-status-warning-bg px-3 py-3 text-status-warning"
            >
              <div class="flex items-center gap-2">
                <WarningCircleIcon16 />
                <Typography
                  variant="body-02-normal-medium"
                  color="text-current"
                >
                  <!-- 타이틀은 Medium 고정 — <strong>(Bold)을 섞으면 그 단어만 튄다
                       (과거 날짜 배너와 같은 규격) -->
                  {#if dominantConflictReason === 'member'}
                    선택한 시간에 담당자의 다른 일정이 있어요
                  {:else if dominantConflictReason === 'both'}
                    선택한 시간에 {roomLabel}과 담당자의 일정이 겹쳐요
                  {:else}
                    선택한 시간에 {roomLabel} 일정이 있어요
                  {/if}
                </Typography>
              </div>
              <Typography variant="body-02-normal-regular" color="text-current">
                {#if dominantConflictReason === 'member'}
                  다른 담당자를 지정하거나 날짜·시간을 변경해보세요
                {:else if dominantConflictReason === 'both'}
                  장소·담당자·시간 중 하나를 바꿔보세요
                {:else}
                  다른 장소를 선택하거나 날짜를 변경해보세요
                {/if}
              </Typography>
            </div>
          {/if}

          <!-- 패턴 감지 영역 -->
          {#if !singleDate && detectedPattern && !isAutoFilled}
            <!-- 보더 없이 면(primary-50)만으로 구분. 사방 패딩 16.
                 space-y-4 = 부제↔인풋, 미리보기↔버튼 모두 16 -->
            <div class="rounded-lg bg-primary-50 p-4 space-y-4">
              <!-- 제목 15/600 ↔ 부제 15/400, 간격 8 -->
              <div class="space-y-2">
                <Typography
                  variant="body-02-normal-semibold"
                  color="text-title-default"
                >
                  {detectedPattern.label}
                </Typography>
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  이 규칙으로 회기를 추가할까요?
                </Typography>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  bind:value={fillCount}
                  class="field-input w-20 text-center"
                />
                <Typography variant="body-02-regular" color="text-gray-600">
                  회 추가
                </Typography>
              </div>

              <Typography
                variant="body-02-normal-medium"
                color="text-primary-500"
              >
                {fillPreview().label}
              </Typography>

              <!-- 문서 §button-outline > outline-secondary 규격:
                   보더 gray-200 · 텍스트 gray-700 · bg 투명 · hover bg gray-50 · pressed gray-100.
                   크기는 Medium(40) — 라벨 Body_02(15) Medium · radius 8 · 아이콘 gap 8 -->
              <button
                type="button"
                onclick={handleAutoFill}
                class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-transparent text-body-02-normal-medium text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3.5v9M3.5 8h9"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                추가
              </button>
            </div>
          {/if}

          <!-- 선택된 날짜 목록 -->
          <div class="space-y-2">
            {#each selectedDates as date, idx}
              {@const conflictInfo = conflictMap[idx]}
              {@const hasConflict = !!conflictInfo}
              <!-- 텍스트 묶음 ↔ 삭제 버튼 gap 8 — justify-between만으로는 폭이 좁을 때
                   시간 텍스트가 삭제 버튼 밑으로 파고든다 -->
              <div
                class="flex items-center justify-between gap-2 rounded-[8px] border px-3 h-11
                  {hasConflict
                  ? 'border-status-warning/40 bg-status-warning-bg'
                  : 'border-gray-200 bg-white'}"
              >
                <!-- 날짜·시간은 줄바꿈 금지 — 좁아지면 줄이 나뉘어 행 높이(h-11)를 넘긴다 -->
                <div class="flex min-w-0 items-center gap-1.5">
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-gray-700"
                    className="shrink-0 whitespace-nowrap"
                  >
                    {formatDateDisplay(date)}
                  </Typography>
                  {#if currentDuration !== null}
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-500"
                      className="min-w-0 truncate-safe whitespace-nowrap"
                    >
                      {startTime} ~ {endTime}
                    </Typography>
                  {/if}
                </div>
                <button
                  type="button"
                  onclick={() => removeDate(date)}
                  aria-label="날짜 제거"
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                >
                  <DeleteCircleIcon20 />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
