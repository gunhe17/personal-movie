<script lang="ts">
  import { slide } from 'svelte/transition'
  import type { FeatureUsageItem } from '$hooks/actions/ai-usage.action'
  import { fmtKRW, fmtNum } from '../view-model'

  interface Props {
    features: FeatureUsageItem[]
  }

  let { features }: Props = $props()

  // ─── 그룹 정의 ────────────────────────────────────────────────────────────────
  interface GroupColor {
    bg: string; text: string; dot: string; bar: string; rowBg: string; countBg: string; countText: string
  }

  interface GroupDef {
    key: string
    label: string
    color: GroupColor
    match: (item: FeatureUsageItem) => boolean
  }

  const GROUP_DEFS: GroupDef[] = [
    {
      key: 'field_note',
      label: 'AI 상담일지',
      color: {
        bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500',
        bar: 'bg-blue-400', rowBg: 'bg-blue-50/30', countBg: 'bg-blue-100', countText: 'text-blue-700',
      },
      match: (i) => ['field_note_summarize', 'field_note_generate_note', 'field_note_recommendation'].includes(i.purpose),
    },
    {
      key: 'stt',
      label: '화자분리',
      color: {
        bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500',
        bar: 'bg-teal-400', rowBg: 'bg-teal-50/30', countBg: 'bg-teal-100', countText: 'text-teal-700',
      },
      match: (i) => ['field_note_stt_chunk', 'field_note_stt_diarize', 'field_note_stt_streaming', 'field_note_refine'].includes(i.purpose),
    },
    {
      key: 'case_analysis',
      label: 'AI 상담사례',
      color: {
        bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500',
        bar: 'bg-violet-400', rowBg: 'bg-violet-50/30', countBg: 'bg-violet-100', countText: 'text-violet-700',
      },
      match: (i) => i.purpose === 'case_analysis',
    },
    {
      key: 'agent',
      label: '채팅 에이전트',
      color: {
        bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500',
        bar: 'bg-purple-400', rowBg: 'bg-purple-50/30', countBg: 'bg-purple-100', countText: 'text-purple-700',
      },
      match: (i) => i.purpose === 'skill_selection' || i.feature.startsWith('agent-'),
    },
    {
      key: 'voucher',
      label: '바우처',
      color: {
        bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500',
        bar: 'bg-amber-400', rowBg: 'bg-amber-50/20', countBg: 'bg-amber-100', countText: 'text-amber-700',
      },
      match: (i) => i.purpose.startsWith('voucher_'),
    },
  ]

  // ─── 그룹 데이터 빌드 ─────────────────────────────────────────────────────────
  interface FeatureGroup {
    key: string
    label: string
    color: GroupColor
    items: FeatureUsageItem[]
    totalCost: number
    totalCalls: number
    isActive: boolean
  }

  const totalFeatureCost = $derived(features.reduce((s, f) => s + f.monthly_cost, 0))
  const totalFeatureCalls = $derived(features.reduce((s, f) => s + f.call_count, 0))

  const groups = $derived.by<FeatureGroup[]>(() => {
    const assigned = new Set<string>()
    const result: FeatureGroup[] = []

    for (const def of GROUP_DEFS) {
      const items = features.filter((i) => def.match(i))
      if (items.length === 0) continue
      items.forEach((i) => assigned.add(i.purpose))
      result.push({
        key: def.key,
        label: def.label,
        color: def.color,
        items: [...items].sort((a, b) => b.monthly_cost - a.monthly_cost),
        totalCost: items.reduce((s, i) => s + i.monthly_cost, 0),
        totalCalls: items.reduce((s, i) => s + i.call_count, 0),
        isActive: items.some((i) => i.status === 'active'),
      })
    }

    // 비용 내림차순 정렬
    return result.sort((a, b) => b.totalCost - a.totalCost)
  })

  let expandedGroups = $state(new Set<string>())

  function toggleGroup(key: string) {
    const next = new Set(expandedGroups)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedGroups = next
  }

  function costShare(cost: number): number {
    return totalFeatureCost > 0 ? (cost / totalFeatureCost) * 100 : 0
  }
</script>

<div>
  <div class="mb-3 flex items-center gap-2">
    <h2 class="text-title-01-normal-semibold text-gray-900">기능별 비용 분석</h2>
    {#if groups.length > 0}
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-label-02-normal-medium text-gray-500">
        {groups.length}개 그룹
      </span>
    {/if}
  </div>

  <!-- 데스크탑 테이블 -->
  <div class="section-border hidden overflow-hidden bg-white sm:block">
    {#if features.length === 0}
      <div class="flex flex-col items-center justify-center gap-2 py-16">
        <svg class="h-10 w-10 text-gray-200" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        <p class="text-body-03-normal-regular text-gray-400">등록된 AI 기능이 없습니다</p>
      </div>
    {:else}
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/60">
            <th class="py-3 pl-5 text-left text-body-03-normal-medium text-gray-500">기능 그룹</th>
            <th class="py-3 text-right text-body-03-normal-medium text-gray-500">호출</th>
            <th class="py-3 text-right text-body-03-normal-medium text-gray-500">비용 비중</th>
            <th class="py-3 pr-5 text-right text-body-03-normal-medium text-gray-500">비용</th>
          </tr>
        </thead>
        <tbody>
          {#each groups as group (group.key)}
            {@const share = costShare(group.totalCost)}
            {@const isExpanded = expandedGroups.has(group.key)}
            {@const hasMultiple = group.items.length > 1}

            <!-- 그룹 헤더 행 -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <tr
              class="border-b border-gray-100 {group.color.rowBg} transition-colors hover:brightness-[0.97] {hasMultiple ? 'cursor-pointer' : ''}"
              onclick={() => hasMultiple && toggleGroup(group.key)}
            >
              <td class="py-3.5 pl-5">
                <div class="flex items-center gap-2">
                  <!-- 확장 화살표 -->
                  {#if hasMultiple}
                    <svg
                      class="h-3.5 w-3.5 shrink-0 {group.color.text} transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  {:else}
                    <span class="w-3.5"></span>
                  {/if}
                  <span class="text-body-03-normal-semibold text-gray-800">{group.label}</span>
                  <!-- 항목 수 배지 -->
                  {#if group.items.length > 1}
                    <span class="rounded-full px-1.5 py-0.5 text-label-02-normal-bold {group.color.countBg} {group.color.countText}">
                      {group.items.length}
                    </span>
                  {/if}
                  <!-- 활성 상태 점 -->
                  <span class="h-1.5 w-1.5 rounded-full {group.isActive ? 'bg-green-500' : 'bg-gray-300'}" title="{group.isActive ? '활성' : '비활성'}"></span>
                </div>
              </td>
              <td class="py-3.5 text-right tabular-nums text-body-03-normal-medium text-gray-700">
                {fmtNum(group.totalCalls)}회
              </td>
              <td class="py-3.5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                    <div class="h-full rounded-full {group.color.bar} transition-all duration-500" style="width:{Math.min(share, 100)}%"></div>
                  </div>
                  <span class="w-9 text-right tabular-nums text-label-01-normal-medium text-gray-500">{share.toFixed(0)}%</span>
                </div>
              </td>
              <td class="py-3.5 pr-5 text-right tabular-nums text-body-03-normal-bold text-gray-800">
                {fmtKRW(group.totalCost)}
              </td>
            </tr>

            <!-- 그룹 내 개별 항목 (확장 시) -->
            {#if isExpanded}
              {#each group.items as item (item.purpose)}
                {@const itemShare = costShare(item.monthly_cost)}
                <tr
                  transition:slide={{ duration: 150 }}
                  class="border-b border-gray-50 last:border-0 {group.color.rowBg} transition-colors hover:brightness-[0.97]"
                >
                  <td class="py-2.5 pl-12">
                    <span class="text-body-03-normal-regular text-gray-600">{item.feature}</span>
                  </td>
                  <td class="py-2.5 text-right tabular-nums text-body-03-normal-regular text-gray-500">
                    {fmtNum(item.call_count)}회
                  </td>
                  <td class="py-2.5 text-right">
                    <span class="tabular-nums text-label-02-normal-regular text-gray-400">{itemShare.toFixed(0)}%</span>
                  </td>
                  <td class="py-2.5 pr-5 text-right tabular-nums text-body-03-normal-regular text-gray-600">
                    {fmtKRW(item.monthly_cost)}
                  </td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t border-gray-100 bg-gray-50/60">
            <td class="py-3.5 pl-5 text-body-03-normal-bold text-gray-700">합계</td>
            <td class="py-3.5 text-right tabular-nums text-body-03-normal-bold text-gray-700">{fmtNum(totalFeatureCalls)}회</td>
            <td class="py-3.5 text-right tabular-nums text-label-01-normal-bold text-gray-500">100%</td>
            <td class="py-3.5 pr-5 text-right tabular-nums text-body-03-normal-bold text-gray-900">{fmtKRW(totalFeatureCost)}</td>
          </tr>
        </tfoot>
      </table>
    {/if}
  </div>

  <!-- 모바일 카드 -->
  <div class="space-y-2 sm:hidden">
    {#each groups as group (group.key)}
      {@const share = costShare(group.totalCost)}
      {@const isExpanded = expandedGroups.has(group.key)}
      {@const hasMultiple = group.items.length > 1}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="section-border flex w-full items-center justify-between {group.color.rowBg} p-4 transition-colors {hasMultiple ? 'cursor-pointer active:brightness-95' : ''}"
        onclick={() => hasMultiple && toggleGroup(group.key)}
      >
        <div class="flex items-center gap-2">
          {#if hasMultiple}
            <svg class="h-3.5 w-3.5 shrink-0 {group.color.text} transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          {/if}
          <span class="text-body-03-normal-semibold text-gray-800">{group.label}</span>
          {#if group.items.length > 1}
            <span class="rounded-full px-1.5 py-0.5 text-label-02-normal-bold {group.color.countBg} {group.color.countText}">{group.items.length}</span>
          {/if}
        </div>
        <div class="text-right">
          <span class="block tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(group.totalCost)}</span>
          <span class="tabular-nums text-label-02-normal-regular text-gray-500">{fmtNum(group.totalCalls)}회 · {share.toFixed(0)}%</span>
        </div>
      </div>
      {#if isExpanded}
        {#each group.items as item (item.purpose)}
          <div transition:slide={{ duration: 150 }} class="section-border ml-4 p-3">
            <div class="flex items-center justify-between">
              <span class="text-body-03-normal-regular text-gray-700">{item.feature}</span>
              <div class="text-right">
                <span class="block tabular-nums text-body-03-normal-semibold text-gray-700">{fmtKRW(item.monthly_cost)}</span>
                <span class="tabular-nums text-label-02-normal-regular text-gray-500">{fmtNum(item.call_count)}회</span>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    {/each}
  </div>
</div>
