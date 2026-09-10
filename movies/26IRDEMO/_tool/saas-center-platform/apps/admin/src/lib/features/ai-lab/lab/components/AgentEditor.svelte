<script lang="ts">
  import Select from '$components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import type { PipelineConfigVM } from '../../production/view-model'
  import ProductionStatusBar from './ProductionStatusBar.svelte'

  let {
    step,
    agentModel = $bindable(''),
    testInput = $bindable(''),
    modelOptions = [],
    sampleInputText = '',
    isRunning = false,
    onRun,
    onBack,
  }: {
    step: PipelineConfigVM
    agentModel: string
    testInput: string
    modelOptions: SelectOptionType[]
    sampleInputText?: string
    isRunning: boolean
    onRun: () => void
    onBack: () => void
  } = $props()

  const canRun = $derived(agentModel && testInput.trim() && !isRunning)
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
    <div class="flex items-center gap-2">
      <div>
        <p class="text-body-03-normal-semibold text-gray-900">{step.label}</p>
        <p class="text-label-01-normal-regular text-gray-400">{step.description}</p>
      </div>
      <span class="rounded-full bg-rose-50 px-2 py-0.5 text-label-01-normal-bold text-rose-600">AGENT</span>
    </div>
  </div>

  <!-- 모델 선택 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <p class="mb-2 text-label-01-normal-bold text-gray-700">에이전트 모델</p>
    <Select
      options={modelOptions}
      selected={agentModel}
      class="w-full h-10"
      on:change={(e) => {
        agentModel = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail)
      }}
    />
    <p class="mt-2 text-label-01-normal-regular text-gray-400">
      사용자 메시지를 분석하여 적절한 스킬을 선택하는 라우팅 모델입니다.
    </p>
  </div>

  <!-- 테스트 입력 -->
  <div class="rounded-2xl border border-gray-200 bg-[#FDFDFD] p-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-label-01-normal-bold text-gray-700">사용자 메시지</p>
      {#if sampleInputText && !testInput}
        <button
          class="text-label-01-normal-medium text-amber-600 transition-colors hover:text-amber-700"
          onclick={() => { testInput = sampleInputText }}
        >
          예시 채우기
        </button>
      {/if}
    </div>
    <textarea
      class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-body-03-normal-regular text-gray-700 outline-none focus:border-primary-400 focus:bg-white resize-none"
      rows="5"
      bind:value={testInput}
      placeholder="에이전트에게 보낼 사용자 메시지를 입력하세요"
    ></textarea>
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
      실행 중...
    {:else}
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
      테스트 실행
    {/if}
  </button>
</div>
