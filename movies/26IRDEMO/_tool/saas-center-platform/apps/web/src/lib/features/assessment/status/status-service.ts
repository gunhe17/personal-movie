import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { showSuccessSnackbar } from '$lib/utils/errorHandler'
import { syncDeleteService } from '$lib/stores/syncDelete'
import { requireCenterId } from '$lib/stores/center.store'
import SendResultModal from '$lib/components/modal/SendResultModal.svelte'
import SendResultSendModal from '$lib/components/modal/SendResultSendModal.svelte'
import SendHistoryModal from '$lib/components/modal/SendHistoryModal.svelte'
import AssessmentBatchSendModal from '$lib/components/modal/AssessmentBatchSendModal.svelte'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import ReportWarningConfirmModal from '$lib/components/modal/ReportWarningConfirmModal.svelte'
import CancelConfirmModal from '$lib/components/modal/CancelConfirmModal.svelte'
import {
  cancelCase as cancelCaseAction,
  deleteCase as deleteCaseAction,
  revertCancelCase as revertCancelCaseAction,
  completeCase as completeCaseAction,
  getTasksByCaseId
} from '$lib/hooks/actions/case.action'
import { createAssessmentSendLink } from '$lib/hooks/actions/quickLinks'
import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
import type { CaseData } from '$lib/types/assessmentStatus'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  getAssessmentCompletionStatusFromCase,
  findTasksMissingReports,
  findIncompleteTaskNames
} from './view-model'

export interface StatusServiceDeps {
  queryClient: QueryClient
}

export function createStatusService({ queryClient }: StatusServiceDeps) {
  const invalidateCases = () =>
    queryClient.invalidateQueries({ queryKey: ['getCases'], exact: false })

  function openSendHistoryModal(
    row: AssessmentStatusRow,
    onResend?: () => void
  ) {
    modalStore.open({
      component: SendHistoryModal,
      props: {
        rowData: row,
        onResend: onResend ?? (() => invalidateCases())
      },
      options: {
        customWidth: 640,
        customHeight: 410,
        desktopOnly: true
      }
    })
  }

  function openSendResultModal(row: AssessmentStatusRow) {
    modalStore.open({
      component: SendResultModal,
      props: {
        rowData: row,
        onSendComplete: () => {
          // 바로링크 전송 완료 상태 저장
          syncDeleteService.markBaroLinkSent(row.id)
          invalidateCases()
        }
      },
      options: {
        customWidth: 960
        // customHeight: 572
      }
    })
  }

  function handleSend(row: AssessmentStatusRow) {
    if (row.resultSent) {
      openSendHistoryModal(row)
    } else {
      openSendResultModal(row)
    }
  }

  // 바로링크 버튼: 전송 완료 여부에 따라 다른 모달
  function handleSendLink(row: AssessmentStatusRow) {
    openSendResultModal(row)
  }

  // 검사 취소 실행 (POST /assessment-cases/:id/cancel)
  async function executeCancelCase(row: AssessmentStatusRow, _reason: string) {
    try {
      const centerId = requireCenterId()
      await cancelCaseAction().request({ centerId, caseId: row.id })
      snackbarStore.info('검사를 취소했어요.')
      invalidateCases()
    } catch {
      snackbarStore.error('검사 취소에 실패했어요.')
    }
  }

  // 검사 취소: 컨펌 모달 표시
  function cancelCase(row: AssessmentStatusRow) {
    modalStore.open({
      component: CancelConfirmModal,
      props: {
        targetId: row.id,
        title: `[${row.clientName}]의 검사 세트를 취소할까요?`,
        description:
          '검사 세트가 취소 상태로 변경돼요.\n취소된 검사는 다시 진행할 수 없어요.',
        cancelText: '닫기',
        confirmText: '취소',
        onConfirm: (_id: string, reason: string) =>
          executeCancelCase(row, reason)
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 검사 삭제 실행
  async function executeDeleteCase(row: AssessmentStatusRow) {
    try {
      const centerId = requireCenterId()
      await deleteCaseAction().request({ centerId, caseId: row.id })
      snackbarStore.success('검사를 삭제했어요.')
      invalidateCases()
    } catch (err) {
      const detail = (err as any)?.response?.data?.detail
      snackbarStore.error(detail || '검사 삭제에 실패했어요.')
    }
  }

  // 검사 삭제: 컨펌 모달 표시
  function deleteCase(row: AssessmentStatusRow) {
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: row.id,
        title: `[${row.clientName}]의 검사 세트를 삭제할까요?`,
        description: '접수된 내용이 삭제되며 복구할 수 없어요',
        cancelText: '닫기',
        confirmText: '삭제',
        onConfirm: () => executeDeleteCase(row)
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 취소 롤백 실행 (POST /assessment-cases/:id/rollback)
  async function executeRollbackCancel(row: AssessmentStatusRow) {
    try {
      const centerId = requireCenterId()
      await revertCancelCaseAction().request({ centerId, caseId: row.id })
      snackbarStore.info('검사 취소를 되돌렸어요.')
      invalidateCases()
    } catch {
      snackbarStore.error('취소 되돌리기에 실패했어요.')
    }
  }

  // 취소 롤백: 컨펌 모달 표시 (사유 불필요)
  function rollbackCancel(row: AssessmentStatusRow) {
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: row.id,
        title: `[${row.clientName}]의 취소를 되돌릴까요?`,
        description: '검사 세트가 취소 전 상태로 복구돼요.',
        cancelText: '닫기',
        confirmText: '되돌리기',
        onConfirm: () => executeRollbackCancel(row)
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 벌크 검사 취소: 하나의 컨펌 모달로 처리
  function bulkCancelCases(
    rows: AssessmentStatusRow[],
    onComplete?: () => void
  ) {
    if (!rows.length) return
    const names = rows.map((r) => r.clientName)
    const label = names.length === 1 ? `[${names[0]}]` : `${names.length}건`

    modalStore.open({
      component: CancelConfirmModal,
      props: {
        targetId: rows[0].id,
        title: `${label}의 검사 세트를 취소할까요?`,
        description:
          '검사 세트가 취소 상태로 변경돼요.\n취소된 검사는 다시 진행할 수 없어요.',
        cancelText: '닫기',
        confirmText: '취소',
        onConfirm: async (_id: string, _reason: string) => {
          try {
            const centerId = requireCenterId()
            await Promise.all(
              rows.map((row) =>
                cancelCaseAction().request({ centerId, caseId: row.id })
              )
            )
            snackbarStore.info(`${rows.length}건의 검사를 취소했어요.`)
            invalidateCases()
            onComplete?.()
          } catch {
            snackbarStore.error('검사 취소에 실패했어요.')
          }
        }
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 벌크 취소 되돌리기: 하나의 컨펌 모달로 처리 (사유 불필요)
  function bulkRollbackCancels(
    rows: AssessmentStatusRow[],
    onComplete?: () => void
  ) {
    if (!rows.length) return
    const names = rows.map((r) => r.clientName)
    const label = names.length === 1 ? `[${names[0]}]` : `${names.length}건`

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: rows[0].id,
        title: `${label}의 취소를 되돌릴까요?`,
        description: '검사 세트가 취소 전 상태로 복구돼요.',
        cancelText: '닫기',
        confirmText: '되돌리기',
        onConfirm: async () => {
          try {
            const centerId = requireCenterId()
            await Promise.all(
              rows.map((row) =>
                revertCancelCaseAction().request({ centerId, caseId: row.id })
              )
            )
            snackbarStore.info(`${rows.length}건의 검사 취소를 되돌렸어요.`)
            invalidateCases()
            onComplete?.()
          } catch {
            snackbarStore.error('취소 되돌리기에 실패했어요.')
          }
        }
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 벌크 삭제: 하나의 컨펌 모달로 처리
  function bulkDeleteCases(
    rows: AssessmentStatusRow[],
    onComplete?: () => void
  ) {
    if (!rows.length) return
    const title =
      rows.length === 1
        ? `[${rows[0].clientName}]의 검사 세트를 삭제할까요?`
        : `선택한 ${rows.length}개의 검사 세트를 삭제할까요?`

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: rows[0].id,
        title,
        description: '접수된 내용이 삭제되며 복구할 수 없어요',
        cancelText: '닫기',
        confirmText: '삭제',
        onConfirm: async () => {
          try {
            const centerId = requireCenterId()
            await Promise.all(
              rows.map((row) =>
                deleteCaseAction().request({ centerId, caseId: row.id })
              )
            )
            snackbarStore.success(`${rows.length}건의 검사를 삭제했어요.`)
            invalidateCases()
            onComplete?.()
          } catch (err) {
            const detail = (err as any)?.response?.data?.detail
            snackbarStore.error(detail || '검사 삭제에 실패했어요.')
          }
        }
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 결과 전송 실행 (공통)
  function executeSendResult(row: AssessmentStatusRow) {
    modalStore.open({
      component: SendResultSendModal,
      props: {
        caseId: row.id,
        onSendComplete: () => {
          syncDeleteService.markResultSent(row.id)
          invalidateCases()
        }
      },
      options: {
        size: 'fit',
        desktopOnly: true
      }
    })
  }

  // 결과 전송 버튼: 미완료 또는 보고서 미작성 시 경고 모달 후 전송
  async function handleSendResult(row: AssessmentStatusRow) {
    const centerId = requireCenterId()
    let missingNames: string[] = []
    let incompleteNames: string[] = []
    try {
      const tasks = await getTasksByCaseId().request({
        centerId,
        caseId: row.id
      })
      missingNames = findTasksMissingReports(tasks)
      incompleteNames = findIncompleteTaskNames(tasks)
    } catch {
      /* fetch 실패 시 경고 없이 진행 */
    }

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
          onConfirm: () => executeSendResult(row)
        },
        options: { customWidth: 420 }
      })
    } else {
      executeSendResult(row)
    }
  }

  // 배치 전송 모달 (바로링크)
  function openBatchSendModal(row: AssessmentStatusRow, cases: CaseData[]) {
    const caseData = cases.find((c: CaseData) => c.uid === row.id)
    if (!caseData) return

    const completionStatuses = getAssessmentCompletionStatusFromCase(
      row.id,
      caseData
    )

    const assessments = completionStatuses.map((asm) => ({
      id: `${row.id}:${asm.uid}`,
      caseId: row.id,
      assessment: asm.name,
      clientName: row.clientName,
      isCompleted: asm.isCompleted
    }))

    modalStore.open({
      component: AssessmentBatchSendModal,
      props: {
        assessments,
        onSend: async (data: {
          ids: string[]
          recipients: { relation: string; name: string; phone: string }[]
        }) => {
          const assessmentIds = data.ids.map((id) => id.split(':')[1])
          const validRecipients = data.recipients.filter(
            (r) => r.name && r.phone
          )
          if (validRecipients.length === 0) return

          try {
            const centerId = requireCenterId()
            const response = await createAssessmentSendLink().request({
              centerId,
              caseId: row.id,
              payload: {
                recipients: validRecipients.map((r) => ({
                  name: r.name,
                  phone: r.phone,
                  relation: r.relation || undefined
                })),
                assessment_ids: assessmentIds,
                channel: 'alarmtalk'
              }
            })

            const result = (response as any)?.data ?? response
            const failed =
              result.delivery_results?.filter(
                (r: any) => r.status === 'failed'
              ) ?? []
            if (failed.length > 0) {
              snackbarStore.error(`${failed.length}명에게 전송에 실패했습니다`)
            } else {
              showSuccessSnackbar(
                `${data.ids.length}개 검사 결과가 전송되었습니다.`
              )
            }
          } catch (err) {
            const detail = (err as any)?.response?.data?.detail
            snackbarStore.error(detail || '바로링크 전송에 실패했습니다')
          }
        }
      },
      options: {
        customWidth: 540
      }
    })
  }

  // 케이스 완료 처리: 태스크 fetch → 보고서 미작성 검사 확인 → 경고 모달
  async function completeCase(row: AssessmentStatusRow) {
    const centerId = requireCenterId()
    let missingNames: string[] = []
    try {
      const tasks = await getTasksByCaseId().request({
        centerId,
        caseId: row.id
      })
      missingNames = findTasksMissingReports(tasks)
    } catch {
      /* fetch 실패 시 경고 없이 진행 */
    }

    if (missingNames.length > 0) {
      modalStore.open({
        component: ReportWarningConfirmModal,
        props: {
          title: '완료 처리할까요?',
          description: '보고서가 작성되지 않은 검사가 있어요.',
          missingItems: missingNames,
          confirmText: '완료 처리',
          onConfirm: () => executeCompleteCase(row)
        },
        options: { customWidth: 420 }
      })
    } else {
      executeCompleteCase(row)
    }
  }

  async function executeCompleteCase(row: AssessmentStatusRow) {
    try {
      const centerId = requireCenterId()
      await completeCaseAction().request({ centerId, caseId: row.id })
      snackbarStore.success('검사를 완료 처리했어요.')
      invalidateCases()
    } catch {
      snackbarStore.error('완료 처리에 실패했어요.')
    }
  }

  // 완료 되돌리기 (completed → rollback)
  function rollbackComplete(row: AssessmentStatusRow) {
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: row.id,
        title: `[${row.clientName}]의 완료를 되돌릴까요?`,
        description: '검사 세트가 완료 전 상태로 복구돼요.',
        cancelText: '닫기',
        confirmText: '되돌리기',
        onConfirm: () => executeRollbackCancel(row)
      },
      options: { customWidth: 420 }
    })
  }

  // 벌크 완료 처리
  function bulkCompleteCases(
    rows: AssessmentStatusRow[],
    onComplete?: () => void
  ) {
    if (!rows.length) return
    const label =
      rows.length === 1 ? `[${rows[0].clientName}]` : `${rows.length}건`

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: rows[0].id,
        title: `${label}의 검사를 완료 처리할까요?`,
        description: '선택한 검사 세트가 완료 상태로 변경돼요.',
        cancelText: '닫기',
        confirmText: '완료 처리',
        onConfirm: async () => {
          try {
            const centerId = requireCenterId()
            await Promise.all(
              rows.map((row) =>
                completeCaseAction().request({ centerId, caseId: row.id })
              )
            )
            snackbarStore.success(`${rows.length}건의 검사를 완료 처리했어요.`)
            invalidateCases()
            onComplete?.()
          } catch {
            snackbarStore.error('완료 처리에 실패했어요.')
          }
        }
      },
      options: { customWidth: 420 }
    })
  }

  // 전송 이력 조회 모달
  function viewCaseSendHistory(caseData: CaseData) {
    modalStore.open({
      component: SendResultSendModal,
      props: {
        caseId: caseData.uid || caseData.case_id,
        onSendComplete: () => invalidateCases()
      },
      options: {
        size: 'fit',
        desktopOnly: true
      }
    })
  }

  return {
    handleSend,
    handleSendLink,
    handleSendResult,
    openBatchSendModal,
    viewCaseSendHistory,
    cancelCase,
    deleteCase,
    rollbackCancel,
    completeCase,
    rollbackComplete,
    bulkCancelCases,
    bulkRollbackCancels,
    bulkDeleteCases,
    bulkCompleteCases
  }
}
