/**
 * 종합 AI 리뷰의 상태머신 — 문서 전체를 훑는 쪽.
 *
 * 구간 리뷰(span-review)가 드래그한 문장만 본다면 이쪽은 보고서 전체를 본다.
 *
 * 에디터를 알지 못한다. 본문을 읽는 일은 readBlocks 콜백으로 주입받는다 —
 * 상태 전이(idle → analyzing → result)와 타이머 관리는 본문을 어떻게 읽는지와
 * 무관하고, 그래야 이 파일이 PaginatedEditor API에 묶이지 않는다.
 *
 * ⚠️ 시연용: analyzeOverall()이 규칙 매칭 목업이고 단계 점등도 타이머다.
 *    실기능 전환 시 POST /api/report/review (scope: 'document')로 바꾸고
 *    단계는 서버 SSE 이벤트로 올린다. 그때 바뀌는 건 run()의 속뿐이다.
 */
import {
  analyzeOverall,
  countSpanIssues,
  REVIEW_STEPS,
  type OverallReview,
  type ReviewBlock
} from './overall-review'
import { MOCK_EXAMS } from './mock-longitudinal'

/**
 * 반영률 검사가 보는 배터리 — **실검사만**.
 *
 * `analyzeOverall`의 규칙 2는 "배터리에 있는데 본문에 안 나오는 검사"를 지적한다.
 * MOCK_EXAMS에는 목업 표준화 검사(MMPI-2·S-척도·TCI)가 섞여 있어, 본문이 실검사
 * 3종만 다루면 실시된 적도 없는 검사 셋을 "언급되지 않았습니다"로 지적한다.
 * 시드의 배터리는 로르샤하·HTP·SCT 셋이므로 그 셋만 남긴다 (2026-09-10).
 */
const REVIEWED_EXAMS = MOCK_EXAMS.filter((e) => e.origin === 'real')

export type OverallPhase = 'idle' | 'analyzing' | 'result'

export function createOverallReview(readBlocks: () => ReviewBlock[]) {
  let open = $state(false)
  let phase = $state<OverallPhase>('idle')
  let review = $state<OverallReview | null>(null)
  /** 분석 진행 단계 인덱스 (0..REVIEW_STEPS.length) */
  let step = $state(0)

  let doneTimer: ReturnType<typeof setTimeout> | null = null
  let stepTimers: ReturnType<typeof setTimeout>[] = []

  function clearStepTimers() {
    for (const t of stepTimers) clearTimeout(t)
    stepTimers = []
  }

  function clearDoneTimer() {
    if (doneTimer) {
      clearTimeout(doneTimer)
      doneTimer = null
    }
  }

  /**
   * 현재 본문으로 결과만 다시 계산한다(진행 애니메이션 없음).
   *
   * 수정안을 적용한 직후처럼 이미 분석을 본 상태에서는 4단계를 다시 보여줄
   * 이유가 없다 — 점수와 지적이 바로 갱신되는 게 더 잘 읽힌다.
   */
  function refresh() {
    // 분석 중이었다면 예약된 타이머가 뒤늦게 결과를 덮어쓰지 않도록 먼저 정리한다
    clearDoneTimer()
    clearStepTimers()

    const blocks = readBlocks()
    review = analyzeOverall(blocks, REVIEWED_EXAMS, countSpanIssues(blocks))
    phase = 'result'
  }

  function run() {
    clearDoneTimer()
    clearStepTimers()
    open = true
    phase = 'analyzing'
    step = 0

    // 단계를 순차 점등해 "AI가 훑고 있다"를 보여준다.
    // 각 단계의 소요 시간은 REVIEW_STEPS[].ms — 작업량이 달라 간격이 일정하지 않다.
    let elapsed = 0
    REVIEW_STEPS.forEach((s, i) => {
      elapsed += s.ms
      stepTimers.push(setTimeout(() => (step = i + 1), elapsed))
    })

    // 마지막 체크가 그려지는 걸 보고 나서 결과로 넘어간다
    doneTimer = setTimeout(() => {
      refresh()
      doneTimer = null
    }, elapsed + 420)
  }

  function close() {
    clearDoneTimer()
    clearStepTimers()
    open = false
  }

  /** 열려 있으면 닫고, 아니면 새로 분석한다 (툴바 버튼) */
  function toggle() {
    if (open) close()
    else run()
  }

  /** 페이지를 떠날 때 — 예약된 타이머가 언마운트 후 상태를 건드리지 않게 한다 */
  function destroy() {
    clearDoneTimer()
    clearStepTimers()
  }

  return {
    get open() {
      return open
    },
    get phase() {
      return phase
    },
    get review() {
      return review
    },
    get step() {
      return step
    },
    run,
    refresh,
    close,
    toggle,
    destroy
  }
}

export type OverallReviewState = ReturnType<typeof createOverallReview>
