<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getScheduleList } from '$lib/hooks/actions/schedule.action'
  import { centerId } from '$lib/stores/center.store'

  interface Props {
    closeModal?: () => void
    onConfirm?: (scheduleId: string) => void | Promise<void>
  }

  let { closeModal, onConfirm }: Props = $props()

  // 과거 4주 ~ 미래 2주 범위의 상담/검사 일정 조회
  const dateRange = $derived.by(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 28)
    const end = new Date(now)
    end.setDate(end.getDate() + 14)
    return {
      start: start.toISOString(),
      end: end.toISOString()
    }
  })

  const schedulesQuery = $derived(
    queryBuilder(getScheduleList, () =>
      $centerId
        ? {
            center_id: $centerId,
            start_date: dateRange.start,
            end_date: dateRange.end,
            counselor_ids: [],
            client_ids: [],
            schedule_types: ['counseling', 'assessment']
          }
        : null
    )
  )

  const items = $derived(schedulesQuery.data ?? [])
  const isLoading = $derived(schedulesQuery.isLoading)

  let selectedId = $state<string | null>(null)
  let isSubmitting = $state(false)

  function formatScheduleDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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
</script>

<div class="flex flex-col gap-4 p-5">
  <div>
    <Typography variant="title-01-semibold" color="text-gray-900">
      일정 연결
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-1"
    >
      이 필드노트를 연결할 일정을 선택하세요.
    </Typography>
  </div>

  <div class="max-h-[60vh] overflow-y-auto -mx-1 px-1">
    {#if isLoading}
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        불러오는 중...
      </Typography>
    {:else if items.length === 0}
      <div class="py-10 text-center">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          연결 가능한 일정이 없어요.
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
                <div class="flex items-center gap-2">
                  <Typography
                    variant="body-01-normal-semibold"
                    color="text-gray-800"
                  >
                    {formatScheduleDate(item.start)}
                  </Typography>
                  <span
                    class="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs {item.schedule_type ===
                    'counseling'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-purple-50 text-purple-600'}"
                  >
                    {item.schedule_type === 'counseling' ? '상담' : '검사'}
                  </span>
                </div>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                >
                  {item.counselor_name}{item.client_names?.length
                    ? ` · ${item.client_names.join(', ')}`
                    : ''}
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
      onclick={() => closeModal?.()}
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
