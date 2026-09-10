import type { TimelineItem } from './types'

const HOUR_MS = 60 * 60 * 1000

/** 데이터가 없거나 한 점에 몰렸을 때 쓰는 기본 업무시간대 */
const FALLBACK_START_HOUR = 9
const FALLBACK_END_HOUR = 18
/** 축이 이보다 좁아지면 카드가 과하게 벌어져 보인다 */
const MIN_SPAN_HOURS = 8

export interface DayRange {
  /** 축 시작(로컬 시각, 정시 정렬) */
  start: Date
  /** 축 끝(로컬 시각, 정시 정렬) */
  end: Date
}

/** 그 날 0시 */
export function startOfDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

/** 하루 뒤(다음 날 0시) */
export function addDays(d: Date, n: number): Date {
  const s = new Date(d)
  s.setDate(s.getDate() + n)
  return s
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * 그 날 항목들을 감싸는 시간축 범위를 정한다.
 *
 * 하루 전체(00~24)를 늘 그리면 새벽·심야의 빈 구간이 화면 절반을 먹고
 * 카드가 가운데로 뭉친다. 반대로 데이터 폭에 딱 맞추면 1건뿐인 날 축이
 * 사라지므로 최소 폭(MIN_SPAN_HOURS)을 보장한다.
 *
 * 경계는 정시로 떨어뜨린다 — 축 눈금이 09:37 같은 값에서 시작하면
 * 시간 라벨이 읽히지 않는다.
 */
export function resolveDayRange(items: TimelineItem[], day: Date): DayRange {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)

  const fallback = (): DayRange => ({
    start: hourOf(dayStart, FALLBACK_START_HOUR),
    end: hourOf(dayStart, FALLBACK_END_HOUR)
  })

  if (items.length === 0) return fallback()

  let minMs = Infinity
  let maxMs = -Infinity
  for (const item of items) {
    const t = item.when.anchorAt.getTime()
    if (t < minMs) minMs = t
    if (t > maxMs) maxMs = t
  }
  if (!Number.isFinite(minMs)) return fallback()

  // 정시로 내림/올림
  let start = floorToHour(new Date(minMs))
  let end = ceilToHour(new Date(maxMs))

  // 최소 폭 보장 — 데이터의 '중심'을 기준으로 벌린다.
  // start/end를 기준으로 벌리면 1건짜리 날(min===max)에 항목이 축 한쪽으로
  // 치우친다. ceilToHour가 앵커를 오른쪽으로 밀어 놓기 때문.
  const spanHours = (end.getTime() - start.getTime()) / HOUR_MS
  if (spanHours < MIN_SPAN_HOURS) {
    const midMs = (minMs + maxMs) / 2
    const halfSpan = (MIN_SPAN_HOURS / 2) * HOUR_MS
    start = floorToHour(new Date(midMs - halfSpan))
    end = new Date(start.getTime() + MIN_SPAN_HOURS * HOUR_MS)
  }

  // 하루 밖으로 새어 나가면 안쪽으로 밀어 넣는다(폭은 유지)
  if (start.getTime() < dayStart.getTime()) {
    const shift = dayStart.getTime() - start.getTime()
    start = dayStart
    end = new Date(Math.min(end.getTime() + shift, dayEnd.getTime()))
  }
  if (end.getTime() > dayEnd.getTime()) {
    const shift = end.getTime() - dayEnd.getTime()
    end = dayEnd
    start = new Date(Math.max(start.getTime() - shift, dayStart.getTime()))
  }

  return { start, end }
}

function hourOf(dayStart: Date, hour: number): Date {
  const d = new Date(dayStart)
  d.setHours(hour, 0, 0, 0)
  return d
}

function floorToHour(d: Date): Date {
  const s = new Date(d)
  s.setMinutes(0, 0, 0)
  return s
}

function ceilToHour(d: Date): Date {
  const s = floorToHour(d)
  if (s.getTime() !== d.getTime()) s.setHours(s.getHours() + 1)
  return s
}

/**
 * 축 눈금 시각들.
 *
 * 폭이 넓을수록 간격을 벌려 라벨이 겹치지 않게 한다.
 * (라벨 하나에 대략 44px은 있어야 "09시"가 안 잘린다)
 */
export function dayTicks(range: DayRange, viewportWidth: number): Date[] {
  const spanHours = (range.end.getTime() - range.start.getTime()) / HOUR_MS
  if (spanHours <= 0) return []

  const pxPerHour = viewportWidth / spanHours
  const stepHours = pxPerHour >= 44 ? 1 : pxPerHour >= 22 ? 2 : pxPerHour >= 11 ? 3 : 6

  const ticks: Date[] = []
  const cursor = new Date(range.start)
  // 시작 시각을 step 배수에 맞춘다 — 09,11,13… 보다 08,10,12…가 읽기 쉽다
  const aligned = Math.ceil(cursor.getHours() / stepHours) * stepHours
  cursor.setHours(aligned, 0, 0, 0)

  while (cursor.getTime() <= range.end.getTime()) {
    ticks.push(new Date(cursor))
    cursor.setHours(cursor.getHours() + stepHours)
  }
  return ticks
}

/** 시각 → 뷰포트 내 x(px). 범위 밖이면 범위를 벗어난 값이 그대로 나온다. */
export function timeToX(t: Date, range: DayRange, viewportWidth: number): number {
  const spanMs = range.end.getTime() - range.start.getTime()
  if (spanMs <= 0) return 0
  return ((t.getTime() - range.start.getTime()) / spanMs) * viewportWidth
}
