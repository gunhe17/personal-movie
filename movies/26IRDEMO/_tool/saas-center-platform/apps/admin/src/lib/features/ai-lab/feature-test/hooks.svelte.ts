/**
 * 기능 테스트 상태 관리 훅 — 센터 선택 + 기능 선택 + 실행 상태
 */

import type { FeatureTestId } from './constants'
import type { ExecutionLogEntry, CreditVerification } from './view-model'
import type { FieldNoteDetailResponse, CaseAnalysisResult, CaseAnalysisPreview } from '$lib/hooks/actions/featureTest.action'

const MAX_LOG_ENTRIES = 50

export function useFeatureTestState() {
  // ── 센터 선택 (admin 전용) ──
  let selectedCenterId = $state('')

  // ── 기능 선택 ──
  let activeFeature = $state<FeatureTestId>('stt')

  // ── 필드노트 선택 (탭별 독립) ──
  let sttFieldNoteId = $state('')
  let summaryFieldNoteId = $state('')
  let noteFieldNoteId = $state('')
  let selectedCaseId = $state('')

  // ── 실행 상태 ──
  let runningAction = $state<string | null>(null)

  // ── 필드노트 결과 (탭별 독립) ──
  let sttDetail = $state<FieldNoteDetailResponse | null>(null)
  let sttLoading = $state(false)
  let summaryDetail = $state<FieldNoteDetailResponse | null>(null)
  let summaryLoading = $state(false)
  let noteDetail = $state<FieldNoteDetailResponse | null>(null)
  let noteLoading = $state(false)

  // ── 사례 분석 결과 ──
  let casePreview = $state<CaseAnalysisPreview | null>(null)
  let caseAnalysis = $state<CaseAnalysisResult | null>(null)
  let caseLoading = $state(false)
  let caseError = $state('')

  // ── 크레딧 검증 (탭별 독립) ──
  let sttCreditVerification = $state<CreditVerification | null>(null)
  let summaryCreditVerification = $state<CreditVerification | null>(null)
  let noteCreditVerification = $state<CreditVerification | null>(null)
  let caseCreditVerification = $state<CreditVerification | null>(null)

  // ── 실행 이력 ──
  let executionLog = $state<ExecutionLogEntry[]>([])

  function addLog(entry: ExecutionLogEntry) {
    executionLog = [entry, ...executionLog].slice(0, MAX_LOG_ENTRIES)
  }

  function clearLog() {
    executionLog = []
  }

  function resetResults() {
    sttFieldNoteId = ''
    summaryFieldNoteId = ''
    noteFieldNoteId = ''
    selectedCaseId = ''
    sttDetail = null
    summaryDetail = null
    noteDetail = null
    casePreview = null
    caseAnalysis = null
    caseError = ''
    sttCreditVerification = null
    summaryCreditVerification = null
    noteCreditVerification = null
    caseCreditVerification = null
  }

  return {
    // 센터
    get selectedCenterId() { return selectedCenterId },
    set selectedCenterId(v: string) { selectedCenterId = v },

    // 기능 선택
    get activeFeature() { return activeFeature },
    set activeFeature(v: FeatureTestId) { activeFeature = v },

    // 선택 상태
    get sttFieldNoteId() { return sttFieldNoteId },
    set sttFieldNoteId(v: string) { sttFieldNoteId = v },
    get summaryFieldNoteId() { return summaryFieldNoteId },
    set summaryFieldNoteId(v: string) { summaryFieldNoteId = v },
    get noteFieldNoteId() { return noteFieldNoteId },
    set noteFieldNoteId(v: string) { noteFieldNoteId = v },
    get selectedCaseId() { return selectedCaseId },
    set selectedCaseId(v: string) { selectedCaseId = v },

    // 실행 상태
    get runningAction() { return runningAction },
    set runningAction(v: string | null) { runningAction = v },

    // 필드노트
    get sttDetail() { return sttDetail },
    set sttDetail(v: FieldNoteDetailResponse | null) { sttDetail = v },
    get sttLoading() { return sttLoading },
    set sttLoading(v: boolean) { sttLoading = v },
    get summaryDetail() { return summaryDetail },
    set summaryDetail(v: FieldNoteDetailResponse | null) { summaryDetail = v },
    get summaryLoading() { return summaryLoading },
    set summaryLoading(v: boolean) { summaryLoading = v },
    get noteDetail() { return noteDetail },
    set noteDetail(v: FieldNoteDetailResponse | null) { noteDetail = v },
    get noteLoading() { return noteLoading },
    set noteLoading(v: boolean) { noteLoading = v },

    // 사례 분석
    get casePreview() { return casePreview },
    set casePreview(v: CaseAnalysisPreview | null) { casePreview = v },
    get caseAnalysis() { return caseAnalysis },
    set caseAnalysis(v: CaseAnalysisResult | null) { caseAnalysis = v },
    get caseLoading() { return caseLoading },
    set caseLoading(v: boolean) { caseLoading = v },
    get caseError() { return caseError },
    set caseError(v: string) { caseError = v },

    // 크레딧 검증
    get sttCreditVerification() { return sttCreditVerification },
    set sttCreditVerification(v: CreditVerification | null) { sttCreditVerification = v },
    get summaryCreditVerification() { return summaryCreditVerification },
    set summaryCreditVerification(v: CreditVerification | null) { summaryCreditVerification = v },
    get noteCreditVerification() { return noteCreditVerification },
    set noteCreditVerification(v: CreditVerification | null) { noteCreditVerification = v },
    get caseCreditVerification() { return caseCreditVerification },
    set caseCreditVerification(v: CreditVerification | null) { caseCreditVerification = v },

    // 이력
    get executionLog() { return executionLog },
    addLog,
    clearLog,
    resetResults,
  }
}
