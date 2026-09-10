<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getUnlinkedFieldNotes } from '$lib/hooks/actions/field-note.action'
  import { centerId } from '$lib/stores/center.store'
  import { buildUnlinkedFieldNotes } from '$lib/features/field-note/query-builders'
  import { formatDuration } from '$lib/features/field-note/view-model'
  import { formatUtcToKst } from '$lib/utils/date'

  interface Props {
    closeModal?: () => void
    onConfirm?: (fieldNoteId: string) => void | Promise<void>
  }

  let { closeModal, onConfirm }: Props = $props()

  const unlinkedQuery = queryBuilder(getUnlinkedFieldNotes, () =>
    buildUnlinkedFieldNotes($centerId)
  )

  let selectedId = $state<string | null>(null)
  let isSubmitting = $state(false)

  async function handleConfirm() {
    if (!selectedId) return
    isSubmitting = true
    try {
      await onConfirm?.(selectedId)
      closeModal?.()
    } finally {
      isSubmitting = false
    }
  }

  function handleCancel() {
    closeModal?.()
  }

  const items = $derived(unlinkedQuery.data ?? [])
  const isLoading = $derived(unlinkedQuery.isLoading)
</script>

<div class="flex flex-col gap-4 p-5">
  <div>
    <Typography variant="title-01-semibold" color="text-gray-900">
      미연결 필드노트 연결
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-1"
    >
      이 회기에 연결할 필드노트를 선택하세요.
    </Typography>
  </div>

  <div class="min-h-[280px] max-h-[60vh] overflow-y-auto -mx-1 px-1">
    {#if isLoading}
      <ul class="space-y-2" aria-busy="true" aria-label="불러오는 중">
        {#each Array(3) as _, i (i)}
          <li
            class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div class="flex w-full flex-col gap-2">
              <div class="h-4 w-32 animate-pulse rounded bg-gray-200"></div>
              <div class="h-3 w-48 animate-pulse rounded bg-gray-100"></div>
            </div>
          </li>
        {/each}
      </ul>
    {:else if items.length === 0}
      <div
        class="flex h-full min-h-[280px] items-center justify-center py-10 text-center"
      >
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          미연결 필드노트가 없어요.
        </Typography>
      </div>
    {:else}
      <ul class="space-y-2">
        {#each items as item (item.id)}
          <li>
            <button
              type="button"
              onclick={() => (selectedId = item.id)}
              class="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors {selectedId ===
              item.id
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'}"
            >
              <div class="flex flex-col gap-0.5">
                <Typography
                  variant="body-01-normal-semibold"
                  color="text-gray-800"
                >
                  {formatUtcToKst(item.created_at, 'YYYY-MM-DD HH:mm')}
                </Typography>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                >
                  총 {formatDuration(item.total_duration)} · {item.processing_status}
                </Typography>
              </div>
              {#if selectedId === item.id}
                <span class="h-4 w-4 rounded-full bg-primary-500"></span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="flex justify-end gap-2 pt-2">
    <button
      type="button"
      onclick={handleCancel}
      class="h-11 rounded-lg border border-gray-300 bg-white px-4 text-body-01-normal-medium text-gray-700 hover:bg-gray-50"
    >
      취소
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!selectedId || isSubmitting}
      class="h-11 rounded-lg px-4 text-body-01-normal-medium text-white {selectedId &&
      !isSubmitting
        ? 'bg-primary-500 hover:bg-primary-600'
        : 'cursor-not-allowed bg-primary-300'}"
    >
      연결
    </button>
  </div>
</div>
