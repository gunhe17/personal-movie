<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$lib/components/Typography.svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    /** 헤더 우측 뱃지 (카운트 등) */
    badgeCount?: number
    badgeColor?: 'amber' | 'red' | 'blue'
    /** 전체 보기 링크 */
    href: string
    /** 로딩 중 */
    isPending?: boolean
    /** 로딩 스켈레톤 행 수 */
    skeletonRows?: number
    /** 빈 상태 메시지 */
    emptyMessage?: string
    /** 데이터 있음 여부 */
    hasData?: boolean
    children: Snippet
  }

  let {
    title,
    badgeCount,
    badgeColor = 'amber',
    href,
    isPending = false,
    skeletonRows = 5,
    emptyMessage = '데이터가 없습니다',
    hasData = false,
    children,
  }: Props = $props()

  const badgeClasses: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
  }
</script>

<div class="section-border flex flex-col">
  <!-- 헤더 -->
  <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
    <Typography variant="title-01-normal-semibold" tag="h2">{title}</Typography>
    {#if !isPending && badgeCount !== undefined && badgeCount > 0}
      <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold {badgeClasses[badgeColor]}">
        {badgeCount}
      </span>
    {/if}
  </div>

  <!-- 본문 -->
  <div class="min-h-0 flex-1 overflow-auto">
    {#if isPending}
      <div class="space-y-2 p-4">
        {#each Array(skeletonRows) as _}
          <div class="h-10 animate-pulse rounded-lg bg-gray-100"></div>
        {/each}
      </div>
    {:else if !hasData}
      <div class="flex h-full min-h-24 items-center justify-center">
        <Typography variant="body-03-normal-regular" color="text-gray-400">{emptyMessage}</Typography>
      </div>
    {:else}
      {@render children()}
    {/if}
  </div>

  <!-- 푸터 -->
  <div class="border-t border-gray-100 px-5 py-3">
    <button
      class="text-xs font-medium text-primary-600 hover:text-primary-700"
      onclick={() => goto(href)}
    >
      전체 보기 →
    </button>
  </div>
</div>
