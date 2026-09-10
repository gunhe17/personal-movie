// 종합 AI 리뷰 — 보고서 **문서 전체**를 대상으로 하는 분석.
//
// ⚠️ 시연용 목업. 실기능 전환 시 analyzeOverall()을 POST /api/report/review
//    (scope: 'document') 호출로 교체한다. 아래 규칙은 서버가 내려줄 응답 형태를
//    그대로 흉내내므로, 반환 타입(OverallReview)은 유지한 채 내부만 바꾸면 된다.
//
// ── 구간별 리뷰(AiReviewCard)와의 역할 구분 ──
// 구간별 = 문장 단위: 맞춤법·이중피동·주관적 강조어 → 드래그한 텍스트만 본다.
// 종합   = 문서 단위: 섹션 누락·앞뒤 논리 모순·검사 반영률·완성도.
// 여기서 문장 단위 교정을 다시 하지 않는다. 대신 구간별 지적을 **집계**해서
// "어느 문단에 몇 건 있다"로 연결한다.

import type { MockExam } from './mock-longitudinal'

/** 보고서 본문 한 블록 (에디터 블록에서 추출한 최소 정보) */
export interface ReviewBlock {
  /** 에디터 블록 id — 클릭 시 해당 위치로 스크롤하는 데 쓴다 */
  id: string
  text: string
  isHeading: boolean
}

export type IssueKind =
  | 'missing-section' // 섹션이 비어 있음
  | 'contradiction' // 앞뒤 서술이 모순
  | 'unreferenced' // 검사 결과가 본문에 반영되지 않음
  | 'span-summary' // 구간별 지적 집계
  | 'structure' // 필수 섹션 자체가 없음

export type Severity = 'high' | 'medium' | 'low'

/**
 * AI가 제안하는 수정안. CDSS 원칙에 따라 **자동 적용하지 않는다** —
 * UI에서 미리보기를 거쳐 임상가가 승인해야 본문에 반영된다.
 *
 * - insert: 빈 섹션에 초안을 삽입 (blockId 위치에)
 * - replace: 특정 표현을 치환 (문서 전체에서 before → after)
 */
export type IssueFix =
  | { type: 'insert'; blockId: string; text: string; label: string }
  | { type: 'replace'; before: string; after: string; label: string }

export interface OverallIssue {
  kind: IssueKind
  severity: Severity
  title: string
  detail: string
  /** 클릭 시 이동할 블록 id (없으면 이동 불가) */
  blockId?: string
  /** 근거 표기 (예: "로르샤하 CDI=4") */
  evidence?: string
  /**
   * 적용 가능한 수정안들. 여러 개면 사용자가 고른다
   * (예: 모순 → "중등도로 통일" / "경미로 통일").
   */
  fixes?: IssueFix[]
}

/**
 * 분석 진행 단계 — "AI가 무슨 일을 하고 있는지" 보여주기 위한 것.
 *
 * ⚠️ 목업에서는 타이머로 순차 점등하지만, 실기능에서는 서버가 SSE로
 * 단계 완료를 밀어준다(`POST /api/report/review` streaming). 단계 구성과
 * detail 문구는 그대로 쓰되 진행 신호만 교체하면 된다.
 */
export interface ReviewStep {
  key: string
  label: string
  /** 완료 후 표시할 요약 (예: "섹션 5개 확인") */
  detail?: string
  /**
   * 이 단계에 걸리는 시간(ms). 단계마다 실제 작업량이 다르므로 일정하지 않다 —
   * 구조 파악은 빠르고, 문서 전체를 훑는 일관성 검토는 오래 걸린다.
   * ⚠️ 목업용. 실기능에서는 서버 SSE 이벤트 도착 시점이 이를 대체한다.
   */
  ms: number
}

export const REVIEW_STEPS: ReviewStep[] = [
  { key: 'structure', label: '문서 구조 파악', ms: 520 },
  { key: 'exams', label: '검사 결과 대조', ms: 880 },
  { key: 'consistency', label: '서술 일관성 검토', ms: 1340 },
  { key: 'style', label: '표현·문체 점검', ms: 700 }
]

export interface OverallReview {
  /** 0~100 완성도 */
  score: number
  issues: OverallIssue[]
  /** 체크리스트 — 통과/미통과 */
  checklist: { label: string; ok: boolean }[]
  /** 진행 단계별 완료 요약 (REVIEW_STEPS의 key → 문구) */
  stepDetails: Record<string, string>
  stats: {
    charCount: number
    sectionCount: number
    /** 본문에 언급된 검사 / 전체 검사 */
    referencedExams: number
    totalExams: number
  }
}

/**
 * 빈 섹션에 넣을 초안.
 *
 * ⚠️ 시연용 고정 문안. 실기능에서는 백엔드 `generate_comprehensive_draft()`가
 * 실제 검사 소견을 근거로 생성한다(이미 구현돼 있음 —
 * apps/api/app/infrastructure/ai/base.py의 ComprehensiveDraftResult).
 * 이 상수는 그때 제거하고 API 응답의 sections[].body를 그대로 쓰면 된다.
 */
const SECTION_DRAFTS: Record<string, string> = {
  Ⅲ:
    '검사 전반에 걸쳐 협조적인 태도를 유지하였으나, 정서를 다루는 문항에서 응답이 지연되고 목소리가 작아지는 경향이 관찰되었다. ' +
    '그림검사에서는 여러 차례 지우고 다시 그리는 모습이 나타나 수행에 대한 불안과 완벽주의적 경향이 시사된다. ' +
    '검사자와의 라포는 무난하게 형성되었으며, 지시 이해와 과제 수행에 어려움은 없었다.'
}

/** 심리평가 보고서 필수 섹션 — 로마숫자 표기를 기준으로 찾는다 */
const REQUIRED_SECTIONS = [
  { key: 'Ⅰ', label: '의뢰 사유 및 배경' },
  { key: 'Ⅱ', label: '실시한 검사' },
  { key: 'Ⅲ', label: '행동 관찰' },
  { key: 'Ⅳ', label: '검사 결과' },
  { key: 'Ⅴ', label: '요약 및 제언' }
]

/**
 * 모순 탐지 규칙 — 같은 구성개념에 대해 문서 앞뒤에서 다른 수준을 말하는 경우.
 * 심각도 표현을 3단계로 정규화해서 비교한다.
 */
const SEVERITY_WORDS: { re: RegExp; level: number; word: string }[] = [
  { re: /경미|경도|가벼운|미미/, level: 1, word: '경미' },
  { re: /중등도|중간\s*수준|보통\s*수준/, level: 2, word: '중등도' },
  { re: /심각|고도|현저|重度|매우\s*심한/, level: 3, word: '심각' }
]

/** 모순 검사 대상 구성개념 */
const CONCEPTS = [
  { key: 'depression', label: '우울', re: /우울/ },
  { key: 'anxiety', label: '불안', re: /불안/ },
  { key: 'impulse', label: '충동조절|과의존', re: /과의존|조절\s*실패|충동/ }
]

/** 섹션 블록을 헤딩 기준으로 묶는다 */
function groupBySection(blocks: ReviewBlock[]): { heading: ReviewBlock | null; body: ReviewBlock[] }[] {
  const out: { heading: ReviewBlock | null; body: ReviewBlock[] }[] = []
  let cur: { heading: ReviewBlock | null; body: ReviewBlock[] } = { heading: null, body: [] }
  for (const b of blocks) {
    if (b.isHeading) {
      if (cur.heading || cur.body.length) out.push(cur)
      cur = { heading: b, body: [] }
    } else {
      cur.body.push(b)
    }
  }
  if (cur.heading || cur.body.length) out.push(cur)
  return out
}

/**
 * 종합 리뷰 실행.
 *
 * @param blocks 본문 블록 (헤딩 포함, 순서 그대로)
 * @param exams  배터리에 포함된 검사들 — 본문 반영 여부를 대조한다
 * @param spanIssueCount 구간별 리뷰가 잡아낸 건수 (문단 id → 건수)
 */
export function analyzeOverall(
  blocks: ReviewBlock[],
  exams: MockExam[],
  spanIssueCount: Record<string, number> = {}
): OverallReview {
  const issues: OverallIssue[] = []
  const sections = groupBySection(blocks)
  const fullText = blocks.map((b) => b.text).join('\n')

  // ── 1. 필수 섹션 존재 여부 + 내용이 비었는지 ──
  for (const req of REQUIRED_SECTIONS) {
    const sec = sections.find((s) => s.heading?.text.includes(req.key))
    if (!sec) {
      issues.push({
        kind: 'structure',
        severity: 'high',
        title: `${req.key}. ${req.label} 섹션이 없습니다`,
        detail: '심리평가 보고서의 필수 구성 항목입니다. 섹션을 추가해 주세요.'
      })
      continue
    }
    const filled = sec.body.filter((b) => b.text.trim().length > 0)
    const chars = filled.reduce((n, b) => n + b.text.trim().length, 0)
    if (chars === 0) {
      // 빈 문단이 있으면 거기에, 없으면 헤딩 바로 뒤에 삽입한다
      const target = sec.body[0]?.id ?? sec.heading?.id
      const draft = SECTION_DRAFTS[req.key]
      issues.push({
        kind: 'missing-section',
        severity: 'high',
        title: `${req.key}. ${req.label}이(가) 비어 있습니다`,
        detail: '해당 섹션에 작성된 내용이 없습니다. AI가 검사 소견을 근거로 초안을 제안할 수 있습니다.',
        blockId: sec.heading?.id,
        fixes:
          draft && target
            ? [{ type: 'insert', blockId: target, text: draft, label: '초안 작성' }]
            : undefined
      })
    } else if (chars < 60) {
      issues.push({
        kind: 'missing-section',
        severity: 'medium',
        title: `${req.key}. ${req.label} 서술이 짧습니다`,
        detail: `현재 ${chars}자입니다. 임상적 근거를 뒷받침할 만큼 충분한지 검토해 주세요.`,
        blockId: sec.heading?.id
      })
    }
  }

  // ── 2. 검사 결과 반영률 — 배터리에 있는데 본문에 안 나오는 검사 ──
  const referenced = exams.filter((ex) => {
    // 코드(예: "S-척도")나 한글명 일부가 본문에 등장하면 반영된 것으로 본다
    const codeHit = fullText.includes(ex.code)
    const nameHit = ex.name.length > 2 && fullText.includes(ex.name.slice(0, 4))
    return codeHit || nameHit
  })
  for (const ex of exams) {
    if (referenced.includes(ex)) continue
    // 가장 두드러진 소견을 근거로 제시
    const notable =
      ex.scores.find((s) => s.direction === 'elevated') ??
      ex.scores.find((s) => s.direction === 'low') ??
      ex.scores[0]
    issues.push({
      kind: 'unreferenced',
      severity: 'high',
      title: `${ex.code} 결과가 본문에 언급되지 않았습니다`,
      detail: `배터리에 포함된 검사입니다. 결과를 본문에 반영하거나, 제외한 사유를 기술해 주세요.`,
      evidence: notable ? `${notable.raw} — ${notable.evidence}` : undefined
    })
  }

  // ── 3. 문서 내 논리 모순 — 같은 개념을 앞뒤에서 다른 수준으로 서술 ──
  for (const concept of CONCEPTS) {
    const mentions: { block: ReviewBlock; level: number; word: string }[] = []
    for (const b of blocks) {
      if (b.isHeading || !concept.re.test(b.text)) continue
      for (const sw of SEVERITY_WORDS) {
        if (!sw.re.test(b.text)) continue
        // 같은 문장 안에 개념어와 심각도어가 함께 있을 때만 센다
        mentions.push({ block: b, level: sw.level, word: sw.word })
        break
      }
    }
    if (mentions.length < 2) continue
    const levels = [...new Set(mentions.map((m) => m.level))]
    if (levels.length < 2) continue
    const first = mentions[0]
    const conflict = mentions.find((m) => m.level !== first.level)!

    // 수정안 — 어느 쪽이 맞는지는 임상가만 알 수 있으므로 양방향 모두 제시한다.
    // 치환은 문서에 실재하는 표현을 그대로 찾아서 한다(고정 문자열이면 어긋난다).
    const firstPhrase = matchPhrase(first.block.text, first.level)
    const conflictPhrase = matchPhrase(conflict.block.text, conflict.level)
    const fixes: IssueFix[] = []
    if (firstPhrase && conflictPhrase) {
      fixes.push({
        type: 'replace',
        before: conflictPhrase,
        after: firstPhrase,
        label: `'${first.word}'로 통일`
      })
      fixes.push({
        type: 'replace',
        before: firstPhrase,
        after: conflictPhrase,
        label: `'${conflict.word}'로 통일`
      })
    }

    issues.push({
      kind: 'contradiction',
      severity: 'high',
      title: `${concept.label} 수준 서술이 문서 내에서 일치하지 않습니다`,
      detail: `앞부분에서는 '${first.word}'로, 뒷부분에서는 '${conflict.word}'로 기술되어 있습니다. 어느 쪽이 최종 판단인지 통일해 주세요.`,
      blockId: conflict.block.id,
      fixes: fixes.length ? fixes : undefined
    })
  }

  // ── 4. 구간별 지적 집계 — 두 기능을 연결하는 지점 ──
  const spanTotal = Object.values(spanIssueCount).reduce((a, b) => a + b, 0)
  if (spanTotal > 0) {
    const worst = Object.entries(spanIssueCount).sort((a, b) => b[1] - a[1])[0]
    const worstBlock = blocks.find((b) => b.id === worst[0])
    const label = worstBlock ? summarize(worstBlock.text) : '일부 문단'
    issues.push({
      kind: 'span-summary',
      severity: spanTotal >= 3 ? 'medium' : 'low',
      title: `표현 교정 제안 ${spanTotal}건이 있습니다`,
      detail: `가장 많은 곳은 "${label}" 문단(${worst[1]}건)입니다. 문장을 선택하면 개별 수정안을 확인할 수 있습니다.`,
      blockId: worst[0]
    })
  }

  // ── 집계 ──
  const charCount = blocks.reduce((n, b) => n + (b.isHeading ? 0 : b.text.trim().length), 0)
  const sectionCount = sections.filter((s) => s.heading).length

  const checklist = [
    { label: '필수 섹션 5개 구성', ok: !issues.some((i) => i.kind === 'structure') },
    { label: '모든 섹션에 내용 기술', ok: !issues.some((i) => i.kind === 'missing-section') },
    { label: '전체 검사 결과 반영', ok: referenced.length === exams.length },
    { label: '문서 내 서술 일관성', ok: !issues.some((i) => i.kind === 'contradiction') },
    { label: '분량 확보 (800자 이상)', ok: charCount >= 800 }
  ]

  // 완성도 — 체크리스트 통과율이 기준. 지적은 이미 체크리스트에 반영돼 있으므로
  // 이중 감점이 되지 않도록 페널티는 작게 잡는다(같은 항목에 여러 건 걸린 경우만 구분).
  const base = (checklist.filter((c) => c.ok).length / checklist.length) * 100
  const penalty = issues.reduce(
    (n, i) => n + (i.severity === 'high' ? 2 : i.severity === 'medium' ? 1 : 0.5),
    0
  )
  const score = Math.max(0, Math.min(100, Math.round(base - penalty)))

  // 심각도 높은 순 정렬
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  issues.sort((a, b) => rank[a.severity] - rank[b.severity])

  // 진행 단계별 요약 — 실제 분석 결과의 숫자를 넣어 "정말 훑었다"가 보이게 한다
  const stepDetails: Record<string, string> = {
    structure: `섹션 ${sectionCount}개 · ${charCount.toLocaleString()}자`,
    exams: `검사 ${exams.length}건 중 ${referenced.length}건 반영`,
    consistency: issues.some((i) => i.kind === 'contradiction')
      ? `불일치 ${issues.filter((i) => i.kind === 'contradiction').length}건 발견`
      : '모순 없음',
    style: spanTotal > 0 ? `교정 제안 ${spanTotal}건` : '교정 제안 없음'
  }

  return {
    score,
    issues,
    checklist,
    stepDetails,
    stats: {
      charCount,
      sectionCount,
      referencedExams: referenced.length,
      totalExams: exams.length
    }
  }
}

/**
 * 문단별 표현 교정 건수 집계.
 *
 * ⚠️ 구간별 리뷰(AiReviewCard)와 같은 패턴을 최소한만 복제한 것이다. 실기능 전환 시
 * 서버가 문서 전체를 한 번에 스캔해 문단별 건수를 내려주므로 이 함수는 제거된다.
 * (지금 규칙을 공용 모듈로 빼는 리팩터링은 곧 사라질 코드에 대한 투자라 하지 않았다.)
 */
const SPAN_PATTERNS: RegExp[] = [
  /해석되어진|되어진/, // 이중 피동
  /보여집니다|보여진다/,
  /사료된다|사료됩니다/,
  /매우\s*높다|매우\s*낮다/, // 주관적 강조어
  /환자/, // 용어 (심리평가는 '내담자')
  /할\s수\s밖에/,
  /있는것|하는것/
]

export function countSpanIssues(blocks: ReviewBlock[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of blocks) {
    if (b.isHeading || !b.text.trim()) continue
    let n = 0
    for (const re of SPAN_PATTERNS) if (re.test(b.text)) n++
    if (n > 0) out[b.id] = n
  }
  return out
}

/**
 * 심각도 표현을 "수준" 수식구까지 포함해 문서에서 실제로 뽑아낸다.
 *
 * 심각도 단어만 바꾸면 어미가 깨진다 — '경미한 수준의' → '중등도 수준의'가 되어야지
 * '중등도한 수준의'가 되면 안 된다. 그래서 뒤따르는 '한/의/수준' 등을 함께 잡는다.
 */
function matchPhrase(text: string, level: number): string | null {
  const sw = SEVERITY_WORDS.find((s) => s.level === level)
  if (!sw) return null
  // 심각도어 + (한|의|하게|하고) + (수준|정도)? 까지 한 덩어리로
  const src = sw.re.source
  const m = text.match(new RegExp(`(?:${src})(?:한|하게|하고)?(?:\\s*수준|\\s*정도)?`))
  return m ? m[0] : null
}

/** 문단 앞머리를 짧게 — 지적사항에 표시할 라벨용 */
function summarize(text: string, max = 14): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : t.slice(0, max) + '…'
}
