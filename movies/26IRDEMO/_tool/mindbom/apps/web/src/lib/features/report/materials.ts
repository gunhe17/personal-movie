/**
 * 종합보고서 편집 화면의 '검사자료' 타입과 표시 규칙.
 *
 * types.ts와 나눠 둔다 — 저쪽은 서버 DTO(ComprehensiveReport 등)이고,
 * 여기는 사이드바에 그려지는 자료 목록의 화면 모델이다. 서버가 주는 모양이
 * 아니라 편집기가 쓰기 좋은 모양으로 조립한 것이라 수명이 다르다.
 *
 * ⚠️ 검사의 이름·색은 여기서 정하지 않는다. 모듈 선언(ExamModule)이 단일
 *    출처이고 EXAM_TYPE_VISUAL이 그 파생 창구다. 예전에 이 화면은 로컬 표
 *    네 개(TYPE_COLOR·TYPE_HEX·TYPE_LABEL_KO·EXAM_TYPE_LABEL)를 갖고 있었는데,
 *    세 검사 색이 전부 모듈과 어긋나 있었다(로샤: 모듈 #3b82f6 vs 로컬 보라).
 *    exam-visual.ts 주석이 경고한 그대로다 — "차트가 별도 hex 표를 들고 있으면
 *    수동 동기화가 되어 반드시 어긋난다".
 */
import type { TableMeta } from '$lib/components/document-editor/editor-core'
import {
  EXAM_TYPE_VISUAL,
  examTypeLabel
} from '$lib/features/examination/common/exam-visual'
import { getExamModule, isSupportedExamType } from '$lib/features/examination/core/registry'
import type { ExamType } from '$lib/features/examination/core/registry'

/**
 * 이 화면이 API에서 받아 쓰는 만큼만 추린 모양.
 *
 * types.ts의 서버 DTO와 겹치지만 그쪽은 종합보고서 리소스(ComprehensiveReport)
 * 전용이고, 이건 검사·내담자·멤버를 개별 조회한 응답이다. 화면과 하위
 * 컴포넌트가 함께 쓰므로 route 안에 두지 않는다.
 */
export interface ExamDetail {
  id: string
  client_id: string
  examiner_id: string
  exam_type: string
  status: string
  scheduled_at?: string | null
  created_at?: string
}

export interface ClientInfo {
  id: string
  name: string
  birth_date: string | null
  gender: string | null
}

export interface MemberInfo {
  id: string
  name: string
}

/** 사이드바 자료 그리드의 한 칸 */
export interface MaterialAsset {
  id: string
  name: string
  kind: 'image' | 'table' | 'chart'
  src?: string
  table?: TableMeta
  count?: number
  /** chart 썸네일 형태 */
  chart?: 'profile' | 'bar' | 'radar' | 'line' | 'table'
  /** 썸네일 색 */
  color?: string
  /** 부가 설명 (예: "T점수 프로파일") */
  hint?: string
}

/** 검사 하나와 그 검사에 딸린 자료들 (사이드바의 한 섹션) */
export interface MaterialGroup {
  examId: string
  /** 배지에 쓰는 짧은 이름 (HTP·로샤·SCT, 목업은 MMPI-2 등) */
  code: string
  /** 그 아래 줄의 긴 이름 */
  nameKo: string
  date: string
  status: string
  /** 점 색 — Tailwind 클래스가 아니라 hex다(모듈 symbolColor는 팔레트 밖 색) */
  dotColor: string
  origin: 'real' | 'mock'
  /** 실검사만 결과 모달 열기 지원 */
  card: ResultCard | null
  items: MaterialAsset[]
}

/** 결과 모달을 열 수 있는 실검사 카드 */
export interface ResultCard {
  id: string
  examType: string // htp/rorschach/sct (원본)
  type: string // HTP/로샤/SCT
  label: string
  status: string
  date: string
}

/**
 * 실검사 에셋에 붙일 차트 썸네일 형태.
 *
 * 이것만 이 화면에 남는다 — 검사의 속성이 아니라 "사이드바 썸네일을 어떤
 * 그림으로 그릴까"라는 이 화면의 표현 선택이라 모듈이 알 필요가 없다.
 */
const CHART_BY_TYPE: Record<string, 'profile' | 'bar' | 'radar' | 'line'> = {
  htp: 'radar',
  rorschach: 'bar',
  sct: 'bar'
}

/** 검사 종류 → 썸네일 차트 형태 */
export function chartShapeFor(
  examType: string
): 'profile' | 'bar' | 'radar' | 'line' {
  return CHART_BY_TYPE[examType] ?? 'bar'
}

/** 검사 종류 → 점·차트 색 (모듈 symbolColor) */
export function colorFor(examType: string): string {
  return EXAM_TYPE_VISUAL[examType as ExamType]?.symbolColor ?? '#64748b'
}

/** 검사 종류 → 배지용 짧은 이름 (모듈 shortLabel) */
export function codeFor(examType: string): string {
  return examTypeLabel(examType)
}

/** 검사 종류 → 자료 목록에 적을 정식 명칭 (모듈 fullName) */
export function longNameFor(examType: string): string {
  if (!isSupportedExamType(examType)) return examType
  return getExamModule(examType).fullName
}
