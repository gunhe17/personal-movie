import { goto } from '$app/navigation'
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { syncDeleteService, cancelledCaseIds } from '$lib/stores/syncDelete'
import SendResultModal from '$lib/components/modal/SendResultModal.svelte'
import SendResultSendModal from '$lib/components/modal/SendResultSendModal.svelte'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import ReportWarningConfirmModal from '$lib/components/modal/ReportWarningConfirmModal.svelte'
import AssessmentRefuseModal from '$lib/components/modal/AssessmentRefuseModal.svelte'
import AssessmentCancelConfirmModal from '$lib/components/modal/AssessmentCancelConfirmModal.svelte'
import { requireCenterId } from '$lib/stores/center.store'
import {
  cancelCase as cancelCaseAction,
  deleteCase as deleteCaseAction,
  updateCase as updateCaseAction,
  refuseTask as refuseTaskAction,
  completeTask as completeTaskAction,
  revertTask as revertTaskAction,
  cancelTask as cancelTaskAction,
  deleteTask as deleteTaskAction,
  revertCancelTask as revertCancelTaskAction
} from '$lib/hooks/actions/case.action'
import {
  cancelAssessmentSession as cancelAssessmentSessionAction,
  revertCancelAssessmentSession as revertCancelAssessmentSessionAction
} from '$lib/hooks/actions/session.action'
import CancelScheduleModal from '$lib/components/modal/CancelScheduleModal.svelte'
import ScheduleAddModal from '$lib/components/modal/ScheduleAddModal.svelte'
import CaseEditModal from '$lib/components/modal/CaseEditModal.svelte'
import { getAssessmentSendLinksByCenterId } from '$lib/hooks/actions/quickLinks'
import type { CaseDetail, TaskListItem } from '$lib/hooks/actions/case.action'
import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
import {
  formatRegisteredAt,
  formatScheduleDate,
  formatScheduleTime,
  calcScheduleDDay
} from '$lib/types/assessmentStatus'
import {
  findTasksMissingReports,
  findIncompleteTaskNames
} from '$lib/features/assessment/status/view-model'
import type { AssessmentItem, CaseDetailVM } from './types'
import type { QueryClient } from '@tanstack/svelte-query'

export interface StatusDetailServiceDeps {
  navigateToList?: () => void
  queryClient?: QueryClient
}

// CaseDetail → AssessmentStatusRow 변환 (서버 상세 스키마)
function mapCaseDetailToRow(
  caseDetail: CaseDetail,
  assessmentNames: string[]
): AssessmentStatusRow {
  const client = caseDetail.clients?.[0]
  const s = (caseDetail.status ?? '').toLowerCase()
  const status =
    s === 'completed'
      ? 'completed'
      : s === 'cancelled'
        ? 'cancelled'
        : s === 'processing'
          ? 'in_progress'
          : 'pending'
  return {
    id: caseDetail.case_id,
    status,
    clientName: client?.name || '',
    clientCode: client?.client_code || '',
    clientGender: client?.gender === 'F' ? 'female' : 'male',
    birthDate: client?.birth_date || '',
    clientProfileImageUrl: client?.profile_image_url ?? null,
    clientCount: caseDetail.clients?.length ?? 0,
    clientMembers: (caseDetail.clients ?? []).map((c) => ({
      name: c.name,
      gender: (c.gender === 'F' ? 'female' : 'male') as 'male' | 'female',
      birthDate: c.birth_date ?? ''
    })),
    reportStatus: caseDetail.is_final_report_required
      ? 'pending'
      : 'not_required',
    staffName: caseDetail.counselor?.name || '',
    organization: '-',
    organizationType:
      String(caseDetail.case_type).toLowerCase() === 'group'
        ? 'institution'
        : 'individual',
    assessments: assessmentNames,
    setName: caseDetail.set_name ?? null,
    assessmentUids: caseDetail.tasks?.map((t) => t.assessment_id) ?? [],
    hasOnlineLink: false,
    accessCode: caseDetail.case_code || '',
    registeredAt: caseDetail.created_at || '',
    scheduledStart: caseDetail.schedule?.start
      ? formatRegisteredAt(caseDetail.schedule.start)
      : null,
    scheduledDateLabel: formatScheduleDate(caseDetail.schedule?.start ?? null),
    scheduledTimeLabel: formatScheduleTime(caseDetail.schedule?.start ?? null),
    scheduledDDay: calcScheduleDDay(caseDetail.schedule?.start ?? null),
    completedCount:
      caseDetail.tasks?.filter((t) => t.status === 'completed').length ?? 0,
    totalCount: caseDetail.tasks?.length ?? 0,
    hasUninvoicedSessions: false,
    resultSent: false
  }
}

export function createStatusDetailService(deps: StatusDetailServiceDeps = {}) {
  const { navigateToList = () => goto('/assessment/status'), queryClient } =
    deps

  const invalidateCaseQueries = () => {
    queryClient?.invalidateQueries({
      queryKey: ['getCaseById'],
      exact: false
    })
    queryClient?.invalidateQueries({
      queryKey: ['getTasksByCaseId'],
      exact: false
    })
    queryClient?.invalidateQueries({
      queryKey: ['getCases'],
      exact: false
    })
  }

  // 바로링크 발송 모달 열기
  function openSendResultModal(
    rowData: AssessmentStatusRow,
    onComplete?: () => void,
    initialTab: 'send' | 'history' = 'send'
  ) {
    modalStore.open({
      component: SendResultModal,
      props: {
        rowData,
        initialTab,
        onSendComplete: () => {
          syncDeleteService.markBaroLinkSent(rowData.id)
          invalidateCaseQueries()
          onComplete?.()
        }
      },
      options: {
        customWidth: 960
      }
    })
  }

  // 전송 기록 모달 열기
  function openSendHistoryModal(
    rowData: AssessmentStatusRow,
    onResend?: () => void
  ) {
    openSendResultModal(rowData, onResend, 'history')
  }

  // 바로링크 발송 (처음 발송 또는 이미 발송된 경우 기록 모달)
  function sendLink(
    caseDetail: CaseDetail,
    assessmentNames: string[],
    onComplete?: () => void
  ) {
    const rowData = mapCaseDetailToRow(caseDetail, assessmentNames)

    if (syncDeleteService.isBaroLinkSent(rowData.id)) {
      openSendHistoryModal(rowData, onComplete)
    } else {
      openSendResultModal(rowData, () => {
        snackbarStore.success('바로링크 전송이 완료되었습니다.')
        onComplete?.()
      })
    }
  }

  // 바로링크 재전송 (기록 모달 또는 재발송 모달)
  function resendLink(
    caseDetail: CaseDetail,
    assessmentNames: string[],
    onComplete?: () => void
  ) {
    const rowData = mapCaseDetailToRow(caseDetail, assessmentNames)

    if (syncDeleteService.isBaroLinkSent(rowData.id)) {
      openSendHistoryModal(rowData, () => {
        snackbarStore.success('바로링크 재전송 요청을 처리했습니다.')
        invalidateCaseQueries()
        onComplete?.()
      })
    } else {
      openSendResultModal(rowData, () => {
        snackbarStore.success('바로링크 전송이 완료되었습니다.')
        onComplete?.()
      })
    }
  }

  // 검사 취소 실행
  async function executeCancelCase(caseDetail: CaseDetail) {
    try {
      await cancelCaseAction().request({
        centerId: requireCenterId(),
        caseId: caseDetail.case_id
      })
      snackbarStore.info('검사를 취소했어요.')
      cancelledCaseIds.update((ids: Set<string>) => {
        ids.add(caseDetail.case_id)
        return new Set(ids)
      })
      invalidateCaseQueries()
      navigateToList()
    } catch {
      snackbarStore.error('검사 취소에 실패했습니다.')
    }
  }

  // 검사 취소: 컨펌 모달
  function cancelCase(caseDetail: CaseDetail) {
    const clientName = caseDetail.clients?.[0]?.name || ''

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: caseDetail.case_id,
        title: '검사를 취소할까요?',
        description: `${clientName}님의 검사를 취소합니다.`,
        confirmText: '취소',
        onConfirm: async () => executeCancelCase(caseDetail)
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 검사 삭제 실행
  async function executeDeleteCase(caseDetail: CaseDetail) {
    try {
      await deleteCaseAction().request({
        centerId: requireCenterId(),
        caseId: caseDetail.case_id
      })
      snackbarStore.success('검사를 삭제했어요.')
      invalidateCaseQueries()
      navigateToList()
    } catch {
      snackbarStore.error('검사 삭제에 실패했습니다.')
    }
  }

  // 검사 삭제: 컨펌 모달
  function deleteCase(caseDetail: CaseDetail) {
    const clientName = caseDetail.clients?.[0]?.name || ''

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: caseDetail.case_id,
        title: '검사 케이스를 삭제할까요?',
        description: `${clientName}님의 검사 접수 내용이 삭제되며 복구할 수 없어요.`,
        confirmText: '삭제',
        onConfirm: () => executeDeleteCase(caseDetail)
      },
      options: {
        customWidth: 420
      }
    })
  }

  async function updateFinalReport(caseDetail: CaseDetail, enabled: boolean) {
    try {
      await updateCaseAction().request({
        centerId: requireCenterId(),
        caseId: caseDetail.case_id,
        payload: {
          require_final_report: enabled
        }
      })
      invalidateCaseQueries()
      snackbarStore.success(
        enabled
          ? '종합 보고서 작성이 활성화되었습니다.'
          : '종합 보고서 작성이 비활성화되었습니다.'
      )
      return true
    } catch {
      snackbarStore.error('종합 보고서 설정 변경에 실패했습니다.')
      return false
    }
  }

  function executeSendResult(caseId: string) {
    modalStore.open({
      component: SendResultSendModal,
      props: {
        caseId,
        onSendComplete: () => {
          syncDeleteService.markResultSent(caseId)
          invalidateCaseQueries()
        }
      },
      options: {
        size: 'fit',
        desktopOnly: true
      }
    })
  }

  function sendResult(caseId: string, tasks?: TaskListItem[]) {
    const missingNames = tasks ? findTasksMissingReports(tasks) : []
    const incompleteNames = tasks ? findIncompleteTaskNames(tasks) : []

    if (incompleteNames.length > 0 || missingNames.length > 0) {
      const description =
        incompleteNames.length > 0
          ? '완료되지 않은 검사가 있어요.'
          : '보고서가 작성되지 않은 검사가 있어요.'
      modalStore.open({
        component: ReportWarningConfirmModal,
        props: {
          title: '결과를 전송할까요?',
          description,
          incompleteItems: incompleteNames,
          missingItems: missingNames,
          confirmText: '전송',
          onConfirm: () => executeSendResult(caseId)
        },
        options: { customWidth: 420 }
      })
    } else {
      executeSendResult(caseId)
    }
  }

  async function refuseTask(
    caseId: string,
    assessmentId: string,
    reason?: string
  ) {
    try {
      const centerId = requireCenterId()
      const task = await refuseTaskAction().request({
        centerId,
        caseId,
        assessmentId,
        payload: {
          reason: reason ?? null
        }
      })
      invalidateCaseQueries()
      snackbarStore.success('검사가 미실시 처리되었습니다.')
      return task
    } catch {
      snackbarStore.error('검사 미실시 처리에 실패했습니다.')
      return null
    }
  }

  async function executeCompleteTask(caseId: string, assessmentId: string) {
    try {
      const centerId = requireCenterId()
      const task = await completeTaskAction().request({
        centerId,
        caseId,
        assessmentId
      })
      invalidateCaseQueries()
      snackbarStore.success('검사가 완료 처리되었습니다.')
      return task
    } catch {
      snackbarStore.error('검사 완료 처리에 실패했습니다.')
      return null
    }
  }

  function completeTask(
    caseId: string,
    assessmentId: string,
    assessment?: AssessmentItem
  ) {
    // self_report 검사를 응답 없이 수동 완료하면 경고
    const isSelfReport = assessment?.workflowType === 'self_report'
    const hasResponses = (assessment?.processResponses ?? []).length > 0
    const needsWarning =
      isSelfReport && !hasResponses && assessment?.status !== 'completed'

    if (needsWarning) {
      modalStore.open({
        component: ReportWarningConfirmModal,
        props: {
          title: '검사를 완료 처리할까요?',
          description:
            '내담자가 검사를 제출하지 않은 상태에서 완료 처리하면\n채점 및 보고서가 자동 생성되지 않아요.',
          missingItems: [],
          confirmText: '완료 처리',
          onConfirm: () => executeCompleteTask(caseId, assessmentId)
        },
        options: { customWidth: 420 }
      })
    } else {
      executeCompleteTask(caseId, assessmentId)
    }
  }

  async function revertTask(caseId: string, assessmentId: string) {
    try {
      const centerId = requireCenterId()
      const task = await revertTaskAction().request({
        centerId,
        caseId,
        assessmentId
      })
      invalidateCaseQueries()
      snackbarStore.success('완료가 되돌려졌습니다.')
      return task
    } catch {
      snackbarStore.error('검사 되돌리기에 실패했습니다.')
      return null
    }
  }

  async function cancelTask(taskId: string, reason?: string) {
    try {
      const centerId = requireCenterId()
      const task = await cancelTaskAction().request({
        centerId,
        taskId,
        payload: { reason: reason ?? undefined }
      })
      invalidateCaseQueries()
      snackbarStore.success('검사가 중단 처리되었습니다.')
      return task
    } catch {
      snackbarStore.error('검사 중단 처리에 실패했습니다.')
      return null
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const centerId = requireCenterId()
      await deleteTaskAction().request({ centerId, taskId })
      invalidateCaseQueries()
      snackbarStore.success('검사가 삭제되었습니다.')
    } catch {
      snackbarStore.error('검사 삭제에 실패했습니다.')
    }
  }

  function openCancelScheduleModal(sessionId: string) {
    modalStore.open({
      component: CancelScheduleModal,
      props: {
        onConfirm: async (reason: string) => {
          try {
            await cancelAssessmentSessionAction().request({
              centerId: requireCenterId(),
              sessionId,
              cancelReason: reason || undefined
            })
            invalidateCaseQueries()
            queryClient?.invalidateQueries({
              queryKey: ['getScheduleList'],
              exact: false
            })
            snackbarStore.success('일정이 취소되었어요.')
          } catch {
            snackbarStore.error('일정 취소에 실패했어요.')
          }
        }
      },
      options: { customWidth: 420 }
    })
  }

  async function revertCancelSchedule(sessionId: string) {
    try {
      const centerId = requireCenterId()
      await revertCancelAssessmentSessionAction().request({
        centerId,
        sessionId
      })
      invalidateCaseQueries()
      queryClient?.invalidateQueries({
        queryKey: ['getScheduleList'],
        exact: false
      })
      snackbarStore.success('일정 취소를 되돌렸어요!')
    } catch {
      snackbarStore.error('취소 되돌리기에 실패했어요!')
    }
  }

  async function revertCancelTask(taskId: string) {
    try {
      const centerId = requireCenterId()
      await revertCancelTaskAction().request({ centerId, taskId })
      invalidateCaseQueries()
      snackbarStore.success('되돌리기가 완료되었습니다.')
    } catch {
      snackbarStore.error('중단 되돌리기에 실패했습니다.')
    }
  }

  async function copyLink(caseId: string) {
    const centerId = requireCenterId()
    const fallbackPath = `/assessment/status/${caseId}`
    let linkToCopy = fallbackPath
    try {
      const response = await getAssessmentSendLinksByCenterId().request({
        centerId,
        page: 1,
        page_size: 50,
        sort: 'created_at_desc'
      })

      const matchedLink = response.data?.find(
        (item) => item.session_uid === caseId
      )
      if (matchedLink?.unique_token) {
        linkToCopy = matchedLink.unique_token.startsWith('http')
          ? matchedLink.unique_token
          : `${window.location.origin}/assessment/link/${matchedLink.unique_token}`
      } else {
        snackbarStore.info(
          '등록된 바로링크를 찾지 못해 상세 페이지 링크를 복사했어요.'
        )
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkToCopy)
        snackbarStore.success('링크가 복사되었습니다.')
      } else {
        throw new Error('clipboard not available')
      }
    } catch (err) {
      console.error(err)
      snackbarStore.error('링크 복사에 실패했습니다.')
    }
  }

  function openKeyboard() {
    snackbarStore.info('케이보드를 열었어요.')
  }

  // 검사 취소 모달 (개별 task)
  function openCancelAssessmentModal(
    caseData: CaseDetail,
    selectedAssessment: AssessmentItem
  ) {
    const assessmentName =
      selectedAssessment.name ?? caseData.tasks?.[0]?.assessment_name ?? '검사'
    const progressState =
      caseData.status?.toLowerCase() === 'processing'
        ? 'in_progress'
        : 'pending'
    const taskId = selectedAssessment.id
    modalStore.open({
      component: AssessmentCancelConfirmModal,
      props: {
        assessmentName,
        actionType: 'cancel',
        progressState,
        customDescription:
          '검사를 중단하면 진행이 멈추지만, 나중에 되돌릴 수 있어요.',
        onConfirm: async (reason: string) => {
          await cancelTask(taskId, reason)
        }
      },
      options: { customWidth: 420 }
    })
  }

  // 검사 삭제 모달 (개별 task)
  function openDeleteAssessmentModal(
    caseData: CaseDetail,
    selectedAssessment: AssessmentItem
  ) {
    const assessmentName = selectedAssessment.name ?? '검사'
    const progressState =
      caseData.status?.toLowerCase() === 'processing'
        ? 'in_progress'
        : 'pending'
    const taskId = selectedAssessment.id
    modalStore.open({
      component: AssessmentCancelConfirmModal,
      props: {
        assessmentName,
        actionType: 'delete',
        progressState,
        customDescription:
          '검사를 삭제하면 모든 데이터가 영구적으로 제거되며 복구할 수 없어요.',
        onConfirm: async (_reason: string) => {
          await deleteTask(taskId)
        }
      },
      options: { customWidth: 420 }
    })
  }

  // 검사 거부 모달
  function openRefuseAssessmentModal(
    assessment: AssessmentItem,
    caseId: string,
    onRefused: (task: any, reason: string) => void
  ) {
    modalStore.open({
      component: AssessmentRefuseModal,
      props: {
        assessmentName: assessment.name,
        onConfirm: async (reason: string) => {
          const task = await refuseTask(caseId, assessment.assessmentId, reason)
          if (task) onRefused(task, reason)
        }
      },
      options: { customWidth: 420 }
    })
  }

  // 일정 추가/변경 모달 열기
  function openAddScheduleModal(
    caseId: string,
    schedule?: CaseDetail['schedule']
  ) {
    // 기존 일정이 있으면 pre-fill 데이터 구성
    let initial: Record<string, unknown> | undefined
    if (schedule) {
      const startRaw = schedule.start
      const endRaw = schedule.end
      const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z')
      const end = new Date(endRaw.endsWith('Z') ? endRaw : endRaw + 'Z')
      initial = {
        date: start,
        startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
        roomId: schedule.room_id,
        scheduleId: schedule.schedule_id
      }
    }
    const isEdit = !!schedule
    modalStore.open({
      component: ScheduleAddModal,
      props: {
        initial,
        onConfirm: async (data: {
          roomId: string | null
          scheduledStart: string
          scheduledEnd: string
        }) => {
          try {
            await updateCaseAction().request({
              centerId: requireCenterId(),
              caseId,
              force: true,
              payload: {
                schedule: {
                  has_schedule: true,
                  scheduled_start: data.scheduledStart,
                  scheduled_end: data.scheduledEnd,
                  room_id: data.roomId
                }
              }
            })
            snackbarStore.success(
              isEdit
                ? '검사 일정이 변경되었습니다.'
                : '검사 일정이 등록되었습니다.'
            )
            invalidateCaseQueries()
          } catch {
            snackbarStore.error(
              isEdit
                ? '검사 일정 변경에 실패했습니다.'
                : '검사 일정 등록에 실패했습니다.'
            )
          }
        }
      },
      options: {
        customWidth: 640,
        desktopOnly: true
      }
    })
  }

  // 검사 정보 수정 모달
  function openEditCaseModal(caseDetail: CaseDetail) {
    modalStore.open({
      component: CaseEditModal,
      props: {
        caseDetail,
        onConfirm: async (data: {
          assessmentIds: string[]
          counselorId: string | null
          assistantIds: string[]
          setId: string | null
        }) => {
          try {
            const payload: Record<string, unknown> = {
              assessment_ids: data.assessmentIds
            }
            if (data.counselorId != null) {
              payload.counselor_id = data.counselorId
            }
            payload.assistant_ids = data.assistantIds
            if (data.setId) {
              payload.set_id = data.setId
            }
            await updateCaseAction().request({
              centerId: requireCenterId(),
              caseId: caseDetail.case_id,
              payload,
              force: true
            })
            snackbarStore.success('검사 정보가 수정되었습니다.')
            invalidateCaseQueries()
          } catch {
            snackbarStore.error('검사 정보 수정에 실패했습니다.')
          }
        }
      },
      options: {
        customWidth: 640,
        desktopOnly: true
      }
    })
  }

  // 종합 보고서 작성 (placeholder)
  function writeReport() {
    snackbarStore.info('종합 보고서 작성 기능은 준비 중입니다.')
  }

  // 보고서 업로드 알림
  function showReportUploadInfo(assessmentName: string, summary: string) {
    snackbarStore.info(`${assessmentName} 보고서: ${summary}`)
  }

  // 삭제된 케이스 알림 + 리다이렉트
  function notifyDeletedCase() {
    snackbarStore.info('삭제된 검사 케이스입니다.')
    navigateToList()
  }

  return {
    cancelCase,
    deleteCase,
    executeCancelCase,
    executeDeleteCase,
    updateFinalReport,
    sendResult,
    refuseTask,
    completeTask,
    revertTask,
    cancelTask,
    deleteTask,
    revertCancelTask,
    revertCancelSchedule,
    openCancelScheduleModal,
    resendLink,
    sendLink,
    copyLink,
    openKeyboard,
    openCancelAssessmentModal,
    openDeleteAssessmentModal,
    openRefuseAssessmentModal,
    openAddScheduleModal,
    openEditCaseModal,
    writeReport,
    showReportUploadInfo,
    notifyDeletedCase,
    invalidateCaseQueries
  }
}
