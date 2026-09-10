<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import AssessmentSidebar from './AssessmentSidebar.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import type {
    AssessmentItem,
    CaseDetailVM
  } from '$lib/features/assessment/status-detail/types'

  let {
    closePanel,
    caseId,
    clientVM,
    isSecretMode = $bindable(),
    assessments,
    selectedAssessment,
    onSelectAssessment,
    onSendResult,
    onWriteReport,
    onToggleFinalReport,
    onAddSchedule,
    onRevertSchedule,
    onCancelSchedule,
    onEditCase,
    billingState = 'none',
    canWriteBilling = false,
    canReadBilling = false,
    onCreateBilling,
    onViewBilling,
    canEdit = true
  } = $props<{
    closePanel: () => void
    panelId?: string
    caseId: string
    clientVM: CaseDetailVM
    isSecretMode: boolean
    assessments: AssessmentItem[]
    selectedAssessment: AssessmentItem | null
    onSelectAssessment: (assessment: AssessmentItem) => void
    onSendResult: () => void
    onWriteReport?: () => void
    onToggleFinalReport?: (
      enabled: boolean
    ) => Promise<boolean | void> | boolean | void
    onAddSchedule?: () => void
    onRevertSchedule?: () => void
    onCancelSchedule?: () => void
    onEditCase?: () => void
    billingState?: 'none' | 'pending' | 'completed'
    canWriteBilling?: boolean
    canReadBilling?: boolean
    onCreateBilling?: () => void
    onViewBilling?: () => void
    canEdit?: boolean
  }>()
</script>

<div class="flex h-full flex-col">
  <!-- 헤더 -->
  <div class="flex items-center justify-between px-5 pt-4 pb-2">
    <Typography variant="title-01-semibold" color="text-gray-900">
      내담자 정보
    </Typography>
    <Tooltip text="닫기">
      <button
        onclick={closePanel}
        class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="닫기"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M15 5L5 15M5 5L15 15"
            stroke="#6B7280"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </Tooltip>
  </div>

  <!-- 사이드바 콘텐츠 -->
  <AssessmentSidebar
    {caseId}
    bind:isSecretMode
    {clientVM}
    {assessments}
    {selectedAssessment}
    {onSelectAssessment}
    {onSendResult}
    {onWriteReport}
    {onToggleFinalReport}
    {onAddSchedule}
    {onRevertSchedule}
    {onCancelSchedule}
    {onEditCase}
    {canEdit}
    {billingState}
    {canWriteBilling}
    {canReadBilling}
    {onCreateBilling}
    {onViewBilling}
    overlay
  />
</div>
