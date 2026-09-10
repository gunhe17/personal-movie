<script lang="ts">
  import { slide, fly } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'

  import Typography from '@common/components/Typography.svelte'
  import {
    COUNT_TONE,
    ROW_ACTION_TONE,
    type DashboardSignal,
    type SignalRowFollowUp
  } from '$lib/features/dashboard/signals/constants'

  // 시그널을 목록 페이지로 넘기지 않고 여기서 펼쳐 처리한다.
  // onOpenList = '전체 목록에서 보기'(큐 순회 시작) — 행이 더 있을 때의 탈출구.
  let {
    signals,
    onOpenList
  }: {
    signals: DashboardSignal[]
    onOpenList: (signal: DashboardSignal, index: number) => void
  } = $props()

  let expandedId = $state<string | null>(null)
  // 처리한 행 — 서버 재조회 전까지 목록에서 즉시 빼 둔다
  let handled = $state<Set<string>>(new Set())
  // 처리했지만 이어질 행동이 남은 행 — 자리를 지키고 후속 액션으로 바뀐다
  let followUps = $state<Record<string, SignalRowFollowUp>>({})
  let running = $state<string | null>(null)

  const visibleRows = (signal: DashboardSignal) =>
    signal.rows.filter((row) => !handled.has(row.id))

  // 후속 액션 대기 중인 행도 '처리됨'으로 세어 배지 숫자가 즉시 줄게 한다
  const handledCount = (signal: DashboardSignal) =>
    signal.rows.filter((row) => handled.has(row.id) || followUps[row.id]).length

  const remaining = (signal: DashboardSignal) =>
    Math.max(0, signal.count - handledCount(signal))

  function toggle(signal: DashboardSignal, index: number) {
    if (signal.rows.length === 0) {
      onOpenList(signal, index)
      return
    }
    expandedId = expandedId === signal.id ? null : signal.id
  }

  async function runAction(
    rowId: string,
    run: () => Promise<boolean | SignalRowFollowUp>
  ) {
    if (running) return
    running = rowId
    try {
      const result = await run()
      if (result === true) {
        handled = new Set([...handled, rowId])
        const { [rowId]: _done, ...rest } = followUps
        followUps = rest
      } else if (result !== false) {
        followUps = { ...followUps, [rowId]: result }
      }
    } finally {
      running = null
    }
  }
</script>

<div
  class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
>
  {#each signals as signal, i (signal.id)}
    {@const rows = visibleRows(signal)}
    {@const left = remaining(signal)}
    <div class="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onclick={() => toggle(signal, i)}
        aria-expanded={expandedId === signal.id}
        class="flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span
          class="flex h-6 min-w-9 shrink-0 items-center justify-center rounded-full px-2 text-label-01-normal-bold {COUNT_TONE[
            signal.tone
          ]}"
        >
          {left}{signal.unit}
        </span>
        <Typography
          variant="body-01-normal-medium"
          color="text-gray-800"
          className="min-w-0 flex-1 truncate-safe"
        >
          {signal.noun}
        </Typography>
        <span
          class="shrink-0 text-gray-300 transition-transform duration-300"
          class:rotate-180={expandedId === signal.id}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>

      {#if expandedId === signal.id}
        <div
          transition:slide={{ duration: 300, easing: cubicOut }}
          class="bg-gray-50/70 px-5 pb-3.5 pt-0.5"
        >
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="block py-2"
          >
            {signal.why}
          </Typography>

          {#if rows.length === 0}
            <div
              in:fly={{ y: 6, duration: 260 }}
              class="rounded-lg bg-white px-4 py-5 text-center ring-1 ring-inset ring-gray-200"
            >
              <Typography variant="body-02-normal-medium" color="text-gray-600">
                {left > 0 ? '여기 있던 건 다 정리했어요' : '정리 완료!'}
              </Typography>
            </div>
          {:else}
            <div class="flex flex-col gap-1.5">
              {#each rows as row, rowIndex (row.id)}
                {@const followUp = followUps[row.id]}
                <div
                  animate:flip={{ duration: 260, easing: cubicOut }}
                  in:fly={{ y: 8, duration: 260, delay: 40 * rowIndex }}
                  out:slide={{ duration: 220, easing: cubicOut }}
                  class="flex items-center gap-3 rounded-lg px-4 py-2.5 ring-1 ring-inset transition-colors duration-300 {followUp
                    ? 'bg-green-50/60 ring-green-200'
                    : 'bg-white ring-gray-200'}"
                  class:opacity-50={running === row.id}
                >
                  <div class="min-w-0 flex-1">
                    <Typography
                      variant="body-02-normal-medium"
                      color={followUp ? 'text-gray-600' : 'text-gray-800'}
                      className="block truncate-safe"
                    >
                      {row.title}
                    </Typography>
                    {#if followUp}
                      <Typography
                        variant="body-03-normal-regular"
                        color="text-green-700"
                        className="mt-0.5 block truncate-safe"
                      >
                        {followUp.note}
                      </Typography>
                    {:else}
                      <Typography
                        variant="body-03-normal-regular"
                        color="text-gray-500"
                        className="mt-0.5 block truncate-safe"
                      >
                        {row.meta}
                      </Typography>
                    {/if}
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    {#each followUp?.actions ?? row.actions as action (action.label)}
                      <button
                        type="button"
                        disabled={!!running}
                        onclick={() => runAction(row.id, action.run)}
                        class="h-8 rounded-lg bg-white px-2.5 text-body-03-normal-medium transition-colors disabled:opacity-40 {ROW_ACTION_TONE[
                          action.tone
                        ]}"
                      >
                        {action.label}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if left > rows.length}
            <button
              type="button"
              onclick={() => onOpenList(signal, i)}
              class="mt-2 h-8 rounded-lg px-2.5 text-body-03-normal-medium text-gray-500 ring-1 ring-inset ring-transparent transition-colors hover:ring-gray-200"
            >
              나머지 {left - rows.length}{signal.unit} 목록에서 보기 →
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>
