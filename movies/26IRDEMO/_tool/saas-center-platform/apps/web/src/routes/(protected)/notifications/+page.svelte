<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { centerId } from '$lib/stores/center.store'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getNotificationList,
    getUnreadCount,
    type NotificationListResponse
  } from '$lib/hooks/actions/notification.action'
  import { createNotificationService } from '$lib/features/notification/notification-service'
  import {
    mapToNotificationVM,
    type NotificationVM
  } from '$lib/features/notification/view-model'
  import { useNotificationListFilters } from '$lib/features/notification/list/hooks.svelte'
  import { buildNotificationListInput } from '$lib/features/notification/list/query-builders'
  import {
    CATEGORY_TAB_OPTIONS,
    SORT_OPTIONS,
    LIST_PAGE_SIZE,
    PINNED_NOTICE_LIMIT,
    PINNED_NOTICE_SCAN_SIZE,
    type CategoryFilter
  } from '$lib/features/notification/list/constants'
  import { responsive } from '$lib/stores/responsive.svelte'

  import TabBar from '$lib/components/TabBar.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import Select from '$lib/components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import CloseStrokeIcon20 from '$lib/assets/CloseStrokeIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'

  const pathname = '/notifications'
  const filters = useNotificationListFilters(page.url, pathname)
  const queryClient = useQueryClient()
  const notificationService = createNotificationService({ queryClient })

  // 알림 목록 쿼리
  const listQuery = queryBuilder(
    getNotificationList,
    () => buildNotificationListInput(filters.buildFilters(), $centerId ?? ''),
    () => ({ enabled: !!$centerId })
  )

  const listData = $derived(
    listQuery.data as NotificationListResponse | undefined
  )
  const total = $derived(listData?.total ?? 0)
  const isLoading = $derived(listQuery.isPending)

  // ── 상단 고정(공지) ────────────────────────────────────────────────
  // 고정은 **안 읽은 공지만** — 읽으면 고정에서 빠지고 아래 일반 행으로 내려간다.
  // 공지의 정본 목록은 사이드바 `공지사항`이고, 알림은 "놓치지 마세요"까지만
  // 맡는다. 읽은 공지까지 고정하면 알림이 게시판을 통째로 미러링한다.
  // 목록 쿼리와 분리하는 이유 — 현재 페이지에 우연히 섞인 공지가 아니라
  // 안 읽은 공지 전체에서 골라야 한다. 서버에 event_type 필터가 없어
  // category=system + is_read=false를 훑어 공지만 걸러낸다.
  /**
   * 지금 이 화면에서만 고정 블록을 접어둔 상태 — **저장하지 않는다.**
   * 새로고침하면 다시 뜬다. 접으면 그 공지들은 사라지는 게 아니라 아래
   * 목록의 일반 행으로 돌아간다(중복 제외가 함께 풀린다).
   */
  let pinnedClosed = $state(false)

  const isPinnedVisible = $derived(
    !pinnedClosed &&
      filters.page === 1 &&
      (filters.category === 'all' || filters.category === 'system')
  )

  const pinnedQuery = queryBuilder(
    getNotificationList,
    () => ({
      center_id: $centerId ?? '',
      category: 'system',
      is_read: false,
      page: 1,
      size: PINNED_NOTICE_SCAN_SIZE
    }),
    () => ({ enabled: !!$centerId && isPinnedVisible })
  )

  const pinnedNotices = $derived<NotificationVM[]>(
    isPinnedVisible
      ? (
          (pinnedQuery.data as NotificationListResponse | undefined)?.items ??
          []
        )
          .map(mapToNotificationVM)
          .filter((n) => n.isNotice && !n.isRead)
          .slice(0, PINNED_NOTICE_LIMIT)
      : []
  )

  const pinnedIds = $derived(new Set(pinnedNotices.map((n) => n.id)))

  // 고정 블록에 올라간 공지는 아래 목록에서 뺀다(같은 화면 중복 노출 방지)
  const notifications = $derived<NotificationVM[]>(
    (listData?.items ?? [])
      .map(mapToNotificationVM)
      .filter((n) => !pinnedIds.has(n.id))
  )

  // 읽지 않은 알림 수 ("모두 읽음" 버튼 표시용)
  const unreadQuery = queryBuilder(
    getUnreadCount,
    () => ({ center_id: $centerId ?? '' }),
    () => ({ enabled: !!$centerId })
  )
  const unreadCount = $derived((unreadQuery.data as any)?.count ?? 0)

  // 탭 데이터 — 카테고리가 탭 축(읽음 상태는 행의 빨간 점이 소유)
  const categoryTabs = CATEGORY_TAB_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label
  }))

  const isOverlayMode = $derived(!responsive.isDesktop)

  // 필터 활성 여부 (빈 상태 메시지 · 초기화 버튼 활성)
  const hasActiveFilter = $derived(
    filters.category !== 'all' ||
      !!filters.searchQuery ||
      filters.sort !== 'desc'
  )
  const noDataMessage = $derived(
    hasActiveFilter ? '조건에 맞는 알림이 없습니다' : '알림이 없습니다'
  )

  // 핸들러
  function handleCategoryChange(tab: string) {
    filters.changeCategory(tab as CategoryFilter)
  }

  async function handleNotificationClick(notification: NotificationVM) {
    if (!notification.isRead) {
      await notificationService.markAsRead(notification.id)
    }
    if (notification.navigateTo) {
      goto(notification.navigateTo)
    }
  }

  async function handleMarkAllRead() {
    await notificationService.markAllAsRead()
  }
</script>

<div in:fade class="flex h-full flex-col overflow-x-hidden">
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
  <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
    <h1 class="text-headline-01-normal-semibold text-gray-800">알림</h1>
    {#if unreadCount > 0}
      <!-- 보조 액션(흰 버튼, §5.6) — 청구·내담자 페이지의 보조 버튼과 동일 규격:
           높이 44 · 좌우 20 · radius 8 · 레이블 Body_01(16) Medium -->
      <button
        type="button"
        onclick={handleMarkAllRead}
        class="flex h-11 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-5 text-body-01-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
      >
        모두 읽음
      </button>
    {/if}
  </div>

  <!-- 카테고리 탭 — 탭↔필터 간격은 FloatingFilterBar의 py-4가 담당 -->
  <TabBar
    tabs={categoryTabs}
    activeTab={filters.category}
    onTabChange={handleCategoryChange}
  />

  <!-- 검색 + 정렬 — 리스트 화면 공통 필터 행 규격(청구·상담현황과 동일).
       목록이 고정 높이 내부 스크롤이라 reserveScroll은 false -->
  <FloatingFilterBar reserveScroll={false}>
    {#snippet children()}
      <div
        class="flex h-11 {isOverlayMode
          ? 'w-full'
          : 'w-90'} items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 duration-200 focus-within:border-border-active"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={filters.searchQuery}
          placeholder="제목, 내용으로 검색"
          class="w-full bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
        />
      </div>

      <!-- 초기화 + 정렬 -->
      <div class="flex items-center gap-3">
        <FilterResetButton
          onclick={filters.resetFilters}
          disabled={!hasActiveFilter}
        />
        <div class="h-9 w-px bg-gray-200"></div>
        <Select
          class="rounded-lg border-none bg-white"
          options={SORT_OPTIONS}
          selected={filters.sort}
          on:change={(e) => (filters.sort = e.detail.value)}
        />
      </div>
    {/snippet}
  </FloatingFilterBar>

  <!-- 카운트 헤더 -->
  <div class="mb-1 flex h-11 shrink-0 items-center">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      총 {total}건
    </Typography>
  </div>

  <!-- 알림 목록 (스크롤 영역) -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-card"
    >
      <!-- 상단 고정 — 공지사항. 스크롤 영역 밖에 두어 목록을 내려도 자리를 지킨다.
           인셋 8 + 행 좌우 12 = 목록 행(px-5)과 같은 20 정렬선.
           radius는 카드(16) > 고정 행(12) 중첩 규칙. -->
      {#if pinnedNotices.length > 0}
        <div class="flex shrink-0 items-start gap-2 p-2">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            {#each pinnedNotices as notice (notice.id)}
              <button
                type="button"
                onclick={() => handleNotificationClick(notice)}
                class="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-brand-subtle px-3 py-3 text-left transition-colors hover:bg-action-primary-subtle"
                aria-label={notice.title}
              >
                <span
                  class="shrink-0 text-body-02-normal-semibold text-action-primary"
                >
                  공지
                </span>
                <span class="flex min-w-0 items-start gap-2">
                  <span
                    class="truncate-safe min-w-0 text-body-01-normal-semibold text-body-strong"
                  >
                    {notice.title}
                  </span>
                  {#if !notice.isRead}
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full bg-status-danger"
                      aria-label="읽지 않음"
                    ></span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>

          <!-- 닫기는 블록 맨 우측, 첫 행 높이(48)의 세로 가운데(mt-2 = 8).
               접어도 공지는 아래 목록에 남는다 — 숨기는 게 아니라 고정을 푸는 것. -->
          <button
            type="button"
            aria-label="공지 고정 닫기"
            onclick={() => (pinnedClosed = true)}
            class="mt-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            <CloseStrokeIcon20 />
          </button>
        </div>
      {/if}

      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if isLoading && notifications.length === 0}
          <div class="flex h-full items-center justify-center py-12">
            <div class="text-body-01-normal-medium text-gray-500">
              로딩 중...
            </div>
          </div>
        {:else if notifications.length === 0}
          <div class="py-10">
            <NoDataSection description={noDataMessage} />
          </div>
        {:else}
          {#each notifications as notification, i (notification.id)}
            <!-- 읽지 않음 신호는 제목 옆 빨간 점 하나뿐 — 행 배경 틴트는 쓰지 않는다
               (틴트를 쓰면 상단 고정 블록의 브랜드 면과 신호가 겹친다). -->
            <button
              type="button"
              onclick={() => handleNotificationClick(notification)}
              class="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors
              {notification.navigateTo ? 'cursor-pointer' : ''}
              hover:bg-gray-50"
              aria-label={notification.title}
            >
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <!-- 타이틀 행 = [카테고리 배지] 8 [제목] 8 [읽지 않음 점].
                     이벤트 종류 텍스트(접수·회기 추가…)는 바로 아래 본문이 같은 말을
                     더 정확히 하고 있어 뺐다(같은 정보를 두 번 읽히지 않는다). -->
                <div class="flex w-full min-w-0 items-center gap-2">
                  <BadgeRectangle
                    label={notification.categoryLabel}
                    color={notification.categoryColor}
                  />
                  <span class="flex min-w-0 items-start gap-2">
                    <span
                      class="truncate-safe min-w-0 text-body-01-normal-semibold text-body-strong"
                    >
                      {notification.title}
                    </span>
                    {#if !notification.isRead}
                      <!-- 점은 첨자 위치 — 글줄 위쪽에 붙여야 표식으로 읽힌다
                           (세로 중앙이면 문장의 한 글자처럼 보인다) -->
                      <span
                        class="h-1.5 w-1.5 shrink-0 rounded-full bg-status-danger"
                        aria-label="읽지 않음"
                      ></span>
                    {/if}
                  </span>
                </div>

                <p
                  class="line-clamp-2 text-body-02-normal-regular text-gray-500"
                >
                  {notification.body}
                </p>
              </div>

              <!-- 시각은 제목 행이 아니라 행 전체 기준 세로 중앙 -->
              <span
                class="shrink-0 text-body-03-normal-regular text-caption-default"
                >{notification.timeAgo}</span
              >
            </button>

            {#if i < notifications.length - 1}
              <div class="mx-5 border-b border-border-subtle"></div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>

    <!-- 페이지네이션 -->
    {#if total > LIST_PAGE_SIZE}
      <div class="mt-4 flex shrink-0 justify-center pb-2">
        <Pagination
          totalItems={total}
          itemsPerPage={LIST_PAGE_SIZE}
          bind:currentPage={filters.page}
        />
      </div>
    {/if}
  </div>
</div>
