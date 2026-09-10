<script lang="ts">
  import Select from '$components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import type { PipelineConfigVM } from '../../production/view-model'
  import type { PromptVersionResponse } from '$hooks/actions/aiLab.action'
  import ProductionStatusBar from './ProductionStatusBar.svelte'

  let {
    step,
    sttModel = $bindable(''),
    selectedSampleId = $bindable(''),
    sttModelOptions = [],
    sampleOptions = [],
    isRunning = false,
    isUploading = false,
    onRun,
    onBack,
    onUpload,
    onImportFieldNote,
    showPrompt = false,
    systemPrompt = $bindable(''),
    defaultPrompt = '',
    onResetPrompt,
    promptVersions = [],
    isPromptModified = false,
    loadedVersionName = '',
    onSave,
    onLoadVersion,
  }: {
    step: PipelineConfigVM
    sttModel: string
    selectedSampleId: string
    sttModelOptions: SelectOptionType[]
    sampleOptions: SelectOptionType[]
    isRunning: boolean
    isUploading?: boolean
    onRun: () => void
    onBack: () => void
    onUpload: (file: File, name: string) => void
    onImportFieldNote?: () => void
    showPrompt?: boolean
    systemPrompt?: string
    defaultPrompt?: string
    onResetPrompt?: () => void
    promptVersions?: PromptVersionResponse[]
    isPromptModified?: boolean
    loadedVersionName?: string
    onSave?: () => void
    onLoadVersion?: (id: string) => void
  } = $props()

  // 기본값과 다른지(복원 버튼 활성화용) — 버전 수정 여부(isPromptModified)와 별개
  const isDefaultModified = $derived(showPrompt && systemPrompt.trim() !== defaultPrompt.trim())
  const filteredVersions = $derived(promptVersions.filter((p) => p.prompt_key === step.step))
  let showVersionList = $state(false)

  const canRun = $derived(sttModel && selectedSampleId && !isRunning)

  // 업로드 상태 (샘플 없으면 자동 펼침)
  const hasSamples = $derived(sampleOptions.length > 0)
  let showUploadForm = $state(false)
  let uploadFormForced = $state(false)
  $effect(() => {
    if (!hasSamples && !uploadFormForced) {
      showUploadForm = true
      uploadFormForced = true
    }
  })
  let uploadFile = $state<File | null>(null)
  let uploadName = $state('')
  let fileInputRef = $state<HTMLInputElement | null>(null)

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      uploadFile = file
      if (!uploadName) {
        uploadName = file.name.replace(/\.[^.]+$/, '')
      }
    }
  }

  function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return
    onUpload(uploadFile, uploadName.trim())
    // 폼 초기화는 업로드 성공 후 부모에서 처리
  }

  function resetUploadForm() {
    showUploadForm = false
    uploadFile = null
    uploadName = ''
    if (fileInputRef) fileInputRef.value = ''
  }

  // 업로드 완료 시 폼 초기화
  let prevUploading = $state(false)
  $effect(() => {
    if (prevUploading && !isUploading) {
      resetUploadForm()
    }
    prevUploading = isUploading
  })
</script>

<div class="flex flex-col gap-4">
  <!-- 상단: 뒤로가기 + 현재 스텝 -->
  <div class="flex items-center gap-3">
    <button
      class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 transition-colors hover:text-gray-600"
      onclick={onBack}
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
    </button>
    <div class="flex items-center gap-2">
      <div>
        <p class="text-body-03-normal-semibold text-gray-900">{step.label}</p>
        <p class="text-label-01-normal-regular text-gray-400">{step.description}</p>
      </div>
      <span class="rounded-full px-2 py-0.5 text-label-01-normal-bold {step.step === 'stt_streaming' ? 'bg-cyan-50 text-cyan-600' : 'bg-amber-50 text-amber-600'}">STT</span>
    </div>
  </div>

  <!-- STT 모델 선택 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <p class="mb-2 text-label-01-normal-bold text-gray-700">STT 모델</p>
    <Select
      options={sttModelOptions}
      selected={sttModel}
      class="w-full h-10"
      on:change={(e) => {
        sttModel = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail)
      }}
    />
    <p class="mt-2 text-label-01-normal-regular text-gray-400">
      {step.step === 'stt_streaming'
        ? 'AWS Transcribe 실시간 스트리밍 전사를 테스트합니다.'
        : step.step === 'stt_transcribe'
          ? 'N분 청크 단위 전사 모델을 선택합니다. Whisper / GPT-4o 선택 가능.'
          : step.step === 'stt_text_diarize'
            ? '전사는 whisper-1 고정. 선택한 LLM이 텍스트로 화자를 추론합니다.'
            : step.step === 'stt_aws_text_diarize'
              ? '전사는 AWS Transcribe 고정(재전사 없음). 선택한 LLM이 화자 라벨만 부여합니다.'
              : '화자분리(diarize) 모델을 선택하면 화자별로 구분됩니다.'}
    </p>
  </div>

  {#if showPrompt}
    <!-- 화자 추론 프롬프트 (텍스트 화자분리 전용) -->
    <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <p class="shrink-0 text-xs font-semibold text-gray-700">화자 추론 프롬프트</p>
          {#if loadedVersionName}
            <span class="truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{loadedVersionName}</span>
          {/if}
          {#if isPromptModified}
            <span class="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600">수정됨</span>
          {/if}
        </div>
        {#if isPromptModified && onSave}
          <button
            class="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
            onclick={onSave}
          >저장</button>
        {/if}
      </div>
      <textarea
        bind:value={systemPrompt}
        rows="8"
        class="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-700 outline-none focus:border-primary-400 focus:bg-white"
        placeholder="화자 추론 지시 프롬프트…"
      ></textarea>
      <p class="mt-2 text-xs text-gray-400">이 프롬프트가 화자 배정 품질을 좌우합니다. 수정 후 실행해 결과를 A/B 비교하세요.</p>

      <!-- 버전 관리 -->
      <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          class="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"
          onclick={() => { showVersionList = !showVersionList }}
        >
          <svg class="h-3 w-3 transition-transform {showVersionList ? 'rotate-90' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          저장된 버전 ({filteredVersions.length})
        </button>
        {#if onResetPrompt}
          <button
            class="text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40"
            onclick={onResetPrompt}
            disabled={!isDefaultModified}
          >기본값 복원</button>
        {/if}
      </div>

      {#if showVersionList}
        {#if filteredVersions.length === 0}
          <p class="mt-2 text-center text-xs text-gray-400">저장된 버전이 없습니다</p>
        {:else}
          <div class="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {#each filteredVersions as pv}
              <button
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                onclick={() => onLoadVersion?.(pv.id)}
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-xs font-medium text-gray-700">{pv.name}</span>
                    <span class="text-xs text-gray-400">v{pv.version}</span>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-gray-400">{pv.system_prompt.slice(0, 80)}{pv.system_prompt.length > 80 ? '…' : ''}</p>
                </div>
                <svg class="h-3.5 w-3.5 shrink-0 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- 오디오 샘플 선택 + 업로드 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-label-01-normal-bold text-gray-700">오디오 샘플</p>
      <button
        class="text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700"
        onclick={() => { showUploadForm = !showUploadForm }}
      >
        {showUploadForm ? '취소' : '+ 새 샘플 업로드'}
      </button>
    </div>

    {#if showUploadForm}
      <!-- 업로드 폼 -->
      <div class="space-y-3 rounded-lg border border-primary-100 bg-primary-50/30 p-3">
        <div>
          <p class="mb-1.5 text-label-01-normal-medium text-gray-600">오디오 파일</p>
          <input
            bind:this={fileInputRef}
            type="file"
            accept="audio/*"
            class="w-full text-label-01-normal-regular text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-label-01-normal-medium file:text-white hover:file:bg-primary-700"
            onchange={handleFileSelect}
          />
          {#if uploadFile}
            <p class="mt-1 text-label-01-normal-regular text-gray-400">
              {(uploadFile.size / 1024 / 1024).toFixed(1)}MB
            </p>
          {/if}
        </div>

        <div>
          <p class="mb-1.5 text-label-01-normal-medium text-gray-600">샘플 이름</p>
          <input
            type="text"
            class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-body-03-normal-regular outline-none focus:border-primary-400"
            placeholder="예: 상담 녹음 샘플 01"
            bind:value={uploadName}
          />
        </div>

        <button
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2 text-label-01-normal-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          disabled={!uploadFile || !uploadName.trim() || isUploading}
          onclick={handleUpload}
        >
          {#if isUploading}
            <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            업로드 중...
          {:else}
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            업로드
          {/if}
        </button>
      </div>
    {:else if sampleOptions.length === 0}
      <div class="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-6">
        <div class="text-center">
          <svg class="mx-auto h-8 w-8 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <p class="mt-2 text-body-03-normal-regular text-gray-500">오디오 샘플이 없습니다</p>
          <button
            class="mt-2 text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700"
            onclick={() => { showUploadForm = true }}
          >
            첫 번째 샘플 업로드하기
          </button>
        </div>
      </div>
    {:else}
      <Select
        options={sampleOptions}
        selected={selectedSampleId}
        placeholder="오디오 샘플을 선택하세요"
        class="w-full h-10"
        on:change={(e) => {
          selectedSampleId = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail)
        }}
      />
      <p class="mt-2 text-label-01-normal-regular text-gray-400">
        {sampleOptions.length}개의 오디오 샘플
      </p>
    {/if}
  </div>

  <!-- 현재 프로덕션 설정 -->
  {#if step.isConfigured}
    <ProductionStatusBar {step} />
  {/if}

  <!-- 실행 버튼 -->
  <button
    class="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 py-3 text-body-03-normal-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={!canRun}
    onclick={onRun}
  >
    {#if isRunning}
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
      분석 중...
    {:else}
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
      테스트 실행
    {/if}
  </button>
</div>
