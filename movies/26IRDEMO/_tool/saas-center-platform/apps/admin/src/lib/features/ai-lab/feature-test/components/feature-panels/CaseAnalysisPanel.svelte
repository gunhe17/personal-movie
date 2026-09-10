<script lang="ts">
  import Select from '$lib/components/Select.svelte'
  import ModelInfoBadge from '../ModelInfoBadge.svelte'
  import ProcessFlowBar from '../ProcessFlowBar.svelte'
  import ArtifactCard from '../ArtifactCard.svelte'
  import TokenUsageCard from '../TokenUsageCard.svelte'
  import { CASE_FLOW_STEPS } from '../../constants'
  import { mapToSimpleFlowSteps } from '../../view-model'
  import type { CreditVerification } from '../../view-model'
  import { formatDate } from '$lib/utils/format'
  import type { CaseAnalysisResult, CaseAnalysisPreview } from '$lib/hooks/actions/featureTest.action'

  let {
    caseOptions,
    selectedCaseId = '',
    onSelectCase,
    onRunAnalysis,
    running = false,
    disabled = false,
    casePreview = null as CaseAnalysisPreview | null,
    caseAnalysis = null as CaseAnalysisResult | null,
    caseLoading = false,
    caseError = '',
    runningAction = null as string | null,
    creditVerification = null as CreditVerification | null,
  }: {
    caseOptions: { value: string; title: string }[]
    selectedCaseId?: string
    onSelectCase: (id: string) => void
    onRunAnalysis: () => void
    running?: boolean
    disabled?: boolean
    casePreview?: CaseAnalysisPreview | null
    caseAnalysis?: CaseAnalysisResult | null
    caseLoading?: boolean
    caseError?: string
    runningAction?: string | null
    creditVerification?: CreditVerification | null
  } = $props()

  const flowSteps = $derived(
    mapToSimpleFlowSteps(CASE_FLOW_STEPS, runningAction, 'case', !!caseAnalysis, !!caseError),
  )

  const themeTags = $derived(
    (caseAnalysis?.content?.recurring_themes ?? []).map((t: string) => ({
      label: t,
      color: 'bg-violet-50 text-violet-600',
    })),
  )

  const emergingTags = $derived(
    (caseAnalysis?.content?.emerging_themes ?? []).map((t: string) => ({
      label: t,
      color: 'bg-blue-50 text-blue-600',
    })),
  )

  const riskTags = $derived(
    (caseAnalysis?.content?.risk_factors ?? []).map((r: string) => ({
      label: r,
      color: 'bg-red-50 text-red-600',
    })),
  )

  const strengthTags = $derived(
    (caseAnalysis?.content?.strengths ?? []).map((s: string) => ({
      label: s,
      color: 'bg-emerald-50 text-emerald-600',
    })),
  )

  const emotionTimeline = $derived(
    (caseAnalysis?.content?.emotional_trajectory ?? []).map((p: any) => ({
      label: `#${p.session}`,
      value: p.change_direction ? `${p.mood} (${p.change_direction})` : p.mood,
    })),
  )

  const interventionRows = $derived(
    Object.entries(caseAnalysis?.content?.intervention_summary ?? {}).map(
      ([method, info]: [string, any]) => ({
        key: method,
        value: `${info.frequency}회 · ${info.effectiveness}${info.evidence ? ` — ${info.evidence}` : ''}`,
      }),
    ),
  )

  const alliance = $derived(caseAnalysis?.content?.therapeutic_alliance)
</script>

<section class="section-border px-6 py-6">
  <div class="flex items-center gap-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100">
      <svg class="h-5 w-5 text-pink-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/></svg>
    </div>
    <div>
      <h3 class="text-body-01-normal-semibold text-gray-900">상담 사례 분석</h3>
      <p class="mt-0.5 text-label-01-normal-regular text-gray-400">다수 세션 종단 분석 (토큰 비례 크레딧 차감)</p>
    </div>
  </div>

  <!-- 입력 -->
  <div class="flex items-center gap-2 mt-5 mb-3">
    <span class="text-label-01-normal-medium text-gray-400 tracking-wider">입력</span>
    <div class="h-px flex-1 bg-gray-100"></div>
  </div>

  {#if caseOptions.length > 0}
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <Select
          class="h-11 w-full rounded-lg bg-white"
          options={caseOptions}
          selected={caseOptions.find((o) => o.value === selectedCaseId)}
          defaultValue=""
          showActiveHighlight={true}
          placeholder="상담 케이스 선택"
          on:change={(e) => {
            const id = typeof e.detail === 'object' ? String(e.detail.value) : ''
            onSelectCase(id)
          }}
        />
      </div>
    </div>

    {#if casePreview}
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-label-01-normal-regular">
        <span class="text-gray-500">세션 <strong class="text-gray-700">{casePreview.session_count}회</strong></span>
        <span class="text-gray-300">|</span>
        <span class="text-gray-500">상담일지 <strong class="text-gray-700">{casePreview.note_count}개</strong></span>
        <span class="text-gray-300">|</span>
        <span class="text-gray-500">
          기존 분석
          <strong class={casePreview.has_previous_analysis ? 'text-emerald-600' : 'text-gray-400'}>
            {casePreview.has_previous_analysis ? '있음' : '없음'}
          </strong>
        </span>
      </div>
    {/if}
  {:else}
    <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-center">
      <p class="text-body-03-normal-regular text-gray-400">상담 케이스가 없습니다.</p>
    </div>
  {/if}

  <!-- 프로세스 -->
  <div class="flex items-center gap-2 mt-5 mb-3">
    <span class="text-label-01-normal-medium text-gray-400 tracking-wider">프로세스</span>
    <div class="h-px flex-1 bg-gray-100"></div>
  </div>

  {#if caseLoading}
    <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p class="text-body-03-normal-regular text-gray-400">케이스 데이터 불러오는 중...</p>
    </div>
  {:else}
    <ProcessFlowBar steps={flowSteps} />

    {#if selectedCaseId && caseOptions.length > 0}
      <div class="mt-3">
        <button
          class="rounded-lg bg-pink-500 px-5 py-2.5 text-body-03-normal-medium text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
          onclick={onRunAnalysis}
          disabled={disabled || running || !selectedCaseId}
        >
          {running ? '실행 중...' : '분석 실행'}
        </button>
      </div>
    {/if}
  {/if}

  <!-- 산출물 -->
  {#if caseError || caseAnalysis}
    <div class="flex items-center gap-2 mt-5 mb-3">
      <span class="text-label-01-normal-medium text-gray-400 tracking-wider">산출물</span>
      <div class="h-px flex-1 bg-gray-100"></div>
    </div>

    {#if caseError}
      <div class="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
        <p class="text-body-03-normal-regular text-red-700">{caseError}</p>
      </div>
    {/if}

    {#if caseAnalysis}
      <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-01-normal-regular">
        <ModelInfoBadge model={caseAnalysis.model_used} label="모델" />
        <span class="text-gray-400">{formatDate(caseAnalysis.created_at, 'YYYY.MM.DD HH:mm')}</span>
      </div>

      <div class="space-y-3">
        <ArtifactCard title="반복 주제" type="tags" tags={themeTags} />
        {#if emergingTags.length > 0}
          <ArtifactCard title="최근 부상 주제" type="tags" tags={emergingTags} />
        {/if}
        <ArtifactCard title="감정 변화" type="timeline" timelineItems={emotionTimeline} />

        {#if alliance}
          <ArtifactCard
            title="치료적 관계"
            type="text"
            content={[
              alliance.attendance_rate ? `출석률: ${alliance.attendance_rate}` : null,
              alliance.engagement_level ? `참여도: ${alliance.engagement_level}` : null,
              alliance.evidence ?? null,
            ].filter(Boolean).join('\n')}
          />
        {/if}

        {#if caseAnalysis.content.progress_summary}
          <ArtifactCard
            title="진행 요약"
            type="text"
            content={caseAnalysis.content.progress_summary}
            rawJson={caseAnalysis.content}
          />
        {/if}

        <ArtifactCard title="개입 방법" type="table" tableRows={interventionRows} />

        {#if strengthTags.length > 0}
          <ArtifactCard title="강점/보호 요인" type="tags" tags={strengthTags} />
        {/if}
        <ArtifactCard title="위험 요인" type="tags" tags={riskTags} />

        {#if caseAnalysis.content.recommendations}
          <ArtifactCard title="권고사항" type="text" content={caseAnalysis.content.recommendations} />
        {/if}

        <TokenUsageCard
          totalInputTokens={caseAnalysis.input_tokens}
          totalOutputTokens={caseAnalysis.output_tokens}
          {creditVerification}
        />
      </div>
    {/if}
  {/if}
</section>
