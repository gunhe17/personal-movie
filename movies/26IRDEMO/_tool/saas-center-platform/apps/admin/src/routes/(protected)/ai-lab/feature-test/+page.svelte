<script lang="ts">
  import { queryBuilder } from '$hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'

  // Actions
  import {
    getFeatureTestCredit,
    getFeatureTestFieldNotes,
    getFeatureTestCounselingCases,
    type CreditBalance,
    type FieldNoteListResponse,
    type CounselingCaseListResponse,
  } from '$lib/hooks/actions/featureTest.action'

  // Feature module
  import { FEATURES, type FeatureTestId } from '$lib/features/ai-lab/feature-test/constants'
  import { getCreditPercent, getCreditStatus, CREDIT_STATUS_STYLES } from '$lib/features/ai-lab/feature-test/view-model'
  import { useFeatureTestState } from '$lib/features/ai-lab/feature-test/hooks.svelte'
  import { createFeatureTestService } from '$lib/features/ai-lab/feature-test/feature-test-service'

  // Components
  import PageHeader from '$components/PageHeader.svelte'
  import CenterSelector from '$lib/features/ai-lab/feature-test/components/CenterSelector.svelte'
  import FeatureSelector from '$lib/features/ai-lab/feature-test/components/FeatureSelector.svelte'
  import ExecutionHistory from '$lib/features/ai-lab/feature-test/components/ExecutionHistory.svelte'
  import SttPanel from '$lib/features/ai-lab/feature-test/components/feature-panels/SttPanel.svelte'
  import SummaryPanel from '$lib/features/ai-lab/feature-test/components/feature-panels/SummaryPanel.svelte'
  import NotePanel from '$lib/features/ai-lab/feature-test/components/feature-panels/NotePanel.svelte'
  import CaseAnalysisPanel from '$lib/features/ai-lab/feature-test/components/feature-panels/CaseAnalysisPanel.svelte'

  const queryClient = useQueryClient()
  const ft = useFeatureTestState()
  const service = createFeatureTestService({
    queryClient,
    getCenterId: () => ft.selectedCenterId,
  })

  // ── Queries (센터 선택 시에만 활성화) ──
  const creditQ = $derived(
    queryBuilder(getFeatureTestCredit, () => ({
      centerId: ft.selectedCenterId,
    }), () => ({ enabled: !!ft.selectedCenterId })),
  )
  const credit = $derived(creditQ.data as CreditBalance | null | undefined)

  const fnQ = $derived(
    queryBuilder(getFeatureTestFieldNotes, () => ({
      centerId: ft.selectedCenterId,
      status: 'completed',
      size: 50,
    }), () => ({ enabled: !!ft.selectedCenterId })),
  )
  const fieldNoteOptions = $derived(
    ((fnQ.data as FieldNoteListResponse | null)?.items ?? []).map((n) => ({
      value: n.id,
      title: `${n.id.slice(0, 8)}... (${Math.round(n.total_duration / 60)}분, ${n.processing_status})`,
    })),
  )

  const caseQ = $derived(
    queryBuilder(getFeatureTestCounselingCases, () => ({
      centerId: ft.selectedCenterId,
      size: 50,
    }), () => ({ enabled: !!ft.selectedCenterId })),
  )
  const caseOptions = $derived(
    ((caseQ.data as CounselingCaseListResponse | null)?.items ?? []).map((c) => ({
      value: c.case_id ?? c.id ?? '',
      title: `${c.title ?? c.clients?.[0]?.name ?? c.case_code ?? (c.case_id ?? c.id ?? '').slice(0, 8)} (${c.completed_sessions ?? 0}/${c.total_sessions ?? '?'}회)`,
    })),
  )

  // ── Credit VM ──
  const creditPercent = $derived(credit ? getCreditPercent(credit.credit_used, credit.credit_limit) : 0)
  const creditStatus = $derived(getCreditStatus(creditPercent))
  const barStyles = $derived(CREDIT_STATUS_STYLES[creditStatus])
  const hasCredit = $derived((credit?.credit_remaining ?? 0) > 0)

  // ── Center Selection ──
  let selectedCenterName = $state('')

  function handleCenterSelect(centerId: string, centerName: string) {
    if (ft.selectedCenterId !== centerId) {
      ft.selectedCenterId = centerId
      selectedCenterName = centerName
      ft.resetResults()
    }
  }

  // ── Tab Handlers ──
  async function handleSelectSttFieldNote(id: string) {
    ft.sttFieldNoteId = id
    ft.sttDetail = null
    ft.sttCreditVerification = null
    if (!id) return
    ft.sttLoading = true
    ft.sttDetail = await service.loadFieldNoteDetail(id)
    ft.sttLoading = false
  }

  async function handleSelectSummaryFieldNote(id: string) {
    ft.summaryFieldNoteId = id
    ft.summaryDetail = null
    ft.summaryCreditVerification = null
    if (!id) return
    ft.summaryLoading = true
    ft.summaryDetail = await service.loadFieldNoteDetail(id)
    ft.summaryLoading = false
  }

  async function handleSelectNoteFieldNote(id: string) {
    ft.noteFieldNoteId = id
    ft.noteDetail = null
    ft.noteCreditVerification = null
    if (!id) return
    ft.noteLoading = true
    ft.noteDetail = await service.loadFieldNoteDetail(id)
    ft.noteLoading = false
  }

  async function handleSttAction() {
    ft.runningAction = 'stt'
    ft.sttCreditVerification = null
    const { detail, log, creditVerification } = await service.runFieldNoteAction('stt', ft.sttFieldNoteId, ft.sttDetail)
    if (detail) ft.sttDetail = detail
    ft.sttCreditVerification = creditVerification
    ft.runningAction = null
    ft.addLog(log)
  }

  async function handleSummaryAction() {
    ft.runningAction = 'summary'
    ft.summaryCreditVerification = null
    const { detail, log, creditVerification } = await service.runFieldNoteAction('summary', ft.summaryFieldNoteId, ft.summaryDetail)
    if (detail) ft.summaryDetail = detail
    ft.summaryCreditVerification = creditVerification
    ft.runningAction = null
    ft.addLog(log)
  }

  async function handleNoteAction() {
    ft.runningAction = 'note'
    ft.noteCreditVerification = null
    const { detail, log, creditVerification } = await service.runFieldNoteAction('note', ft.noteFieldNoteId, ft.noteDetail)
    if (detail) ft.noteDetail = detail
    ft.noteCreditVerification = creditVerification
    ft.runningAction = null
    ft.addLog(log)
  }

  async function handleSelectCase(id: string) {
    ft.selectedCaseId = id
    ft.casePreview = null
    ft.caseAnalysis = null
    ft.caseError = ''
    ft.caseCreditVerification = null
    if (!id) return
    ft.caseLoading = true
    const result = await service.loadCaseData(id)
    ft.casePreview = result.preview
    ft.caseAnalysis = result.analysis
    ft.caseError = result.error
    ft.caseLoading = false
  }

  async function handleCaseAnalysis() {
    ft.runningAction = 'case'
    ft.caseError = ''
    ft.caseCreditVerification = null
    const { result, log, creditVerification } = await service.runCaseAnalysis(ft.selectedCaseId)
    if (result.analysis) ft.caseAnalysis = result.analysis
    ft.caseError = result.error
    ft.caseCreditVerification = creditVerification
    ft.runningAction = null
    ft.addLog(log)
  }
</script>

<PageHeader title="통합 테스트" description="센터별 AI 기능 실행 테스트" />
<div class="flex flex-col pb-8">
  <!-- 센터 선택기 -->
  <section class="section-border px-6 py-5">
    <div class="mb-3 flex items-center gap-2">
      <h3 class="text-body-03-normal-medium text-gray-900">센터 선택</h3>
      {#if selectedCenterName}
        <span class="text-label-01-normal-regular text-gray-400">{selectedCenterName}</span>
      {/if}
    </div>
    <CenterSelector
      selectedCenterId={ft.selectedCenterId}
      onSelect={handleCenterSelect}
    />
  </section>

  {#if ft.selectedCenterId}
    <!-- 크레딧 요약 -->
    <section class="mt-4 section-border px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-body-03-normal-medium text-gray-900">크레딧</h2>
          {#if credit}
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-label-01-normal-medium text-gray-500">
              {credit.plan_type ?? 'free'}
            </span>
          {/if}
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
          onclick={service.invalidateCredit}
          aria-label="새로고침"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"/></svg>
        </button>
      </div>

      {#if credit}
        <div class="mt-3 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <span class="text-headline-01-normal-bold tabular-nums text-gray-900">
              {credit.credit_used.toLocaleString()}
            </span>
            <span class="text-body-03-normal-regular text-gray-400">
              / {credit.credit_limit.toLocaleString()} 사용
            </span>
          </div>
          <span class="text-body-03-normal-medium tabular-nums {barStyles.text}">
            {creditPercent}%
          </span>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full transition-all duration-500 {barStyles.bar}"
            style="width: {creditPercent}%"
          ></div>
        </div>
      {:else}
        <p class="mt-3 text-body-03-normal-regular text-gray-400">불러오는 중...</p>
      {/if}
    </section>

    <!-- 기능 선택기 -->
    <div class="mt-4">
      <FeatureSelector
        features={FEATURES}
        activeFeatureId={ft.activeFeature}
        onSelect={(id) => (ft.activeFeature = id as FeatureTestId)}
      />
    </div>

    <!-- 활성 기능 패널 -->
    <div class="mt-4">
      {#if ft.activeFeature === 'stt'}
        <SttPanel
          {fieldNoteOptions}
          selectedFieldNoteId={ft.sttFieldNoteId}
          onSelectFieldNote={handleSelectSttFieldNote}
          onRun={handleSttAction}
          runningAction={ft.runningAction}
          disabled={!!ft.runningAction}
          fnDetail={ft.sttDetail}
          fnLoading={ft.sttLoading}
          creditVerification={ft.sttCreditVerification}
        />

      {:else if ft.activeFeature === 'summary'}
        <SummaryPanel
          {fieldNoteOptions}
          selectedFieldNoteId={ft.summaryFieldNoteId}
          onSelectFieldNote={handleSelectSummaryFieldNote}
          onRun={handleSummaryAction}
          runningAction={ft.runningAction}
          disabled={!!ft.runningAction || !hasCredit}
          fnDetail={ft.summaryDetail}
          fnLoading={ft.summaryLoading}
          creditVerification={ft.summaryCreditVerification}
        />

      {:else if ft.activeFeature === 'note'}
        <NotePanel
          {fieldNoteOptions}
          selectedFieldNoteId={ft.noteFieldNoteId}
          onSelectFieldNote={handleSelectNoteFieldNote}
          onRun={handleNoteAction}
          runningAction={ft.runningAction}
          disabled={!!ft.runningAction || !hasCredit}
          fnDetail={ft.noteDetail}
          fnLoading={ft.noteLoading}
          creditVerification={ft.noteCreditVerification}
        />

      {:else if ft.activeFeature === 'case'}
        <CaseAnalysisPanel
          {caseOptions}
          selectedCaseId={ft.selectedCaseId}
          onSelectCase={handleSelectCase}
          onRunAnalysis={handleCaseAnalysis}
          running={ft.runningAction === 'case'}
          disabled={!!ft.runningAction || !hasCredit}
          casePreview={ft.casePreview}
          caseAnalysis={ft.caseAnalysis}
          caseLoading={ft.caseLoading}
          caseError={ft.caseError}
          runningAction={ft.runningAction}
          creditVerification={ft.caseCreditVerification}
        />
      {/if}
    </div>

    <!-- 실행 이력 -->
    <div class="mt-4">
      <ExecutionHistory entries={ft.executionLog} onClear={ft.clearLog} />
    </div>

    <!-- 안내 -->
    <section class="mt-4 section-border px-5 py-4">
      <p class="mb-2 text-body-03-normal-medium text-gray-500">안내</p>
      <ul class="space-y-1">
        <li class="flex items-start gap-1.5">
          <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
          <span class="text-body-03-normal-regular text-gray-500">선택한 센터의 크레딧이 실제로 차감됩니다. 음성 분석(STT·정제)은 무료입니다.</span>
        </li>
        <li class="flex items-start gap-1.5">
          <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
          <span class="text-body-03-normal-regular text-gray-500">기능별 토큰 사용량과 크레딧 차감 내역을 실시간으로 확인할 수 있습니다.</span>
        </li>
      </ul>
    </section>
  {:else}
    <!-- 센터 미선택 상태 -->
    <div class="mt-6 section-border border-dashed px-6 py-16 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/></svg>
      <p class="mt-4 text-body-03-normal-medium text-gray-500">센터를 선택하면 AI 기능 테스트를 시작할 수 있습니다.</p>
      <p class="mt-1 text-label-01-normal-regular text-gray-400">위 검색창에서 센터를 검색해주세요.</p>
    </div>
  {/if}
</div>
