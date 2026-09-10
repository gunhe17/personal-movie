<script lang="ts">
  import type { PromptVersionResponse } from '$hooks/actions/aiLab.action'

  let {
    versions = [],
    currentStep = '',
    onLoad,
    onImport,
  }: {
    versions: PromptVersionResponse[]
    currentStep: string
    onLoad: (id: string) => void
    onImport: () => void
  } = $props()

  const filtered = $derived(
    versions
      .filter((v) => v.prompt_key === currentStep)
      .sort((a, b) => b.version - a.version),
  )
</script>

<div class="rounded-xl border border-gray-200 bg-white p-4">
  <div class="flex items-center justify-between">
    <p class="text-label-01-normal-bold text-gray-700">프롬프트 버전</p>
    <button
      class="text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700"
      onclick={onImport}
    >
      프로덕션에서 가져오기
    </button>
  </div>

  {#if filtered.length === 0}
    <p class="mt-3 text-center text-label-01-normal-regular text-gray-400">저장된 버전이 없습니다</p>
  {:else}
    <div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
      {#each filtered as pv}
        <button
          class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50 transition-colors"
          onclick={() => onLoad(pv.id)}
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-label-01-normal-medium text-gray-700 truncate">{pv.name}</span>
              {#if pv.is_production}
                <span class="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-label-01-normal-bold text-emerald-600">PROD</span>
              {/if}
            </div>
            <p class="text-label-01-normal-regular text-gray-400">v{pv.version}</p>
          </div>
          <svg class="h-3.5 w-3.5 shrink-0 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      {/each}
    </div>
  {/if}
</div>
