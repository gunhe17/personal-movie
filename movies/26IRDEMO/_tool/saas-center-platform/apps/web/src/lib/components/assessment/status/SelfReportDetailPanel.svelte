<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import SelfReportStepIndicator from './SelfReportStepIndicator.svelte'
  import { getSelfReportActiveStep } from '$lib/features/assessment/status-detail/constants'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'
  import SandGlass54 from '$root/src/lib/assets/SandGlass54.svelte'
  import GoodThumbIcon54 from '$root/src/lib/assets/GoodThumbIcon54.svelte'
  import AssessmentResultView from './AssessmentResultView.svelte'
  import AssessmentReportViewer from './AssessmentReportViewer.svelte'

  let {
    selectedAssessment,
    clientName,
    clientBirthDate,
    onRefuseAssessment,
    onSendResult
  } = $props<{
    selectedAssessment: AssessmentItem
    /** 내담자명 (다운로드 파일명 조합용) */
    clientName?: string
    /** 내담자 생년월일 (다운로드 파일명 조합용, 예: 1990-01-01) */
    clientBirthDate?: string
    onRefuseAssessment?: (assessment: AssessmentItem) => void
    /** 보고서 툴바 "결과전송" 버튼 (선택) */
    onSendResult?: () => void
  }>()

  let selectedStep = $state(1)

  const hasResponses = $derived(
    (selectedAssessment.processResponses ?? []).length > 0
  )
  const hasScoring = $derived(!!selectedAssessment.reportPayload?.scoring)
  const hasReportPayload = $derived(!!selectedAssessment.reportPayload)
  const hasReportDocument = $derived(!!selectedAssessment.reportDocumentId)
  /** submitted 또는 completed 상태 = 결과 데이터 표시 가능 */
  const isSubmittedOrCompleted = $derived(
    selectedAssessment.status === 'submitted' ||
      selectedAssessment.status === 'completed'
  )

  /** 각 단계 완료 표시 (데이터 기반) */
  const completedSteps = $derived.by(() => {
    const steps: number[] = []
    if (hasResponses || hasScoring) steps.push(1)
    if (hasReportPayload) steps.push(2)
    if (hasReportDocument) steps.push(3)
    return steps
  })

  $effect(() => {
    selectedStep = getSelfReportActiveStep(selectedAssessment.status, {
      hasReportDocument,
      hasReportPayload
    })
  })

  function handleStepChange(stepNumber: number) {
    selectedStep = stepNumber
  }

  type ResponseRow = { question_number: number; answer_value: number }
  type QuestionDef = { number: number; text: string }
  const responseRows = $derived(
    (selectedAssessment.processResponses ?? [])
      .slice()
      .sort(
        (a: ResponseRow, b: ResponseRow) =>
          a.question_number - b.question_number
      )
  )
  const questionDefs = $derived(selectedAssessment.questionDefinitions ?? [])
  function getQuestionText(num: number): string {
    const q = questionDefs.find((d: QuestionDef) => d.number === num)
    return q?.text ?? `문항 ${num}`
  }
</script>

<!-- 스텝 3 PDF 뷰어 하단바 — 뷰어가 자체 하단바를 쓰므로 스니펫으로 넘긴다 -->
{#snippet reportFooter()}
  <div
    class="shadow-sticky-top relative z-10 flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 xl:rounded-b-2xl"
  >
    <button
      type="button"
      class="h-11 w-35 rounded-lg border border-gray-300 bg-white text-body-01-normal-medium text-gray-700 hover:bg-gray-50"
      onclick={() => handleStepChange(2)}
    >
      이전
    </button>
  </div>
{/snippet}

<SelfReportStepIndicator
  activeStep={selectedStep}
  {completedSteps}
  onStepChange={handleStepChange}
/>

{#if selectedStep === 1}
  <!-- 스텝 1: 채점 확인 -->
  {#if selectedAssessment.status === 'pending' || selectedAssessment.status === 'in_progress'}
    <div
      class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
    >
      <div class="mb-4"><SandGlass54 /></div>
      <Typography
        variant="title-01-normal-semibold"
        color="text-title-default"
        className="mb-2"
      >
        {selectedAssessment.status === 'pending'
          ? '검사 대기 중이에요'
          : selectedAssessment.isOnline
            ? '온라인 검사 진행 중이에요'
            : '검사 진행 중이에요'}
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="text-center"
      >
        내담자가 검사를 제출하면 자동으로 채점됩니다.
      </Typography>
    </div>
  {:else if selectedAssessment.status === 'refused'}
    <div
      class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
    >
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="mb-4 text-center"
      >
        이 검사는 거부 처리되었습니다.
        {#if selectedAssessment.refusedReason}
          <span class="block mt-2 text-gray-500">
            사유: {selectedAssessment.refusedReason}
          </span>
        {/if}
      </Typography>
    </div>
  {:else if selectedAssessment.status === 'cancelled'}
    <div
      class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
    >
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="text-center"
      >
        이 검사는 중단되었어요.
        {#if selectedAssessment.cancelledReason}
          <span class="block mt-3 text-gray-400 text-xs">
            사유: {selectedAssessment.cancelledReason}
          </span>
        {/if}
      </Typography>
    </div>
  {:else}
    {@const scoring = selectedAssessment.reportPayload?.scoring as
      | { total_score?: number; max_total_score?: number }
      | undefined}
    {#if responseRows.length === 0}
      <div
        class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
      >
        {#if scoring && typeof scoring.total_score === 'number' && typeof scoring.max_total_score === 'number'}
          <div class="mb-4"><GoodThumbIcon54 /></div>
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
            className="mb-2"
          >
            채점이 완료되었어요
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            className="mb-4"
          >
            응답 데이터가 없습니다.
          </Typography>
          <Typography variant="body-02-medium" color="text-gray-700">
            내점수 / 전체점수: {scoring.total_score} / {scoring.max_total_score}
          </Typography>
        {:else}
          <div class="mb-4"><SandGlass54 /></div>
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
            className="mb-2"
          >
            내담자가 아직 검사를 완료하지 않았어요
          </Typography>
          <Typography variant="body-02-normal-regular" color="text-body-subtle">
            내담자가 검사를 제출하면 자동으로 채점됩니다.
          </Typography>
        {/if}
      </div>
    {:else}
      <div class="flex flex-1 flex-col px-8 py-6 overflow-auto">
        <Typography
          variant="body-02-medium"
          color="text-gray-700"
          className="mb-4"
        >
          검사 응답
        </Typography>
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full min-w-160 border-collapse bg-white">
            <thead>
              <tr class="bg-gray-50">
                <th
                  class="border-b border-r border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-800"
                  >문항</th
                >
                <th
                  class="border-b border-r border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700"
                  >전혀 그렇지 않다</th
                >
                <th
                  class="border-b border-r border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700"
                  >때때로 그렇다</th
                >
                <th
                  class="border-b border-r border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700"
                  >자주 그렇다</th
                >
                <th
                  class="border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700"
                  >항상 그렇다</th
                >
              </tr>
            </thead>
            <tbody>
              {#each responseRows as row (row.question_number)}
                <tr class="bg-white">
                  <td
                    class="border-b border-r border-gray-200 px-4 py-2.5 text-sm text-gray-800"
                  >
                    {row.question_number}. {getQuestionText(
                      row.question_number
                    )}
                  </td>
                  <td
                    class="border-b border-r border-gray-200 px-4 py-2.5 text-center"
                  >
                    {#if row.answer_value === 1}
                      <span
                        class="inline-block h-2 w-2 rounded-full bg-gray-500"
                        aria-hidden="true"
                      ></span>
                    {/if}
                  </td>
                  <td
                    class="border-b border-r border-gray-200 px-4 py-2.5 text-center"
                  >
                    {#if row.answer_value === 2}
                      <span
                        class="inline-block h-2 w-2 rounded-full bg-gray-500"
                        aria-hidden="true"
                      ></span>
                    {/if}
                  </td>
                  <td
                    class="border-b border-r border-gray-200 px-4 py-2.5 text-center"
                  >
                    {#if row.answer_value === 3}
                      <span
                        class="inline-block h-2 w-2 rounded-full bg-gray-500"
                        aria-hidden="true"
                      ></span>
                    {/if}
                  </td>
                  <td class="border-b border-gray-200 px-4 py-2.5 text-center">
                    {#if row.answer_value === 4}
                      <span
                        class="inline-block h-2 w-2 rounded-full bg-gray-500"
                        aria-hidden="true"
                      ></span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if scoring && typeof scoring.total_score === 'number' && typeof scoring.max_total_score === 'number'}
          <Typography
            variant="body-02-medium"
            color="text-gray-700"
            className="mt-4 text-center"
          >
            내점수 / 전체점수: {scoring.total_score} / {scoring.max_total_score}
          </Typography>
        {/if}
      </div>
    {/if}
  {/if}
{:else if selectedStep === 2}
  <AssessmentResultView assessment={selectedAssessment} />
{:else}
  <!-- 스텝 3: 보고서 생성 -->
  <AssessmentReportViewer
    assessment={selectedAssessment}
    {clientName}
    {clientBirthDate}
    {onSendResult}
    footer={reportFooter}
  />
{/if}

<!-- 제출 완료/완료 상태: 단계별 이전/다음 (스텝3 PDF 뷰어는 자체 하단바 사용) -->
{#if isSubmittedOrCompleted && !(selectedStep === 3 && selectedAssessment.reportDocumentId)}
  <div
    class="shadow-sticky-top relative z-10 flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 xl:rounded-b-2xl"
  >
    <!-- 스텝 이동 버튼 = §panel-footer 규격(높이 44 · 레이블 16 Medium) · 너비 140 고정 -->
    <button
      type="button"
      class="h-11 w-35 rounded-lg border border-gray-300 bg-white text-body-01-normal-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={selectedStep === 1}
      onclick={() => handleStepChange(selectedStep - 1)}
    >
      이전
    </button>
    {#if selectedStep < 3}
      <button
        type="button"
        class="h-11 w-35 rounded-lg bg-primary-500 text-body-01-normal-medium text-white hover:bg-primary-600"
        onclick={() => handleStepChange(selectedStep + 1)}
      >
        다음
      </button>
    {/if}
  </div>
{/if}
