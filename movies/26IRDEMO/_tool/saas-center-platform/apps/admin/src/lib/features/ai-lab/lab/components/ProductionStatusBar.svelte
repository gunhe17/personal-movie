<script lang="ts">
  import type { PipelineConfigVM } from '../../production/view-model'
  import { formatDateKST } from '../../constants'
  import {
    getProductionConfigHistory,
    rollbackProductionConfig,
    type ProductionAIConfigResponse,
  } from '$hooks/actions/aiLab.action'
  import { snackbarStore } from '$stores/snackbar'

  let {
    step,
  }: {
    step: PipelineConfigVM
  } = $props()

  let history = $state<ProductionAIConfigResponse[]>([])
  let showHistory = $state(false)
  let isLoadingHistory = $state(false)
  let isRollingBack = $state(false)

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
      // 이력 갱신
      history = []
      showHistory = false
    } catch {
      snackbarStore.error('롤백에 실패했습니다.')
    } finally {
      isRollingBack = false
    }
  }
</script>

<div class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-label-01-normal-bold uppercase tracking-wider text-emerald-600">현재 프로덕션 설정</p>
      <div class="mt-1.5 flex items-center gap-2">
        <span class="rounded-md bg-white px-2 py-0.5 text-label-01-normal-regular font-mono text-gray-700">{step.modelLabel}</span>
        {#if step.promotedAt !== '-'}
          <span class="text-label-01-normal-regular text-gray-400">반영: {step.promotedAt}</span>
        {/if}
      </div>
    </div>
    <button
      class="text-label-01-normal-medium text-emerald-600 transition-colors hover:text-emerald-700"
      onclick={loadHistory}
      disabled={isLoadingHistory}
    >
      {isLoadingHistory ? '불러오는 중...' : showHistory ? '이력 닫기' : '승격 이력'}
    </button>
  </div>

  {#if showHistory}
    <div class="mt-3 border-t border-emerald-100 pt-3">
      {#if history.length === 0}
        <p class="text-label-01-normal-regular text-gray-400">이력이 없습니다.</p>
      {:else}
        <div class="max-h-40 space-y-1.5 overflow-y-auto">
          {#each history.slice(0, 5) as h}
            <div class="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
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
      {/if}
    </div>
  {/if}
</div>
