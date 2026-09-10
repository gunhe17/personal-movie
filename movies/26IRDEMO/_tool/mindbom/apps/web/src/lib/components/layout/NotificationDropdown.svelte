<script lang="ts">
  import { goto } from '$app/navigation'
  import { useQueryClient } from '@tanstack/svelte-query'

  import Icon from '$components/ui/Icon.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { institutionId } from '$lib/stores/institution.store'
  import {
    getNotificationList,
    getUnreadCount,
    markAllNotificationsRead,
    markNotificationRead
  } from '$lib/features/notifications/query-builders'
  import type {
    NotificationItem,
    NotificationListResponse,
    NotificationType,
    UnreadCountResponse
  } from '$lib/features/notifications/types'

  const queryClient = useQueryClient()

  let open = $state(false)
  let buttonEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)

  // 미읽음 카운트: 30초마다 폴링 (헤더 빨간점)
  const unreadQuery = queryBuilder<UnreadCountResponse, UnreadCountResponse>(
    getUnreadCount,
    () => ({ institutionId: $institutionId ?? '' }),
    () => ({
      enabled: !!$institutionId,
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
      staleTime: 15000
    })
  )

  // 알림 목록: 드롭다운이 열릴 때만 fetch
  const listQuery = queryBuilder<
    NotificationListResponse,
    NotificationListResponse
  >(
    getNotificationList,
    () => ({ institutionId: $institutionId ?? '', page: 1, size: 20 }),
    () => ({
      enabled: !!$institutionId && open,
      staleTime: 0
    })
  )

  let unreadCount = $derived(unreadQuery.data?.unread_count ?? 0)
  let items = $derived<NotificationItem[]>(listQuery.data?.items ?? [])
  let isListLoading = $derived(listQuery.isLoading || listQuery.isFetching)

  function toggle() {
    open = !open
  }

  function close() {
    open = false
  }

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: ['getNotificationUnreadCount'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getNotificationList'],
      exact: false
    })
  }

  async function handleItemClick(item: NotificationItem) {
    const inst = $institutionId
    if (!inst) return

    if (!item.read_at) {
      try {
        await markNotificationRead().request({
          institutionId: inst,
          notificationId: item.id
        })
      } catch {
        // 무시 — 네트워크 실패해도 네비게이션은 진행
      }
      invalidate()
    }

    close()

    if (item.link_path) {
      goto(item.link_path)
    }
  }

  async function handleMarkAllRead() {
    const inst = $institutionId
    if (!inst || unreadCount === 0) return
    try {
      await markAllNotificationsRead().request({ institutionId: inst })
    } finally {
      invalidate()
    }
  }

  // 외부 클릭으로 닫기
  $effect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelEl?.contains(target) ||
        buttonEl?.contains(target)
      ) {
        return
      }
      close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  })

  // ── presentation helpers ──

  const TYPE_ICONS: Record<NotificationType, string> = {
    'examination.assigned': 'assignment_ind',
    'examination.ai_draft_ready': 'auto_awesome',
    'examination.confirmed': 'verified',
    'examination.report_ready': 'description',
    'member.invited': 'group_add',
    'account.password_changed': 'lock_reset'
  }

  function iconFor(type: string): string {
    return TYPE_ICONS[type as NotificationType] ?? 'notifications'
  }

  function timeAgo(iso: string): string {
    const created = new Date(iso).getTime()
    const diffSec = Math.max(0, (Date.now() - created) / 1000)
    if (diffSec < 60) return '방금 전'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`
    return new Date(iso).toLocaleDateString('ko-KR')
  }

  let badgeText = $derived(unreadCount > 99 ? '99+' : String(unreadCount))
</script>

<div class="relative">
  <button
    bind:this={buttonEl}
    onclick={toggle}
    class="relative flex size-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
    aria-label="알림"
    aria-haspopup="dialog"
    aria-expanded={open}
    title="알림"
  >
    <Icon name="notifications" size="lg" />
    {#if unreadCount > 0}
      <span
        class="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-caption-01-normal-semibold leading-none text-white"
        aria-hidden="true"
      >
        {badgeText}
      </span>
    {/if}
  </button>

  {#if open}
    <!--
      z-dropdown(50) — 이전 값은 z-2000이었지만 헤더(z-10)가 만든 스태킹
      컨텍스트에 갇혀 전역 실효값은 10이었다. 큰 수를 적어도 부모를 넘지
      못한다. 여기서 잘리진 않으므로(헤더에 overflow 없음) 사다리대로 되돌린다.
      모달 위로 띄워야 할 일이 생기면 그때 portal로 내보낼 것.
    -->
    <div
      bind:this={panelEl}
      role="dialog"
      aria-label="알림 목록"
      class="absolute right-0 top-12 z-dropdown flex w-[min(380px,calc(100vw-2rem))] max-h-120 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-xl"
    >
      <header class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div class="flex items-baseline gap-2">
          <h2 class="text-sm font-semibold">알림</h2>
          {#if unreadCount > 0}
            <span class="text-xs text-gray-500">미읽음 {unreadCount}건</span>
          {/if}
        </div>
        <button
          onclick={handleMarkAllRead}
          disabled={unreadCount === 0}
          class="text-xs font-medium text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
        >
          모두 읽음
        </button>
      </header>

      <div class="flex-1 overflow-y-auto">
        {#if isListLoading && items.length === 0}
          <div class="flex h-32 items-center justify-center text-sm text-gray-400">
            불러오는 중…
          </div>
        {:else if items.length === 0}
          <div class="flex h-32 flex-col items-center justify-center gap-2 text-sm text-gray-400">
            <Icon name="notifications_none" size="xl" class="opacity-40" />
            <span>알림이 없습니다</span>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100">
            {#each items as item (item.id)}
              {@const unread = !item.read_at}
              <li>
                <button
                  type="button"
                  onclick={() => handleItemClick(item)}
                  class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 {unread ? 'bg-blue-50/40' : ''}"
                >
                  <span
                    class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full {unread ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}"
                  >
                    <Icon name={iconFor(item.type)} size="md" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <p class="truncate text-sm {unread ? 'font-semibold text-gray-900' : 'text-gray-700'}">
                        {item.title}
                      </p>
                      {#if unread}
                        <span class="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" aria-label="미읽음"></span>
                      {/if}
                    </div>
                    {#if item.body}
                      <p class="mt-0.5 line-clamp-2 text-xs text-gray-500">
                        {item.body}
                      </p>
                    {/if}
                    <p class="mt-1 text-label-02-normal-regular text-gray-400">
                      {timeAgo(item.created_at)}
                    </p>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>
