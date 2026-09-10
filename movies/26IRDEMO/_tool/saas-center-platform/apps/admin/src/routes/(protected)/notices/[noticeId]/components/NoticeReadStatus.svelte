<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import Select from '$components/Select.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getNoticeReadStatus,
    getNoticeReadCenterDetail,
    type NoticeReadCenterSummary,
    type NoticeReadMemberDetail
  } from '$hooks/actions/notice.action'
  import { formatDate } from '$utils/format'
  import { slide } from 'svelte/transition'
  import BellIcon from '$lib/assets/BellIcon.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'

  interface Props {
    noticeId: string
    onNotifyUnread: (noticeId: string) => void
  }

  let { noticeId, onNotifyUnread }: Props = $props()

  // ─── 필터/검색/페이지네이션 상태 ───
  let readStatusFilter = $state<string>('all')
  let readSearchQuery = $state('')
  let debouncedReadSearch = $state('')
  let readSearchTimeout: ReturnType<typeof setTimeout>
  let readCurrentPage = $state(1)
  const readPageSize = 10
  let expandedCenterId = $state<string | null>(null)

  $effect(() => {
    clearTimeout(readSearchTimeout)
    const q = readSearchQuery
    readSearchTimeout = setTimeout(() => {
      debouncedReadSearch = q
      readCurrentPage = 1
    }, 300)
  })

  const READ_FILTER_OPTIONS = [
    { value: 'all', title: '전체' },
    { value: 'read', title: '읽음' },
    { value: 'unread', title: '읽지 않음' }
  ]

  // ─── is_read 쿼리 파라미터 변환 ───
  const isReadParam = $derived(
    readStatusFilter === 'read'
      ? true
      : readStatusFilter === 'unread'
        ? false
        : undefined
  )

  // ─── 읽음 현황 쿼리 (서버 페이지네이션) ───
  const readStatusQuery = $derived(
    queryBuilder<any, any>(getNoticeReadStatus, () => ({
      noticeId,
      search: debouncedReadSearch.trim() || undefined,
      is_read: isReadParam,
      page: readCurrentPage,
      size: readPageSize
    }))
  )
  const readStatusData = $derived(readStatusQuery?.data ?? null)
  const readCenters = $derived<NoticeReadCenterSummary[]>(
    readStatusData?.centers ?? []
  )
  const readTotalFiltered = $derived(readStatusData?.total_centers ?? 0)
  const readTotalPages = $derived(readStatusData?.pages ?? 1)

  // ─── 쿨다운 ───
  const COOLDOWN_MS = 24 * 60 * 60 * 1000

  const cooldownInfo = $derived.by(() => {
    const lastNotified = readStatusData?.last_notified_at
    if (!lastNotified) return { isCooldown: false, remainLabel: '' }
    const lastMs = new Date(
      /Z$|[+-]\d{2}:?\d{2}$/.test(lastNotified)
        ? lastNotified
        : `${lastNotified}Z`
    ).getTime()
    const diff = Date.now() - lastMs
    if (diff >= COOLDOWN_MS) return { isCooldown: false, remainLabel: '' }
    const remainH = Math.ceil((COOLDOWN_MS - diff) / (60 * 60 * 1000))
    return {
      isCooldown: true,
      remainLabel: `${remainH}시간 후 재발송 가능`
    }
  })

  const hasUnreadMembers = $derived(
    readCenters.some((c) => c.read_count < c.member_count)
  )

  const bulkNotifyDisabled = $derived(
    cooldownInfo.isCooldown || !hasUnreadMembers
  )

  const bulkNotifyTooltip = $derived(
    !hasUnreadMembers
      ? '모두 열람 완료'
      : cooldownInfo.isCooldown
        ? cooldownInfo.remainLabel
        : ''
  )

  // ─── 센터 상세 캐시 ───
  let centerDetailCache = $state<Record<string, NoticeReadMemberDetail[]>>({})
  let centerDetailLoading = $state<Record<string, boolean>>({})

  // ─── 핸들러 ───
  async function toggleCenterExpand(centerId: string) {
    if (expandedCenterId === centerId) {
      expandedCenterId = null
      return
    }
    expandedCenterId = centerId
    if (!centerDetailCache[centerId]) {
      centerDetailLoading[centerId] = true
      try {
        const detail = await getNoticeReadCenterDetail().request({
          noticeId,
          centerId
        })
        centerDetailCache[centerId] = detail.members
      } catch {
        centerDetailCache[centerId] = []
      } finally {
        centerDetailLoading[centerId] = false
      }
    }
  }

  function handleReadFilterChange(e: CustomEvent) {
    const option = e.detail
    readStatusFilter = typeof option === 'object' ? option.value : option
    expandedCenterId = null
    readCurrentPage = 1
  }

  const DATE_FORMAT = 'YYYY-MM-DD HH:mm'
</script>

<div class="section-border p-6">
  <div class="mb-4 flex items-center justify-between">
    <Typography variant="title-01-normal-semibold" tag="h2">
      조회 현황
      <span class="ml-1 text-sm font-normal text-gray-400">
        {readStatusData?.read_centers ?? 0} / {readStatusData?.total_centers ??
          0}개 센터 확인
      </span>
    </Typography>

    <div class="flex items-center gap-2">
      <div class="relative group">
        <button
          onclick={() => onNotifyUnread(noticeId)}
          disabled={bulkNotifyDisabled}
          class="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <BellIcon class="h-4 w-4" />
          미열람자 일괄 알림
        </button>
        {#if bulkNotifyTooltip}
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden rounded-md bg-gray-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap group-hover:block"
          >
            {bulkNotifyTooltip}
            <div
              class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"
            ></div>
          </div>
        {/if}
      </div>
      <div
        class="flex h-9 w-52 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3"
      >
        <SearchIcon class="h-4 w-4 shrink-0" strokeColor="#9CA3AF" />
        <input
          type="text"
          placeholder="센터명 검색"
          bind:value={readSearchQuery}
          class="w-full text-sm placeholder:text-gray-400 outline-none"
        />
      </div>
      <Select
        options={READ_FILTER_OPTIONS}
        selected={readStatusFilter}
        placeholder="전체"
        showActiveHighlight={true}
        defaultValue="all"
        class="h-9 w-24 rounded-lg"
        on:change={handleReadFilterChange}
      />
    </div>
  </div>

  {#if readStatusQuery.isPending}
    <div class="flex items-center justify-center py-10 text-sm text-gray-400">
      불러오는 중...
    </div>
  {:else if readCenters.length === 0}
    <div class="flex items-center justify-center py-10 text-sm text-gray-400">
      {debouncedReadSearch.trim()
        ? '검색 결과가 없습니다'
        : '해당하는 센터가 없습니다'}
    </div>
  {:else}
    <div class="space-y-2">
      {#each readCenters as center (center.center_id)}
        <div class="rounded-lg border border-gray-100 overflow-hidden">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => toggleCenterExpand(center.center_id)}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ')
                toggleCenterExpand(center.center_id)
            }}
            role="button"
            tabindex="0"
            class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                class:bg-green-50={center.is_read}
                class:text-green-700={center.is_read}
                class:bg-gray-100={!center.is_read}
                class:text-gray-500={!center.is_read}
              >
                {center.is_read ? '확인' : '미확인'}
              </span>
              <span class="text-sm font-medium text-gray-900"
                >{center.center_name}</span
              >
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-400">
                {center.read_count}/{center.member_count}명 조회
              </span>
              {#if center.first_read_at}
                <span class="text-xs text-gray-400">
                  최초 {formatDate(center.first_read_at, DATE_FORMAT)}
                </span>
              {/if}
              <svg
                class="h-4 w-4 text-gray-400 transition-transform {expandedCenterId ===
                center.center_id
                  ? 'rotate-180'
                  : ''}"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          {#if expandedCenterId === center.center_id}
            <div
              transition:slide
              class="border-t border-gray-100 bg-gray-50 px-4 py-3"
            >
              {#if centerDetailLoading[center.center_id]}
                <div
                  class="flex items-center justify-center py-4 text-sm text-gray-400"
                >
                  불러오는 중...
                </div>
              {:else if centerDetailCache[center.center_id]}
                <div class="space-y-2">
                  {#each centerDetailCache[center.center_id] as member}
                    <div class="flex items-center justify-between text-sm">
                      <div class="flex items-center gap-2">
                        <span
                          class="h-1.5 w-1.5 rounded-full"
                          class:bg-green-500={member.read_at}
                          class:bg-gray-300={!member.read_at}
                        ></span>
                        <span class="text-gray-900">{member.name}</span>
                        <span
                          class="rounded-md bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500"
                        >
                          {member.role_name}
                        </span>
                      </div>
                      <span class="text-xs text-gray-400">
                        {member.read_at
                          ? formatDate(member.read_at, DATE_FORMAT)
                          : '읽지 않음'}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- 페이지네이션 -->
    {#if readTotalPages > 1}
      <div class="mt-3 flex items-center justify-between">
        <span class="text-xs text-gray-400">
          {readTotalFiltered}개 중 {(readCurrentPage - 1) * readPageSize +
            1}-{Math.min(readCurrentPage * readPageSize, readTotalFiltered)}
        </span>
        <div class="flex items-center gap-1">
          <button
            onclick={() => (readCurrentPage = Math.max(1, readCurrentPage - 1))}
            disabled={readCurrentPage === 1}
            class="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ‹
          </button>
          {#each Array.from({ length: readTotalPages }, (_, i) => i + 1) as p}
            <button
              onclick={() => (readCurrentPage = p)}
              class="flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors {readCurrentPage ===
              p
                ? 'bg-primary-500 text-white'
                : 'text-gray-500 hover:bg-gray-100'}"
            >
              {p}
            </button>
          {/each}
          <button
            onclick={() =>
              (readCurrentPage = Math.min(readTotalPages, readCurrentPage + 1))}
            disabled={readCurrentPage === readTotalPages}
            class="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ›
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
