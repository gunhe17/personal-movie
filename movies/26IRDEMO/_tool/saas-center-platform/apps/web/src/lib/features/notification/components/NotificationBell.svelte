<script lang="ts">
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { get } from 'svelte/store'
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getUnreadCount,
    getNotificationList
  } from '$lib/hooks/actions/notification.action'
  import { createNotificationService } from '../notification-service'
  import { mapToNotificationVM, type NotificationVM } from '../view-model'
  import { DROPDOWN_PAGE_SIZE, UNREAD_POLL_INTERVAL } from '../constants'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import Typography from '@common/components/Typography.svelte'
  import DefaultBell from '$lib/assets/DefaultBell.svelte'
  import SettingIcon20 from '$lib/assets/SettingIcon20.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isMobile = $derived(responsive.width < 640)

  interface Props {
    variant?: 'header' | 'sidebar'
    collapsed?: boolean
    /** 드롭다운을 위쪽으로 열기 (사이드바 하단 배치 시) */
    dropUp?: boolean
    /** 축소된 사이드바용 작은 아이콘 (h-4 w-4) */
    compact?: boolean
  }

  let {
    variant = 'header',
    collapsed = false,
    dropUp = false,
    compact = false
  }: Props = $props()

  const isSidebar = $derived(variant === 'sidebar')

  // 드롭다운 상태
  let isOpen = $state(false)
  let dropdownRef: HTMLElement | null = $state(null)

  const queryClient = useQueryClient()
  const notificationService = createNotificationService({ queryClient })

  // 읽지 않은 알림 개수 (폴링 + window focus 시 갱신)
  const unreadQuery = queryBuilder(
    getUnreadCount,
    () => ({ center_id: $centerId ?? '' }),
    () => ({
      enabled: !!$centerId,
      refetchInterval: UNREAD_POLL_INTERVAL,
      refetchOnWindowFocus: true,
      refetchOnMount: 'always' as const
    })
  )

  const unreadCount = $derived((unreadQuery.data as any)?.count ?? 0)

  // 드롭다운 내 알림 목록 (열릴 때만 fetch + window focus 시 갱신)
  const listQuery = queryBuilder(
    getNotificationList,
    () => ({
      center_id: $centerId ?? '',
      size: DROPDOWN_PAGE_SIZE
    }),
    () => ({
      enabled: !!$centerId && isOpen,
      refetchOnWindowFocus: true
    })
  )

  const notifications = $derived<NotificationVM[]>(
    ((listQuery.data as any)?.items ?? []).map(mapToNotificationVM)
  )

  // 외부 클릭 시 드롭다운 닫기
  $effect(() => {
    if (!isOpen || !browser) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        isOpen = false
      }
    }
    const timer = setTimeout(
      () => window.addEventListener('click', handleClick),
      0
    )
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClick)
    }
  })

  function toggleDropdown() {
    isOpen = !isOpen
  }

  async function handleNotificationClick(notification: NotificationVM) {
    // 1. 읽음 처리
    if (!notification.isRead) {
      await notificationService.markAsRead(notification.id)
    }

    // 2. 이동 또는 현재 페이지 데이터 갱신
    if (notification.navigateTo) {
      isOpen = false
      const currentPath = get(page).url.pathname
      if (currentPath === notification.navigateTo) {
        // 이미 해당 페이지 — 목록만 갱신
        queryClient.invalidateQueries({
          queryKey: ['getMyInquiryList'],
          exact: false
        })
      } else {
        goto(notification.navigateTo)
      }
    }
  }

  async function handleMarkAllAsRead() {
    await notificationService.markAllAsRead()
  }
</script>

<div class="relative" bind:this={dropdownRef}>
  <!-- 벨 아이콘 버튼 -->
  {#if isSidebar}
    <button
      type="button"
      onclick={toggleDropdown}
      class="group relative flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-[#394561]/60 {collapsed
        ? 'justify-center px-2'
        : ''}"
      aria-label="알림"
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      <span
        class="relative flex h-5 w-5 shrink-0 items-center justify-center text-gray-400 group-hover:text-white"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {#if unreadCount > 0}
          <span
            class="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-caption-01-normal-medium text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        {/if}
      </span>
      {#if !collapsed}
        <span class="text-sm text-gray-300 group-hover:text-white">알림</span>
        {#if unreadCount > 0}
          <span
            class="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-caption-01-normal-medium text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        {/if}
      {/if}
    </button>
  {:else}
    <button
      type="button"
      onclick={toggleDropdown}
      class="relative flex items-center justify-center"
      aria-label="알림"
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      <DefaultBell />
      {#if unreadCount > 0}
        <span
          class="absolute top-0.5 right-1.5 translate-x-1/3 -translate-y-1/3 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-caption-01-normal-medium text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      {/if}
    </button>
  {/if}

  <!-- 드롭다운 패널 -->
  {#if isOpen}
    {#if isMobile && !isSidebar}
      <!-- 모바일: 반투명 배경 -->
      <div
        class="fixed inset-0 z-40 bg-black/20"
        transition:fade={{ duration: 150 }}
        onclick={() => (isOpen = false)}
        role="presentation"
      ></div>
    {/if}
    <div
      class="{isMobile && !isSidebar
        ? 'fixed left-2 right-2 top-[4.5rem] bottom-4 z-50 flex flex-col'
        : 'absolute z-50 w-[min(24rem,calc(100vw-1rem))]'} overflow-hidden rounded-xl bg-white shadow-dropdown {!isMobile ||
      isSidebar
        ? isSidebar
          ? 'left-full bottom-0 ml-2'
          : dropUp
            ? 'left-0 bottom-full mb-2'
            : 'right-0 top-full mt-2'
        : ''}"
      role="menu"
      transition:fly={{ y: -8, duration: 180, easing: cubicOut }}
    >
      <!-- 헤더 -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-4"
      >
        <Typography
          variant="title-01-normal-semibold"
          color="text-body-strong"
          tag="h3">알림</Typography
        >
        <div class="flex items-center gap-2">
          {#if unreadCount > 0}
            <button
              type="button"
              onclick={handleMarkAllAsRead}
              class="text-body-03-normal-medium text-primary-600 hover:text-primary-700"
            >
              모두 읽음
            </button>
          {/if}
          <Tooltip text="알림 설정">
            <button
              type="button"
              onclick={() => {
                isOpen = false
                goto('/settings/notifications')
              }}
              class="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="알림 설정"
              title="알림 설정"
            >
              <SettingIcon20 />
            </button>
          </Tooltip>
        </div>
      </div>

      <!-- 알림 목록 -->
      <div
        class="{isMobile && !isSidebar
          ? 'flex-1 min-h-0'
          : 'max-h-[min(24rem,60vh)]'} overflow-y-auto"
      >
        {#if notifications.length === 0}
          <div
            class="flex flex-col items-center justify-center py-12 text-gray-400"
          >
            <svg
              class="mb-2 h-8 w-8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
            <Typography variant="body-03-normal-medium" color="text-inherit"
              >알림이 없습니다</Typography
            >
          </div>
        {:else}
          {#each notifications as notification, i (notification.id)}
            {#if i > 0}
              <div class="h-px bg-gray-100"></div>
            {/if}
            <button
              type="button"
              onclick={() => handleNotificationClick(notification)}
              class="flex w-full flex-col px-4 py-4 text-left transition-colors hover:bg-primary-50 {notification.navigateTo
                ? 'cursor-pointer'
                : ''}"
              role="menuitem"
            >
              <!-- 배지 · 타이틀 한 줄 (gap 8) · 우측 경과시간 -->
              <div class="flex items-center gap-2">
                <BadgeRectangle
                  label={notification.categoryLabel}
                  color={notification.categoryColor}
                />
                <Typography
                  variant="body-01-normal-semibold"
                  color="text-body-strong"
                  className="min-w-0 flex-1 truncate"
                >
                  {notification.title}
                </Typography>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-caption-default"
                  className="shrink-0">{notification.timeAgo}</Typography
                >
              </div>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                className="mt-2 line-clamp-2"
              >
                {notification.body}
              </Typography>
            </button>
          {/each}
        {/if}
      </div>

      <!-- 전체 보기 -->
      <button
        type="button"
        onclick={() => {
          isOpen = false
          goto('/notifications')
        }}
        class="flex w-full shrink-0 items-center justify-center gap-2 border-t border-gray-100 py-5 text-body-03-normal-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
      >
        모든 알림 보기
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
          />
        </svg>
      </button>
    </div>
  {/if}
</div>
