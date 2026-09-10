// ⚠️ 시연용 목업 데이터 — 실제 API 연동 전 임시.
// 실기능 전환 시 이 파일의 export 시그니처를 유지한 채 내부를 API 호출로 교체하면 된다.
//   getMockBattery()      → GET /institutions/{id}/clients/{cid}/examinations (배터리 전체)
//   getMockAxisScores()   → GET /institutions/{id}/clients/{cid}/longitudinal
//   getMockAiReview()     → POST /api/report/review

/**
 * 교차분석 공통 축 — 검사 종류가 달라도 이 임상 구성개념으로 묶어 비교한다.
 *
 * ⚠️ 중요: 이 축은 "점수를 환산하는 척도"가 아니라 "같은 구성개념을 다루는
 * 지표들을 모으는 분류"다. 표준화 검사는 규준이 있는 실제 점수(T점수·백분위)를
 * 그대로 쓰고, 투사적 검사(HTP·로르샤하·SCT)는 규준 점수가 존재하지 않으므로
 * 정성 소견(관찰된 지표)으로만 표시한다. 서로 다른 검사의 원점수를 하나의
 * 0~100 척도로 환산하는 것은 표준화된 근거가 없어 하지 않는다.
 */
export interface AnalysisAxis {
  key: string
  label: string
  /** 임상적 해석 방향: high면 높을수록 위험 */
  direction: 'high' | 'low'
}

export const ANALYSIS_AXES: AnalysisAxis[] = [
  { key: 'aggression', label: '공격성', direction: 'high' },
  { key: 'depression', label: '우울', direction: 'high' },
  { key: 'anxiety', label: '불안', direction: 'high' },
  { key: 'impulse', label: '충동조절', direction: 'low' },
  { key: 'social', label: '대인관계', direction: 'low' },
  { key: 'selfConcept', label: '자기개념', direction: 'low' },
  { key: 'reality', label: '현실검증', direction: 'low' }
]

/** 임상적 방향성 — 지표가 해당 축에서 무엇을 가리키는가 */
export type Direction = 'elevated' | 'normal' | 'low'

/** 검사 하나가 특정 축에 대해 내놓은 소견 */
export interface AxisFinding {
  axisKey: string
  /**
   * 규준 기반 점수(0~100 백분위/T점수 환산). 표준화 검사만 값을 갖는다.
   * 투사적 검사는 규준 점수가 없으므로 null — 차트에 점으로 찍지 않는다.
   */
  value: number | null
  /** 원 척도 표기 (예: "T=72 (Pd)", "DEPI=5", "AG=1") */
  raw: string
  /** 임상적 방향 — 점수가 없는 정성 지표도 이 값으로 비교한다 */
  direction: Direction
  /** 해당 검사에서 이 축을 뒷받침하는 근거 */
  evidence: string
}

export interface MockExam {
  id: string
  /** 실제 검사면 real, 목업이면 mock */
  origin: 'real' | 'mock'
  /**
   * 검사 유형 — standardized: 규준 점수 보유(정량 비교 가능)
   *            projective: 규준 점수 없음(정성 소견만)
   */
  kind: 'standardized' | 'projective'
  code: string
  name: string
  date: string
  status: string
  /** tailwind 색 (점 표시) */
  dot: string
  /** 차트 선/막대 색 (hex) */
  color: string
  scores: AxisFinding[]
}

/**
 * 시연 목업 배터리 — 실제 연결된 HTP/SCT/Rorschach 외에
 * "종합 심리평가 배터리"처럼 보이도록 표준화 검사 4종을 추가.
 */
export const MOCK_EXAMS: MockExam[] = [
  // ── 표준화 검사: 규준 점수 보유 → 정량 비교 가능 ──
  {
    id: 'mock-mmpi',
    origin: 'mock',
    kind: 'standardized',
    code: 'MMPI-2',
    name: '다면적 인성검사 II',
    date: '2026.06.28',
    status: '확인완료',
    dot: 'bg-sky-500',
    color: '#0ea5e9',
    scores: [
      { axisKey: 'aggression', value: 72, raw: 'T=72 (Pd)', direction: 'elevated', evidence: '척도 4(Pd) 상승 — 충동 통제 곤란, 규범 갈등' },
      { axisKey: 'depression', value: 66, raw: 'T=66 (D)', direction: 'elevated', evidence: '척도 2(D) 경계선 상승' },
      { axisKey: 'anxiety', value: 60, raw: 'T=60 (Pt)', direction: 'normal', evidence: '척도 7(Pt) 평균 상단' },
      { axisKey: 'impulse', value: 33, raw: 'T=67 (DISC)', direction: 'low', evidence: 'PSY-5 통제결여(DISC) 상승 — 행동 억제 곤란' },
      { axisKey: 'social', value: 37, raw: 'T=63 (Si)', direction: 'low', evidence: '척도 0(Si) 상승 — 사회적 내향성' },
      { axisKey: 'selfConcept', value: 42, raw: 'T=58 (Lse)', direction: 'low', evidence: '낮은 자존감 내용척도 상승' },
      { axisKey: 'reality', value: 62, raw: 'T=54 (Sc)', direction: 'normal', evidence: '척도 8 정상 범위 — 현실검증 유지' }
    ]
  },
  {
    id: 'mock-sscale',
    origin: 'mock',
    kind: 'standardized',
    // 한국지능정보사회진흥원(NIA) 성인 스마트폰 과의존 척도.
    // 총점 23~30 잠재적위험, 31~48 고위험 (성인 기준).
    code: 'S-척도',
    name: '스마트폰 과의존 척도 (성인)',
    date: '2026.06.28',
    status: '확인완료',
    dot: 'bg-rose-500',
    color: '#f43f5e',
    scores: [
      { axisKey: 'impulse', value: 22, raw: '총점 41 (고위험군)', direction: 'low', evidence: '조절실패 하위영역 최고점 — 사용시간 통제 반복 실패' },
      { axisKey: 'depression', value: 71, raw: '문제적결과 13/16', direction: 'elevated', evidence: '수면 곤란·무기력 등 일상 기능 저하 동반 보고' },
      { axisKey: 'anxiety', value: 74, raw: '현저성 12/15', direction: 'elevated', evidence: '스마트폰 미사용 시 초조·불안 호소' },
      { axisKey: 'social', value: 31, raw: '문제적결과 문항 4·7', direction: 'low', evidence: '대면 관계 회피, 온라인 관계로 대체 경향' },
      { axisKey: 'selfConcept', value: 29, raw: '조절실패 문항 2', direction: 'low', evidence: '통제 실패 반복에 따른 자기효능감 저하' }
    ]
  },
  {
    id: 'mock-tci',
    origin: 'mock',
    kind: 'standardized',
    code: 'TCI',
    name: '기질 및 성격검사',
    date: '2026.07.02',
    status: '확인완료',
    dot: 'bg-teal-500',
    color: '#14b8a6',
    scores: [
      { axisKey: 'aggression', value: 40, raw: 'HA 백분위 40', direction: 'normal', evidence: '위험회피 중간 — 공격 표출보다 억제 우세' },
      { axisKey: 'depression', value: 40, raw: 'HA 백분위 40', direction: 'normal', evidence: '위험회피 중간 — 우울 취약 기질 뚜렷하지 않음' },
      { axisKey: 'anxiety', value: 45, raw: 'PS 백분위 45', direction: 'normal', evidence: '인내력 중간 범위' },
      { axisKey: 'impulse', value: 28, raw: 'NS 백분위 72', direction: 'low', evidence: '자극추구 높고 인내력 중간 — 즉각적 보상 추구 경향' },
      { axisKey: 'social', value: 25, raw: 'CO 백분위 25', direction: 'low', evidence: '연대감 낮음 — 관계에서 자신의 방식 우선' },
      { axisKey: 'selfConcept', value: 60, raw: 'SD 백분위 60', direction: 'normal', evidence: '자율성 중간 — 자기개념 비교적 유지' }
    ]
  },
  // ── 투사적 검사: 규준 점수 없음 → 정성 소견만 (value: null) ──
  {
    id: 'mock-htp',
    origin: 'real',
    kind: 'projective',
    code: 'HTP',
    name: '집-나무-사람',
    date: '2026.07.14',
    status: '확인완료',
    dot: 'bg-green-500',
    color: '#00bf40',
    scores: [
      { axisKey: 'aggression', value: null, raw: '강한 필압 · 예각 가지', direction: 'elevated', evidence: '나무 가지 끝 예각 처리, 강한 필압 — 공격 충동 시사' },
      { axisKey: 'depression', value: null, raw: '용지 하단 배치', direction: 'elevated', evidence: '작게 그려진 화면 하단 배치 — 위축·우울감' },
      { axisKey: 'anxiety', value: null, raw: '음영 · 반복 수정', direction: 'elevated', evidence: '음영 처리와 잦은 지우기 — 불안 수준 시사' },
      { axisKey: 'impulse', value: null, raw: '선 이탈 · 필압 변동', direction: 'low', evidence: '윤곽선 이탈과 급격한 필압 변화 — 운동 통제 불안정' },
      { axisKey: 'social', value: null, raw: '창문 생략 · 작은 문', direction: 'low', evidence: '창문 생략, 문 작게 — 대인 접촉 회피' },
      { axisKey: 'selfConcept', value: null, raw: '인물상 크기 축소', direction: 'low', evidence: '인물 크기 축소 — 낮은 자기가치감' },
      { axisKey: 'reality', value: null, raw: '기저선 · 비례 유지', direction: 'normal', evidence: '기저선 존재, 비례 유지 — 현실검증 보존' }
    ]
  },
  {
    id: 'mock-ror',
    origin: 'real',
    kind: 'projective',
    code: 'Rorschach',
    name: '로르샤하',
    date: '2026.07.14',
    status: '확인완료',
    dot: 'bg-purple-500',
    color: '#9b5dff',
    scores: [
      { axisKey: 'aggression', value: null, raw: 'AG=1, S=2', direction: 'normal', evidence: 'AG 반응 1개 — 공격성 지표 정상 범위' },
      { axisKey: 'depression', value: null, raw: 'DEPI=5', direction: 'elevated', evidence: 'DEPI 5점 — 우울 지표 유의' },
      { axisKey: 'anxiety', value: null, raw: 'Y=3, m=2', direction: 'elevated', evidence: '음영·무생물운동 반응 상승 — 상황적 스트레스' },
      { axisKey: 'impulse', value: null, raw: 'FC:CF+C = 3:1', direction: 'normal', evidence: '형태우세 색채반응 우위 — 정서 조절 비교적 유지' },
      { axisKey: 'social', value: null, raw: 'CDI=4, COP=0', direction: 'low', evidence: 'CDI 4점 — 대처결함, 협응반응 없음' },
      { axisKey: 'selfConcept', value: null, raw: 'Egoc=0.28, MOR=3', direction: 'low', evidence: '자기중심성 낮고 손상반응 3개' },
      { axisKey: 'reality', value: null, raw: 'XA%=0.78, PTI=1', direction: 'low', evidence: 'XA% 다소 저하 — 지각 정확성 경미 손상' }
    ]
  },
  {
    id: 'mock-sct',
    origin: 'real',
    kind: 'projective',
    code: 'SCT',
    name: '문장완성검사',
    date: '2026.07.02',
    status: '확인완료',
    dot: 'bg-orange-500',
    color: '#ff9200',
    scores: [
      { axisKey: 'aggression', value: null, raw: '가족영역 2/12', direction: 'elevated', evidence: '"아버지는…" 문항 적대감 간접 표현' },
      { axisKey: 'depression', value: null, raw: '자기개념 3/12', direction: 'elevated', evidence: '"내가 바라는 것은…" 무망감 표현' },
      { axisKey: 'anxiety', value: null, raw: '미래영역 4/12', direction: 'elevated', evidence: '미래 관련 문항에 회피적 응답' },
      { axisKey: 'impulse', value: null, raw: '자기개념 문항 9', direction: 'low', evidence: '"내가 저지른 가장 큰 잘못은…" 충동적 행동 후회 기술' },
      { axisKey: 'social', value: null, raw: '대인영역 5/12', direction: 'normal', evidence: '친구 관련 문항은 비교적 긍정적' },
      { axisKey: 'selfConcept', value: null, raw: '자기개념 3/12', direction: 'low', evidence: '자기 기술 문항 전반 부정적' },
      { axisKey: 'reality', value: null, raw: '비논리적 응답 없음', direction: 'normal', evidence: '기괴하거나 비논리적인 응답 없음' }
    ]
  }
]

/** 검사 간 불일치 — 같은 축에서 검사들이 상반된 방향을 가리킬 때 */
export interface Discrepancy {
  axisKey: string
  axisLabel: string
  /** 상승을 시사한 검사들 */
  elevated: FindingRef[]
  /** 정상/낮음을 시사한 검사들 */
  contrary: FindingRef[]
  /** 규준 점수를 가진 검사만 추린 정량 근거 (없을 수 있음) */
  quantitative: FindingRef[]
  /** 임상적 해석 코멘트 */
  note: string
  severity: 'high' | 'medium' | 'low'
}

export interface FindingRef {
  code: string
  kind: MockExam['kind']
  value: number | null
  raw: string
  direction: Direction
  evidence: string
  color: string
}

const DISCREPANCY_NOTES: Record<string, string> = {
  aggression:
    'HTP 필압·MMPI-2 척도 4는 공격 충동을 시사하나 로르샤하 AG=1은 정상 범위. 표출된 공격성보다 내재화된 적대감일 가능성이 높음. 그림검사의 필압 지표는 상태 불안을 반영했을 수 있어 단독 해석은 권장되지 않음.',
  depression:
    'S-척도 문제적결과 영역과 로르샤하 DEPI가 모두 우울을 지지하나, TCI 위험회피는 중간 범위로 기질적 취약성은 뚜렷하지 않음. 과의존에 수반된 상태로서의 우울이 우세한 양상.',
  anxiety:
    'HTP·로르샤하·S-척도가 불안 상승을 시사하는 반면 MMPI-2 척도 7은 평균 상단에 그침. 특성 불안 대비 상태 불안이 우세할 가능성. S-척도 현저성 상승은 스마트폰 미사용 상황에 국한된 불안일 수 있어 일반화에 주의.',
  impulse:
    'S-척도 고위험·MMPI-2 통제결여·TCI 자극추구가 일관되게 조절 곤란을 지지하나 로르샤하 FC:CF+C는 정서 조절 보존을 시사. 정서적 충동성보다 행동적 조절실패가 우세한 양상으로, 개입 표적을 사용 습관 통제에 두는 편이 타당해 보임.',
  social:
    '로르샤하 CDI·TCI 연대감·MMPI-2 Si가 일관되게 대인 자원 부족을 지지하나 SCT 대인영역만 상대적으로 양호. 실제 관계 경험보다 관계 기대의 손상일 수 있음. S-척도에서 온라인 관계로의 대체 경향이 보고된 점을 함께 고려할 필요가 있음.',
  selfConcept:
    'HTP·로르샤하·SCT·S-척도가 모두 낮은 자기가치감을 지지하는 반면 TCI 자율성은 중간 범위. 전반적 자기개념 손상 속에서도 자율적 기능은 일부 보존된 것으로 보임.',
  reality:
    'MMPI-2·HTP·SCT는 현실검증 보존을 지지하나 로르샤하 XA%는 경미 저하. 구조화된 과제에서는 유지되나 비구조 상황에서 지각 정확성이 흔들릴 수 있음.'
}

function toRef(ex: MockExam, s: AxisFinding): FindingRef {
  return {
    code: ex.code,
    kind: ex.kind,
    value: s.value,
    raw: s.raw,
    direction: s.direction,
    evidence: s.evidence,
    color: ex.color
  }
}

/**
 * 축별 검사 간 불일치 계산.
 *
 * 점수 차가 아니라 **임상적 방향(elevated vs normal/low)** 이 갈리는지로 판단한다.
 * 서로 다른 검사의 원점수를 하나의 척도로 환산하는 것은 표준화 근거가 없으므로
 * 하지 않는다. 상반된 검사 수가 많을수록 severity가 높다.
 */
export function computeDiscrepancies(exams: MockExam[] = MOCK_EXAMS): Discrepancy[] {
  const out: Discrepancy[] = []
  for (const axis of ANALYSIS_AXES) {
    const refs: FindingRef[] = []
    for (const ex of exams) {
      const s = ex.scores.find((sc) => sc.axisKey === axis.key)
      if (s) refs.push(toRef(ex, s))
    }
    if (refs.length < 2) continue

    // 축 방향에 따라 '문제를 시사하는 쪽'이 다르다.
    // direction 'high' 축(공격성·우울·불안)은 elevated가, 'low' 축(대인관계·
    // 자기개념·현실검증)은 low가 문제 신호다.
    const flags = (r: FindingRef) =>
      axis.direction === 'high' ? r.direction === 'elevated' : r.direction === 'low'

    const elevated = refs.filter(flags)
    const contrary = refs.filter((r) => !flags(r))
    if (!elevated.length || !contrary.length) {
      // 방향이 모두 같으면 불일치 없음 — 일치 소견으로 기록
      out.push({
        axisKey: axis.key,
        axisLabel: axis.label,
        elevated,
        contrary,
        quantitative: refs.filter((r) => r.value !== null),
        note: DISCREPANCY_NOTES[axis.key] ?? '',
        severity: 'low'
      })
      continue
    }

    // 소수 의견일수록(한쪽이 1~2개) 불일치가 두드러진다
    const minority = Math.min(elevated.length, contrary.length)
    const ratio = minority / refs.length
    out.push({
      axisKey: axis.key,
      axisLabel: axis.label,
      elevated,
      contrary,
      quantitative: refs.filter((r) => r.value !== null),
      note: DISCREPANCY_NOTES[axis.key] ?? '',
      severity: ratio >= 0.4 ? 'high' : ratio >= 0.25 ? 'medium' : 'low'
    })
  }
  // 불일치가 큰 순 → 상반 검사 수가 많은 순
  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/** 규준 점수를 가진 검사들의 축별 평균 (정량 비교 차트 기준선용) */
export function axisMean(axisKey: string, exams: MockExam[] = MOCK_EXAMS): number {
  const vals = exams
    .map((e) => e.scores.find((s) => s.axisKey === axisKey)?.value)
    .filter((v): v is number => v !== null && v !== undefined)
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** 정량 비교가 가능한(규준 점수 보유) 검사만 */
export function standardizedExams(exams: MockExam[] = MOCK_EXAMS): MockExam[] {
  return exams.filter((e) => e.kind === 'standardized')
}