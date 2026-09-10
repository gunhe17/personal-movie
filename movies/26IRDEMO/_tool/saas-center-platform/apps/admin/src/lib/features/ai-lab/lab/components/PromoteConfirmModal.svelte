<script lang="ts">
  import { formatDateKST } from '../../constants'
  import type { PipelineConfigVM } from '../../production/view-model'
  import {
    getProductionConfigHistory,
    rollbackProductionConfig,
    type ProductionAIConfigResponse,
  } from '$hooks/actions/aiLab.action'
  import { snackbarStore } from '$stores/snackbar'

  interface PromoteTarget {
    model: string
    systemPrompt: string
    versionName?: string
    score?: number
  }

  let {
    open = false,
    step,
    target,
    onConfirm,
    onClose,
  }: {
    open: boolean
    step: PipelineConfigVM
    target: PromoteTarget
    onConfirm: () => void
    onClose: () => void
  } = $props()

  let history = $state<ProductionAIConfigResponse[]>([])
  let showHistory = $state(false)
  let isLoadingHistory = $state(false)
  let isRollingBack = $state(false)

  const modelChanged = $derived(step.raw?.model_name !== target.model)
  const promptChanged = $derived(
    step.raw?.system_prompt !== target.systemPrompt &&
    !!target.systemPrompt
  )
  const hasChanges = $derived(modelChanged || promptChanged || !step.isConfigured)

  async function loadHistory() {
    if (history.length > 0) {
      showHistory = !showHistory
      return
    }
    isLoadingHistory = true
    try {
      history = await getProductionConfigHistory().request({
        pipeline_step: step.step,
        module: step.module,
      })
      showHistory = true
    } catch {
      snackbarStore.error('이력 조회에 실패했습니다.')
    } finally {
      isLoadingHistory = false
    }
  }

  async function handleRollback(configId: string) {
    if (!confirm('이 설정으로 롤백하시겠습니까?')) return
    isRollingBack = true
    try {
      await rollbackProductionConfig().request({ configId })
      snackbarStore.success('롤백이 완료되었습니다.')
      onClose()
    } catch {
      snackbarStore.error('롤백에 실패했습니다.')
    } finally {
      isRollingBack = false
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-xl" onclick={(e) => e.stopPropagation()}>
      <!-- 헤더 -->
      <div class="border-b border-gray-100 px-6 py-4">
        <h3 class="text-body-03-normal-semibold text-gray-900">프로덕션 반영 확인</h3>
        <p class="mt-0.5 text-label-01-normal-regular text-gray-500">{step.label} 단계의 설정을 변경합니다.</p>
      </div>

      <!-- 비교 -->
      <div class="space-y-4 px-6 py-5">
        <!-- 모델 비교 -->
        <div>
          <p class="mb-1.5 text-label-01-normal-bold uppercase tracking-wider text-gray-400">모델</p>
          <div class="flex items-center gap-2">
            <span class="rounded-md bg-gray-100 px-2 py-1 font-mono text-label-01-normal-regular text-gray-600">
              {step.isConfigured ? step.modelName : '(기본값)'}
            </span>
            <svg class="h-3.5 w-3.5 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            <span class="rounded-md px-2 py-1 font-mono text-label-01-normal-regular {modelChanged ? 'bg-amber-50 text-amber-700 font-semibold' : 'bg-gray-100 text-gray-600'}">
              {target.model}
            </span>
            {#if modelChanged}
              <span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-label-01-normal-medium text-amber-600">변경</span>
            {/if}
          </div>
        </div>

        <!-- 프롬프트 비교 (LLM만) -->
        {#if target.systemPrompt}
          <div>
            <p class="mb-1.5 text-label-01-normal-bold uppercase tracking-wider text-gray-400">시스템 프롬프트</p>
            {#if promptChanged}
              <div class="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-label-01-normal-medium text-amber-600">변경됨</span>
                  {#if target.versionName}
                    <span class="rounded-md bg-primary-50 px-1.5 py-0.5 text-label-01-normal-medium text-primary-600">{target.versionName}</span>
                  {/if}
                </div>
                <p class="text-label-01-normal-regular text-gray-600 line-clamp-3">{target.systemPrompt.slice(0, 200)}{target.systemPrompt.length > 200 ? '...' : ''}</p>
              </div>
            {:else}
              <p class="text-label-01-normal-regular text-gray-500">변경 없음</p>
            {/if}
          </div>
        {/if}

        <!-- 현재 설정 정보 -->
        {#if step.isConfigured && step.promotedAt !== '-'}
          <div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p class="text-label-01-normal-bold uppercase tracking-wider text-gray-400 mb-1">현재 프로덕션</p>
            <p class="text-label-01-normal-regular text-gray-600">마지막 반영: {step.promotedAt}</p>
            {#if step.description_text}
              <p class="mt-0.5 text-label-01-normal-regular text-gray-500">{step.description_text}</p>
            {/if}
          </div>
        {:else}
          <div class="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <p class="text-label-01-normal-regular text-emerald-700">최초 프로덕션 설정입니다. 기본 하드코딩 프롬프트를 대체합니다.</p>
          </div>
        {/if}
      </div>

      <!-- 이력 -->
      <div class="border-t border-gray-100 px-6 py-3">
        <button
          class="text-label-01-normal-regular text-gray-500 transition-colors hover:text-gray-700"
          onclick={loadHistory}
          disabled={isLoadingHistory}
        >
          {isLoadingHistory ? '불러오는 중...' : showHistory ? '이력 닫기' : '승격 이력 보기'}
        </button>

        {#if showHistory && history.length > 0}
          <div class="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
            {#each history.slice(0, 5) as h}
              <div class="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-label-01-normal-regular text-gray-600">{h.model_name}</span>
                    {#if h.is_active}
                      <span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-label-01-normal-medium text-emerald-600">현재</span>
                    {/if}
                  </div>
                  <p class="text-label-01-normal-regular text-gray-400">
                    {h.promoted_at ? formatDateKST(h.promoted_at) : h.created_at ? formatDateKST(h.created_at) : '-'}
                    {#if h.description}
                      · {h.description}
                    {/if}
                  </p>
                </div>
                {#if !h.is_active}
                  <button
                    class="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-label-01-normal-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    onclick={() => handleRollback(h.id)}
                    disabled={isRollingBack}
                  >롤백</button>
                {/if}
              </div>
            {/each}
          </div>
        {:else if showHistory}
          <p class="mt-2 text-label-01-normal-regular text-gray-400">이력이 없습니다.</p>
        {/if}
      </div>

      <!-- 액션 -->
      <div class="flex gap-2 border-t border-gray-100 px-6 py-4">
        <button
          class="flex-1 rounded-xl border border-gray-200 py-2.5 text-body-03-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
          onclick={onClose}
        >취소</button>
        <button
          class="flex-1 rounded-xl bg-emerald-600 py-2.5 text-body-03-normal-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          disabled={!hasChanges && step.isConfigured}
          onclick={onConfirm}
        >
          {#if !hasChanges && step.isConfigured}
            변경사항 없음
          {:else}
            프로덕션 반영
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
