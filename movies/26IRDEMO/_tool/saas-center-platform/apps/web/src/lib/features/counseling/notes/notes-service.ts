import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import {
  getCounselingDetailById,
  type MyCounselingNoteItem
} from '$lib/hooks/actions/counseling.action'
import { openCounselingJournalModal } from '$lib/features/counseling/detail'
import type { CounselingSession } from '$lib/types/counseling'
import type { QueryClient } from '@tanstack/svelte-query'

export interface NotesServiceDeps {
  queryClient: QueryClient
}

export function createCounselingNotesService(deps: NotesServiceDeps) {
  const { queryClient } = deps

  const invalidateNotes = () =>
    queryClient.invalidateQueries({
      queryKey: ['getMyCounselingNotes'],
      exact: false
    })

  /**
   * 노트 카드 클릭 → 케이스 상세 조회 후 기존 상담일지 모달 재사용.
   * 모달이 닫히면 목록을 invalidate 해 작성/수정 결과를 반영한다.
   */
  async function openNote(item: MyCounselingNoteItem, isSecretMode = false) {
    if (!item.counseling_case_id) {
      snackbarStore.error('회기 정보를 찾을 수 없어요')
      return
    }
    await openNoteByIds(
      {
        caseId: item.counseling_case_id,
        sessionId: item.counseling_session_id,
        clientId: item.client_id
      },
      isSecretMode
    )
  }

  /**
   * id만으로 일지 모달 열기 — agent prefill(/counseling/notes?case_id=…&session_id=…) 진입점.
   * 목록을 거치지 않으므로 페이지네이션·담당자 필터에 걸리지 않는다.
   */
  async function openNoteByIds(
    ids: { caseId: string; sessionId: string; clientId?: string },
    isSecretMode = false
  ) {
    try {
      const detail = await getCounselingDetailById().request({
        centerId: requireCenterId(),
        counselingId: ids.caseId
      })
      const session = (detail.sessions ?? []).find(
        (s: CounselingSession) => s.session_id === ids.sessionId
      )
      if (!session) {
        snackbarStore.error('회기 정보를 찾을 수 없어요')
        return
      }
      const programName =
        detail.case_type === 'individual'
          ? detail.program_name
          : `${detail.program_name} - 그룹`

      const modalId = openCounselingJournalModal({
        session,
        caseClients: detail.clients ?? [],
        programName,
        initialClientId: ids.clientId ?? (detail.clients ?? [])[0]?.client_id,
        isSecretMode
      })

      const unsubscribe = modalStore.subscribe((state) => {
        const stillOpen = state.modals.some((m) => m.id === modalId)
        if (!stillOpen) {
          setTimeout(() => unsubscribe(), 0)
          invalidateNotes()
        }
      })
    } catch {
      snackbarStore.error('일지 정보를 불러오지 못했어요')
    }
  }

  return { openNote, openNoteByIds, invalidateNotes }
}
