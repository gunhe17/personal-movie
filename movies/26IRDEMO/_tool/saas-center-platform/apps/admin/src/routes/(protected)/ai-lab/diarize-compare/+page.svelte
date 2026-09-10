<script lang="ts">
  import { getContext } from 'svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$hooks/queries/builder'
  import type { SelectOptionType } from '$lib/types/common'
  import { getLlmModels, getDefaultSystemPrompt } from '$lib/features/ai-lab/metadata-helpers'
  import {
    getSampleList,
    getSampleDetail,
    uploadAudioSample,
    runSTTExperiment,
    getDiarizationAccuracy,
    getPromptSuggestion,
    type LabMetadataResponse,
    type SampleListResponse,
    type SampleDatasetResponse,
    type ExperimentRunResponse,
    type DiarizationAccuracyResponse,
    type ReferenceSegment,
  } from '$hooks/actions/aiLab.action'
  import { snackbarStore } from '$stores/snackbar'
  import Select from '$components/Select.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import DiarizeColumn from '$lib/features/ai-lab/diarize-compare/DiarizeColumn.svelte'
  import ReferenceEditorModal from '$lib/features/ai-lab/lab/components/ReferenceEditorModal.svelte'
  import FieldNoteImportModal from '$lib/features/ai-lab/lab/components/FieldNoteImportModal.svelte'
  import { parseSyncSegments } from '$lib/features/ai-lab/shared/audio-sync'

  const getMetadata = getContext<() => LabMetadataResponse | undefined>('labMetadata')
  const metadata = $derived(getMetadata())
  const queryClient = useQueryClient()

  // ── 샘플 ──
  const samplesQ = $derived(
    queryBuilder(getSampleList, () => ({ input_type: 'audio', size: 50 }), () => ({ throwOnError: false })),
  )
  const audioSamples = $derived((samplesQ.data as SampleListResponse)?.items ?? [])
  const sampleOptions: SelectOptionType[] = $derived(
    audioSamples.map((s) => ({ value: s.id, title: `${s.name}${s.tags ? ` [${s.tags}]` : ''}` })),
  )

  // ── 모델 ──
  const audioModelOptions: SelectOptionType[] = $derived(
    (metadata?.stt_diarize_models ?? []).map((m) => ({ value: m.value, title: m.label })),
  )
  const llmModels = $derived(getLlmModels(metadata))

  let selectedSampleId = $state('')
  let audioModel = $state('')
  let textModels = $state<string[]>([]) // 멀티 선택
  let prompt = $state('')
  let showPromptEdit = $state(false)

  $effect(() => {
    if (!metadata) return
    if (!audioModel) audioModel = metadata.stt_diarize_models?.[0]?.value ?? 'gpt-4o-transcribe-diarize'
    if (textModels.length === 0 && llmModels.length > 0) textModels = [llmModels[0].value]
    if (!prompt) prompt = getDefaultSystemPrompt(metadata, 'stt_text_diarize')
  })

  function toggleTextModel(v: string) {
    textModels = textModels.includes(v) ? textModels.filter((x) => x !== v) : [...textModels, v]
  }
  function modelLabel(v: string): string {
    return llmModels.find((m) => m.value === v)?.label ?? v
  }

  // ── 오디오 업로드 / 필드노트 가져오기 ──
  let showUpload = $state(false)
  let uploadFile = $state<File | null>(null)
  let uploadName = $state('')
  let uploading = $state(false)
  let showImportModal = $state(false)
  let fileInputRef = $state<HTMLInputElement | null>(null)

  function onFilePick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (f) {
      uploadFile = f
      if (!uploadName.trim()) uploadName = f.name.replace(/\.[^.]+$/, '')
    }
  }
  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return
    uploading = true
    try {
      const res = await uploadAudioSample().request({ file: uploadFile, name: uploadName.trim() })
      await queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })
      selectedSampleId = res.id
      snackbarStore.success('오디오 업로드 완료')
      showUpload = false
      uploadFile = null
      uploadName = ''
      if (fileInputRef) fileInputRef.value = ''
    } catch {
      snackbarStore.error('업로드에 실패했습니다.')
    } finally {
      uploading = false
    }
  }

  // ── 샘플 상세(정답 상태) ──
  const detailQ = $derived(
    queryBuilder(
      getSampleDetail,
      () => ({ sampleId: selectedSampleId }),
      () => ({ throwOnError: false, enabled: !!selectedSampleId }),
    ),
  )
  const sampleDetail = $derived(detailQ.data as SampleDatasetResponse | undefined)
  const hasReference = $derived(!!sampleDetail?.reference_segments)
  const refSpeakers = $derived.by(() => {
    if (!sampleDetail?.reference_segments) return null
    try {
      const segs = JSON.parse(sampleDetail.reference_segments) as { speaker: string }[]
      return new Set(segs.map((s) => s.speaker)).size
    } catch {
      return null
    }
  })

  // ── 결과 상태 ──
  type Slot = {
    run: ExperimentRunResponse | null
    acc: DiarizationAccuracyResponse | null
    err: string | null
    loading: boolean
  }
  type TextSlot = Slot & { model: string; suggestion: string | null; suggesting: boolean }
  const emptySlot = (): Slot => ({ run: null, acc: null, err: null, loading: false })

  let audio = $state<Slot>(emptySlot())
  let textSlots = $state<TextSlot[]>([])
  let running = $state(false)
  let hasRun = $state(false)

  async function measure(run: ExperimentRunResponse | null): Promise<DiarizationAccuracyResponse | null> {
    if (!run || run.status !== 'completed') return null
    try {
      return await getDiarizationAccuracy().request({ experimentId: run.id })
    } catch {
      return null
    }
  }

  async function runAll() {
    if (!selectedSampleId) {
      snackbarStore.error('오디오 샘플을 선택하세요.')
      return
    }
    if (textModels.length === 0) {
      snackbarStore.error('텍스트 LLM을 하나 이상 선택하세요.')
      return
    }
    running = true
    hasRun = true
    audio = { ...emptySlot(), loading: true }
    textSlots = textModels.map((m) => ({
      model: m, run: null, acc: null, err: null, loading: true, suggestion: null, suggesting: false,
    }))

    const audioTask = (async () => {
      try {
        const run = await runSTTExperiment().request({
          experiment_type: 'stt_diarize', sample_id: selectedSampleId, model_name: audioModel,
        })
        const acc = await measure(run)
        audio = { run, acc, err: run.status === 'failed' ? run.error_message ?? '실패' : null, loading: false }
      } catch {
        audio = { run: null, acc: null, err: '실행 실패', loading: false }
      }
    })()

    const textTasks = textSlots.map((slot, idx) =>
      (async () => {
        try {
          const run = await runSTTExperiment().request({
            experiment_type: 'stt_text_diarize', sample_id: selectedSampleId,
            model_name: slot.model, system_prompt: prompt,
          })
          const acc = await measure(run)
          textSlots[idx] = {
            ...textSlots[idx], run, acc,
            err: run.status === 'failed' ? run.error_message ?? '실패' : null, loading: false,
          }
        } catch {
          textSlots[idx] = { ...textSlots[idx], run: null, acc: null, err: '실행 실패', loading: false }
        }
      })(),
    )

    await Promise.all([audioTask, ...textTasks])
    running = false
  }

  async function suggestFor(idx: number) {
    const slot = textSlots[idx]
    if (!slot?.run) return
    textSlots[idx] = { ...slot, suggesting: true }
    try {
      const res = await getPromptSuggestion().request({ experimentId: slot.run.id })
      textSlots[idx] = { ...textSlots[idx], suggestion: res.suggestion, suggesting: false }
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      snackbarStore.error(msg ?? '제안을 생성할 수 없습니다. 먼저 정답을 만들어주세요.')
      textSlots[idx] = { ...textSlots[idx], suggesting: false }
    }
  }

  // ── 정답 편집 ──
  let showRefModal = $state(false)
  let refInitial = $state<ReferenceSegment[]>([])
  function openReference() {
    let segs: ReferenceSegment[] | null = null
    if (sampleDetail?.reference_segments) {
      try {
        segs = JSON.parse(sampleDetail.reference_segments)
      } catch {
        segs = null
      }
    }
    if (!segs || segs.length === 0) {
      const seed = audio.run?.output_json ?? textSlots.find((s) => s.run?.output_json)?.run?.output_json
      const parsed = parseSyncSegments(seed)
      segs = parsed ? parsed.map((s) => ({ speaker: s.speaker, text: s.text, start: s.start, end: s.end })) : null
    }
    if (!segs || segs.length === 0) {
      snackbarStore.error('정답을 만들려면 먼저 "실행"으로 결과를 생성하세요.')
      return
    }
    refInitial = segs
    showRefModal = true
  }
  async function onRefSaved() {
    await queryClient.invalidateQueries({ queryKey: ['getSampleDetail'], exact: false })
    audio = { ...audio, acc: await measure(audio.run) }
    textSlots = await Promise.all(textSlots.map(async (s) => ({ ...s, acc: await measure(s.run) })))
  }

  // ── 스코어보드 ──
  type Score = { key: string; label: string; icon: string; acc: number | null; speakers: number | null }
  const scores = $derived.by<Score[]>(() => {
    const list: Score[] = [
      { key: 'audio', label: '음향', icon: '🔊', acc: audio.acc?.accuracy_pct ?? null, speakers: audio.acc?.cand_speakers ?? null },
      ...textSlots.map((s) => ({
        key: s.model, label: modelLabel(s.model), icon: '📝',
        acc: s.acc?.accuracy_pct ?? null, speakers: s.acc?.cand_speakers ?? null,
      })),
    ]
    return list
  })
  const bestKey = $derived.by(() => {
    const scored = scores.filter((s) => s.acc != null)
    if (scored.length < 2) return null
    return scored.reduce((a, b) => ((b.acc ?? 0) > (a.acc ?? 0) ? b : a)).key
  })
  const anyScored = $derived(scores.some((s) => s.acc != null))
</script>

<div class="flex h-full flex-col">
  <PageHeader title="화자분리 동시 비교" description="같은 녹음에 음향 기반과 여러 텍스트 LLM 화자분리를 동시에 돌려 정답 대비 정확도·모델별 개선안을 비교합니다." />

  <!-- 입력 -->
  <div class="mb-4 rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-700">오디오 샘플</p>
          <div class="flex items-center gap-2">
            <button class="text-xs font-medium text-violet-600 hover:text-violet-700" onclick={() => (showImportModal = true)}>↧ 필드노트</button>
            <button class="text-xs font-medium text-primary-600 hover:text-primary-700" onclick={() => (showUpload = !showUpload)}>
              {showUpload ? '취소' : '+ 업로드'}
            </button>
          </div>
        </div>
        <Select options={sampleOptions} selected={selectedSampleId} placeholder="샘플 선택" class="w-full h-10"
          on:change={(e) => (selectedSampleId = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail))} />
      </div>
      <div>
        <p class="mb-1.5 text-xs font-semibold text-gray-700">🔊 음향 모델</p>
        <Select options={audioModelOptions} selected={audioModel} class="w-full h-10"
          on:change={(e) => (audioModel = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail))} />
      </div>
    </div>

    {#if showUpload}
      <div class="mt-3 space-y-2 rounded-lg border border-primary-100 bg-primary-50/30 p-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input bind:this={fileInputRef} type="file" accept="audio/*"
            class="flex-1 text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-700"
            onchange={onFilePick} />
          <input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 sm:w-56"
            placeholder="샘플 이름" bind:value={uploadName} />
          <button class="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            onclick={handleUpload} disabled={!uploadFile || !uploadName.trim() || uploading}>{uploading ? '업로드 중…' : '업로드'}</button>
        </div>
        {#if uploadFile}<p class="text-xs text-gray-400">{(uploadFile.size / 1024 / 1024).toFixed(1)}MB · 업로드 후 자동 선택됩니다</p>{/if}
      </div>
    {/if}

    <!-- 텍스트 LLM 멀티 선택 -->
    <div class="mt-3">
      <p class="mb-1.5 text-xs font-semibold text-gray-700">📝 텍스트 LLM (여러 개 선택 가능)</p>
      <div class="flex flex-wrap gap-1.5">
        {#each llmModels as m}
          <button
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors
              {textModels.includes(m.value) ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}"
            onclick={() => toggleTextModel(m.value)}
          >{m.label}</button>
        {/each}
      </div>
    </div>

    <!-- 정답 + 프롬프트 -->
    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        {#if !selectedSampleId}
          <span class="text-xs text-gray-400">샘플을 선택하세요</span>
        {:else if hasReference}
          <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">정답 있음 · 화자 {refSpeakers}명</span>
        {:else}
          <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">정답 없음 (정확도 측정 불가)</span>
        {/if}
        <button class="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-40" onclick={openReference} disabled={!selectedSampleId}>
          {hasReference ? '정답 편집' : '정답 만들기'}
        </button>
      </div>
      <button class="text-xs font-medium text-gray-500 hover:text-gray-700" onclick={() => (showPromptEdit = !showPromptEdit)}>
        {showPromptEdit ? '프롬프트 닫기' : '텍스트 프롬프트 편집 ▾'}
      </button>
    </div>

    {#if showPromptEdit}
      <textarea bind:value={prompt} rows="6"
        class="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 outline-none focus:border-primary-400"></textarea>
      <p class="mt-1 text-xs text-gray-400">이 프롬프트는 선택한 모든 텍스트 LLM에 동일하게 적용됩니다(모델 간 비교).</p>
    {/if}

    <button
      class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
      onclick={runAll} disabled={running || !selectedSampleId}
    >
      {#if running}
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span> 실행 중…
      {:else}
        ▶ 실행 (음향 1 + 텍스트 {textModels.length})
      {/if}
    </button>
  </div>

  {#if hasRun}
    <!-- 스코어보드 -->
    {#if anyScored}
      <div class="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
        {#each scores as s}
          <div class="flex items-center gap-1.5 rounded-lg px-2 py-1 {bestKey === s.key ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}">
            <span class="text-sm">{s.icon}</span>
            <span class="text-xs font-medium text-gray-600">{s.label}</span>
            <span class="text-base font-bold text-gray-900">{s.acc != null ? `${s.acc}%` : '–'}</span>
            {#if s.speakers != null}<span class="text-xs text-gray-400">{s.speakers}명</span>{/if}
            {#if bestKey === s.key}<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-600">최고</span>{/if}
          </div>
        {/each}
        {#if refSpeakers != null}<span class="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">정답 화자 {refSpeakers}명</span>{/if}
      </div>
    {:else}
      <div class="mb-4 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3">
        <p class="text-xs text-amber-700">정답이 없어 정확도를 측정하지 못했습니다. 아래 결과 중 정확한 쪽을 골라 정답으로 만들면 점수·개선안이 활성화됩니다.</p>
        <button class="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600" onclick={openReference}>정답 만들기</button>
      </div>
    {/if}

    <!-- 컬럼 비교 (음향 + 텍스트 N) -->
    <div class="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
      <div class="flex min-h-0 w-[340px] shrink-0">
        <DiarizeColumn
          title="음향 기반" icon="🔊" accent="violet"
          model={audio.run?.model_name ?? audioModel}
          outputJson={audio.run?.output_json ?? null}
          latencyMs={audio.run?.latency_ms ?? null}
          accuracy={audio.acc} {refSpeakers} loading={audio.loading} error={audio.err}
        />
      </div>
      {#each textSlots as slot, idx (slot.model)}
        <div class="flex min-h-0 w-[340px] shrink-0">
          <DiarizeColumn
            title={modelLabel(slot.model)} icon="📝" accent="fuchsia"
            model={slot.model}
            outputJson={slot.run?.output_json ?? null}
            latencyMs={slot.run?.latency_ms ?? null}
            accuracy={slot.acc} {refSpeakers} loading={slot.loading} error={slot.err}
            onSuggest={() => suggestFor(idx)} suggestion={slot.suggestion} suggesting={slot.suggesting}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<ReferenceEditorModal
  open={showRefModal}
  sampleId={selectedSampleId}
  sampleName={sampleDetail?.name ?? ''}
  initialSegments={refInitial}
  onClose={() => (showRefModal = false)}
  onSaved={onRefSaved}
/>

<FieldNoteImportModal
  open={showImportModal}
  onClose={() => (showImportModal = false)}
  onImported={() => queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })}
/>
