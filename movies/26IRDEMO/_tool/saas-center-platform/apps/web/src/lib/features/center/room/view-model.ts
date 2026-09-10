/**
 * 상담실 관리 ViewModel
 * - room 메타 + schedule 집계를 UI 표현 모델로 변환
 * - schedule 집계는 백엔드 통계 API가 없어 프론트에서 room_name 기준으로 계산
 */

import type { RoomItemType } from '$lib/hooks/actions/room.action'
import type {
  ScheduleType,
  MappedSchedule
} from '$lib/hooks/actions/schedule.action'
import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
import {
  utcToKstDate,
  kstDayIndexMonFirst,
  kstMinutesOfDay,
  formatUtcToKst
} from '$lib/utils/date'

/** 방별 예약 집계 (오늘 / 이번 주) */
export interface RoomScheduleCount {
  today: number
  week: number
}

/** 카드 렌더용 ViewModel */
export interface RoomCardVM extends RoomItemType {
  todayCount: number
  weekCount: number
}

/** 상단 요약 대시보드 통계 */
export interface RoomSummaryStats {
  total: number
  active: number
  inactive: number
  todayReservation: number
}

/** 예약 타입(상담/검사) — block·meeting 제외 */
export type ReservationType = 'counseling' | 'assessment'

/**
 * 타입별 라벨·색상 (막대/범례 공용).
 * color는 전용 아이콘(Counsel24Icon / AssessmentStack) 주색에 맞춤.
 */
export const RESERVATION_TYPE_META: Record<
  ReservationType,
  { label: string; color: string }
> = {
  counseling: {
    label: '상담',
    color: '#F3BF21' // Counsel24Icon 주색
  },
  assessment: {
    label: '검사',
    color: '#0478ED' // AssessmentStack 주색
  }
}

/** 로컬(=KST) 날짜의 YYYY-MM-DD 키 */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** now 기준 이번 주(월~일)의 KST 날짜키 집합과 오늘 키 */
function weekKeys(now: Date): { todayKey: string; weekKeySet: Set<string> } {
  const monday = startOfWeek(now)
  const weekKeySet = new Set<string>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    weekKeySet.add(localDateKey(d))
  }
  return { todayKey: localDateKey(now), weekKeySet }
}

/**
 * schedule 목록을 room_name 기준으로 오늘/이번주 예약 건수 집계.
 * 시각은 서버 UTC(naive)이므로 KST 벽시계로 변환해 날짜를 판정한다.
 * block(운영 차단) 타입은 예약이 아니므로 제외한다.
 */
export function aggregateRoomSchedules(
  schedules: ScheduleType[],
  now: Date
): Map<string, RoomScheduleCount> {
  const map = new Map<string, RoomScheduleCount>()
  const { todayKey, weekKeySet } = weekKeys(now)

  for (const s of schedules) {
    if (s.schedule_type === 'block') continue
    const roomName = s.room_name
    if (!roomName) continue

    // UTC → KST 날짜키로 비교 (로컬 타임존 무관하게 일관)
    const kstKey = localDateKey(utcToKstDate(s.start))
    const entry = map.get(roomName) ?? { today: 0, week: 0 }

    if (weekKeySet.has(kstKey)) entry.week += 1
    if (kstKey === todayKey) entry.today += 1

    map.set(roomName, entry)
  }

  return map
}

/**
 * room 목록 + 집계 → 카드 VM 목록 (활성 우선 정렬).
 *
 * 정렬의 '활성 여부'는 현재 값이 아니라 `activeOrder`(진입 시점 스냅샷)를 본다.
 * 사용불가로 토글한 카드가 눈앞에서 곧장 맨 뒤로 튀면 사라진 것처럼 보이므로,
 * 순서는 그대로 두고 표시(흑백 썸네일·'사용불가'·스위치)만 바꾼다.
 * 새로고침·재진입하면 스냅샷이 다시 떠져 그때 맨 뒤로 간다 — 인지할 시간을 주는 것.
 * (내담자 목록의 비활성 처리와 같은 규칙. 스냅샷이 없으면 현재 값으로 정렬)
 */
export function mapToRoomCardVMs(
  rooms: RoomItemType[],
  counts: Map<string, RoomScheduleCount>,
  activeOrder?: Map<string, boolean>
): RoomCardVM[] {
  const orderOf = (room: RoomItemType) =>
    activeOrder?.get(room.id) ?? room.is_active

  return rooms
    .map((room) => {
      const c = counts.get(room.name) ?? { today: 0, week: 0 }
      return { ...room, todayCount: c.today, weekCount: c.week }
    })
    .sort((a, b) => {
      // 사용가능 먼저, 그 안에서는 오늘 예약 많은 순
      const aActive = orderOf(a)
      const bActive = orderOf(b)
      if (aActive !== bActive) return aActive ? -1 : 1
      return b.todayCount - a.todayCount
    })
}

/** room 목록 + 집계 → 요약 통계 */
export function buildRoomSummary(
  rooms: RoomItemType[],
  counts: Map<string, RoomScheduleCount>
): RoomSummaryStats {
  const active = rooms.filter((r) => r.is_active).length
  const todayReservation = rooms.reduce(
    (sum, r) => sum + (counts.get(r.name)?.today ?? 0),
    0
  )
  return {
    total: rooms.length,
    active,
    inactive: rooms.length - active,
    todayReservation
  }
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const DEFAULT_TL_START = 9
const DEFAULT_TL_END = 21

/** 요일×시간 간트 막대 1개 (선택된 방의 예약 1건) */
export interface TimelineBar {
  type: ReservationType
  /** 자정 기준 분 */
  startMin: number
  endMin: number
  /** 시작 시각 'HH:MM' (KST) */
  startLabel: string
  /** 내담자명 (다중이면 'A 외 N') — ScheduleLine과 동일 표시 */
  clientName: string
  /** 프로그램명 (있으면 우선 표시) */
  programName: string | null
  /** 취소 여부 (취소선 표시용) */
  isCancelled: boolean
  /** 'HH:MM ~ HH:MM' (툴팁용) */
  timeLabel: string
  /** 클릭 시 상세 모달에 넘길 매핑 데이터 (캘린더와 동일 형태) */
  schedule: MappedSchedule
}

/** 요일×시간 간트 한 행 (요일 1개) */
export interface TimelineDayRow {
  label: string
  isToday: boolean
  bars: TimelineBar[]
}

/** 선택된 방의 주간 요일×시간 타임라인 */
export interface RoomWeekTimeline {
  roomName: string
  is_active: boolean
  rows: TimelineDayRow[]
  /** 표시 시작/끝 시(hour) */
  startHour: number
  endHour: number
  ticks: number[]
  hasAny: boolean
}

/** 차트 표시 시간 범위 (시 단위) */
export interface HoursRange {
  startHour: number
  endHour: number
}

/**
 * 센터 운영시간 → 주간 차트 표시 범위 계산.
 * 이번 주 운영 요일 중 가장 이른 open ~ 가장 늦은 close 를 시(hour) 단위로.
 * 운영시간이 없으면 기본 9~21시.
 */
export function operatingHoursRange(
  operatingTimes: OperatingTimeSummary[] | undefined
): HoursRange {
  if (!operatingTimes || operatingTimes.length === 0)
    return { startHour: DEFAULT_TL_START, endHour: DEFAULT_TL_END }

  let minOpen = 24
  let maxClose = 0
  for (const ot of operatingTimes) {
    if (!ot.open_time || !ot.close_time) continue
    const open = parseHour(ot.open_time)
    const close = parseHourCeil(ot.close_time)
    minOpen = Math.min(minOpen, open)
    maxClose = Math.max(maxClose, close)
  }

  // 운영 요일이 하나도 없으면(전부 휴무) 기본값
  if (minOpen >= maxClose)
    return { startHour: DEFAULT_TL_START, endHour: DEFAULT_TL_END }

  return { startHour: minOpen, endHour: maxClose }
}

/** "HH:MM" → 시(내림) */
function parseHour(t: string): number {
  return Math.floor(Number(t.split(':')[0]))
}

/** "HH:MM" → 시(올림, 분이 있으면 +1시간) */
function parseHourCeil(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (m ?? 0) > 0 ? h + 1 : h
}

/**
 * 선택된 방의 이번 주 예약을 요일(월~일)×시간 간트로 변환.
 * 표시 시간 범위는 센터 운영시간(hoursRange)으로 고정해 가로 스크롤을 막는다.
 * 단, 운영시간 밖 예약이 있으면 그 예약이 잘리지 않도록 범위를 확장한다.
 */
export function buildRoomWeekTimeline(
  room: RoomItemType | null,
  schedules: ScheduleType[],
  now: Date,
  hoursRange: HoursRange
): RoomWeekTimeline {
  const todayIdx = dayIndexMonFirst(now)
  const baseStart = hoursRange.startHour
  const baseEnd = hoursRange.endHour

  if (!room) {
    return {
      roomName: '',
      is_active: true,
      rows: DAY_LABELS.map((label, i) => ({
        label,
        isToday: i === todayIdx,
        bars: []
      })),
      startHour: baseStart,
      endHour: baseEnd,
      ticks: tickRange(baseStart, baseEnd),
      hasAny: false
    }
  }

  const { weekKeySet } = weekKeys(now)

  const byDay: TimelineBar[][] = Array.from({ length: 7 }, () => [])
  // 운영시간을 기본 범위로 두되, 범위 밖 예약이 있으면 확장
  let minMin = baseStart * 60
  let maxMin = baseEnd * 60

  for (const s of schedules) {
    // 상담·검사만 표시 (block·meeting 제외)
    if (s.schedule_type !== 'counseling' && s.schedule_type !== 'assessment')
      continue
    if (s.room_name !== room.name) continue

    // 시각은 서버 UTC(naive) → KST 벽시계로 변환해 판정
    const kstStart = utcToKstDate(s.start)
    if (!weekKeySet.has(localDateKey(kstStart))) continue

    const startMin = kstMinutesOfDay(s.start)
    const endKstMin = kstMinutesOfDay(s.end)
    // 종료가 자정을 넘기거나(다음날) 시작보다 작으면 당일 끝으로 클램프
    const rawEndMin = endKstMin <= startMin ? 24 * 60 : endKstMin
    const endMin = Math.max(rawEndMin, startMin + 15)

    minMin = Math.min(minMin, startMin)
    maxMin = Math.max(maxMin, endMin)

    byDay[kstDayIndexMonFirst(s.start)].push({
      type: s.schedule_type,
      startMin,
      endMin,
      startLabel: fmtMin(startMin),
      clientName: formatClientNames(s.client_names),
      programName: s.program_name ?? null,
      isCancelled: s.session_status === 'cancelled',
      timeLabel: `${fmtMin(startMin)} ~ ${fmtMin(endKstMin)}`,
      schedule: toMappedSchedule(s)
    })
  }

  const startHour = Math.floor(minMin / 60)
  const endHour = Math.ceil(maxMin / 60)

  const rows: TimelineDayRow[] = DAY_LABELS.map((label, i) => ({
    label,
    isToday: i === todayIdx,
    bars: byDay[i].sort((a, b) => a.startMin - b.startMin)
  }))

  return {
    roomName: room.name,
    is_active: room.is_active,
    rows,
    startHour,
    endHour,
    ticks: tickRange(startHour, endHour),
    hasAny: rows.some((r) => r.bars.length > 0)
  }
}

function tickRange(startHour: number, endHour: number): number[] {
  const t: number[] = []
  for (let h = startHour; h <= endHour; h++) t.push(h)
  return t
}

/** 자정 기준 분 → 'HH:MM' (24:00 이상은 자정 넘김 표기) */
function fmtMin(minOfDay: number): string {
  const h = Math.floor(minOfDay / 60)
  const m = minOfDay % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 내담자명 배열 → 'A' 또는 'A 외 2' 표시 문자열 */
function formatClientNames(names: string[] | undefined): string {
  if (!names || names.length === 0) return '-'
  if (names.length === 1) return names[0]
  return `${names[0]} 외 ${names.length - 1}`
}

/**
 * ScheduleType → MappedSchedule 변환 (상세 모달 입력용).
 * 캘린더(ScheduleTimelineView)의 매핑과 동일 형태를 유지한다.
 */
function toMappedSchedule(s: ScheduleType): MappedSchedule {
  return {
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
  }
}

/** 월요일=0 ~ 일요일=6 인덱스 */
function dayIndexMonFirst(d: Date): number {
  const day = d.getDay() // 0(일)~6(토)
  return day === 0 ? 6 : day - 1
}

// ── date helpers (로컬 타임존 기준) ──

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

/** 월요일 시작 주 (now는 브라우저 로컬=KST 기준) */
function startOfWeek(d: Date): Date {
  const r = startOfDay(d)
  const day = r.getDay() // 0(일)~6(토)
  const diff = day === 0 ? -6 : 1 - day
  r.setDate(r.getDate() + diff)
  return r
}
