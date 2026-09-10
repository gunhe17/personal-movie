<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import DivideIcon from '$lib/assets/DivideIcon.svelte'
  import type { FieldNoteListVM } from '../view-model'

  interface Props {
    item: FieldNoteListVM
    authorName: string
    onDelete: (id: string) => void
    onOpen: (id: string) => void
  }

  let { item, authorName, onDelete, onOpen }: Props = $props()
</script>

<div
  role="button"
  tabindex="0"
  onclick={() => onOpen(item.id)}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(item.id)}
  class="w-full min-w-75 rounded-2xl border border-border-subtle bg-white p-4 flex flex-col relative cursor-pointer hover:border-primary-400 hover:shadow-card-hover transition-all duration-200"
>
  <div class="flex items-start justify-between pb-3 border-b border-gray-200">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5">
        <Typography variant="title-01-semibold">
          {authorName}
        </Typography>
        <Typography variant="body-03-medium" color="text-gray-500">
          {item.statusLabel}
        </Typography>
      </div>
      <div class="flex gap-1.5 items-center">
        <Typography variant="body-02-medium" color="text-gray-500">
          {item.createdAt}
        </Typography>
        <DivideIcon height={9.64} />
        <Typography variant="body-02-medium" color="text-gray-500">
          {item.durationText}
        </Typography>
      </div>
    </div>
    <div class="flex items-center gap-1.5">
      {#if item.isLinked}
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700"
          >연결됨</span
        >
      {:else}
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500"
          >미연결</span
        >
      {/if}
    </div>
  </div>

  <div class="space-y-1 pt-3 text-sm">
    <div class="flex items-center justify-between">
      <Typography
        variant="body-01-regular"
        color="text-gray-600"
        className="shrink-0"
      >
        처리 상태
      </Typography>
      <span class="text-sm {item.processingColor}">{item.processingLabel}</span>
    </div>
    <div class="flex items-center justify-between">
      <Typography
        variant="body-01-regular"
        color="text-gray-600"
        className="shrink-0"
      >
        요약
      </Typography>
      {#if item.hasSummary}
        <Typography variant="body-01-regular" color="text-green-600">
          완료
        </Typography>
      {:else}
        <Typography variant="body-01-regular" color="text-gray-400">
          -
        </Typography>
      {/if}
    </div>
  </div>

  <div class="mt-3 pt-3 border-t border-gray-100 flex justify-end">
    <button
      class="text-xs text-red-400 hover:text-red-600 transition-colors"
      onclick={(e) => {
        e.stopPropagation()
        onDelete(item.id)
      }}
    >
      삭제
    </button>
  </div>
</div>
