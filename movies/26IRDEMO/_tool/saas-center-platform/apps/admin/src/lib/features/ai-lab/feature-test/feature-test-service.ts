/**
 * 기능 테스트 서비스 — centerId를 외부에서 주입받음 (admin 패턴)
 */

import type { QueryClient } from '@tanstack/svelte-query'
import { snackbarStore } from '$stores/snackbar'
import {
  getFeatureTestCredit,
  getFeatureTestFieldNoteDetail,
  postFeatureTestTranscribe,
  postFeatureTestRefine,
  postFeatureTestSummary,
  postFeatureTestNote,
  postFeatureTestCaseAnalysis,
  getFeatureTestCaseLatest,
  getFeatureTestCasePreview,
} from '$lib/hooks/actions/featureTest.action'
import type {
  FieldNoteDetailResponse,
  CaseAnalysisResult,
  CaseAnalysisPreview,
} from '$lib/hooks/actions/featureTest.action'
import type { CreditSnapshot, CreditVerification } from './view-model'
import { createLogEntry, snapshotCredit, buildCreditVerification } from './view-model'
import type { ExecutionLogEntry } from './view-model'

export interface FeatureTestServiceDeps {
  queryClient: QueryClient
  getCenterId: () => string
}

export interface CaseResult {
  preview: CaseAnalysisPreview | null
  analysis: CaseAnalysisResult | null
  error: string
}

// ── 크레딧 스냅샷 헬퍼 ──

async function captureCreditBefore(cid: string): Promise<CreditSnapshot | null> {
  try {
    const bal = await getFeatureTestCredit().request({ centerId: cid })
    if (bal) return snapshotCredit(bal)
  } catch { /* ignore */ }
  return null
}

async function captureCreditAfter(cid: string): Promise<CreditSnapshot | null> {
  try {
    await new Promise((r) => setTimeout(r, 1500))
    const bal = await getFeatureTestCredit().request({ centerId: cid })
    if (bal) return snapshotCredit(bal)
  } catch { /* ignore */ }
  return null
}

const FREE_PURPOSES = new Set([
  'field_note_stt_chunk',
  'field_note_stt_diarize',
  'field_note_stt_streaming',
  'field_note_refine',
  'field_note_recommendation',
])

function sumPaidTokenUsage(detail: FieldNoteDetailResponse | null): number {
  if (!detail?.token_usage || !Array.isArray(detail.token_usage)) return 0
  let total = 0
  for (const u of detail.token_usage) {
    if (u.purpose && FREE_PURPOSES.has(u.purpose)) continue
    total += u.input_tokens ?? 0
    total += u.output_tokens ?? 0
  }
  return total
}

function buildVerification(
  before: CreditSnapshot | null,
  after: CreditSnapshot | null,
  totalTokens: number,
): CreditVerification | null {
  if (!before || !after) return null
  return buildCreditVerification(before, after, totalTokens)
}

export function createFeatureTestService(deps: FeatureTestServiceDeps) {
  const { queryClient, getCenterId } = deps

  function invalidateCredit() {
    queryClient.invalidateQueries({ queryKey: ['getFeatureTestCredit'], exact: false })
  }

  // ── 필드노트 파이프라인 ──

  async function runFieldNoteAction(
    action: string,
    fieldNoteId: string,
    existingDetail: FieldNoteDetailResponse | null = null,
  ): Promise<{
    detail: FieldNoteDetailResponse | null
    log: ExecutionLogEntry
    creditVerification: CreditVerification | null
  }> {
    if (!fieldNoteId) {
      snackbarStore.error('필드노트를 선택해주세요.')
      return {
        detail: null,
        log: createLogEntry('pipeline', '필드노트', action, 'error', { preview: '필드노트 미선택' }),
        creditVerification: null,
      }
    }

    const cid = getCenterId()
    const tokensBefore = sumPaidTokenUsage(existingDetail)
    const creditBefore = await captureCreditBefore(cid)

    try {
      if (action === 'stt') {
        await postFeatureTestTranscribe().request({ centerId: cid, fieldNoteId })
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 3000))
          const check = await getFeatureTestFieldNoteDetail().request({ centerId: cid, fieldNoteId })
          if (check?.transcribe_status === 'completed') {
            await postFeatureTestRefine().request({ centerId: cid, fieldNoteId })
            break
          }
          if (check?.transcribe_status === 'failed') break
        }
      } else if (action === 'summary') {
        await postFeatureTestSummary().request({ centerId: cid, fieldNoteId })
      } else if (action === 'note') {
        await postFeatureTestNote().request({ centerId: cid, fieldNoteId, noteTemplateType: 'default' })
      }

      const detail = await getFeatureTestFieldNoteDetail().request({ centerId: cid, fieldNoteId })
      snackbarStore.success('실행 완료')
      invalidateCredit()
      const creditAfter = await captureCreditAfter(cid)

      const tokensAfter = sumPaidTokenUsage(detail)
      const tokenDelta = Math.max(0, tokensAfter - tokensBefore)
      const cv = buildVerification(creditBefore, creditAfter, tokenDelta)

      const sttPreview = _extractRefinedPreview(detail?.refined_transcript) ?? detail?.audios?.[0]?.transcript?.slice(0, 100) ?? '완료'
      const logLabels: Record<string, { category: string; label: string; preview: string }> = {
        stt: { category: 'stt', label: '음성 분석', preview: sttPreview },
        summary: { category: 'summary', label: '요약 생성', preview: detail?.summary?.slice(0, 100) ?? '완료' },
        note: { category: 'note', label: '상담일지 생성', preview: detail?.note_status === 'completed' ? '상담일지 생성 완료' : '완료' },
      }
      const logInfo = logLabels[action] ?? logLabels.stt

      return {
        detail,
        log: createLogEntry(logInfo.category, logInfo.label, action, 'success', {
          credits: cv?.actualCredits ?? null,
          model: detail?.refinement_model ?? detail?.summary_model ?? null,
          preview: logInfo.preview,
          rawJson: detail,
        }),
        creditVerification: cv,
      }
    } catch (e: any) {
      const error = e?.message ?? '실행 실패'
      snackbarStore.error(error)
      invalidateCredit()
      const creditAfter = await captureCreditAfter(cid)

      return {
        detail: null,
        log: createLogEntry(action, action, action, 'error', { preview: error }),
        creditVerification: buildVerification(creditBefore, creditAfter, 0),
      }
    }
  }

  // ── 필드노트 상세 ──

  async function loadFieldNoteDetail(fieldNoteId: string): Promise<FieldNoteDetailResponse | null> {
    if (!fieldNoteId) return null
    try {
      return await getFeatureTestFieldNoteDetail().request({
        centerId: getCenterId(),
        fieldNoteId,
      })
    } catch {
      return null
    }
  }

  // ── 사례 분석 ──

  async function loadCaseData(caseId: string): Promise<CaseResult> {
    if (!caseId) return { preview: null, analysis: null, error: '' }
    try {
      const cid = getCenterId()
      const [preview, analysis] = await Promise.all([
        getFeatureTestCasePreview().request({ centerId: cid, caseId }),
        getFeatureTestCaseLatest().request({ centerId: cid, caseId }),
      ])
      return { preview, analysis, error: '' }
    } catch {
      return { preview: null, analysis: null, error: '' }
    }
  }

  async function runCaseAnalysis(caseId: string): Promise<{
    result: CaseResult
    log: ExecutionLogEntry
    creditVerification: CreditVerification | null
  }> {
    if (!caseId) {
      snackbarStore.error('상담 케이스를 선택해주세요.')
      return {
        result: { preview: null, analysis: null, error: '케이스 미선택' },
        log: createLogEntry('case', '사례 분석', '분석', 'error', { preview: '케이스 미선택' }),
        creditVerification: null,
      }
    }

    const cid = getCenterId()
    const creditBefore = await captureCreditBefore(cid)

    try {
      const existingAnalysis = await getFeatureTestCaseLatest().request({ centerId: cid, caseId })
      const previousCreatedAt = existingAnalysis?.created_at ?? null

      await postFeatureTestCaseAnalysis().request({ centerId: cid, caseId })

      let analysis: CaseAnalysisResult | null = null
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise((r) => setTimeout(r, 3000))
        const result = await getFeatureTestCaseLatest().request({ centerId: cid, caseId })
        if (result && result.created_at !== previousCreatedAt) {
          analysis = result
          break
        }
      }

      invalidateCredit()
      const creditAfter = await captureCreditAfter(cid)

      if (!analysis) {
        return {
          result: { preview: null, analysis: null, error: '분석 처리 중입니다. 잠시 후 다시 조회해주세요.' },
          log: createLogEntry('case', '사례 분석', '분석', 'running', { preview: '처리 중' }),
          creditVerification: buildVerification(creditBefore, creditAfter, 0),
        }
      }

      const totalTokens = (analysis.input_tokens ?? 0) + (analysis.output_tokens ?? 0)
      const cv = buildVerification(creditBefore, creditAfter, totalTokens)

      return {
        result: { preview: null, analysis, error: '' },
        log: createLogEntry('case', '사례 분석', '분석', 'success', {
          credits: cv?.actualCredits ?? null,
          model: analysis.model_used,
          preview: analysis.content.progress_summary?.slice(0, 100) ?? '완료',
          rawJson: analysis,
        }),
        creditVerification: cv,
      }
    } catch (e: any) {
      const error = e?.message ?? '실행 실패'
      snackbarStore.error(error)
      invalidateCredit()
      const creditAfter = await captureCreditAfter(cid)

      return {
        result: { preview: null, analysis: null, error },
        log: createLogEntry('case', '사례 분석', '분석', 'error', { preview: error }),
        creditVerification: buildVerification(creditBefore, creditAfter, 0),
      }
    }
  }

  return {
    invalidateCredit,
    runFieldNoteAction,
    loadFieldNoteDetail,
    loadCaseData,
    runCaseAnalysis,
  }
}

function _extractRefinedPreview(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const segments = JSON.parse(raw)
    if (!Array.isArray(segments)) return raw.slice(0, 100)
    const text = segments.map((s: { text?: string }) => s.text ?? '').join(' ')
    return text.slice(0, 100) || null
  } catch {
    return raw.slice(0, 100)
  }
}
