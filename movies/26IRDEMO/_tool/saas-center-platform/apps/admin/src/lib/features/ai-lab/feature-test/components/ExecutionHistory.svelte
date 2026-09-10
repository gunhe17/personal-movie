<script lang="ts">
  import { EXECUTION_STATUS_STYLES } from '../constants'
  import type { ExecutionLogEntry } from '../view-model'

  let { entries, onClear }: { entries: ExecutionLogEntry[]; onClear?: () => void } = $props()

  let expandedId = $state<string | null>(null)
  let jsonExpandedId = $state<string | null>(null)

  function formatTime(iso: string): string {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }
</script>

<section class="section-border px-6 py-5">
  <div class="mb-3 flex items-center justify-between">
    <h3 class="text-body-03-normal-medium text-gray-900">실행 이력</h3>
    {#if entries.length > 0 && onClear}
      <button class="text-label-01-normal-regular text-gray-400 hover:text-gray-600 transition-colors" onclick={onClear}>초기화</button>
    {/if}
  </div>

  {#if entries.length === 0}
    <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
      <p class="text-body-03-normal-regular text-gray-400">아직 실행 이력이 없습니다.</p>
    </div>
  {:else}
    <div class="space-y-1.5 max-h-[400px] overflow-y-auto">
      {#each entries as entry (entry.id)}
        {@const styles = EXECUTION_STATUS_STYLES[entry.status] ?? EXECUTION_STATUS_STYLES.error}
        <div class="rounded-lg transition-colors hover:bg-gray-50 {expandedId === entry.id ? 'bg-gray-50' : ''}">
          <button class="w-full px-4 py-2.5 text-left" onclick={() => (expandedId = expandedId === entry.id ? null : entry.id)}>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <span class="rounded-full px-2 py-0.5 text-label-01-normal-medium {styles.badge}">
                  {entry.status === 'success' ? '성공' : entry.status === 'error' ? '실패' : '실행 중'}
                </span>
                <span class="text-body-03-normal-medium text-gray-700 truncate">{entry.featureName}</span>
                <span class="text-label-01-normal-regular text-gray-400">{entry.action}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                {#if entry.creditsUsed}
                  <span class="text-label-01-normal-medium tabular-nums text-red-500">-{entry.creditsUsed}</span>
                {/if}
                <span class="text-label-01-normal-regular tabular-nums text-gray-400">{formatTime(entry.timestamp)}</span>
                <svg class="h-4 w-4 text-gray-400 transition-transform {expandedId === entry.id ? 'rotate-90' : ''}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
              </div>
            </div>
          </button>

          {#if expandedId === entry.id && (entry.preview || entry.model || entry.rawJson)}
            <div class="px-4 pb-3 space-y-1 border-t border-gray-100 mx-4 pt-2">
              {#if entry.model}
                <p class="text-label-01-normal-regular text-gray-400">모델: <span class="text-gray-600">{entry.model}</span></p>
              {/if}
              {#if entry.preview}
                <p class="text-label-01-normal-regular text-gray-600 line-clamp-3">{entry.preview}</p>
              {/if}
              {#if entry.rawJson}
                <button
                  class="mt-1 flex items-center gap-1 text-label-01-normal-regular text-gray-400 hover:text-gray-600 transition-colors"
                  onclick={(e) => { e.stopPropagation(); jsonExpandedId = jsonExpandedId === entry.id ? null : entry.id }}
                >
                  <svg class="h-3 w-3 transition-transform {jsonExpandedId === entry.id ? 'rotate-90' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
                  JSON 원본
                </button>
                {#if jsonExpandedId === entry.id}
                  <pre class="mt-1 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-label-01-normal-regular text-gray-600">{JSON.stringify(entry.rawJson, null, 2)}</pre>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
