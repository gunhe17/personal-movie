<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getBillableTargetsByClient,
    type BillableTarget,
    type BillableTargetType
  } from '$lib/hooks/actions/billable.action'
  import Counsel24Icon from '$lib/assets/Counsel24Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import { scale } from 'svelte/transition'
  import { backOut } from 'svelte/easing'
  import { formatUtcToKst } from '$lib/utils/date'

  interface Props {
    centerId: string | null
    clientId: string | null
    /** 선택된 대상 키 — session_id 우선, 세션 없으면 case_id */
    selectedKey: string | null
    onSelect: (target: BillableTarget | null) => void
    disabled?: boolean
  }

  let {
    centerId,
    clientId,
    selectedKey,
    onSelect,
    disabled = false
  }: Props = $props()

  // 대상 고유 키 (세션 있으면 session_id, 없으면 case_id)
  const targetKey = (t: BillableTarget): string => t.session_id ?? t.case_id

  const PAGE_SIZE = 6

  let typeFilter = $state<'all' | BillableTargetType>('all')
  let page = $state(1)

  const query = $derived(
    queryBuilder(getBillableTargetsByClient, () => ({
      centerId,
      clientId,
      type: typeFilter,
      page,
      size: PAGE_SIZE,
      includeBilled: false
    }))
  )

  const items = $derived(query.data?.items ?? [])
  const counts = $derived(
    query.data?.total_counts ?? { all: 0, assessment: 0, counseling: 0 }
  )
  const totalPages = $derived(query.data?.pages ?? 0)
  const isLoading = $derived(query.isLoading)

  function changeType(next: 'all' | BillableTargetType) {
    if (typeFilter === next) return
    typeFilter = next
    page = 1
  }

  function goToPage(next: number) {
    if (next < 1 || next > totalPages) return
    page = next
  }

  function formatScheduledAt(iso: string | null, hasSession: boolean): string {
    // 세션 자체가 없는 케이스(일정 없이 접수된 검사) → 온라인 접수
    if (!hasSession) return '온라인 접수'
    if (!iso) return '일정 미정'
    return formatUtcToKst(iso, 'YYYY-MM-DD HH:mm') || '일정 미정'
  }

  function handleClick(target: BillableTarget) {
    if (targetKey(target) === selectedKey) {
      // 동일 항목 재클릭 → 해제
      onSelect(null)
    } else {
      onSelect(target)
    }
  }
</script>

<div class="flex flex-col gap-3">
  <!-- 헤더: 타입 탭 + 해제 -->
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
      {#each [{ key: 'all', label: '전체', count: counts.all }, { key: 'counseling', label: '상담', count: counts.counseling }, { key: 'assessment', label: '검사', count: counts.assessment }] as tab (tab.key)}
        <button
          type="button"
          class="h-7 rounded-md px-3 text-xs font-medium transition
            {typeFilter === tab.key
            ? 'bg-white text-gray-800 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}"
          onclick={() => changeType(tab.key as typeof typeFilter)}
          {disabled}
        >
          {tab.label} <span class="ml-0.5 text-gray-400">{tab.count}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 리스트 -->
  {#if !clientId}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8"
    >
      <Typography variant="body-02-normal-regular" color="text-gray-400">
        내담자를 먼저 선택해주세요
      </Typography>
    </div>
  {:else if isLoading}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8"
    >
      <Typography variant="body-02-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if items.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8"
    >
      <Typography variant="body-02-normal-regular" color="text-gray-400">
        청구 가능한 상담/검사 일정이 없어요
      </Typography>
    </div>
  {:else}
    <div class="rounded-lg bg-gray-50 p-3">
      <div class="grid grid-cols-2 gap-2">
        {#each items as target (`${targetKey(target)}:${target.client_id ?? ''}`)}
          {@const isSelected = targetKey(target) === selectedKey}
          {@const isCounseling = target.type === 'counseling'}
          <button
            type="button"
            onclick={() => handleClick(target)}
            style:--accent={isCounseling ? '#F3BF21' : '#0478ED'}
            style:--accent-bg={isCounseling ? '#FFFBEB' : '#EFF6FF'}
            class="group relative flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all duration-200 ease-out
              {isSelected
              ? 'scale-[1.01] border-(--accent) bg-(--accent-bg) shadow-sm ring-1 ring-(--accent)'
              : 'scale-100 border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}"
          >
            <!-- 타입 아이콘 -->
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              {#if isCounseling}
                <Counsel24Icon />
              {:else}
                <AssessmentStack />
              {/if}
            </span>

            <!-- 본문 -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                {#if target.case_code}
                  <span
                    class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-label-02-normal-medium text-gray-600"
                  >
                    {target.case_code}
                  </span>
                {/if}
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-900"
                  tag="span"
                  className="block truncate-safe"
                >
                  {target.title}
                </Typography>
                {#if target.status === 'no_show'}
                  <span
                    class="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-label-02-normal-medium text-amber-700"
                  >
                    노쇼
                  </span>
                {/if}
              </div>
              <div
                class="mt-0.5 truncate-safe text-body-03-normal-regular text-gray-500"
              >
                {formatScheduledAt(
                  target.scheduled_at,
                  target.session_id !== null
                )}
                {#if target.subtitle}
                  <span class="text-gray-300"> · </span>{target.subtitle}
                {/if}
              </div>
            </div>

            <!-- 선택 체크 -->
            {#if isSelected}
              <span
                transition:scale={{
                  duration: 200,
                  start: 0.5,
                  easing: backOut
                }}
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--accent) text-caption-01-normal-medium text-white"
                aria-label="선택됨"
              >
                ✓
              </span>
            {/if}
          </button>
        {/each}
      </div>

      {#if totalPages > 1}
        <div class="mt-3 flex items-center justify-center gap-1">
          <button
            type="button"
            class="h-7 rounded-md px-2 text-xs text-gray-600 hover:bg-white disabled:text-gray-300 disabled:hover:bg-transparent"
            onclick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            이전
          </button>
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p (p)}
            <button
              type="button"
              class="h-7 min-w-7 rounded-md px-2 text-xs font-medium transition
                {p === page
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:bg-white hover:text-gray-700'}"
              onclick={() => goToPage(p)}
            >
              {p}
            </button>
          {/each}
          <button
            type="button"
            class="h-7 rounded-md px-2 text-xs text-gray-600 hover:bg-white disabled:text-gray-300 disabled:hover:bg-transparent"
            onclick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            다음
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
