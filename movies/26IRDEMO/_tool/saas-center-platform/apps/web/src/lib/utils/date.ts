/**
 * 날짜/시간 관련 유틸리티 함수들
 */

export const DAYS_IN_KOREA: string[] = [
  '일',
  '월',
  '화',
  '수',
  '목',
  '금',
  '토'
]

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 서버에서 오는 UTC 시간(문자열 또는 Date)을 UTC 기준 Date로 파싱합니다.
 * ISO 문자열에 timezone 정보(Z 또는 ±HH:mm)가 없으면 UTC로 간주합니다.
 */
export function parseAsUtc(date: Date | string): Date {
  if (date instanceof Date) return date
  const s = String(date).trim()
  if (!s) return new Date(NaN)
  // 이미 Z 또는 ±오프셋이 있으면 그대로 파싱
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s)
  // 없으면 UTC로 간주 (서버가 naive UTC로 보낼 때)
  return new Date(s.endsWith('Z') ? s : `${s.replace(/\.\d{3}$/, '')}Z`)
}

/**
 * UTC 시각을 한국 시간(KST)으로 포맷합니다.
 * 서버에서 UTC로 내려주는 start/end 등에 사용하세요.
 * format 토큰은 dateToString과 동일 (YYYY, MM/M, DD/D, HH, mm, d, ddd 등).
 * MM·DD = 0 패딩(08월), M·D = 패딩 없음(8월).
 */
export function formatUtcToKst(date: Date | string, format: string): string {
  const utcDate = parseAsUtc(date)
  if (isNaN(utcDate.getTime())) return ''
  // UTC + 9시간 = KST (한국은 서머타임 없음)
  const kstTime = new Date(utcDate.getTime() + KST_OFFSET_MS)
  const padZero = (n: number): string => n.toString().padStart(2, '0')
  const fullYear = kstTime.getUTCFullYear()
  const month = kstTime.getUTCMonth() + 1
  const day = kstTime.getUTCDate()
  const hours = kstTime.getUTCHours()
  const minutes = kstTime.getUTCMinutes()
  const seconds = kstTime.getUTCSeconds()
  const dayOfWeek = kstTime.getUTCDay()
  const dayLabel = DAYS_IN_KOREA[dayOfWeek]

  return format
    .replace('YYYY', `${fullYear}`)
    .replace('YY', `${String(fullYear).slice(-2)}`)
    .replace('MM', padZero(month))
    .replace('DD', padZero(day))
    // 한 자리 토큰 — 반드시 MM·DD 뒤에 온다(앞에 두면 MM의 첫 글자를 먼저 먹는다).
    // 대문자 M·D는 요일 토큰(소문자 d)과 겹치지 않는다.
    .replace('M', `${month}`)
    .replace('D', `${day}`)
    .replace('ddd', `${dayLabel}요일`)
    .replace('d', dayLabel)
    .replace('HH', padZero(hours))
    .replace('mm', padZero(minutes))
    .replace('SS', padZero(seconds))
}

/**
 * UTC ISO 문자열을 KST 기준 시/분으로 파싱합니다.
 * 주간/일간 캘린더에서 일정 바 위치 계산용으로 사용하세요.
 */
export function parseUtcToKstTime(isoString: string): {
  hour: number
  minute: number
} {
  const utcDate = parseAsUtc(isoString)
  const kstTime = new Date(utcDate.getTime() + KST_OFFSET_MS)
  return {
    hour: kstTime.getUTCHours(),
    minute: kstTime.getUTCMinutes()
  }
}

/**
 * 서버의 UTC(naive) 시각을 KST 벽시계 기준 Date로 변환합니다.
 * 반환 Date는 getUTC* 메서드로 읽으면 KST 시/분/요일/날짜가 나옵니다.
 * (로컬 타임존에 의존하지 않고 항상 KST로 계산할 때 사용)
 */
export function utcToKstDate(value: Date | string): Date {
  return new Date(parseAsUtc(value).getTime() + KST_OFFSET_MS)
}

/** UTC 시각의 KST 기준 요일 인덱스 (월=0 ~ 일=6) */
export function kstDayIndexMonFirst(value: Date | string): number {
  const day = utcToKstDate(value).getUTCDay() // 0(일)~6(토)
  return day === 0 ? 6 : day - 1
}

/** UTC 시각의 KST 기준 자정으로부터의 분 (0~1439) */
export function kstMinutesOfDay(value: Date | string): number {
  const kst = utcToKstDate(value)
  return kst.getUTCHours() * 60 + kst.getUTCMinutes()
}

/**
 * UTC ISO 문자열이 KST 기준으로 targetDate·targetHour와 같은지 확인합니다.
 * 일/주 캘린더에서 해당 셀에 일정을 넣을 때 사용하세요.
 */
export function isSameKstDateTime(
  utcIsoString: string,
  targetDate: Date,
  targetHour?: number
): boolean {
  const utcDate = parseAsUtc(utcIsoString)
  if (isNaN(utcDate.getTime())) return false
  const kstTime = new Date(utcDate.getTime() + KST_OFFSET_MS)
  const y = kstTime.getUTCFullYear()
  const m = kstTime.getUTCMonth()
  const d = kstTime.getUTCDate()
  const targetY = targetDate.getFullYear()
  const targetM = targetDate.getMonth()
  const targetD = targetDate.getDate()
  const sameDate =
    y === targetY && m === targetM && d === targetD
  if (targetHour !== undefined) {
    return sameDate && kstTime.getUTCHours() === targetHour
  }
  return sameDate
}

export const diffMinutes = (from: Date | undefined, to: Date | undefined) => {
  if (!from || !to) return
  const diffMs = to.getTime() - from.getTime()
  return Math.floor(diffMs / (1000 * 60))
}

export const dateToString = (date: Date | string, format: string) => {
  if (date) {
    const dateConvert = new Date(date)
    const DAY_IN_KOREA = DAYS_IN_KOREA[dateConvert.getDay()]

    const padZero = (num: number): string => num.toString().padStart(2, '0')

    const fullYear = dateConvert.getFullYear()
    return format
      .replace('YYYY', `${fullYear}`)
      .replace('YY', `${String(fullYear).slice(-2)}`)
      .replace('MM', `${padZero(dateConvert.getMonth() + 1)}`)
      .replace('DD', `${padZero(dateConvert.getDate())}`)
      // 한 자리 토큰 — MM·DD 뒤에 온다(formatUtcToKst와 동일 규칙)
      .replace('M', `${dateConvert.getMonth() + 1}`)
      .replace('D', `${dateConvert.getDate()}`)
      .replace('ddd', `${DAY_IN_KOREA}요일`)
      .replace('d', `${DAY_IN_KOREA}`)
      .replace('HH', `${padZero(dateConvert.getHours())}`)
      .replace('mm', `${padZero(dateConvert.getMinutes())}`)
      .replace('SS', `${padZero(dateConvert.getSeconds())}`)
  } else {
    return ''
  }
}

export const parseTimeFromISO = (isoString: string) => {
  const date = new Date(isoString)
  return { hour: date.getHours(), minute: date.getMinutes() }
}

export const isSameLocalDateTime = (
  isoString: string,
  targetDate: Date,
  targetHour?: number
): boolean => {
  const date = new Date(isoString)
  const dateStr = dateToString(date, 'YYYY-MM-DD')
  const yyyy = targetDate.getFullYear()
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
  const dd = String(targetDate.getDate()).padStart(2, '0')
  const localDateStr = `${yyyy}-${mm}-${dd}`

  if (targetHour !== undefined) {
    return dateStr === localDateStr && date.getHours() === targetHour
  }
  return dateStr === localDateStr
}

export const yyyymmddToDateSafe = (value: string): Date | null => {
  if (!/^\d{8}$/.test(value)) return null

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6)) - 1
  const day = Number(value.slice(6, 8))

  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate()
}

/** 기준 시각 이후 가장 가까운 정시/30분 슬롯 ("HH:mm"). 자정을 넘으면 "00:00" */
export const nextHalfHourSlot = (from: Date = new Date()): string => {
  const d = new Date(from)
  d.setSeconds(0, 0)
  const m = d.getMinutes()
  if (m > 0 && m <= 30) d.setMinutes(30)
  else if (m > 30) {
    d.setHours(d.getHours() + 1)
    d.setMinutes(0)
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const hourStr = String(hour).padStart(2, '0')
  const minute = i % 2 === 0 ? '00' : '30'
  const value = `${hourStr}:${minute}`

  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const title =
    minute === '00'
      ? `${period} ${displayHour}시`
      : `${period} ${displayHour}시 ${minute}분`

  return {
    title,
    value
  }
})

/**
 * 생년월일을 기준으로 현재 만나이 계산
 * @param birthDate 생년월일 문자열 (예: "1996-08-13" 또는 "1996.08.13")
 * @returns 만나이 (숫자)
 */
export const calculateAge = (birthDate: string | null | undefined): number => {
  if (!birthDate) return 0

  try {
    // 날짜 형식 정규화 (YYYY-MM-DD 또는 YYYY.MM.DD를 Date 객체로 변환)
    const normalizedDate = birthDate.replace(/\./g, '-')
    const birth = new Date(normalizedDate)

    // 유효한 날짜인지 확인
    if (isNaN(birth.getTime())) {
      console.error('유효하지 않은 날짜:', birthDate)
      return 0
    }

    const today = new Date()

    // 만나이 계산
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()

    // 생일이 지나지 않았으면 1살 빼기
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--
    }

    return age
  } catch (error) {
    console.error('나이 계산 오류:', error)
    return 0
  }
}

/**
 * 생년월일을 기준으로 현재 만나이를 문자열로 반환
 * @param birthDate 생년월일 문자열 (예: "1996-08-13" 또는 "1996.08.13")
 * @returns 만나이 문자열 (예: "27세")
 */
export const getAgeString = (birthDate: string | null | undefined): string => {
  const age = calculateAge(birthDate)
  return age > 0 ? `${age}세` : 'N/A'
}

export const parseDateParam = (dateParam: string) => {
  const [y, m, d] = dateParam.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const getDayOfWeek = (date: Date):
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday' => {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ] as const

  return days[date.getDay()]
}

export const formatLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * KST 기준 날짜+시간 문자열(HH:mm)을 UTC ISO 문자열로 변환합니다.
 * 서버에 일정 변경을 전송할 때 사용하세요.
 */
export function kstDateTimeToUtcIso(date: Date, timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  // date는 로컬 Date이지만 날짜 값(년/월/일)만 사용
  const kstMs =
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0) -
    KST_OFFSET_MS
  return new Date(kstMs).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
}