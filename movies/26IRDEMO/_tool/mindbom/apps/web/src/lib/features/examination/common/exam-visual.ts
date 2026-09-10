import type { ExamStatus } from './constants'
import { EXAM_TYPES, getExamModule, type ExamType } from '../core/registry'

export interface ExamTypeVisual {
  label: string
  pillClass: string
  /** 원형 심볼 블록의 배경색 — 흰 글자를 얹는다 */
  symbolColor: string
}

/**
 * 검사 타입의 표시 규칙 — 모듈 선언에서 파생된다.
 *
 * 예전에는 여기에 3종을 손으로 적어 뒀고, `EXAM_TYPE_LABELS`(constants.ts)와
 * 모듈 title, 생성 모달, 목록 필터까지 다섯 곳이 각자 이름을 갖고 있었다.
 * 그래서 같은 검사가 '로샤'와 '로르샤하'로 갈렸다.
 * 이제 이름·색의 출처는 모듈 하나다.
 */
export const EXAM_TYPE_VISUAL = Object.fromEntries(
  EXAM_TYPES.map((t) => {
    const m = getExamModule(t)
    return [
      t,
      { label: m.shortLabel, pillClass: m.pillClass, symbolColor: m.symbolColor }
    ]
  })
) as Record<ExamType, ExamTypeVisual>

/**
 * 검사 타입 → 표시 이름. 미지원 타입이면 원문을 그대로 돌려준다.
 *
 * 화면마다 `{ htp: 'HTP', rorschach: '로르샤하', ... }` 로컬 맵을 두던 것을
 * 대체한다 — 그렇게 두면 새 검사를 붙일 때 화면 수만큼 빠뜨리고,
 * 실제로 같은 검사가 화면마다 다른 이름으로 보였다.
 */
export function examTypeLabel(type: string): string {
  return EXAM_TYPE_VISUAL[type as ExamType]?.label ?? type
}

/**
 * 검사 상태의 표시 규칙 — 라벨·색의 단일 출처.
 *
 * 화면마다 로컬 상수를 두면 같은 상태가 다른 이름·다른 색으로 보인다
 * (실제로 'AI 초안'과 'AI 초안완료', violet과 orange가 공존했다).
 * 새 표기가 필요하면 여기에 필드를 추가하고 소비처가 읽어 가게 한다.
 */
export interface ExamStatusVisual {
  label: string
  dotClass: string
  textClass: string
  /**
   * SVG fill/stroke용 색. dotClass와 같은 색이어야 한다 —
   * 차트가 별도 hex 표를 들고 있으면 수동 동기화가 되어 반드시 어긋난다.
   * (dotClass의 Tailwind 기본 팔레트 값과 1:1로 맞춰 둔 것)
   */
  hex: string
  /** 진행 중임을 드러내는 상태. 점 대신 스피너를 돌린다. */
  spinning?: boolean
  /** 스피너 테두리색 — spinning일 때만 쓰인다. dotClass와 같은 색. */
  borderClass?: string
}

export const EXAM_STATUS_VISUAL: Record<ExamStatus, ExamStatusVisual> = {
  created: {
    label: '검사대기',
    dotClass: 'bg-gray-400',
    textClass: 'text-gray-600',
    hex: '#9ca3af'
  },
  in_progress: {
    label: '진행중',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600',
    hex: '#3b82f6'
  },
  ai_draft_ready: {
    label: 'AI 초안',
    dotClass: 'bg-purple-400',
    textClass: 'text-purple-600',
    hex: '#b98eff'
  },
  under_review: {
    label: '검토중',
    dotClass: 'bg-orange-500',
    textClass: 'text-orange-700',
    hex: '#ff9200'
  },
  confirmed: {
    label: '확인완료',
    dotClass: 'bg-green-500',
    textClass: 'text-green-700',
    hex: '#00bf40'
  },
  /*
   * confirmed와 색·라벨을 뚜렷이 갈라 둔다.
   *
   * 예전에는 '확인완료'(green-500) / '완료'(green-600)에 textClass는 둘 다
   * text-green-700이었다. 라벨도 색도 거의 같아 필터 목록에 나란히 뜨면
   * 무엇이 다른지 알 수 없었다.
   *
   * 두 상태는 성격이 다르다 — confirmed는 임상가가 초안을 확정한 것(사람의
   * 행위)이고, report_generated는 보고서가 발행된 종점(산출물)이다.
   *
   * 색은 색상환에서 가장 멀리 떨어진 자리를 골랐다. 처음엔 남색(#6366f1)을
   * 썼는데 진행중(H=217)과 22도, AI 초안(H=263)과 24도밖에 안 떨어져 파랑·
   * 보라 사이에 끼어 있었다 — 한 색을 고치며 다른 충돌을 만든 셈이다.
   * 연두(H=85)는 가장 가까운 검토중과도 51도 떨어진다.
   *
   * '완료'라는 이름도 쓰지 않는다. 플랫폼(마인드스코프)의 completed는
   * 담당자 검수로만 도달하는 별개 사건인데 같은 이름을 쓰면 동명이의가 된다
   * — completed를 상태 머신에서 뺀 것과 같은 논지다(state_machine.py).
   */
  report_generated: {
    label: '보고서 생성',
    dotClass: 'bg-lime-600',
    textClass: 'text-lime-700',
    hex: '#65a30d'
  },
  // 과거 데이터 전용 — 새로 만들어지지 않는다(constants.ts ExamStatus 주석).
  // 우리 축에서 사라진 값이므로 '완료'라는 이름을 그대로 둔다. 새 상태와
  // 같은 표시를 쓰면 과거 행이 report_generated인 것처럼 보인다.
  // 검사대기(#9ca3af)도 회색이라, 같은 명도면 둘이 거의 구분되지 않는다
  // (체감 색차 dE 19 — 25 아래면 헷갈린다). 과거 데이터는 더 어둡게 눌러
  // 뒤로 물러나 보이게 한다.
  completed: {
    label: '완료(과거)',
    dotClass: 'bg-gray-700',
    textClass: 'text-gray-700',
    hex: '#374151'
  }
}

/**
 * 워크플로 진행 순서. 필터 목록·차트 범례처럼 상태를 나열하는 곳이 쓴다.
 *
 * Record의 키 순서에 기대면 안 되므로 순서는 따로 명시한다.
 */
export const EXAM_STATUS_ORDER: ExamStatus[] = [
  'created',
  'in_progress',
  'ai_draft_ready',
  'under_review',
  'confirmed',
  'report_generated'
]
