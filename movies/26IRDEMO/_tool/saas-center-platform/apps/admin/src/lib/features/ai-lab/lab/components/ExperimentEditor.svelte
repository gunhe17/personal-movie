<script lang="ts">
  import Select from '$components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import type { PipelineConfigVM } from '../../production/view-model'
  import type { PromptVersionResponse } from '$hooks/actions/aiLab.action'
  import ProductionStatusBar from './ProductionStatusBar.svelte'

  interface RecentResult {
    id: string
    label: string
    text: string
  }

  let {
    step,
    editPrompt = $bindable(''),
    editModel = $bindable(''),
    testInput = $bindable(''),
    modelOptions = [],
    recentResults = [],
    promptVersions = [],
    sampleInputText = '',
    isRunning = false,
    isPromptModified = false,
    loadedVersionName = '',
    onRun,
    onSave,
    onLoadVersion,
    onImportProduction,
    onBack,
  }: {
    step: PipelineConfigVM
    editPrompt: string
    editModel: string
    testInput: string
    modelOptions: SelectOptionType[]
    recentResults: RecentResult[]
    promptVersions: PromptVersionResponse[]
    sampleInputText?: string
    isRunning: boolean
    isPromptModified: boolean
    loadedVersionName: string
    onRun: () => void
    onSave: () => void
    onLoadVersion: (id: string) => void
    onImportProduction: () => void
    onBack: () => void
  } = $props()

  let showRecentPicker = $state(false)
  let showVersionList = $state(false)

  const filteredVersions = $derived(
    promptVersions
      .filter((v) => v.prompt_key === step.step)
      .sort((a, b) => b.version - a.version),
  )
</script>

<div class="flex flex-col gap-4">
  <!-- 상단: 뒤로가기 + 현재 스텝 -->
  <div class="flex items-center gap-3">
    <button
      class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
      onclick={onBack}
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
    </button>
    <div>
      <p class="text-body-03-normal-semibold text-gray-900">{step.label}</p>
      <p class="text-label-01-normal-regular text-gray-400">{step.description}</p>
    </div>
  </div>

  <!-- 모델 선택 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <p class="mb-2 text-label-01-normal-bold text-gray-700">모델 선택</p>
    <Select
      options={modelOptions}
      selected={editModel}
      class="w-full h-10"
      on:change={(e) => {
        editModel = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail)
      }}
    />
  </div>

  <!-- 시스템 프롬프트 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <p class="text-label-01-normal-bold text-gray-700 shrink-0">시스템 프롬프트</p>
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
      rows="8"
      bind:value={editPrompt}
      placeholder="시스템 프롬프트를 입력하세요..."
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

  <!-- 테스트 입력 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-label-01-normal-bold text-gray-700">테스트 입력</p>
      <div class="flex items-center gap-2">
        {#if sampleInputText && !testInput}
          <button
            class="text-label-01-normal-medium text-amber-600 transition-colors hover:text-amber-700"
            onclick={() => { testInput = sampleInputText }}
          >
            예시 채우기
          </button>
        {/if}
        {#if recentResults.length > 0}
          <button
            class="text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700"
            onclick={() => { showRecentPicker = !showRecentPicker }}
          >
            {showRecentPicker ? '닫기' : '이전 결과 불러오기'}
          </button>
        {/if}
      </div>
    </div>

    {#if showRecentPicker}
      <div class="mb-3 space-y-1.5 rounded-lg border border-primary-100 bg-primary-50/30 p-2.5">
        <p class="text-label-01-normal-medium text-gray-500">최근 실험 결과를 입력으로 사용</p>
        {#each recentResults as result}
          <button
            class="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/50"
            onclick={() => {
              testInput = result.text
              showRecentPicker = false
            }}
          >
            <span class="min-w-0 flex-1 truncate text-label-01-normal-regular text-gray-700">{result.label}</span>
            <span class="shrink-0 text-label-01-normal-regular text-primary-500">사용</span>
          </button>
        {/each}
      </div>
    {/if}

    <textarea
      class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-body-03-normal-regular text-gray-700 outline-none focus:border-primary-400 focus:bg-white resize-none"
      rows="5"
      bind:value={testInput}
      placeholder="실제 상담 녹취록이나 텍스트를 붙여넣으세요"
    ></textarea>
  </div>

  <!-- 현재 프로덕션 설정 -->
  {#if step.isConfigured}
    <ProductionStatusBar {step} />
  {/if}

  <!-- 실행 버튼 -->
  <button
    class="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 py-3 text-body-03-normal-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={!editPrompt || !testInput || !editModel || isRunning}
    onclick={onRun}
  >
    {#if isRunning}
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
      실행 중...
    {:else}
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
      테스트 실행
    {/if}
  </button>
</div>
