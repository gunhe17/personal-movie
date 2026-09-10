<script lang="ts">
  import Select from '$lib/components/Select.svelte'
  import ModelInfoBadge from '../ModelInfoBadge.svelte'
  import ProcessFlowBar from '../ProcessFlowBar.svelte'
  import ArtifactCard from '../ArtifactCard.svelte'
  import TokenUsageCard from '../TokenUsageCard.svelte'
  import type { FlowStep, FlowStepStatus, CreditVerification } from '../../view-model'
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

  const flowSteps = $derived.by((): FlowStep[] => {
    const hasAudio = !!fnDetail
    const hasTranscript = !!fnDetail?.audios?.[0]?.transcript
    const hasRefined = !!fnDetail?.refined_transcript

    function resolve(statusField: string, hasData: boolean): FlowStepStatus {
      const raw = (fnDetail as Record<string, any> | null)?.[statusField] as string | undefined
      if (raw === 'completed' || hasData) return 'completed'
      if (raw === 'processing' || raw === 'generating') return 'active'
      if (raw === 'failed') return 'error'
      return 'idle'
    }

    return [
      { key: 'audio', label: '오디오', description: '녹음 원본', status: hasAudio ? 'completed' : 'idle' },
      { key: 'transcribe', label: '전사 (STT)', description: '음성→텍스트', status: resolve('transcribe_status', hasTranscript) },
      { key: 'refine', label: '정제', description: '텍스트 정리', status: resolve('refine_status', hasRefined) },
    ]
  })

  const FREE_PURPOSES = new Set(['field_note_stt_chunk', 'field_note_stt_diarize', 'field_note_refine'])
  const tokenItems = $derived(
    (fnDetail?.token_usage ?? []).filter((t) => t.purpose && FREE_PURPOSES.has(t.purpose)),
  )
  const totalInputTokens = $derived(tokenItems.reduce((s, t) => s + t.input_tokens, 0))
  const totalOutputTokens = $derived(tokenItems.reduce((s, t) => s + t.output_tokens, 0))

  const isRunning = $derived(runningAction === 'stt')

  /** segments JSON → "[화자] 텍스트" 포맷 */
  function formatSpeakerSegments(raw: string | null | undefined): string {
    if (!raw) return ''
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      // { text, segments } 형태 (diarized_transcript)
      const segments = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.segments)
          ? parsed.segments
          : null
      if (!segments) return typeof raw === 'string' ? raw : ''
      return segments
        .map((s: { speaker?: string; text?: string }) =>
          s.speaker ? `[${s.speaker}] ${s.text ?? ''}` : (s.text ?? ''),
        )
        .join('\n')
    } catch {
      return typeof raw === 'string' ? raw : ''
    }
  }

  const formattedDiarized = $derived(formatSpeakerSegments(fnDetail?.audios?.[0]?.diarized_transcript))
  const formattedRefined = $derived(formatSpeakerSegments(fnDetail?.refined_transcript))
</script>

<section class="section-border px-6 py-6">
  <div class="flex items-center gap-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
      <svg class="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"/></svg>
    </div>
    <div>
      <h3 class="text-body-01-normal-semibold text-gray-900">음성 분석</h3>
      <p class="mt-0.5 text-label-01-normal-regular text-gray-400">녹음 → 전사(STT) → 텍스트 정제 (무료)</p>
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
        <span class="text-gray-500">오디오 <strong class="text-gray-700">{fnDetail.audios?.length ?? 0}개</strong></span>
        <span class="text-gray-300">|</span>
        <span class="text-gray-500">생성 <strong class="text-gray-700">{formatDate(fnDetail.created_at, 'YYYY.MM.DD HH:mm')}</strong></span>
        <ModelInfoBadge model={fnDetail.audios?.[0]?.stt_model_used ?? null} label="STT" />
        <ModelInfoBadge model={fnDetail.refinement_model ?? null} label="정제" />
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
          class="rounded-lg bg-emerald-500 px-5 py-2.5 text-body-03-normal-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          onclick={onRun}
          disabled={disabled || isRunning || !selectedFieldNoteId}
        >
          {isRunning ? '분석 중...' : '음성 분석 실행'}
        </button>
      </div>
    {/if}
  {/if}

  {#if fnDetail && (fnDetail.audios?.[0]?.transcript || fnDetail.refined_transcript)}
    <div class="flex items-center gap-2 mt-5 mb-3">
      <span class="text-label-01-normal-medium text-gray-400 tracking-wider">산출물</span>
      <div class="h-px flex-1 bg-gray-100"></div>
    </div>

    <div class="space-y-3">
      {#if formattedDiarized}
        <ArtifactCard
          title="화자분리 전사"
          type="text"
          content={formattedDiarized}
          rawJson={fnDetail.audios?.[0]?.diarized_transcript}
        />
      {:else if fnDetail.audios?.[0]?.transcript}
        <ArtifactCard
          title="전사 원본"
          type="text"
          content={fnDetail.audios[0].transcript}
          rawJson={fnDetail.audios[0]}
        />
      {/if}

      {#if fnDetail.refined_transcript}
        <ArtifactCard title="정제된 전사" type="text" content={formattedRefined} rawJson={fnDetail.refined_transcript} />
      {/if}

      {#if tokenItems.length > 0}
        <TokenUsageCard items={tokenItems} {totalInputTokens} {totalOutputTokens} {creditVerification} />
      {/if}
    </div>
  {/if}
</section>
