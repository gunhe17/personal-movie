/**
 * AI 상담 경과 분석 — API content → 화면 VM
 *
 * content는 두 세대가 섞여 있다. 2026-08 개편 이후 저장분은 근거 회기 번호를 단
 * 구조(headline/phases/session_track/themes/interventions/direction)이고, 그 이전
 * 저장분은 산문 5필드(progress_summary/recurring_themes/...)다. 옛 행을 다시 돌릴
 * 수는 없으므로(크레딧이 든다) 화면이 두 형태를 모두 읽는다.
 *
 * 옛 포맷에는 근거 회기가 없다 — `sessions: []`로 두면 화면이 근거 줄을 생략한다.
 */

import type {
  AnalysisTrend,
  CaseAnalysisContent,
  CaseAnalysisResult
} from '$lib/hooks/actions/case-analysis.action'
import { maskName } from '$lib/utils/maskingHandler'
import type { CounselingCaseBaseDetail } from '$lib/types/counseling'

export type Trend = AnalysisTrend
export type Attendance = 'attended' | 'absent' | 'no_show'
export type NoteSource = 'manual' | 'ai' | 'none'

export interface SessionRowVM {
  session: number
  date: string | null
  attendance: Attendance | null
  /** 그룹 표시용 — 접힌 `attendance` 한 값으로는 3/5와 5/5가 구분되지 않는다 */
  attendedCount: number | null
  participantCount: number | null
  noteSource: NoteSource
  topic: string | null
  mood: string | null
  intervention: string | null
  change: Trend | null
  homework: 'done' | 'partial' | 'none' | null
  turning: string | null
}

export interface PhaseVM {
  label: string
  range: string
  from: number
  to: number
  focus: string | null
  mood: string | null
  trend: Trend | null
  turning: string | null
}

export interface ThemeVM {
  name: string
  sessions: number[]
  note: string | null
}

export interface InterventionVM {
  name: string
  count: number
  sessions: number[]
  response: string | null
  effect: string | null
  evidence: string | null
}

export interface FactorVM {
  text: string
  sessions: number[]
}

export interface CoverageVM {
  completedSessions: number
  analyzedSessions: number
  noteCount: number
  manualNotes: number
  aiNotes: number
  moodNotes: number
  interventionNotes: number
  attendanceRate: number | null
  /** 예산을 넘어 일부만 넣은 일지 수 — 화면이 그 사실을 숨기지 않는다 */
  truncatedNotes: number
  perSessionChars: number | null
}

export interface CaseReportVM {
  // ── 이 리포트의 주체는 **케이스**다 (2026-09-03) ──
  // 예전엔 `clientName` 하나가 머리에 있었다. 그런데 분석 단위는 처음부터 케이스였고
  // (회기 일지를 케이스 단위로 묶어 돌린다), 그룹 케이스에서는 `clients[0]`만 집어
  // 이름을 세우는 게 사실과 어긋났다 — 다섯 명이 참여한 상담을 한 사람의 리포트처럼
  // 보이게 만든다. 그래서 머리에는 케이스가 서고, 사람은 참여자 줄로 내려간다.
  /** 케이스 표시명 — 프로그램명(그룹이면 ' - 그룹'). 헤더 breadcrumb·좌측 패널과 같은 표기 */
  caseTitle: string
  /** 상담 코드 — 케이스의 식별자 */
  caseCode: string
  /** 참여 내담자 전원. 개인 케이스면 1명, 그룹이면 전원 */
  clientNames: string[]
  /**
   * **이 분석이 그룹으로 만들어졌는가** (케이스가 그룹 프로그램인가가 아니다).
   * 정서·참석률 라벨과 회기별 출결 표시가 이 값으로 갈리는데, 그 값들은 서버가
   * 그룹으로 셈한 결과이므로 판정도 서버 것을 따라야 한다. 옛 분석(coverage 없음)은
   * 케이스 유형으로 폴백한다.
   */
  isGroup: boolean
  /** 분석 시점 명단 인원 — 지금 명단과 다를 수 있다 */
  clientCount: number
  chiefComplaint: string
  period: string
  planned: number
  headline: string | null
  /**
   * 서버는 계속 내려주지만 **화면은 그리지 않는다** (2026-09-03).
   * 프롬프트상 headline이 "무엇이 달라졌고 무엇이 남았는지"라 그 뒷절이 곧 이 값이다 —
   * 배너 `현재`와 AI 한 줄 정리가 같은 말을 두 번 하고 있었다. 매핑은 남겨둔다(계약 보존).
   */
  currentState: string | null
  moodTrend: Trend | null
  engagement: string | null
  alliance: string | null
  phases: PhaseVM[]
  sessionTrack: SessionRowVM[]
  themes: { recurring: ThemeVM[]; emerging: ThemeVM[]; resolved: ThemeVM[] }
  interventions: InterventionVM[]
  risks: FactorVM[]
  strengths: FactorVM[]
  direction: {
    goals: string[]
    approaches: string[]
    closing: string | null
    supervision: string[]
  }
  coverage: CoverageVM
  createdAt: string
  isLegacy: boolean
}

const TREND_VALUES: Trend[] = ['up', 'flat', 'down']
const LEGACY_TREND: Record<string, Trend> = {
  improved: 'up',
  stable: 'flat',
  declined: 'down'
}

function toTrend(value: unknown): Trend | null {
  if (typeof value !== 'string') return null
  if (TREND_VALUES.includes(value as Trend)) return value as Trend
  return LEGACY_TREND[value] ?? null
}

function toThemes(items: unknown, fallbackNames?: string[]): ThemeVM[] {
  if (
    Array.isArray(items) &&
    items.length > 0 &&
    typeof items[0] === 'object'
  ) {
    return (items as ThemeVM[]).map((t) => ({
      name: t.name,
      sessions: t.sessions ?? [],
      note: t.note ?? null
    }))
  }
  return (fallbackNames ?? []).map((name) => ({
    name,
    sessions: [],
    note: null
  }))
}

function toFactors(items: unknown, fallbackTexts?: string[]): FactorVM[] {
  if (
    Array.isArray(items) &&
    items.length > 0 &&
    typeof items[0] === 'object'
  ) {
    return (items as FactorVM[]).map((f) => ({
      text: f.text,
      sessions: f.sessions ?? []
    }))
  }
  return (fallbackTexts ?? []).map((text) => ({ text, sessions: [] }))
}

function legacyInterventions(content: CaseAnalysisContent): InterventionVM[] {
  return Object.entries(content.intervention_summary ?? {}).map(
    ([name, v]) => ({
      name,
      count: v?.frequency ?? 0,
      sessions: [],
      response: null,
      effect: v?.effectiveness ?? null,
      evidence: v?.evidence ?? null
    })
  )
}

function legacyTrack(content: CaseAnalysisContent): SessionRowVM[] {
  return (content.emotional_trajectory ?? []).map((p) => ({
    session: p.session,
    date: p.date ?? null,
    attendance: null,
    attendedCount: null,
    participantCount: null,
    noteSource: 'ai' as NoteSource,
    topic: null,
    mood: p.mood ?? null,
    intervention: null,
    change: toTrend(p.change_direction),
    homework: null,
    turning: null
  }))
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null
  const n = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
  return Number.isNaN(n) ? null : n
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

// 옛 포맷 분석은 날짜가 'YYYY-MM-DD'로, 신규는 'MM.DD'로 온다 — 표(회기별 기록)와
// 같은 표기로 맞춘다. 시작·끝이 같은 날이면 한 번만 쓴다("08.27 ~ 08.27"은 군더더기).
function shortDate(value: string): string {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/)
  return m ? `${m[1]}.${m[2]}` : value
}

function buildPeriod(sessions: SessionRowVM[], fallback: string): string {
  const dates = sessions
    .map((s) => s.date)
    .filter((d): d is string => !!d)
    .map(shortDate)
  if (dates.length === 0) return fallback
  const first = dates[0]
  const last = dates[dates.length - 1]
  return first === last ? first : `${first} ~ ${last}`
}

/**
 * 시크릿 모드에서 **AI가 쓴 문장 속 이름**을 가린다.
 *
 * 🔴 그룹 지원(2026-09-03)과 함께 생긴 문제다. 프롬프트가 `risks`·`strengths`를
 * "성원 이름으로 시작"하게 만들면서, 리포트 본문에 실명이 문장으로 박히기 시작했다.
 * 배너 이름은 `maskName`으로 가리는데 본문은 그대로면 시크릿 모드가 뚫린다
 * (화면 공유·어깨너머가 이 모드의 존재 이유다).
 *
 * 개별 컴포넌트에서 가리지 않고 **VM 한 곳에서** 처리한다 — 이름은 리포트 어느
 * 문장에도 들어갈 수 있어서(요약·주제 메모·개입 반응·회기 요약), 자리마다 거는
 * 방식으로는 반드시 빠뜨리는 곳이 생긴다.
 */
function maskNamesDeep<T>(value: T, names: string[]): T {
  if (names.length === 0) return value
  // 긴 이름부터 — 짧은 이름이 긴 이름의 일부인 경우("김하" ⊂ "김하은") 순서가 중요하다
  const ordered = [...names].sort((a, b) => b.length - a.length)
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      let out = v
      for (const n of ordered) out = out.split(n).join(maskName(n))
      return out
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => [
          k,
          walk(x)
        ])
      )
    }
    return v
  }
  return walk(value) as T
}

export function buildCaseReport(
  analysis: CaseAnalysisResult,
  caseDetail: CounselingCaseBaseDetail,
  options: { maskNames?: boolean } = {}
): CaseReportVM {
  const c = analysis.content ?? {}
  const isLegacy =
    !c.headline && !c.session_track?.length && !!c.progress_summary

  const sessionTrack: SessionRowVM[] = c.session_track?.length
    ? c.session_track.map((row) => ({
        session: row.session,
        date: row.date ?? null,
        attendance: row.attendance ?? null,
        attendedCount: row.attended_count ?? null,
        participantCount: row.participant_count ?? null,
        noteSource: (row.note_source ?? 'none') as NoteSource,
        topic: row.topic ?? null,
        mood: row.mood ?? null,
        intervention: row.intervention ?? null,
        change: toTrend(row.change),
        homework: row.homework ?? null,
        turning: row.turning ?? null
      }))
    : legacyTrack(c)

  const phases: PhaseVM[] = (c.phases ?? [])
    .filter((p) => p.from != null && p.to != null)
    .map((p) => ({
      label: p.label ?? '',
      range: `${p.from}~${p.to}회기`,
      from: p.from as number,
      to: p.to as number,
      focus: p.focus ?? null,
      mood: p.mood ?? null,
      trend: toTrend(p.trend),
      turning: p.turning ?? null
    }))

  const cov = c.coverage ?? {}
  const analyzed =
    cov.analyzed_sessions ?? analysis.session_count ?? sessionTrack.length
  const coverage: CoverageVM = {
    completedSessions: cov.completed_sessions ?? analyzed,
    analyzedSessions: analyzed,
    noteCount: cov.note_count ?? 0,
    manualNotes: cov.manual_notes ?? 0,
    aiNotes: cov.ai_notes ?? 0,
    moodNotes: cov.mood_notes ?? 0,
    interventionNotes: cov.intervention_notes ?? 0,
    attendanceRate:
      cov.attendance_rate ??
      parsePercent(c.therapeutic_alliance?.attendance_rate),
    truncatedNotes: cov.truncated_notes ?? 0,
    perSessionChars: cov.per_session_chars ?? null
  }

  // 케이스 표시명의 '- 그룹'은 **케이스 유형**을 따른다(breadcrumb·좌측 패널과 같은 표기).
  // 반면 아래 isGroup은 **분석 단위**라 출처가 다르다 — 둘은 갈릴 수 있고, 갈리는 게 사실이다.
  const isGroupCaseType = caseDetail.case_type !== 'individual'
  const clientNames = (caseDetail.clients ?? [])
    .map((c) => c.name)
    .filter((n): n is string => !!n)
  const isGroup = c.coverage?.is_group ?? isGroupCaseType
  const clientCount = c.coverage?.client_count ?? clientNames.length

  const vm: CaseReportVM = {
    caseTitle: `${caseDetail.program_name}${isGroupCaseType ? ' - 그룹' : ''}`,
    caseCode: caseDetail.case_code,
    clientNames,
    isGroup,
    clientCount,
    chiefComplaint: caseDetail.chief_complaint || '기록 없음',
    period: buildPeriod(sessionTrack, formatDate(analysis.created_at)),
    planned: caseDetail.total_sessions,
    headline: c.headline ?? c.progress_summary ?? null,
    currentState: c.current_state ?? null,
    moodTrend: toTrend(c.mood_trend),
    engagement:
      c.alliance?.engagement ??
      c.therapeutic_alliance?.engagement_level ??
      null,
    alliance: c.alliance?.evidence ?? c.therapeutic_alliance?.evidence ?? null,
    phases,
    sessionTrack,
    themes: {
      recurring: toThemes(c.themes?.recurring, c.recurring_themes),
      emerging: toThemes(c.themes?.emerging, c.emerging_themes),
      resolved: toThemes(c.themes?.resolved)
    },
    interventions: c.interventions?.length
      ? c.interventions.map((it) => ({
          name: it.name,
          count: it.count ?? 0,
          sessions: it.sessions ?? [],
          response: it.response ?? null,
          effect: it.effect ?? null,
          evidence: it.evidence ?? null
        }))
      : legacyInterventions(c),
    risks: toFactors(c.risks, c.risk_factors),
    strengths: toFactors(
      c.strengths,
      (c as { strengths?: string[] }).strengths
    ),
    direction: {
      goals: c.direction?.goals ?? [],
      approaches:
        c.direction?.approaches ??
        (c.recommendations ? [c.recommendations] : []),
      closing: c.direction?.closing ?? null,
      supervision: c.direction?.supervision ?? []
    },
    coverage,
    createdAt: formatDate(analysis.created_at),
    isLegacy
  }

  // 신원(이름·인원)은 마스킹 대상이 아니다 — 배너가 자기 자리에서 이미 가린다.
  // 여기서 가리는 건 **AI가 쓴 문장 안에 박힌 이름**뿐이다.
  if (!options.maskNames) return vm
  const { caseTitle, caseCode, clientNames: keep, ...rest } = vm
  return {
    ...maskNamesDeep(rest, clientNames),
    caseTitle,
    caseCode,
    clientNames: keep
  }
}
