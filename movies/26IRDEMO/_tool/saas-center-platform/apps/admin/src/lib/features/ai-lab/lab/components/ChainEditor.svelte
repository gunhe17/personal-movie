<script lang="ts">
  import Select from '$components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import type { PipelineConfigVM } from '../../production/view-model'
  import type { PromptVersionResponse } from '$hooks/actions/aiLab.action'
  import ProductionStatusBar from './ProductionStatusBar.svelte'

  let {
    step,
    sttModel = $bindable(''),
    llmModel = $bindable(''),
    systemPrompt = $bindable(''),
    selectedSampleId = $bindable(''),
    sttModelOptions = [],
    llmModelOptions = [],
    sampleOptions = [],
    promptVersions = [],
    isRunning = false,
    isUploading = false,
    isPromptModified = false,
    loadedVersionName = '',
    onRun,
    onBack,
    onUpload,
    onSave,
    onLoadVersion,
    onImportProduction,
  }: {
    step: PipelineConfigVM
    sttModel: string
    llmModel: string
    systemPrompt: string
    selectedSampleId: string
    sttModelOptions: SelectOptionType[]
    llmModelOptions: SelectOptionType[]
    sampleOptions: SelectOptionType[]
    promptVersions: PromptVersionResponse[]
    isRunning: boolean
    isUploading?: boolean
    isPromptModified: boolean
    loadedVersionName: string
    onRun: () => void
    onBack: () => void
    onUpload: (file: File, name: string) => void
    onSave: () => void
    onLoadVersion: (id: string) => void
    onImportProduction: () => void
  } = $props()

  const canRun = $derived(sttModel && llmModel && selectedSampleId && !isRunning)
  let showVersionList = $state(false)

  const filteredVersions = $derived(
    promptVersions
      .filter((v) => v.prompt_key === step.step)
      .sort((a, b) => b.version - a.version),
  )

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
  }

  function resetUploadForm() {
    showUploadForm = false
    uploadFile = null
    uploadName = ''
    if (fileInputRef) fileInputRef.value = ''
  }

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
      <span class="rounded-full bg-violet-50 px-2 py-0.5 text-label-01-normal-bold text-violet-600">CHAIN</span>
    </div>
  </div>

  <!-- 파이프라인 플로우 표시 -->
  <div class="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/30 px-4 py-3">
    <div class="flex items-center gap-1.5">
      <span class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-label-01-normal-bold text-white">1</span>
      <span class="text-label-01-normal-medium text-gray-700">STT 화자분리</span>
    </div>
    <svg class="h-3 w-3 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
    <div class="flex items-center gap-1.5">
      <span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-label-01-normal-bold text-white">2</span>
      <span class="text-label-01-normal-medium text-gray-700">LLM 보정</span>
    </div>
    <span class="ml-auto text-label-01-normal-regular text-gray-400">자동 연결</span>
  </div>

  <!-- STT 모델 선택 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center gap-2">
      <span class="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-label-01-normal-bold text-white">1</span>
      <p class="text-label-01-normal-bold text-gray-700">STT 화자분리 모델</p>
    </div>
    <Select
      options={sttModelOptions}
      selected={sttModel}
      class="w-full h-10"
      on:change={(e) => {
        sttModel = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail)
      }}
    />
    <p class="mt-2 text-label-01-normal-regular text-gray-400">
      음성을 화자별로 구분하여 전사합니다.
    </p>
  </div>

  <!-- LLM 모델 + 시스템 프롬프트 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center gap-2">
      <span class="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-label-01-normal-bold text-white">2</span>
      <p class="text-label-01-normal-bold text-gray-700">LLM 보정 모델</p>
    </div>
    <Select
      options={llmModelOptions}
      selected={llmModel}
      class="w-full h-10"
      on:change={(e) => {
        llmModel = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail)
      }}
    />
    <p class="mt-2 text-label-01-normal-regular text-gray-400">
      전사 결과의 오탈자/어투를 자동 보정합니다.
    </p>
  </div>

  <!-- 시스템 프롬프트 (항상 표시, 버전 관리 포함) -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <p class="text-label-01-normal-bold text-gray-700 shrink-0">보정 프롬프트</p>
        {#if loadedVersionName}
          <span class="truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-medium text-gray-500">
            {loadedVersionName}
          </span>
        {/if}
        {#if isPromptModified}
          <span class="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-label-01-normal-medium text-amber-600">
            수정됨
          </span>
        {/if}
      </div>
      {#if isPromptModified}
        <button
          class="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-label-01-normal-bold text-white transition-colors hover:bg-primary-700"
          onclick={onSave}
        >
          저장
        </button>
      {/if}
    </div>
    <textarea
      class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-body-03-normal-regular leading-relaxed text-gray-700 outline-none focus:border-primary-400 focus:bg-white resize-none"
      rows="6"
      bind:value={systemPrompt}
      placeholder="화자분리 전사 보정용 시스템 프롬프트"
    ></textarea>

    <!-- 프롬프트 버전 관리 (통합) -->
    <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
      <button
        class="flex items-center gap-1 text-label-01-normal-medium text-gray-500 transition-colors hover:text-gray-700"
        onclick={() => { showVersionList = !showVersionList }}
      >
        <svg
          class="h-3 w-3 transition-transform {showVersionList ? 'rotate-90' : ''}"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        저장된 버전 ({filteredVersions.length})
      </button>
      <button
        class="text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700"
        onclick={onImportProduction}
      >
        프로덕션에서 가져오기
      </button>
    </div>

    {#if showVersionList}
      {#if filteredVersions.length === 0}
        <p class="mt-2 text-center text-label-01-normal-regular text-gray-400">저장된 버전이 없습니다</p>
      {:else}
        <div class="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {#each filteredVersions as pv}
            <button
              class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50 transition-colors"
              onclick={() => onLoadVersion(pv.id)}
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-label-01-normal-medium text-gray-700 truncate">{pv.name}</span>
                  {#if pv.is_production}
                    <span class="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-label-01-normal-bold text-emerald-600">PROD</span>
                  {/if}
                  <span class="text-label-01-normal-regular text-gray-400">v{pv.version}</span>
                </div>
                <p class="mt-0.5 truncate text-label-01-normal-regular text-gray-400">{pv.system_prompt.slice(0, 80)}{pv.system_prompt.length > 80 ? '…' : ''}</p>
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
      <div class="space-y-3 rounded-lg border border-primary-100 bg-primary-50/30 p-3">
        <div>
          <p class="mb-1.5 text-label-01-normal-medium text-gray-600">오디오 파일</p>
          <input
            bind:this={fileInputRef}
            type="file"
            accept="audio/*"
            class="w-full text-label-01-normal-regular text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-700"
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
    class="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-body-03-normal-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={!canRun}
    onclick={onRun}
  >
    {#if isRunning}
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
      STT + 보정 실행 중...
    {:else}
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
      체인 실행
    {/if}
  </button>
</div>
