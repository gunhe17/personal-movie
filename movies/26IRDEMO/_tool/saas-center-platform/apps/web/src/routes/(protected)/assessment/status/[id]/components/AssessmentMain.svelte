<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Button from '$root/src/lib/components/Button.svelte'
  import AssessmentStack from '$root/src/lib/assets/AssessmentStack.svelte'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import FileUploadIcon from '$root/src/lib/assets/FileUploadIcon.svelte'
  import PDFViewer from '$lib/components/PDFViewer.svelte'
  import AssessmentCard from './AssessmentCard.svelte'
  import AssessmentSection from './AssessmentSection.svelte'
  import AssessmentCardGrid from './AssessmentCardGrid.svelte'
  import type {
    AssessmentItem,
    AssessmentVisual,
    CaseDetailVM
  } from '$lib/features/assessment/status-detail/types'
  import type { FieldNoteEntryStatus } from '$lib/features/field-note/view-model'
  import {
    SelfReportDetailPanel,
    ExternalServiceDetailPanel
  } from '$lib/components/assessment/status'
  import {
    ASSESSMENT_STATUS_LABELS,
    ASSESSMENT_STATUS_TAG_STYLES
  } from '$lib/features/assessment/status-detail/constants'
  import LinkIcon from '$root/src/lib/assets/LinkIcon.svelte'
  import QuestionTooltipIcon from '$root/src/lib/assets/QuestionTooltipIcon.svelte'
  import SendPlaneGradientIcon from '$root/src/lib/assets/SendPlaneGradientIcon.svelte'
  import BaroLinkTextIcon from '$root/src/lib/assets/BaroLinkTextIcon.svelte'
  import { modalStore } from '$root/src/lib/stores/modal'
  import BaroLinkInfoModal from '$root/src/lib/components/modal/BaroLinkInfoModal.svelte'
  import { sentBaroLinkIds } from '$root/src/lib/stores/syncDelete'
  import OpinionIcon24 from '$root/src/lib/assets/OpinionIcon24.svelte'
  import {
    openAssessmentOpinionModal,
    saveTaskOpinion
  } from '$lib/features/assessment/status-detail/opinion-service'
  import AssessmentOpinionWorkspace from '$lib/features/assessment/status-detail/components/AssessmentOpinionWorkspace.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'
  import ArrowDownIcon20 from '$root/src/lib/assets/ArrowDownIcon20.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import KebabIcon20 from '$root/src/lib/assets/KebabIcon20.svelte'
  import FieldnoteIcon20 from '$lib/assets/FieldnoteIcon20.svelte'
  import TriangleWarningIcon54 from '$lib/assets/TriangleWarningIcon54.svelte'
  import RollbackIcon20 from '$lib/assets/RollbackIcon20.svelte'
  import UploadCircleYellowIcon48 from '$root/src/lib/assets/UploadCircleYellowIcon48.svelte'
  import CheckCircleBlueIcon48 from '$root/src/lib/assets/CheckCircleBlueIcon48.svelte'
  import ArrowRightIcon16 from '$root/src/lib/assets/ArrowRightIcon16.svelte'
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'

  const queryClient = useQueryClient()

  let {
    caseId,
    caseVM,
    assessments,
    selectedAssessment,
    uploadedPdfFile,
    isDragging = $bindable(),
    completedAssessments,
    totalAssessments,
    isOverlayMode = false,
    assessmentSetName = '',
    assessmentVisualMap = {},
    onCancelAssessment,
    onDeleteAssessment,
    onRollbackAssessment,
    onCompleteAssessment,
    onCopyLink,
    onResendLink,
    onSendLink,
    onSendResult,
    onSelectAssessment,
    onClearSelection,
    onDropFiles,
    onSelectFiles,
    onRefuseAssessment,
    onUploadProfessionalReport,
    onUploadClientReport,
    onReportSubmitted,
    onOpenFieldNote,
    fieldNoteStatus = 'none'
  } = $props<{
    caseId: string
    caseVM: CaseDetailVM
    assessments: AssessmentItem[]
    selectedAssessment: AssessmentItem | null
    uploadedPdfFile: File | null
    isDragging: boolean
    completedAssessments: number
    totalAssessments: number
    isOverlayMode?: boolean
    assessmentSetName?: string
    assessmentVisualMap?: Record<string, AssessmentVisual>
    onCancelAssessment: () => void
    onDeleteAssessment?: () => void
    onRollbackAssessment?: () => void
    onCompleteAssessment?: () => void
    onCopyLink: () => void
    onResendLink: () => void
    onSendLink?: () => void
    onSendResult: () => void
    onSelectAssessment: (assessment: AssessmentItem) => void
    onClearSelection: () => void
    onDropFiles: (event: DragEvent) => void
    onSelectFiles: (event: Event) => void
    onRefuseAssessment?: (assessment: AssessmentItem) => void
    onUploadProfessionalReport?: (assessment: AssessmentItem) => void
    onUploadClientReport?: (assessment: AssessmentItem) => void
    onReportSubmitted?: () => void | Promise<void>
    /** 필드노트 시트 열기 (schedule_id 있고 서비스 주입된 경우에만) */
    onOpenFieldNote?: () => void
    /** 이 일정의 필드노트 상태 — none이면 버튼 자체를 띄우지 않는다 */
    fieldNoteStatus?: FieldNoteEntryStatus
  }>()

  // 바로링크 전송 완료 여부
  const isBaroLinkSent = $derived($sentBaroLinkIds.has(caseId))

  let dotMenuOpen = $state(false)
  let dotMenuEl: HTMLDivElement | null = $state(null)

  $effect(() => {
    if (!dotMenuOpen) return
    const fn = (e: MouseEvent) => {
      if (dotMenuEl && !dotMenuEl.contains(e.target as Node)) {
        dotMenuOpen = false
      }
    }
    setTimeout(() => window.addEventListener('click', fn), 0)
    return () => window.removeEventListener('click', fn)
  })

  const centerAssessments = $derived(
    assessments.filter((a: AssessmentItem) => !a.isOnline)
  )
  const onlineAssessments = $derived(
    assessments.filter((a: AssessmentItem) => a.isOnline)
  )

  const isSelfReport = $derived(
    selectedAssessment?.workflowType === 'self_report'
  )
  /** external_service: 외부 보고서 업로드 후 결과 보기 (2단계) */
  const isExternalService = $derived(
    selectedAssessment?.workflowType === 'external_service'
  )
  /** 취소/거부된 검사: 보고서 업로드 등 행동 불가 */
  const isActionBlocked = $derived(
    selectedAssessment?.status === 'cancelled' ||
      selectedAssessment?.status === 'refused'
  )

  const isPending = $derived(
    selectedAssessment?.status === 'pending' ||
      selectedAssessment?.status === 'refused'
  )
  const isCompleted = $derived(selectedAssessment?.status === 'completed')

  // 헤더 상태 배지 (검사 카드와 동일 매핑)
  const selectedStatusKey = $derived(
    selectedAssessment?.status as keyof typeof ASSESSMENT_STATUS_LABELS
  )
  const selectedStatusLabel = $derived(
    ASSESSMENT_STATUS_LABELS[selectedStatusKey] ?? null
  )
  const selectedStatusStyle = $derived(
    ASSESSMENT_STATUS_TAG_STYLES[selectedStatusKey] ?? { text: '', bg: '' }
  )
  const isCancelled = $derived(selectedAssessment?.status === 'cancelled')

  function openBaroLinkInfoModal(e: MouseEvent) {
    e.stopPropagation()
    modalStore.open({
      component: BaroLinkInfoModal,
      props: {},
      options: {
        customWidth: 640
      }
    })
  }

  // ── 소견 ────────────────────────────────────────────────────────────
  // 읽기는 아래 소견 블록이 상주해서 맡고, 쓰기는 항상 작성 모드(보고서 동반)로 연다.
  // 상태에 따라 버튼이 다른 걸 여는 분기는 두지 않는다.
  let opinionWorkspaceOpen = $state(false)
  let opinionExpanded = $state(false)

  /** 소견 대상 = 태스크가 있는 검사 (레일 목록) */
  const opinionTargets = $derived(
    assessments.filter((a: AssessmentItem) => !!a.taskId)
  )

  function openOpinionEditor() {
    if (!selectedAssessment?.taskId) return
    opinionTooltipVisible = false
    // 3열이 성립하지 않는 태블릿 이하는 기존 모달로 폴백
    if (!responsive.isDesktop) {
      openAssessmentOpinionModal({
        assessments,
        initialAssessmentId: selectedAssessment.id,
        clientName: caseVM?.clientDetail?.name,
        clientCode: caseVM?.clientCode,
        scheduledLabel: selectedAssessment.date,
        queryClient
      })
      return
    }
    opinionWorkspaceOpen = true
  }

  // 검사가 바뀌면 소견 블록은 접힌 상태로 돌아간다
  $effect(() => {
    void selectedAssessment?.id
    opinionExpanded = false
  })

  // 검사 선택 변경 시 소견 버튼 툴팁을 잠시 노출
  let opinionTooltipVisible = $state(false)
  let opinionTooltipTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const taskId = selectedAssessment?.taskId
    if (!taskId) {
      opinionTooltipVisible = false
      if (opinionTooltipTimer) {
        clearTimeout(opinionTooltipTimer)
        opinionTooltipTimer = null
      }
      return
    }
    opinionTooltipVisible = true
    if (opinionTooltipTimer) clearTimeout(opinionTooltipTimer)
    opinionTooltipTimer = setTimeout(() => {
      opinionTooltipVisible = false
      opinionTooltipTimer = null
    }, 2500)
    return () => {
      if (opinionTooltipTimer) {
        clearTimeout(opinionTooltipTimer)
        opinionTooltipTimer = null
      }
    }
  })
</script>

<!-- 오른쪽: 진행중인 검사 그리드 / 결과 보고서 업로드 / PDF 뷰어 -->
<!-- 그리드 ↔ 상세 전환을 부드럽게: 한 그리드 셀에 겹쳐 쌓아 in/out 트랜지션이 동시에 재생되도록 -->
<div
  class="grid grid-cols-1 grid-rows-1 flex-1 min-w-0 overflow-hidden xl:min-h-0"
>
  {#if selectedAssessment === null}
    <!-- 진행중인 검사 (기본 화면 - 카드 그리드) -->
    <div
      class="relative col-start-1 row-start-1 flex flex-1 flex-col xl:rounded-2xl xl:border xl:border-gray-200 bg-white xl:min-h-0"
      transition:fly={{ x: -24, duration: 220, easing: cubicOut }}
    >
      <!-- 패널 헤더 — 높이 62 고정 (Web_Design.md §Components>panel-header) -->
      <div
        class="{isOverlayMode
          ? 'px-4'
          : 'px-6'} h-[58px] flex items-center justify-between border-b border-gray-200"
      >
        <div class="flex items-center gap-3">
          <Typography variant="title-01-normal-semibold" color="text-gray-900">
            검사 항목
          </Typography>
        </div>
      </div>

      <!-- 카드 그리드 -->
      {#if assessments.length > 0}
        <div
          class="flex-1 overflow-y-auto {isOverlayMode
            ? 'px-4 py-5'
            : 'px-6 py-6'}"
        >
          <AssessmentCardGrid
            {assessments}
            setName={assessmentSetName}
            visualMap={assessmentVisualMap}
            onSelect={onSelectAssessment}
          />
        </div>
      {:else}
        <!-- 빈 상태 -->
        <div
          class="flex-1 flex flex-col items-center justify-center {isOverlayMode
            ? 'px-4'
            : 'px-6'}"
        >
          <Typography
            variant="body-01-regular"
            color="text-gray-400"
            className="text-center"
          >
            등록된 검사가 없습니다.
          </Typography>
        </div>
      {/if}

      <!-- 하단 바로발송 안내 (일단 주석 처리) -->
      {#if false && caseVM.hasOnlineAssessment}
        <div
          class="{isOverlayMode
            ? 'px-4'
            : 'px-8'} py-4 border-t border-gray-100 flex items-center justify-center gap-3"
        >
          <div class="flex items-center gap-1">
            <Typography variant="body-02-regular" color="text-gray-600">
              {isBaroLinkSent
                ? '바로링크 전송이 완료되었어요!'
                : '모바일로 가능한 검사가 포함되어있어요!'}
            </Typography>
            {#if !isBaroLinkSent}
              <button
                onclick={openBaroLinkInfoModal}
                class="cursor-pointer hover:opacity-80 transition-opacity"
                aria-label="바로링크 안내"
              >
                <QuestionTooltipIcon />
              </button>
            {/if}
          </div>
          <Button
            class="group flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 text-center shadow-[0_2px_8px_rgba(76,135,246,0.15)] transition-colors hover:bg-primary-100"
            onclick={onSendLink}
          >
            <SendPlaneGradientIcon />
            <BaroLinkTextIcon />
          </Button>
        </div>
      {/if}
    </div>
  {:else if uploadedPdfFile}
    <!-- PDF 뷰어 -->
    <div
      class="col-start-1 row-start-1 flex flex-1 flex-col min-w-0"
      transition:fade={{ duration: 180 }}
    >
      <PDFViewer file={uploadedPdfFile} />
    </div>
  {:else}
    <!-- 검사 상세 화면 (workflow_type별 분기) -->
    <div
      class="relative col-start-1 row-start-1 flex flex-1 flex-col xl:rounded-2xl xl:border xl:border-gray-200 bg-white xl:min-h-0 min-w-0"
      transition:fly={{ x: 24, duration: 220, easing: cubicOut }}
    >
      <!-- 패널 헤더: 검사명 + 상태 버튼 + dot 메뉴. 높이 62 고정
           (Web_Design.md §Components>panel-header — 2줄로 접히는 오버레이만 고정 해제) -->
      <div
        class="{isOverlayMode
          ? 'px-4 py-3 flex-col gap-2'
          : 'px-6 h-[58px] flex-row items-center'} flex justify-between border-b border-gray-200"
      >
        <!-- 좌: 뒤로가기 + 검사명 -->
        <div class="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onclick={() => onClearSelection()}
            aria-label="검사 항목 목록으로"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowBackIcon />
          </button>

          <Typography
            variant="title-01-normal-semibold"
            color="text-gray-900"
            className="truncate-safe"
          >
            {selectedAssessment?.name || '검사'}
          </Typography>
          <!-- 상태 배지 = 검사 카드(AssessmentGridCard)와 동일한 라벨·색 매핑 -->
          {#if selectedStatusLabel}
            <span
              class="inline-flex h-6 shrink-0 items-center rounded-md px-2 text-body-03-normal-medium"
              style="color: {selectedStatusStyle.text}; background-color: {selectedStatusStyle.bg};"
            >
              {selectedStatusLabel}
            </span>
          {/if}
        </div>

        <!-- 우: 소견·필드노트 + dot 메뉴(완료·중단·삭제) -->
        <div
          class="flex items-center gap-2 shrink-0 {isOverlayMode
            ? 'self-end'
            : ''}"
        >
          <!-- 소견 작성 / 수정 -->
          {#if selectedAssessment?.taskId}
            {@const hasOpinion = !!selectedAssessment.opinion}
            <Tooltip
              text={hasOpinion
                ? '보고서를 보며 소견 수정'
                : '보고서를 보며 소견 작성'}
              placement="top"
              forceVisible={opinionTooltipVisible}
            >
              <!-- 필드노트 버튼과 동일 규격(높이 40 · gap 12 · 레이블 15) — 상태색만 다르다 -->
              <button
                type="button"
                class="relative flex h-10 items-center gap-2 rounded-lg border px-3 text-body-02-normal-medium transition-colors
                {hasOpinion
                  ? 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200'}"
                aria-label={hasOpinion ? '소견 수정' : '소견 작성'}
                onclick={openOpinionEditor}
              >
                <OpinionIcon24 animate />
                <span>{hasOpinion ? '소견 수정' : '소견 작성'}</span>
                {#if hasOpinion}
                  <!-- svelte-ignore element_invalid_self_closing_tag -->
                  <span
                    class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white"
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </Tooltip>
          {/if}

          <!-- 필드노트 열기: 일정(schedule_id) 있고 취소되지 않았고, 녹음이 있는 경우.
               상태(정리 중·정리 실패)는 열기 전에 알린다 — 상담 일지 상단 블록과 같은 규칙 -->
          {#if onOpenFieldNote && caseVM.schedule?.scheduleId && !caseVM.schedule.isCancelled && fieldNoteStatus !== 'none'}
            <!-- 상담 상세(SessionDetailPanel)의 필드노트 버튼과 동일 규격 -->

            <button
              type="button"
              aria-label={fieldNoteStatus === 'failed'
                ? '필드노트 열기 (정리 실패)'
                : fieldNoteStatus === 'processing'
                  ? '필드노트 열기 (정리 중)'
                  : '필드노트 열기'}
              onclick={() => onOpenFieldNote?.()}
              class="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <span class="relative flex items-center">
                <FieldnoteIcon20 />
                {#if fieldNoteStatus === 'failed'}
                  <!-- svelte-ignore element_invalid_self_closing_tag -->
                  <span
                    class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-status-danger ring-2 ring-white"
                    aria-hidden="true"
                  />
                {/if}
              </span>
              <span class="hidden md:inline">필드노트</span>
              {#if fieldNoteStatus !== 'completed'}
                <span
                  class="hidden text-body-03-normal-regular md:inline {fieldNoteStatus ===
                  'failed'
                    ? 'text-status-danger'
                    : 'text-gray-400'}"
                >
                  · {fieldNoteStatus === 'processing' ? '정리 중' : '정리 실패'}
                </span>
              {/if}
            </button>
          {/if}

          <!-- dot 메뉴 -->
          <div class="relative" bind:this={dotMenuEl}>
            <Tooltip text="더보기">
              <button
                type="button"
                class="flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                onclick={() => (dotMenuOpen = !dotMenuOpen)}
                aria-label="더보기"
              >
                <KebabIcon20 color="currentColor" />
              </button>
            </Tooltip>
            {#if dotMenuOpen}
              <div class="dropdown-panel absolute top-full right-0 z-50 mt-1">
                <!-- 상태 전이 → (구분선) → 삭제.
                     완료·중단 상태에서는 '되돌리기' 하나로 합친다 — 두 상태 모두
                     복귀 지점이 '진행 전'이라 어디로 가는지는 확인 모달이 밝힌다.
                     맨 위 항목이 주어('검사')를 밝히므로 아래는 짧게 둔다. -->
                <button
                  type="button"
                  class="dropdown-item"
                  onclick={() => {
                    dotMenuOpen = false
                    isCompleted || isCancelled
                      ? onRollbackAssessment?.()
                      : onCompleteAssessment?.()
                  }}
                >
                  {isCompleted || isCancelled ? '되돌리기' : '검사 완료하기'}
                </button>
                {#if !isCompleted && !isCancelled}
                  <button
                    type="button"
                    class="dropdown-item"
                    onclick={() => {
                      dotMenuOpen = false
                      onCancelAssessment()
                    }}
                  >
                    중단하기
                  </button>
                {/if}
                <div class="dropdown-divider"></div>
                <button
                  type="button"
                  class="dropdown-item is-danger"
                  onclick={() => {
                    dotMenuOpen = false
                    onDeleteAssessment?.()
                  }}
                >
                  삭제
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 소견 블록 — 작성된 소견은 열지 않고 여기서 읽는다(읽기 상주 / 쓰기는 작성 모드).
           접힘 = 한 줄 미리보기, 펼침 = 전문. 좌측 액센트 라인은 쓰지 않는다. -->
      {#if selectedAssessment?.opinion}
        <div class="shrink-0 border-b border-gray-200 bg-bg-base px-6 py-3">
          <button
            type="button"
            onclick={() => (opinionExpanded = !opinionExpanded)}
            class="flex w-full items-center gap-3 text-left"
            aria-expanded={opinionExpanded}
          >
            <Typography
              variant="body-02-normal-medium"
              tag="span"
              color="text-gray-500"
              className="shrink-0"
            >
              소견
            </Typography>
            {#if !opinionExpanded}
              <Typography
                variant="body-02-normal-regular"
                tag="span"
                color="text-gray-800"
                className="min-w-0 flex-1 truncate-safe"
              >
                {selectedAssessment.opinion}
              </Typography>
            {:else}
              <!-- svelte-ignore element_invalid_self_closing_tag -->
              <span class="flex-1" />
            {/if}
            <span
              class="shrink-0 transition-transform {opinionExpanded
                ? 'rotate-180'
                : ''}"
              aria-hidden="true"
            >
              <ArrowDownIcon20 />
            </span>
          </button>
          {#if opinionExpanded}
            <Typography
              variant="body-01-reading-regular"
              tag="p"
              color="text-gray-800"
              className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word"
            >
              {selectedAssessment.opinion}
            </Typography>
          {/if}
        </div>
      {/if}


      {#if isActionBlocked}
        <!-- 중단·미실시 = 이 패널에서 더 할 일이 없는 상태.
             상담 상세 우측 패널(취소된 회기)·같은 패널의 대기 상태와 동일한
             중앙 빈 상태 규격 — 아이콘 54 →24→ 타이틀 →12→ 설명 →24→ 사유·액션.
             상태 배지·검사명은 바로 위 패널 헤더가 이미 말하므로 되풀이하지 않고,
             카드 좌측 액센트 라인은 쓰지 않는다(Web_Design.md §Do's and Don'ts). -->
        <div
          class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto {isOverlayMode
            ? 'px-4'
            : 'px-8'} pt-30 pb-10"
        >
          <!-- 중단 확인 모달(AssessmentCancelConfirmModal)과 같은 일러스트 -->
          <TriangleWarningIcon54 />
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
            tag="p"
            className="mt-6 text-center"
          >
            {isCancelled ? '중단된 검사예요' : '미실시 처리된 검사예요'}
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            tag="p"
            className="mt-3 text-center"
          >
            {isCancelled
              ? '되돌리면 중단 이전 상태에서 다시 진행할 수 있어요.'
              : '보고서 업로드 등 검사 진행 기능은 사용할 수 없어요.'}
          </Typography>

          <!-- 중단 사유 = 인셋(well) 서브 블록 — radius 8 · padding 16 · 라벨→본문 8 -->
          {#if isCancelled && selectedAssessment?.cancelledReason}
            <div class="mt-6 w-full max-w-120 rounded-lg bg-bg-base p-4">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                tag="p"
              >
                중단 사유
              </Typography>
              <Typography
                variant="body-01-normal-regular"
                color="text-body-default"
                tag="p"
                className="mt-2 wrap-break-word"
              >
                {selectedAssessment.cancelledReason}
              </Typography>
            </div>
          {/if}

          <!-- 되돌리기 = 이 상태에 남은 유일한 행동. 중립 액션이므로
               outline-secondary(보더 gray-200 · 텍스트 gray-700 · hover gray-050) -->
          {#if isCancelled}
            <button
              type="button"
              onclick={() => onRollbackAssessment?.()}
              class="mt-6 inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border-default bg-white px-6 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <!-- 아이콘은 레이블(gray-700)보다 한 단 연하게 — icon-secondary -->
              <span class="flex shrink-0 text-icon-secondary" aria-hidden="true">
                <RollbackIcon20 />
              </span>
              되돌리기
            </button>
          {/if}
        </div>
      {:else if isSelfReport && selectedAssessment}
        <SelfReportDetailPanel
          {selectedAssessment}
          clientName={caseVM?.clientDetail?.name}
          clientBirthDate={caseVM?.clientDetail?.birthDate}
          {onRefuseAssessment}
          {onSendResult}
        />
      {:else if isExternalService && selectedAssessment}
        <ExternalServiceDetailPanel
          {selectedAssessment}
          clientName={caseVM?.clientDetail?.name}
          clientBirthDate={caseVM?.clientDetail?.birthDate}
          {onReportSubmitted}
          {onRefuseAssessment}
        />
      {:else}
        <!-- self_report 중 스마트폰중독검사가 아닌 경우: 업로드 카드 -->
        <div
          class="flex-1 flex items-center justify-center {isOverlayMode
            ? 'px-4 py-8'
            : 'px-8 py-12'}"
        >
          <div
            class="flex flex-wrap gap-6 {selectedAssessment?.isOnline
              ? ''
              : 'justify-center'}"
          >
            <div
              class="flex flex-col items-center {isOverlayMode
                ? 'w-full max-w-70'
                : 'w-70'} rounded-lg border border-gray-200 bg-white p-8"
            >
              <div class="mb-4">
                <UploadCircleYellowIcon48 />
              </div>
              <Typography
                variant="body-01-semibold"
                color="text-gray-900"
                className="mb-1">전문가용</Typography
              >
              <Typography
                variant="body-02-medium"
                color="text-gray-900"
                className="mb-2">보고서 업로드</Typography
              >
              <Typography
                variant="body-03-regular"
                color="text-gray-500"
                className="text-center mb-6"
                >전문가 검토를 위한 상세 평가 보고서에요</Typography
              >
              <Button
                class="h-10 rounded-lg border border-primary-500 bg-white px-4 hover:bg-primary-50"
                onclick={() =>
                  onUploadProfessionalReport?.(selectedAssessment!)}
              >
                <div class="flex items-center gap-1 text-primary-500">
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-primary-500"
                  >
                    업로드
                  </Typography>
                  <ArrowRightIcon16 color="currentColor" strokeWidth={1.5} />
                </div>
              </Button>
            </div>
            {#if selectedAssessment?.isOnline}
              <div
                class="flex flex-col items-center {isOverlayMode
                  ? 'w-full max-w-70'
                  : 'w-70'} rounded-lg border border-gray-200 bg-white p-8"
              >
                <div class="mb-4">
                  <CheckCircleBlueIcon48 />
                </div>
                <Typography
                  variant="body-01-semibold"
                  color="text-gray-900"
                  className="mb-1">내담자 전달용</Typography
                >
                <Typography
                  variant="body-02-medium"
                  color="text-gray-900"
                  className="mb-2">보고서 업로드</Typography
                >
                <Typography
                  variant="body-03-regular"
                  color="text-gray-500"
                  className="text-center mb-6"
                  >보호자에게 전달할 보고서를 업로드할 수 있어요</Typography
                >
                <Button
                  class="h-10 rounded-lg border border-primary-500 bg-white px-4 hover:bg-primary-50"
                  onclick={() => onUploadClientReport?.(selectedAssessment!)}
                >
                  <div class="flex items-center gap-1 text-primary-500">
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-primary-500">업로드</Typography
                    >
                    <ArrowRightIcon16 color="currentColor" strokeWidth={1.5} />
                  </div>
                </Button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- 소견 작성 모드 — 보고서를 보며 쓰는 전용 화면 (데스크톱) -->
{#if opinionWorkspaceOpen && selectedAssessment}
  <AssessmentOpinionWorkspace
    assessments={opinionTargets}
    initialAssessmentId={selectedAssessment.id}
    clientName={caseVM?.clientDetail?.name}
    clientBirthDate={caseVM?.clientDetail?.birthDate}
    clientCode={caseVM?.clientCode}
    onSave={(taskId, opinion) =>
      saveTaskOpinion({ taskId, opinion, queryClient })}
    onClose={() => (opinionWorkspaceOpen = false)}
  />
{/if}
