<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { tick } from 'svelte'
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { modalUtils } from '$lib/stores/modal'
  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getCaseById,
    getTasksByCaseId,
    type GetCaseResponse
  } from '$root/src/lib/hooks/actions/case.action'
  import { getBillableByRelated } from '$root/src/lib/hooks/actions/billable.action'
  import { hasPermission } from '$lib/stores/permission.view'
  import { createAssessmentBillingService } from '$lib/features/assessment/status-detail/assessment-billing-service'
  import BillableCreateModal from '$lib/features/billing/components/create/BillableCreateModal.svelte'
  import SessionBillingModal from '$lib/features/billing/components/create/SessionBillingModal.svelte'
  import BillableDetailModal from '$root/src/routes/(protected)/billing/components/BillableDetailModal.svelte'
  import type { TaskListItem } from '$root/src/lib/hooks/actions/case.action'
  import {
    getRoomList,
    type RoomItemType
  } from '$lib/hooks/actions/room.action'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import AssessmentSidebar from './components/AssessmentSidebar.svelte'
  import AssessmentMain from './components/AssessmentMain.svelte'
  import {
    buildCaseDetailInput,
    buildTaskListInput
  } from '$lib/features/assessment/status-detail/query-builders'
  import {
    mapCaseDetailToVM,
    toAssessmentItemsFromTaskList,
    mergeTaskIntoAssessmentItem,
    summarizeTaskReportPayload,
    applySetMembership,
    buildAssessmentVisualMap
  } from '$lib/features/assessment/status-detail/view-model'
  import {
    getCenterAssessments,
    type CenterAssessment
  } from '$lib/hooks/actions/assessment.action'
  import { createStatusDetailService } from '$lib/features/assessment/status-detail/status-detail-service'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'
  import { ASSESSMENT_STATUS_TAG_STYLES } from '$lib/features/assessment/status-detail/constants'
  import { getStatusDescription } from '$lib/features/assessment/status-detail/view-model'
  import { centerId } from '$lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { panelStore } from '$lib/stores/sidePanel'
  import AssessmentSidebarPanel from './components/AssessmentSidebarPanel.svelte'
  import FieldNoteFloatingSheet from '$lib/components/counseling/field-note/FieldNoteFloatingSheet.svelte'
  import { createFieldNoteService } from '$lib/features/field-note/field-note-service'
  import { getFieldNoteBySchedule } from '$lib/hooks/actions/field-note.action'
  import { buildFieldNoteBySchedule } from '$lib/features/field-note/query-builders'
  import { mapToEntryStatus } from '$lib/features/field-note/view-model'

  const isOverlayMode = $derived(!responsive.isDesktop)

  function openSidebarPanel() {
    panelStore.open({
      component: AssessmentSidebarPanel as any,
      props: {
        caseId: id,
        clientVM: caseVM,
        isSecretMode: $isSecretMode,
        assessments,
        selectedAssessment,
        onSelectAssessment: (assessment: AssessmentItem) => {
          selectAssessment(assessment)
          panelStore.close()
        },
        onSendResult: handleSendResult,
        onWriteReport: handleWriteReport,
        onToggleFinalReport: handleToggleFinalReport,
        onAddSchedule: handleAddSchedule,
        onRevertSchedule: handleRevertSchedule,
        onCancelSchedule: handleCancelSchedule,
        onEditCase: handleEditCase,
        onDeleteCase: handleDeleteCase,
        canEdit: canEditCase,
        billingState,
        canWriteBilling,
        canReadBilling,
        onCreateBilling: handleCreateBilling,
        onViewBilling: handleViewBilling
      },
      options: { width: 'w-[min(90vw,400px)]' }
    })
  }

  const id = $derived($page.params.id ?? '')

  const caseQuery = queryBuilder(
    getCaseById,
    () => buildCaseDetailInput($centerId ?? '', id),
    () => ({ enabled: !!$centerId && !!id })
  )
  const tasksQuery = queryBuilder(
    getTasksByCaseId,
    () => buildTaskListInput($centerId ?? '', id),
    () => ({ enabled: !!$centerId && !!id })
  )

  const roomsQuery = queryBuilder(
    getRoomList as any,
    () => ({
      center_id: $centerId!
    }),
    () => ({ enabled: !!$centerId })
  )

  // 카드 그리드 비주얼(영문명/분류색)용 센터 검사 카탈로그
  const centerAssessmentsQuery = queryBuilder(
    getCenterAssessments as any,
    () => ({ centerId: $centerId ?? '' }),
    () => ({ enabled: !!$centerId })
  )
  const assessmentVisualMap = $derived(
    buildAssessmentVisualMap(
      centerAssessmentsQuery.data as unknown as CenterAssessment[] | undefined
    )
  )
  const roomNameMap = $derived.by(() => {
    const rooms =
      (roomsQuery.data as unknown as RoomItemType[] | undefined) ?? []
    const map: Record<string, string> = {}
    for (const r of rooms) map[r.id] = r.name
    return map
  })

  const caseData = $derived(
    (caseQuery.data as GetCaseResponse | undefined)?.data
  )
  // 부담당(참여 검사자)은 열람만 — 서버도 주담당에게만 수정을 허용한다
  const canEditCase = $derived(caseData?.my_role !== 'assistant')
  const tasksData = $derived(
    (tasksQuery.data as TaskListItem[] | undefined) ?? []
  )
  let isLoading = $derived(caseQuery.isLoading || tasksQuery.isLoading)

  const queryClient = useQueryClient()
  const detailService = createStatusDetailService({ queryClient })
  const billingService = createAssessmentBillingService({ queryClient })

  const canWriteBilling = $derived($hasPermission('write:billing'))
  const canReadBilling = $derived($hasPermission('read:billing'))

  const billablesQuery = queryBuilder(
    getBillableByRelated,
    () => ({
      centerId: $centerId ?? '',
      // 세션/케이스 단위 청구 모두 조회 (일정 없는 검사는 case 단위로 청구됨)
      relatedType: ['assessment_session', 'assessment_case'],
      relatedCaseId: id
    }),
    () => ({ enabled: !!$centerId && !!id && canReadBilling })
  )
  const existingBillables = $derived(
    (billablesQuery.data as any[] | undefined) ?? []
  )
  const billingState = $derived.by(() => {
    if (existingBillables.length === 0) return 'none'
    const allPaid = existingBillables.every((b: any) => b.status === 'paid')
    return allPaid ? 'completed' : 'pending'
  })

  function handleCreateBilling() {
    if (!caseData) return
    billingService.openCreateBilling({
      caseData,
      SessionBillingModal,
      BillableCreateModal
    })
  }
  function handleViewBilling() {
    billingService.openViewBilling({
      existingBillables,
      canWriteBilling,
      BillableDetailModal
    })
  }
  const fieldNoteService = createFieldNoteService({
    queryClient,
    getCenterId: () => $centerId
  })

  const caseVM = $derived(
    mapCaseDetailToVM(caseData, $isSecretMode, roomNameMap)
  )
  const baseAssessments = $derived<AssessmentItem[]>(
    applySetMembership(
      toAssessmentItemsFromTaskList(tasksData, caseData?.created_at),
      caseData?.tasks
    )
  )

  // task API 조회/변경 결과를 assessmentId 기준으로 덮어쓰기
  let taskAssessmentOverrides = $state<Record<string, AssessmentItem>>({})
  let selectedTaskReportSummary = $state('보고서 데이터 없음')

  // 거부 상태가 반영된 검사 목록
  const assessments = $derived<AssessmentItem[]>(
    baseAssessments.map((a) => {
      return taskAssessmentOverrides[a.assessmentId] ?? a
    })
  )

  const totalAssessments = $derived(assessments.length)
  const completedAssessments = $derived(
    assessments.filter((a) => a.status === 'completed').length
  )

  let selectedAssessment = $state<AssessmentItem | null>(null)

  // 케이스가 삭제된 경우(백엔드에서 모든 태스크 삭제 시 케이스도 삭제) 목록으로 이동
  let hasLoadedCase = $state(false)

  $effect(() => {
    if (caseData) hasLoadedCase = true
  })

  $effect(() => {
    if (hasLoadedCase && !caseQuery.isLoading && !caseData) {
      detailService.notifyDeletedCase()
    }
  })

  // 진입 시에는 카드 그리드(selectedAssessment = null)부터 보여준다.
  // 카드 클릭 시 selectAssessment로 작업 화면 전환, "뒤로"로 그리드 복귀.

  // tasks 재조회 시 선택된 검사 항목을 최신 데이터로 동기화 (삭제된 검사 선택 시 그리드로 복귀)
  $effect(() => {
    const sel = selectedAssessment
    const list = assessments
    if (!sel?.id || !list?.length) return
    const found = list.find((a) => a.id === sel.id)
    if (found) {
      // 기존 검사가 업데이트된 경우 동기화
      if (
        found.reportDocumentId !== sel.reportDocumentId ||
        found.status !== sel.status ||
        found.opinion !== sel.opinion
      ) {
        selectedAssessment = found
      }
    } else {
      // 선택된 검사가 삭제된 경우 그리드로 복귀
      clearSelection()
    }
  })
  let isDragging = $state(false)
  let uploadedPdfFile: File | null = $state(null)

  const maskedName = $derived(caseVM.maskedName)

  function clearSelection() {
    selectedAssessment = null
    uploadedPdfFile = null
    selectedTaskReportSummary = '보고서 데이터 없음'
  }

  // 검사 이름 목록 (모달에 전달용)
  const assessmentNameList = $derived(
    tasksData
      .map((t: TaskListItem) => t.assessment?.kor_name ?? '')
      .filter(Boolean)
  )

  const handleCancelAssessment = () => {
    if (!caseData || !selectedAssessment) return
    detailService.openCancelAssessmentModal(caseData, selectedAssessment)
  }
  const handleDeleteAssessment = () => {
    if (!caseData || !selectedAssessment) return
    detailService.openDeleteAssessmentModal(caseData, selectedAssessment)
  }
  // 완료·중단 되돌리기 — 어디로 가는지(진행 전)는 레이블이 아니라 확인 모달이 밝힌다
  const handleRollbackAssessment = async () => {
    if (!selectedAssessment || !caseData) return
    const ok = await modalUtils.confirm(
      '완료·중단 이전 상태로 돌아가며, 다시 진행할 수 있어요.',
      '검사를 진행 전으로 되돌릴까요?',
      { confirmText: '되돌리기', cancelText: '닫기' }
    )
    if (!ok) return
    if (selectedAssessment.status === 'completed') {
      detailService.revertTask(
        caseData.case_id,
        selectedAssessment.assessmentId
      )
    } else if (selectedAssessment.status === 'cancelled') {
      detailService.revertCancelTask(selectedAssessment.id)
    }
  }
  const handleSendResult = () => detailService.sendResult(id, tasksData)
  const handleResendLink = () => {
    if (caseData) detailService.resendLink(caseData, assessmentNameList)
  }
  const handleSendLink = () => {
    if (caseData) detailService.sendLink(caseData, assessmentNameList)
  }
  const handleCopyLink = () => detailService.copyLink(id)
  const handleToggleFinalReport = async (enabled: boolean) => {
    if (!caseData) return false
    return detailService.updateFinalReport(caseData, enabled)
  }
  const handleCompleteAssessment = () => {
    if (!caseData || !selectedAssessment) return
    detailService.completeTask(
      caseData.case_id,
      selectedAssessment.assessmentId,
      selectedAssessment
    )
  }
  const handleAddSchedule = () =>
    detailService.openAddScheduleModal(id, caseData?.schedule)
  const handleRevertSchedule = () => {
    const sessionId = caseData?.schedule?.session_id
    if (!sessionId) return
    detailService.revertCancelSchedule(sessionId)
  }
  const handleCancelSchedule = () => {
    const sessionId = caseData?.schedule?.session_id
    if (!sessionId) return
    detailService.openCancelScheduleModal(sessionId)
  }
  const handleEditCase = () => {
    if (caseData) detailService.openEditCaseModal(caseData)
  }
  // 검사 삭제 — 확인 모달·삭제·목록 복귀는 상세 서비스가 소유
  function handleDeleteCase() {
    if (caseData) detailService.deleteCase(caseData)
  }

  const handleWriteReport = () => detailService.writeReport()

  // 필드노트는 상담 회기 상세와 같은 좌하단 플로팅 시트로 연다
  // (검사 소견을 보며 작성할 수 있게 X 버튼으로만 닫힘 — 시트가 규격을 소유)
  let isFieldNoteMode = $state(false)
  const fieldNoteScheduleId = $derived(caseData?.schedule?.schedule_id ?? '')

  // 진입 버튼에 상태를 보여주기 위한 조회 — 상담 회기 상세와 같은 판정(mapToEntryStatus).
  // 녹음이 없으면 버튼 자체를 띄우지 않고, 정리 중·정리 실패는 열기 전에 알린다.
  const fieldNoteStatusQuery = queryBuilder(
    getFieldNoteBySchedule,
    () => buildFieldNoteBySchedule($centerId, fieldNoteScheduleId),
    () => ({
      enabled: !!$centerId && !!fieldNoteScheduleId,
      refetchOnMount: 'always' as const,
      // 케이스를 옮길 때 이전 케이스 상태가 잠깐 남지 않게 — 기본 keepPreviousData 해제
      placeholderData: undefined,
      // 비필수 뱃지용 — 에러가 검사 상세 렌더를 깨지 않게 차단
      throwOnError: false,
      retry: false
    })
  )
  const fieldNoteStatus = $derived(
    mapToEntryStatus(fieldNoteStatusQuery.data as any)
  )
  // 화자 편집 후보 — 검사 케이스는 담당자·내담자 두 명이 전부
  const fieldNoteParticipants = $derived(
    [caseVM.specialistName, caseVM.clientDetail?.name].filter(
      (n): n is string => !!n
    )
  )

  function handleOpenFieldNote() {
    if (!fieldNoteScheduleId) return
    // 모바일에서 사이드바 패널이 열려있으면 닫고 시트로 전환
    if (isOverlayMode) panelStore.close()
    isFieldNoteMode = true
  }
  function handleCloseFieldNote() {
    isFieldNoteMode = false
  }

  // 다른 검사 케이스로 이동하면 시트를 닫는다 (회기 전환 시 닫는 상담 상세와 같은 규칙)
  let prevCaseId = $state('')
  $effect(() => {
    if (prevCaseId !== id) {
      isFieldNoteMode = false
      prevCaseId = id
    }
  })

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      handleFileUpload(files)
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleFileUpload(input.files)
    }
  }

  function handleFileUpload(files: FileList) {
    console.log('파일 업로드:', files)
    const file = files[0]
    if (file && file.type === 'application/pdf') {
      uploadedPdfFile = file
    }
  }

  let tabBarEl: HTMLDivElement | undefined = $state()

  function selectAssessment(assessment: AssessmentItem) {
    selectedAssessment = assessment
    selectedTaskReportSummary = summarizeTaskReportPayload(
      assessment.reportPayload ?? null
    )
    // Task 목록 API에서 이미 status, report_payload 등 상세 정보를 받아오므로
    // 검사 클릭 시 별도 getTaskById/getTaskReport 호출 없음

    // 오버레이 모드에서 검사 선택 시 사이드 패널 닫기
    if (isOverlayMode) panelStore.close()

    // 선택된 탭이 보이도록 자동 스크롤
    scrollToSelectedTab(assessment)
  }

  async function scrollToSelectedTab(assessment: AssessmentItem) {
    if (!tabBarEl) return
    await tick()
    const idx = assessments.findIndex((a) => a.id === assessment.id)
    const tab = tabBarEl.children[idx] as HTMLElement | undefined
    if (tab) {
      tab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }

  function handleRefuseAssessment(assessment: AssessmentItem) {
    if (!caseData) return
    detailService.openRefuseAssessmentModal(
      assessment,
      caseData.case_id,
      (task, reason) => {
        const merged = mergeTaskIntoAssessmentItem(assessment, task, null)
        taskAssessmentOverrides = {
          ...taskAssessmentOverrides,
          [assessment.assessmentId]: {
            ...merged,
            refusedReason: reason
          }
        }

        if (selectedAssessment?.id === assessment.id) {
          selectedAssessment = {
            ...merged,
            refusedReason: reason
          }
          selectedTaskReportSummary = summarizeTaskReportPayload(
            selectedAssessment.reportPayload
          )
        }
      }
    )
  }

  function handleUploadProfessionalReport(assessment: AssessmentItem) {
    detailService.showReportUploadInfo(
      `${assessment.name} 전문가용`,
      selectedTaskReportSummary
    )
  }

  function handleUploadClientReport(assessment: AssessmentItem) {
    detailService.showReportUploadInfo(
      `${assessment.name} 내담자용`,
      selectedTaskReportSummary
    )
  }

  async function handleReportSubmitted() {
    detailService.invalidateCaseQueries()
  }
</script>

{#if isLoading}
  <div class="flex h-full items-center justify-center">
    <Typography variant="body-01-medium" color="text-gray-500"
      >로딩 중...</Typography
    >
  </div>
{:else if !caseData}
  <div class="flex h-full items-center justify-center">
    <Typography variant="body-01-medium" color="text-gray-500">
      데이터를 불러올 수 없습니다.
    </Typography>
  </div>
{:else}
  <div in:fade class="flex min-h-full xl:h-full flex-col">
    <!-- 헤더 -->
    <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          onclick={() => history.back()}
          aria-label="뒤로가기"
          class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowBackIcon />
        </button>

        <button
          onclick={() => goto('/assessment/status')}
          class="transition-colors hover:text-body-default"
        >
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-subtle">검사</Typography
          >
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-gray-300"
        >
          /
        </Typography>
        <Typography
          variant="body-02-normal-medium"
          tag="span"
          color="text-body-default"
        >
          {maskedName}
        </Typography>
      </div>
      <div class="flex items-center gap-4">
        {#if isOverlayMode}
          <button
            onclick={openSidebarPanel}
            class="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 21V19C20 16.79 18.21 15 16 15H8C5.79 15 4 16.79 4 19V21"
                stroke="#4B5563"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                cx="12"
                cy="7"
                r="4"
                stroke="#4B5563"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <Typography
              variant="body-02-medium"
              tag="span"
              color="text-gray-700"
            >
              내담자 정보
            </Typography>
          </button>
        {/if}
      </div>
    </div>

    <!-- 반응형: 가로 스크롤 검사 탭 바 -->
    {#if isOverlayMode && assessments.length > 0}
      <div
        bind:this={tabBarEl}
        class="mb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide"
      >
        {#each assessments as assessment}
          {@const isSelected = selectedAssessment?.id === assessment.id}
          {@const statusKey =
            assessment.status as keyof typeof ASSESSMENT_STATUS_TAG_STYLES}
          {@const tagStyle =
            ASSESSMENT_STATUS_TAG_STYLES[statusKey] ??
            ASSESSMENT_STATUS_TAG_STYLES.pending}
          {@const statusDesc = getStatusDescription(assessment)}
          <button
            onclick={() => selectAssessment(assessment)}
            class="flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 transition-colors {isSelected
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 bg-white hover:border-primary-100 hover:shadow-sm'}"
          >
            <span
              class="text-sm whitespace-nowrap {isSelected
                ? 'font-medium text-primary-500'
                : 'text-gray-800'}"
            >
              {assessment.nameEn || assessment.name}
            </span>
            {#if statusDesc}
              <span
                class="text-xs whitespace-nowrap"
                style="color: {tagStyle.text};"
              >
                {statusDesc}
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- 메인 콘텐츠 -->
    <div class="flex xl:min-h-0 flex-1 xl:gap-4 -mx-4 xl:mx-0">
      {#if !isOverlayMode}
        <AssessmentSidebar
          caseId={id}
          isSecretMode={$isSecretMode}
          clientVM={caseVM}
          {assessments}
          {selectedAssessment}
          onSelectAssessment={selectAssessment}
          onSendResult={handleSendResult}
          onWriteReport={handleWriteReport}
          onToggleFinalReport={handleToggleFinalReport}
          onAddSchedule={handleAddSchedule}
          onRevertSchedule={handleRevertSchedule}
          onCancelSchedule={handleCancelSchedule}
          onEditCase={handleEditCase}
          onDeleteCase={handleDeleteCase}
          canEdit={canEditCase}
          {billingState}
          {canWriteBilling}
          {canReadBilling}
          onCreateBilling={handleCreateBilling}
          onViewBilling={handleViewBilling}
        />
      {/if}
      <AssessmentMain
        caseId={id}
        bind:isDragging
        {caseVM}
        {assessments}
        {selectedAssessment}
        {uploadedPdfFile}
        {completedAssessments}
        {totalAssessments}
        {isOverlayMode}
        assessmentSetName={caseVM.assessmentSetName}
        {assessmentVisualMap}
        onCancelAssessment={handleCancelAssessment}
        onDeleteAssessment={handleDeleteAssessment}
        onRollbackAssessment={handleRollbackAssessment}
        onCompleteAssessment={handleCompleteAssessment}
        onCopyLink={handleCopyLink}
        onResendLink={handleResendLink}
        onSendLink={handleSendLink}
        onSendResult={handleSendResult}
        onSelectAssessment={selectAssessment}
        onClearSelection={clearSelection}
        onDropFiles={handleDrop}
        onSelectFiles={handleFileSelect}
        onRefuseAssessment={handleRefuseAssessment}
        onUploadProfessionalReport={handleUploadProfessionalReport}
        onUploadClientReport={handleUploadClientReport}
        onReportSubmitted={handleReportSubmitted}
        onOpenFieldNote={handleOpenFieldNote}
        {fieldNoteStatus}
      />
    </div>
  </div>
{/if}

{#if isFieldNoteMode && fieldNoteScheduleId}
  <FieldNoteFloatingSheet
    scheduleId={fieldNoteScheduleId}
    service={fieldNoteService}
    participantCandidates={fieldNoteParticipants}
    onClose={handleCloseFieldNote}
  />
{/if}
