/**
 * 필드노트 서비스
 *
 * 책임:
 *  - 파이프라인 트리거(run/retry/generate-summary/generate-counseling-note)
 *  - 화자명 매핑 업데이트
 *  - 일정 연결 (link-schedule)
 *  - 상담일지 초안 주입 (generate-counseling-note → 세션 노트 invalidate)
 *  - 스낵바/invalidate 캡슐화
 *
 * centerId는 서비스 팩토리 deps로 받지 않고, 실행 시점에 getCenterId()로 가져와
 * SSR 안전성을 유지한다.
 */

import type { QueryClient } from '@tanstack/svelte-query'

import {
  getCounselingNoteAiDrafts,
  type CounselingNoteAiDraft
} from '$lib/hooks/actions/counseling-note-ai-draft.action'
import type { NoteTemplateType } from '$lib/hooks/actions/field-note.action'
import {
  getExportTranscript,
  patchLinkSchedule,
  patchSpeakerMap,
  postGenerateCounselingNote,
  postGenerateSummary,
  postRetryPipeline,
  postRunPipeline
} from '$lib/hooks/actions/field-note.action'
import { snackbarStore } from '$lib/stores/snackbar'

/** 초안 폴링 — 전사 길이에 따라 수십 초가 걸린다 */
const DRAFT_POLL_INTERVAL_MS = 2000
const DRAFT_POLL_ATTEMPTS = 60

export interface FieldNoteServiceDeps {
  queryClient: QueryClient
  getCenterId: () => string | null
}

export function createFieldNoteService(deps: FieldNoteServiceDeps) {
  const { queryClient, getCenterId } = deps

  function requireCenterId(): string {
    const id = getCenterId()
    if (!id) throw new Error('센터가 선택되지 않았습니다.')
    return id
  }

  function invalidateFieldNote() {
    queryClient.invalidateQueries({
      queryKey: ['getFieldNoteBySchedule'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getFieldNoteDetail'],
      exact: false
    })
  }

  function invalidateStatuses() {
    queryClient.invalidateQueries({
      queryKey: ['getFieldNoteStatuses'],
      exact: false
    })
  }

  function invalidateUnlinked() {
    queryClient.invalidateQueries({
      queryKey: ['getUnlinkedFieldNotes'],
      exact: false
    })
  }

  function invalidateSessionNotes() {
    queryClient.invalidateQueries({
      queryKey: ['getSessionNoteList'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getCounselingDetailById'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getCounselingNoteAiDrafts'],
      exact: false
    })
  }

  /** AI 기능 사용 후 크레딧 잔여량 갱신 */
  function invalidateCredit() {
    queryClient.invalidateQueries({
      queryKey: ['getCreditBalance'],
      exact: false
    })
  }

  async function runPipeline(fieldNoteId: string) {
    try {
      const action = postRunPipeline()
      await action.request({
        centerId: requireCenterId(),
        fieldNoteId
      })
      snackbarStore.success('분석을 시작했어요.')
      invalidateFieldNote()
      invalidateStatuses()
      invalidateCredit()
    } catch (e: any) {
      if (e?.response?.status !== 429)
        snackbarStore.error('분석 시작에 실패했어요.')
    }
  }

  async function retryPipeline(fieldNoteId: string) {
    try {
      const action = postRetryPipeline()
      await action.request({
        centerId: requireCenterId(),
        fieldNoteId
      })
      snackbarStore.success('분석을 다시 시도했어요.')
      invalidateFieldNote()
      invalidateStatuses()
      invalidateCredit()
    } catch (e: any) {
      if (e?.response?.status !== 429)
        snackbarStore.error('분석 재시도에 실패했어요.')
    }
  }

  async function regenerateSummary(fieldNoteId: string) {
    try {
      const action = postGenerateSummary()
      const result = await action.request({
        centerId: requireCenterId(),
        fieldNoteId
      })
      const resultStatus = (result as any)?.status ?? 'started'
      if (resultStatus === 'started') {
        snackbarStore.success('요약을 다시 만들고 있어요.')
      } else if (resultStatus === 'already_processing') {
        snackbarStore.info('이미 요약을 만드는 중이에요.')
      } else if (resultStatus === 'already_completed') {
        snackbarStore.info('이미 요약이 완료되었어요.')
      } else if (resultStatus === 'precondition_not_met') {
        snackbarStore.error(
          (result as any)?.message ?? '먼저 분석을 완료해야 해요.'
        )
      } else {
        snackbarStore.success('요약을 다시 만들고 있어요.')
      }
      invalidateFieldNote()
      invalidateCredit()
    } catch (e: any) {
      if (e?.response?.status !== 429)
        snackbarStore.error('요약 생성에 실패했어요.')
    }
  }

  async function generateCounselingNote(
    fieldNoteId: string,
    noteTemplateType?: NoteTemplateType
  ): Promise<string | null> {
    try {
      const action = postGenerateCounselingNote()
      const result = await action.request({
        centerId: requireCenterId(),
        fieldNoteId,
        noteTemplateType
      })
      const resultStatus = (result as any)?.status ?? 'started'
      const caseId = (result as any)?.counseling_case_id ?? null
      if (resultStatus === 'started') {
        snackbarStore.success(
          '상담일지 초안 생성을 시작했어요. 완료되면 일지의 "AI 초안 이력"에서 볼 수 있어요.'
        )
      } else if (resultStatus === 'already_processing') {
        snackbarStore.info('이미 생성이 진행 중이에요.')
      } else if (resultStatus === 'already_completed') {
        snackbarStore.info('이미 생성이 완료되었어요.')
      } else if (resultStatus === 'precondition_not_met') {
        snackbarStore.error(
          (result as any)?.message ?? '아직 초안을 생성할 수 없어요.'
        )
      } else {
        snackbarStore.success('상담일지 초안을 생성했어요.')
      }
      invalidateFieldNote()
      invalidateSessionNotes()
      invalidateCredit()
      return caseId
    } catch (e: any) {
      if (e?.response?.status !== 429) {
        const detail = e?.response?.data?.detail
        snackbarStore.error(detail || '상담일지 초안 생성에 실패했어요.')
      }
      return null
    }
  }

  /**
   * 초안 생성 → 완료까지 대기 → 새로 생긴 초안을 돌려준다.
   *
   * 생성은 Track B 워커라 요청이 즉시 결과를 주지 않는다(전사 전체를 LLM에 넣어
   * 수십 초가 걸린다). 그래서 요청 직전의 최신 초안 id를 기준선으로 잡고, 그보다
   * 새 초안이 뜰 때까지 폴링한다 — 화면은 그동안 로딩만 보이면 된다.
   */
  async function generateCounselingNoteDraft(
    fieldNoteId: string,
    sessionId: string,
    noteTemplateType?: NoteTemplateType
  ): Promise<CounselingNoteAiDraft | null> {
    const centerId = requireCenterId()
    const listDrafts = async (): Promise<CounselingNoteAiDraft[]> =>
      ((await getCounselingNoteAiDrafts().request({
        centerId,
        sessionId
      })) as CounselingNoteAiDraft[]) ?? []

    let baselineId: string | null = null
    try {
      baselineId = (await listDrafts())[0]?.id ?? null
    } catch {
      // 이력 조회 실패는 생성을 막을 이유가 아니다 — 기준선 없이 첫 초안을 기다린다
    }

    try {
      const result: any = await postGenerateCounselingNote().request({
        centerId,
        fieldNoteId,
        noteTemplateType
      })
      const status = result?.status ?? 'started'
      if (status === 'precondition_not_met') {
        snackbarStore.error(result?.message ?? '아직 초안을 만들 수 없어요.')
        return null
      }
      // already_processing·already_completed 는 그대로 폴링 — 진행 중이던 것이 곧 뜬다
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      snackbarStore.error(detail || '초안 생성을 시작하지 못했어요.')
      return null
    }

    // 전사 길이에 따라 편차가 커서 넉넉히 잡는다(2s × 60 = 2분)
    for (let i = 0; i < DRAFT_POLL_ATTEMPTS; i += 1) {
      await new Promise((r) => setTimeout(r, DRAFT_POLL_INTERVAL_MS))
      let drafts: CounselingNoteAiDraft[] = []
      try {
        drafts = await listDrafts()
      } catch {
        continue
      }
      const newest = drafts[0]
      if (newest && newest.id !== baselineId) {
        invalidateFieldNote()
        invalidateSessionNotes()
        invalidateCredit()
        return newest
      }
    }

    snackbarStore.info(
      '초안을 만드는 데 시간이 걸리고 있어요. 완료되면 「초안 보기」에서 확인할 수 있어요.'
    )
    invalidateFieldNote()
    return null
  }

  async function updateSpeakerMap(
    fieldNoteId: string,
    speakerMap: Record<string, string>
  ) {
    try {
      const action = patchSpeakerMap()
      await action.request({
        centerId: requireCenterId(),
        fieldNoteId,
        speakerMap
      })
      snackbarStore.success('화자 이름을 저장했어요.')
      invalidateFieldNote()
    } catch {
      snackbarStore.error('화자 이름 저장에 실패했어요.')
    }
  }

  async function linkToSchedule(fieldNoteId: string, scheduleId: string) {
    try {
      const action = patchLinkSchedule()
      await action.request({
        centerId: requireCenterId(),
        fieldNoteId,
        scheduleId
      })
      snackbarStore.success('회기에 필드노트를 연결했어요.')
      invalidateFieldNote()
      invalidateStatuses()
      invalidateUnlinked()
    } catch {
      snackbarStore.error('필드노트 연결에 실패했어요.')
    }
  }

  async function exportTranscript(
    fieldNoteId: string,
    format: 'text' | 'json'
  ) {
    try {
      const action = getExportTranscript()
      const result = await action.request({
        centerId: requireCenterId(),
        fieldNoteId,
        format
      })
      if (!result) {
        snackbarStore.error('내보내기 데이터가 없어요.')
        return
      }
      // 브라우저에서 파일 다운로드
      const blob = new Blob([result.content], {
        type: format === 'json' ? 'application/json' : 'text/plain'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
      snackbarStore.success('전사 내용을 내보냈어요.')
    } catch {
      snackbarStore.error('내보내기에 실패했어요.')
    }
  }

  return {
    runPipeline,
    retryPipeline,
    regenerateSummary,
    generateCounselingNote,
    generateCounselingNoteDraft,
    updateSpeakerMap,
    linkToSchedule,
    exportTranscript,
    invalidateSessionNotes
  }
}

export type FieldNoteService = ReturnType<typeof createFieldNoteService>
