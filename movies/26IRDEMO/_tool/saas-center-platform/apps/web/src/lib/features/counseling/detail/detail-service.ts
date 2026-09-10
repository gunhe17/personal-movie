import { modalStore, modalUtils } from '$lib/stores/modal'
import GreenCircleCheck54 from '$lib/assets/GreenCircleCheck54.svelte'
import { snackbarStore } from '$lib/stores/snackbar'
import {
  updateCounselingSession,
  updateSessionParticipant,
  patchModifySessionNote,
  deleteCounselingSession,
  patchCounselingCase
} from '$lib/hooks/actions/counseling.action'
import SessionEditModal from '$lib/components/modal/SessionEditModal.svelte'
import SessionCancelModal from '$lib/components/modal/SessionCancelModal.svelte'
import SessionCancelAttendanceModal from '$lib/components/modal/SessionCancelAttendanceModal.svelte'
import SessionCreateModal from '$lib/components/modal/SessionCreateModal.svelte'
import type {
  JournalFormData,
  CounselingSession,
  SessionParticipant,
  SessionStatus
} from '$lib/types/counseling'
import type { QueryClient } from '@tanstack/svelte-query'
import { MODAL_SIZES } from './constants'

export interface DetailServiceDeps {
  queryClient: QueryClient
  getCenterId: () => string | null
}

export function createCounselingDetailService(deps: DetailServiceDeps) {
  const { queryClient, getCenterId } = deps

  // 회기 상태(노쇼·취소·완료) 변경은 케이스 상세뿐 아니라 상담현황 목록 뱃지와
  // 내담자 상세 진행률에도 반영돼야 하므로 연결 aggregate 뷰까지 함께 무효화한다.
  const invalidateDetail = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['getCounselingDetailById'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getCounselingsByCenterId'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getClientDetail'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getClientMetrics'],
        exact: false
      })
    ])

  const invalidateNotes = () =>
    queryClient.invalidateQueries({
      queryKey: ['getSessionNoteList'],
      exact: false
    })

  // 스낵바는 '무엇을 어떻게 바꿨는지'를 말한다 — '상태가 변경되었습니다'는
  // 완료·취소·노쇼·되돌리기가 전부 같은 문장이라 결과를 확인할 수 없다.
  const SESSION_STATUS_RESULT: Record<SessionStatus, string> = {
    scheduled: '예정으로 되돌렸어요',
    completed: '완료했어요',
    cancelled: '취소했어요',
    no_show: '노쇼 처리했어요'
  }
  function sessionStatusMessage(
    status: SessionStatus,
    sessionNumber?: number | null
  ) {
    const subject = sessionNumber ? `${sessionNumber}회기를` : '회기를'
    return `${subject} ${SESSION_STATUS_RESULT[status] ?? '변경했어요'}`
  }

  async function changeSessionStatus(
    sessionId: string,
    status: SessionStatus,
    currentSession?: CounselingSession,
    counselingData?: any
  ) {
    try {
      // 역방향 연동: 회기 상태 변경 시 내담자 참석 상태 처리
      let supplementAfter = false
      if (currentSession) {
        const handled = await handleReverseSync(currentSession, status)
        if (handled === 'abort') return
        if (handled === 'supplement') supplementAfter = true
      }

      await changeSessionStatusAsync(sessionId, status)
      snackbarStore.success(
        sessionStatusMessage(status, currentSession?.session_number)
      )
      await invalidateDetail()

      // 보충 회기 추가: 취소 완료 후 회기 추가 모달 열기
      if (supplementAfter && counselingData) {
        openAddSessionModal(counselingData)
      }
    } catch {
      snackbarStore.error('회기 상태 변경에 실패했어요')
      // 참석 상태만 바뀌고 회기 상태 변경이 실패했을 수 있어 서버 실제 상태로 재동기화
      await invalidateDetail()
    }
  }

  /**
   * 역방향 연동: 회기 상태 변경 → 내담자 참석 상태 처리
   * @returns 'abort' 이면 회기 상태 변경 자체를 취소, 'continue'면 진행
   */
  async function handleReverseSync(
    session: CounselingSession,
    newStatus: SessionStatus
  ): Promise<'abort' | 'continue' | 'supplement'> {
    const clients = session.clients
    const unresolvedClients = clients.filter(
      (c) => c.attendance_status === 'scheduled'
    )
    const hasUnresolved = unresolvedClients.length > 0

    // 취소: ① 보충 회기 여부 → ② 내담자별 취소/노쇼 확인
    // 회기 취소 ↔ 내담자 취소·노쇼가 짝이므로, 전원을 둘 중 하나로 확정해야 취소가 끝난다.
    // 이미 참석으로 찍힌 사람도 다시 묻는다(완료 → 취소 역방향 전이).
    if (newStatus === 'cancelled') {
      const choice = await openSessionCancelModal()
      if (!choice) return 'abort'

      const targets = clients.filter((c) => c.participant_type === 'client')
      if (targets.length > 0) {
        const picked = await openSessionCancelAttendanceModal(targets)
        if (!picked) return 'abort'

        // 값이 실제로 바뀌는 사람만 PATCH — 이미 같은 값이면 건드리지 않는다
        const changes = targets.filter(
          (c) => picked[c.session_participant_id] !== c.attendance_status
        )
        await Promise.all(
          changes.map((c) =>
            bulkUpdateAttendance(
              [c.session_participant_id],
              picked[c.session_participant_id],
              // 노쇼 차감은 센터 정책 — 일괄 전이에서는 켜지 않고 카드에서 개별 토글
              picked[c.session_participant_id] === 'no_show'
                ? { isConsumed: false }
                : undefined
            )
          )
        )
      }

      if (choice === 'supplement') return 'supplement'
    }

    // 회기 노쇼 분기 없음 — 회기 상태는 예정/완료/취소 3단이고,
    // 노쇼는 내담자 출결에만 존재한다(전원 노쇼 = 회기 취소).

    // 되돌리기: completed/cancelled → scheduled
    if (newStatus === 'scheduled') {
      // 확인은 여기 한 곳만 — 호출부(케밥 등)에서 또 물으면 팝업이 두 번 뜬다
      const confirmed = await modalUtils.confirm(
        '예정 상태일 땐 회기를 수정할 수 있어요.',
        '회기를 예정 상태로 되돌릴까요?',
        { confirmText: '되돌리기', cancelText: '닫기' }
      )
      if (!confirmed) return 'abort'
      // 출결은 '진행된 회기'에만 성립한다 — 예정으로 되돌리면 확정된 출결도 미확정으로.
      // 남겨두면 되돌린 회기에서 일지가 그대로 열려 되돌린 의미가 사라진다.
      const confirmedAttendance = session.clients.filter((c) =>
        ['attended', 'absent', 'no_show'].includes(c.attendance_status)
      )
      if (confirmedAttendance.length > 0) {
        await bulkUpdateAttendance(
          confirmedAttendance.map((c) => c.session_participant_id),
          'scheduled'
        )
      }
      return 'continue'
    }

    if (newStatus === 'completed' && hasUnresolved) {
      const unresolvedNames = unresolvedClients
        .map((c) => c.participant_name)
        .join(', ')
      const confirmed = await modalUtils.confirm(
        '',
        '회기를 완료로 변경할게요',
        {
          description: `${unresolvedNames}의 출결이 참석으로 변경돼요`,
          // 완료 확정은 경고가 아니라 긍정 확인 — 기본 경고 삼각형 대신 체크
          icon: GreenCircleCheck54
        }
      )
      if (confirmed) {
        await bulkUpdateAttendance(
          unresolvedClients.map((c) => c.session_participant_id),
          'attended'
        )
      } else {
        return 'abort'
      }
    }

    return 'continue'
  }

  async function bulkUpdateAttendance(
    sessionParticipantIds: string[],
    attendanceStatus: string,
    options?: { memo?: string; isConsumed?: boolean }
  ) {
    const centerId = getCenterId()!
    await Promise.all(
      sessionParticipantIds.map((id) => {
        const action = updateSessionParticipant()
        return action.request({
          centerId,
          sessionParticipantId: id,
          payload: {
            attendance_status: attendanceStatus,
            ...(options?.memo && { memo: options.memo }),
            ...(options?.isConsumed !== undefined && {
              is_consumed: options.isConsumed
            })
          }
        })
      })
    )
  }

  /**
   * 미확인(scheduled) 내담자를 일괄 '참석' 처리.
   * 내담자 리스트 헤더의 "일괄 참석" 버튼에서 호출.
   * 이미 참석/불참/노쇼로 확정된 사람은 건드리지 않는다.
   * 처리 후 전원 확정되면 회기 완료 제안까지 이어준다(단건 핸들러와 동일 UX).
   */
  async function markAllAttended(currentSession: CounselingSession) {
    const unresolved = currentSession.clients.filter(
      (c) => c.attendance_status === 'scheduled'
    )
    if (unresolved.length === 0) {
      snackbarStore.info('참석 처리할 미확인 내담자가 없어요')
      return
    }

    const names = unresolved.map((c) => c.participant_name).join(', ')
    const confirmed = await modalUtils.confirm(names, '일괄 참석 처리', {
      description: `미확인 내담자 ${unresolved.length}명을 '참석'으로 처리할까요?`,
      confirmText: '참석 처리',
      type: 'info'
    })
    if (!confirmed) return

    try {
      await bulkUpdateAttendance(
        unresolved.map((c) => c.session_participant_id),
        'attended'
      )
      // 회기 상태도 함께 확정 (단건 변경과 동일 흐름 — 예정 회기에 확정 출결을 남기지 않는다)
      const suggestedStatus = getSuggestedSessionStatus(
        currentSession,
        unresolved.map((c) => c.session_participant_id),
        'attended'
      )
      if (suggestedStatus) {
        await changeSessionStatusAsync(
          currentSession.session_id,
          suggestedStatus
        )
        snackbarStore.success(
          `${unresolved.length}명을 참석 처리했어요. ${sessionStatusMessage(suggestedStatus, currentSession.session_number)}`
        )
      } else {
        snackbarStore.success(`${unresolved.length}명을 참석 처리했어요`)
      }
      await invalidateDetail()
    } catch {
      snackbarStore.error('일괄 참석 처리에 실패했어요')
    }
  }

  function openSessionCancelModal(): Promise<
    'supplement' | 'cancel_only' | null
  > {
    return new Promise((resolve) => {
      let resolved = false
      const id = modalStore.open({
        component: SessionCancelModal,
        props: {
          onSelect: (choice: 'supplement' | 'cancel_only') => {
            if (resolved) return
            resolved = true
            unsubscribe()
            resolve(choice)
          }
        },
        options: { customWidth: 540 }
      })

      // X 버튼으로 모달이 닫힌 경우 감지
      const unsubscribe = modalStore.subscribe((state) => {
        if (resolved) return
        const stillOpen = state.modals.some((m) => m.id === id)
        if (!stillOpen) {
          resolved = true
          // tick 후 unsubscribe (subscribe 콜백 내에서 즉시 호출 방지)
          setTimeout(() => unsubscribe(), 0)
          resolve(null)
        }
      })
    })
  }

  /**
   * 취소 전이 시 내담자별 취소/노쇼를 고르게 한다.
   * null = 닫기(취소 전이 자체를 중단).
   */
  function openSessionCancelAttendanceModal(
    clients: SessionParticipant[]
  ): Promise<Record<string, 'absent' | 'no_show'> | null> {
    return new Promise((resolve) => {
      let resolved = false
      const id = modalStore.open({
        component: SessionCancelAttendanceModal,
        props: {
          clients,
          onConfirm: (result: Record<string, 'absent' | 'no_show'>) => {
            if (resolved) return
            resolved = true
            unsubscribe()
            resolve(result)
          }
        },
        options: { customWidth: 540 }
      })

      // X 버튼·바깥 클릭으로 닫힌 경우 감지 (취소 모달과 동일 패턴)
      const unsubscribe = modalStore.subscribe((state) => {
        if (resolved) return
        const stillOpen = state.modals.some((m) => m.id === id)
        if (!stillOpen) {
          resolved = true
          setTimeout(() => unsubscribe(), 0)
          resolve(null)
        }
      })
    })
  }

  function openAddSessionModal(counselingData: any) {
    modalStore.open({
      component: SessionCreateModal,
      props: {
        counselingDetail: counselingData,
        onSuccess: () => {
          invalidateDetail()
        }
      },
      options: MODAL_SIZES.sessionEdit
    })
  }

  function openEditSessionModal(
    session: CounselingSession,
    counselingData: any
  ) {
    modalStore.open({
      component: SessionEditModal,
      props: {
        session,
        counselingData,
        onSuccess: () => {
          invalidateDetail()
        }
      },
      options: MODAL_SIZES.sessionEdit
    })
  }

  function saveJournal(
    noteId: string,
    journalData: JournalFormData,
    isNew: boolean
  ) {
    const action = patchModifySessionNote()
    action
      .request({
        centerId: getCenterId()!,
        noteId,
        payload: {
          content: {
            main_topic: journalData.goal,
            progress: journalData.progress,
            next_goal: journalData.nextPlan,
            private_notes: journalData.privateMemo
          },
          summary: journalData.opinion
        }
      })
      .then(() => {
        snackbarStore.success(
          isNew ? '일지를 작성했어요!' : '일지를 수정했어요!'
        )
        invalidateDetail()
        invalidateNotes()
      })
      .catch(() => {
        snackbarStore.error(
          isNew ? '일지 작성에 실패했어요.' : '일지 수정에 실패했어요.'
        )
      })
  }

  async function changeSessionStatusAsync(
    sessionId: string,
    status: SessionStatus
  ) {
    const action = updateCounselingSession()
    await action.request({
      centerId: getCenterId()!,
      sessionId,
      payload: { status }
    })
  }

  /**
   * 내담자 출결 → 회기 상태 (정방향 연동).
   *
   * 회기 상태와 내담자 출결은 짝이다:
   *   예정 ↔ 전원 미확정 · 완료 ↔ 참석 1명 이상 · 취소 ↔ 전원 취소/노쇼
   * 회기 자체에는 노쇼가 없다 — 노쇼는 내담자 단위 사유이고, 전원 노쇼면 회기는 취소다.
   *
   * **첫 확정**에서 바로 예정을 벗어난다(전원 확정을 기다리지 않는다) — 예정 회기는
   * 출결을 미확정으로 표시하므로, 한 명만 확정한 구간이 곧 모순 상태이기 때문.
   * 뒤늦게 참석이 하나 생기면 취소 → 완료로 승격된다(같은 규칙의 재평가).
   */
  function getSuggestedSessionStatus(
    session: CounselingSession,
    changedParticipantId: string | string[],
    newStatus: string
  ): SessionStatus | null {
    // 변경된 참여자(들)의 상태를 낙관적으로 반영 (단건/일괄 모두 지원)
    const changedIds = new Set(
      Array.isArray(changedParticipantId)
        ? changedParticipantId
        : [changedParticipantId]
    )
    const statuses = session.clients.map((c) =>
      changedIds.has(c.session_participant_id) ? newStatus : c.attendance_status
    )

    const resolved = statuses.filter((s) => s !== 'scheduled')
    if (resolved.length === 0) return null

    const target: SessionStatus = resolved.some(
      (s) => s === 'attended' || s === 'late'
    )
      ? 'completed'
      : 'cancelled'

    // 이미 그 상태면 건드리지 않는다
    return target === session.status ? null : target
  }

  async function changeAttendanceStatus(
    sessionParticipantId: string,
    attendanceStatus: string,
    currentSession: CounselingSession
  ) {
    try {
      let memo: string | undefined
      let isConsumed: boolean | undefined

      const attendanceLabels: Record<string, string> = {
        attended: '참석',
        absent: '취소',
        no_show: '노쇼',
        scheduled: '미확인'
      }
      const label = attendanceLabels[attendanceStatus] ?? attendanceStatus
      const targetName =
        currentSession.clients.find(
          (c) => c.session_participant_id === sessionParticipantId
        )?.participant_name ?? '내담자'

      // 출결은 회기 상태까지 함께 움직인다 — 무엇이 따라 바뀌는지 먼저 알리고 확인받는다.
      const suggestedStatus = getSuggestedSessionStatus(
        currentSession,
        sessionParticipantId,
        attendanceStatus
      )
      const sessionStatusLabels: Record<SessionStatus, string> = {
        scheduled: '예정',
        completed: '완료',
        cancelled: '취소',
        no_show: '노쇼'
      }
      // 노쇼는 사유·차감을 받는 전용 모달이 확인을 겸한다 — 팝업을 두 번 띄우지 않는다
      if (attendanceStatus !== 'no_show') {
        const okToChange = await modalUtils.confirm(
          '',
          `${targetName}님을 ${label}으로 변경할까요?`,
          {
            description: suggestedStatus
              ? `${currentSession.session_number}회기가 ${sessionStatusLabels[suggestedStatus]} 처리돼요.`
              : undefined,
            confirmText: '변경'
          }
        )
        if (!okToChange) return
      }

      if (attendanceStatus === 'no_show') {
        // 노쇼 전용 모달: 사유 + 회기 차감 스위치 (디폴트 off)
        const { default: NoShowReasonModal } = await import(
          '$lib/components/modal/NoShowReasonModal.svelte'
        )
        // 이 모달이 노쇼의 확인 팝업을 겸한다 — 타이틀로 묻고, 부제로 회기 변화를 고지한다
        const result = (await modalStore.openWithPromise(
          NoShowReasonModal,
          {
            title: `${targetName}님을 노쇼로 변경할까요?`,
            message: suggestedStatus
              ? `${currentSession.session_number}회기가 ${sessionStatusLabels[suggestedStatus]} 처리돼요. 사유는 선택이에요.`
              : '노쇼 사유를 입력해주세요. (선택)',
            confirmText: '변경'
          },
          { customWidth: 420 }
        )) as { memo: string; isConsumed: boolean } | null
        // null = X 버튼/취소
        if (!result) return
        memo = result.memo || undefined
        isConsumed = result.isConsumed
      }
      // '취소'는 사유를 받지 않는다 — 사전 통보라 귀책을 남길 일이 없다.
      // 사유는 노쇼(연락 없이 불참)에만 붙는다.

      const action = updateSessionParticipant()
      await action.request({
        centerId: getCenterId()!,
        sessionParticipantId,
        payload: {
          attendance_status: attendanceStatus,
          ...(memo && { memo }),
          ...(isConsumed !== undefined && { is_consumed: isConsumed })
        }
      })
      // 회기 상태는 위 확인에서 이미 고지했으므로 여기서 다시 묻지 않는다 —
      // 거절당하면 '예정 + 확정 출결' 같은 모순 조합이 남는다.
      if (suggestedStatus) {
        await changeSessionStatusAsync(
          currentSession.session_id,
          suggestedStatus
        )
        snackbarStore.success(
          `${label} 처리했어요. ${sessionStatusMessage(suggestedStatus, currentSession.session_number)}`
        )
      } else {
        snackbarStore.success(`${label} 상태로 변경했어요`)
      }
      await invalidateDetail()
    } catch {
      snackbarStore.error('참석 상태 변경에 실패했어요')
    }
  }

  /**
   * 이미 노쇼로 마킹된 참가자의 사유·차감을 함께 편집.
   * NoShowReasonModal을 현재 값으로 초기화해서 띄우고, 결과를 PATCH로 반영.
   */
  async function editNoShow(client: SessionParticipant) {
    const { default: NoShowReasonModal } = await import(
      '$lib/components/modal/NoShowReasonModal.svelte'
    )
    const result = (await modalStore.openWithPromise(
      NoShowReasonModal,
      {
        title: '사유 수정',
        initialNote: client.memo ?? '',
        initialIsConsumed: client.is_consumed
      },
      { customWidth: 420 }
    )) as { memo: string; isConsumed: boolean } | null
    if (!result) return

    try {
      const action = updateSessionParticipant()
      await action.request({
        centerId: getCenterId()!,
        sessionParticipantId: client.session_participant_id,
        payload: {
          memo: result.memo,
          is_consumed: result.isConsumed
        }
      })
      snackbarStore.success('노쇼 사유를 수정했어요')
      await invalidateDetail()
    } catch {
      snackbarStore.error('노쇼 사유 수정에 실패했어요')
    }
  }

  async function deleteSession(
    session: CounselingSession,
    totalSessions: number
  ) {
    const sessionNum = session.session_number
    const isLastSession = totalSessions <= 1

    const confirmed = isLastSession
      ? await modalUtils.confirm(
          `${sessionNum}회기를 삭제하시겠습니까?`,
          '마지막 회기 삭제',
          {
            type: 'danger',
            description:
              '이 회기를 삭제하면 상담에 남는 회기가 없어요. 상담은 빈 상태로 유지되며, 종결하려면 상담 화면에서 직접 삭제해주세요.',
            confirmText: '삭제'
          }
        )
      : await modalUtils.confirm(
          `${sessionNum}회기를 삭제하시겠습니까?`,
          '회기 삭제',
          { type: 'danger', description: '삭제된 회기는 복구할 수 없어요.' }
        )
    if (!confirmed) return

    try {
      const action = deleteCounselingSession()
      await action.request({
        centerId: getCenterId()!,
        sessionId: session.session_id
      })
      snackbarStore.success('회기를 삭제했어요')
      invalidateDetail()
    } catch {
      snackbarStore.error('회기 삭제에 실패했어요')
    }
  }

  // 상담 종결: 예정 회기가 남아있으면 경고 후 완결 처리
  async function terminateCase(caseId: string, scheduledCount: number) {
    const confirmed = await modalUtils.confirm(
      scheduledCount > 0
        ? `아직 예정된 회기가 ${scheduledCount}건 있어요. 종결하면 이 회기들은 처리되지 않은 채 남아요.`
        : '종결 처리 후에도 되돌릴 수 있어요',
      '상담을 종결 처리할까요?',
      { type: 'warning', confirmText: '종결 처리' }
    )
    if (!confirmed) return
    try {
      await patchCounselingCase().request({
        centerId: getCenterId()!,
        counselingId: caseId,
        status: 'completed'
      })
      snackbarStore.success('상담을 종결 처리했어요.')
      await invalidateDetail()
    } catch (err: any) {
      snackbarStore.error(
        err?.response?.data?.detail || '종결 처리에 실패했어요.'
      )
    }
  }

  // 종결 되돌리기: 미종결(active)로 재개
  async function reopenCase(caseId: string) {
    const confirmed = await modalUtils.confirm(
      '상담이 미종결 상태로 변경돼요',
      '종결을 되돌릴까요?',
      { confirmText: '되돌리기' }
    )
    if (!confirmed) return
    try {
      await patchCounselingCase().request({
        centerId: getCenterId()!,
        counselingId: caseId,
        status: 'active'
      })
      snackbarStore.success('상담을 미종결 상태로 되돌렸어요.')
      await invalidateDetail()
    } catch {
      snackbarStore.error('되돌리기에 실패했어요.')
    }
  }

  return {
    changeSessionStatus,
    changeAttendanceStatus,
    markAllAttended,
    editNoShow,
    openEditSessionModal,
    openAddSessionModal,
    saveJournal,
    deleteSession,
    terminateCase,
    reopenCase,
    invalidateDetail
  }
}
