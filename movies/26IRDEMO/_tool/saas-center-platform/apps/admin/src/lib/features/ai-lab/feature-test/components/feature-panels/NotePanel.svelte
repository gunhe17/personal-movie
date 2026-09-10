<script lang="ts">
  import Select from '$lib/components/Select.svelte'
  import ProcessFlowBar from '../ProcessFlowBar.svelte'
  import TokenUsageCard from '../TokenUsageCard.svelte'
  import { NOTE_FLOW_STEPS } from '../../constants'
  import type { CreditVerification } from '../../view-model'
  import { formatDate } from '$lib/utils/format'
  import type { FieldNoteDetailResponse } from '$lib/hooks/actions/featureTest.action'

  let {
    fieldNoteOptions,
    selectedFieldNoteId = '',
    onSelectFieldNote,
    onRun,
    runningAction = null as string | null,
    disabled = false,
    fnDetail = null as FieldNoteDetailResponse | null,
    fnLoading = false,
    creditVerification = null as CreditVerification | null,
  }: {
    fieldNoteOptions: { value: string; title: string }[]
    selectedFieldNoteId?: string
    onSelectFieldNote: (id: string) => void
    onRun: () => void
    runningAction?: string | null
    disabled?: boolean
    fnDetail?: FieldNoteDetailResponse | null
    fnLoading?: boolean
    creditVerification?: CreditVerification | null
  } = $props()

  const noteCompleted = $derived(fnDetail?.note_status === 'completed')
  const hasInput = $derived(!!fnDetail?.refined_transcript || !!fnDetail?.audios?.[0]?.transcript)
  const flowSteps = $derived.by(() => {
    const inputStatus = hasInput ? 'completed' : 'idle'
    const noteStatus = noteCompleted ? 'completed'
      : runningAction === 'note' ? 'active'
      : 'idle'
    return NOTE_FLOW_STEPS.map((s) => ({
      ...s,
      status: s.key === 'input' ? inputStatus : noteStatus,
    })) as Array<{ key: string; label: string; description: string; status: 'idle' | 'active' | 'completed' | 'error' }>
  })

  const tokenItems = $derived(
    (fnDetail?.token_usage ?? []).filter((t) => t.purpose === 'field_note_counseling_note'),
  )
  const totalInputTokens = $derived(tokenItems.reduce((s, t) => s + t.input_tokens, 0))
  const totalOutputTokens = $derived(tokenItems.reduce((s, t) => s + t.output_tokens, 0))

  const isRunning = $derived(runningAction === 'note')
  const noteTemplate = $derived(fnDetail?.note_template_type ?? 'default')
</script>

<section class="section-border px-6 py-6">
  <div class="flex items-center gap-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
      <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/></svg>
    </div>
    <div>
      <h3 class="text-body-01-normal-semibold text-gray-900">상담일지 생성</h3>
      <p class="mt-0.5 text-label-01-normal-regular text-gray-400">정제된 텍스트 → 구조화된 상담일지 (크레딧 차감)</p>
    </div>
  </div>

  <div class="flex items-center gap-2 mt-5 mb-3">
    <span class="text-label-01-normal-medium text-gray-400 tracking-wider">입력</span>
    <div class="h-px flex-1 bg-gray-100"></div>
  </div>

  {#if fieldNoteOptions.length > 0}
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <Select
          class="h-11 w-full rounded-lg bg-white"
          options={fieldNoteOptions}
          selected={fieldNoteOptions.find((o) => o.value === selectedFieldNoteId)}
          defaultValue=""
          showActiveHighlight={true}
          placeholder="필드노트 선택"
          on:change={(e) => {
            const id = typeof e.detail === 'object' ? String(e.detail.value) : ''
            onSelectFieldNote(id)
          }}
        />
      </div>
    </div>

    {#if fnDetail}
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-label-01-normal-regular">
        <span class="text-gray-500">녹음 <strong class="text-gray-700">{Math.round(fnDetail.total_duration / 60)}분</strong></span>
        <span class="text-gray-300">|</span>
        <span class="text-gray-500">생성 <strong class="text-gray-700">{formatDate(fnDetail.created_at, 'YYYY.MM.DD HH:mm')}</strong></span>
        {#if !hasInput}
          <span class="text-amber-500 text-label-01-normal-medium">전사/정제가 먼저 필요합니다</span>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-center">
      <p class="text-body-03-normal-regular text-gray-400">완료된 필드노트가 없습니다.</p>
    </div>
  {/if}

  <div class="flex items-center gap-2 mt-5 mb-3">
    <span class="text-label-01-normal-medium text-gray-400 tracking-wider">프로세스</span>
    <div class="h-px flex-1 bg-gray-100"></div>
  </div>

  {#if fnLoading}
    <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p class="text-body-03-normal-regular text-gray-400">필드노트 데이터 불러오는 중...</p>
    </div>
  {:else}
    <ProcessFlowBar steps={flowSteps} />

    {#if selectedFieldNoteId && fieldNoteOptions.length > 0}
      <div class="mt-3">
        <button
          class="rounded-lg bg-indigo-500 px-5 py-2.5 text-body-03-normal-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          onclick={onRun}
          disabled={disabled || isRunning || !selectedFieldNoteId || !hasInput}
        >
          {isRunning ? '생성 중...' : '상담일지 생성'}
        </button>
      </div>
    {/if}
  {/if}

  {#if noteCompleted || tokenItems.length > 0}
    <div class="flex items-center gap-2 mt-5 mb-3">
      <span class="text-label-01-normal-medium text-gray-400 tracking-wider">산출물</span>
      <div class="h-px flex-1 bg-gray-100"></div>
    </div>

    <div class="space-y-3">
      {#if noteCompleted}
        <div class="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p class="text-body-03-normal-medium text-emerald-700">
            상담일지가 생성되었습니다 (템플릿: {noteTemplate})
          </p>
          <p class="mt-1 text-label-01-normal-regular text-emerald-600">
            생성된 상담일지는 해당 상담 세션의 상담일지 탭에서 확인할 수 있습니다.
          </p>
        </div>
      {/if}

      {#if tokenItems.length > 0}
        <TokenUsageCard items={tokenItems} {totalInputTokens} {totalOutputTokens} {creditVerification} />
      {/if}
    </div>
  {/if}
</section>
