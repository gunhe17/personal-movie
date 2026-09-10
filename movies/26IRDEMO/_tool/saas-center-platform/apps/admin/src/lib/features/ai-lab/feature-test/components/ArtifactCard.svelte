<script lang="ts">
  interface TagItem { label: string; color: string }
  interface TimelineItem { label: string; value: string }
  interface TableRow { key: string; value: string }

  let {
    title,
    type,
    content = '',
    tags = [] as TagItem[],
    timelineItems = [] as TimelineItem[],
    tableRows = [] as TableRow[],
    rawJson = null as any,
    maxHeight = 'max-h-48',
    collapsible = true,
  }: {
    title: string
    type: 'text' | 'tags' | 'timeline' | 'table'
    content?: string
    tags?: TagItem[]
    timelineItems?: TimelineItem[]
    tableRows?: TableRow[]
    rawJson?: any
    maxHeight?: string
    collapsible?: boolean
  } = $props()

  let expanded = $state(false)
  let showJson = $state(false)
</script>

<div class="section-border p-4">
  <div class="mb-3 flex items-center justify-between">
    <h4 class="text-body-03-normal-medium text-gray-700">{title}</h4>
    <div class="flex items-center gap-1.5">
      {#if rawJson}
        <button
          class="rounded px-2 py-0.5 text-label-01-normal-medium transition-colors
            {showJson ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
          onclick={() => (showJson = !showJson)}
        >JSON</button>
      {/if}
      {#if collapsible && type === 'text' && content.length > 200}
        <button
          class="rounded bg-gray-100 px-2 py-0.5 text-label-01-normal-medium text-gray-500 transition-colors hover:bg-gray-200"
          onclick={() => (expanded = !expanded)}
        >{expanded ? '접기' : '펼치기'}</button>
      {/if}
    </div>
  </div>

  {#if showJson && rawJson}
    <pre class="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-label-01-normal-regular text-gray-800">{JSON.stringify(rawJson, null, 2)}</pre>
  {:else if type === 'text'}
    <div class="whitespace-pre-wrap text-body-03-normal-regular leading-relaxed text-gray-800 overflow-hidden {!expanded && collapsible ? maxHeight : ''}">{content}</div>
  {:else if type === 'tags'}
    <div class="flex flex-wrap gap-1.5">
      {#each tags as tag}
        <span class="rounded-full px-2.5 py-0.5 text-label-01-normal-medium {tag.color}">{tag.label}</span>
      {/each}
      {#if tags.length === 0}
        <span class="text-label-01-normal-regular text-gray-400">데이터 없음</span>
      {/if}
    </div>
  {:else if type === 'timeline'}
    <div class="space-y-2">
      {#each timelineItems as item}
        <div class="flex items-start gap-3">
          <span class="mt-0.5 shrink-0 text-label-01-normal-medium text-gray-500">{item.label}</span>
          <span class="text-body-03-normal-regular text-gray-800">{item.value}</span>
        </div>
      {/each}
      {#if timelineItems.length === 0}
        <span class="text-label-01-normal-regular text-gray-400">데이터 없음</span>
      {/if}
    </div>
  {:else if type === 'table'}
    <div class="overflow-hidden rounded-lg border border-gray-100">
      <table class="w-full">
        {#each tableRows as row, i}
          <tr class={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td class="px-3 py-2 text-label-01-normal-medium text-gray-600">{row.key}</td>
            <td class="px-3 py-2 text-label-01-normal-regular text-gray-800">{row.value}</td>
          </tr>
        {/each}
      </table>
      {#if tableRows.length === 0}
        <div class="px-3 py-3 text-label-01-normal-regular text-gray-400">데이터 없음</div>
      {/if}
    </div>
  {/if}
</div>
