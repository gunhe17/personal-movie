<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import Select from './Select.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import NoticeBubble from '$lib/components/common/NoticeBubble.svelte'
  import { fade } from 'svelte/transition'

  interface Tab {
    value: string
    label: string
    count?: number
    /** 이 탭 위에 상시 노출할 말풍선 문구 (없으면 미노출) */
    notice?: string
  }

  interface SortOption {
    value: string
    title: string
  }

  interface Props {
    tabs: Tab[]
    activeTab: string
    onTabChange?: (tab: string) => void
    // 뷰 토글
    showViewToggle?: boolean
    viewType?: 'list' | 'grid'
    onViewChange?: (view: 'list' | 'grid') => void
    // 정렬
    showSort?: boolean
    sort?: string
    sortOptions?: SortOption[]
    onSortChange?: (sort: string) => void
    // 스타일
    class?: string
    /** 각 탭 버튼에 병합할 클래스 (예: 고정 폭 지정) */
    tabClass?: string
    /** 넘기면 tab.notice 말풍선에 닫기 버튼이 붙는다 */
    onNoticeClose?: (tab: string) => void
  }

  let {
    tabs,
    activeTab = $bindable(),
    onTabChange,
    showViewToggle = false,
    viewType = $bindable('list'),
    onViewChange,
    showSort = false,
    sort = $bindable('desc'),
    sortOptions = [
      { value: 'desc', title: '오래된 순' },
      { value: 'asc', title: '최신 순' }
    ],
    onSortChange,
    class: className,
    tabClass = '',
    onNoticeClose
  }: Props = $props()

  // 탭 행 높이 = 56 고정 (h-14) — Web_Design.md §Components>tab
  // (라벨 16 + 상하 패딩 20). 옛 py-5는 카운트 배지(22)가 붙는 탭만 62로 부풀려
  // 같은 탭바가 화면마다 다른 높이로 보였다(변경 요청 62 / 구성원 56).
  // 배지는 행 높이를 정하지 않고 56 안에서 세로 가운데 정렬된다.

  // 탭 인디케이터 애니메이션
  let tabsContainer: HTMLDivElement | null = $state(null)
  let tabRefs: Record<string, HTMLButtonElement | null> = $state({})
  let indicatorStyle = $state({ left: 0, width: 0 })
  let isMounted = $state(false)

  function handleTabClick(tab: string) {
    if (activeTab === tab) return
    activeTab = tab
    onTabChange?.(tab)
  }

  function handleViewClick(view: 'list' | 'grid') {
    viewType = view
    onViewChange?.(view)
  }

  function handleSortChange(value: string) {
    sort = value
    onSortChange?.(value)
  }

  function updateIndicator() {
    const activeTabEl = tabRefs[activeTab]
    if (activeTabEl && tabsContainer) {
      const containerRect = tabsContainer.getBoundingClientRect()
      const tabRect = activeTabEl.getBoundingClientRect()
      indicatorStyle = {
        left: tabRect.left - containerRect.left,
        width: tabRect.width
      }
    }
    updateNotice()
  }

  // 탭 위 말풍선 — 해당 탭의 가로 중앙에 맞춘다(인디케이터와 같은 측정 경로)
  const noticeTab = $derived(tabs.find((t) => t.notice))
  let noticeLeft = $state(0)

  function updateNotice() {
    if (!noticeTab || !tabsContainer) return
    const el = tabRefs[noticeTab.value]
    if (!el) return
    const containerRect = tabsContainer.getBoundingClientRect()
    const tabRect = el.getBoundingClientRect()
    noticeLeft = tabRect.left - containerRect.left + tabRect.width / 2
  }

  // 마운트 시 인디케이터 초기화 + ResizeObserver 등록
  $effect(() => {
    isMounted = true
    requestAnimationFrame(() => {
      updateIndicator()
    })

    if (!tabsContainer) return

    const observer = new ResizeObserver(() => {
      updateIndicator()
    })
    observer.observe(tabsContainer)
    for (const el of Object.values(tabRefs)) {
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  })

  // 활성 탭 변경 시 인디케이터 업데이트
  $effect(() => {
    void activeTab
    if (isMounted) {
      updateIndicator()
    }
  })

  // 말풍선은 데이터가 늦게 도착해 뒤늦게 붙는다 — 붙은 프레임에 위치 재측정
  $effect(() => {
    void noticeTab?.notice
    if (isMounted) {
      requestAnimationFrame(updateNotice)
    }
  })
</script>

<div
  class={twMerge(
    'flex items-center justify-between border-b border-gray-200',
    className
  )}
>
  <!-- 탭 버튼들 -->
  <div bind:this={tabsContainer} class="relative flex w-full xl:w-auto">
    {#each tabs as tab}
      <button
        bind:this={tabRefs[tab.value]}
        onclick={() => handleTabClick(tab.value)}
        class={twMerge(
          'relative flex h-14 flex-1 xl:flex-initial min-w-0 xl:min-w-20 items-center justify-center gap-x-1 whitespace-nowrap px-3 xl:px-7.75',
          tabClass
        )}
      >
        <Typography
          color={activeTab === tab.value ? 'text-primary-500' : 'text-gray-400'}
          variant="body-01-normal-medium"
          className="duration-200 transition-colors">{tab.label}</Typography
        >
        {#if tab.count !== undefined}
          <!-- 건수는 레이블에 딸린 수식어다 — 배지(원형 면)를 두면 탭 하나가
               '레이블 + 별개 요소'로 읽힌다. 면 없이 색만 레이블을 따른다 -->
          <Typography
            color={activeTab === tab.value
              ? 'text-primary-500'
              : 'text-gray-300'}
            variant="body-02-semibold"
            className="duration-200 transition-colors"
          >
            {tab.count}
          </Typography>
        {/if}
      </button>
    {/each}

    <!-- 슬라이딩 인디케이터 -->
    <div
      class="absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-300 ease-out"
      style="left: {indicatorStyle.left}px; width: {indicatorStyle.width}px;"
    ></div>

    <!-- 탭 위 상시 말풍선 — 탭 버튼 바깥(위)이라 탭 클릭을 가리지 않는다.
         가운데 정렬이 아니라 꼬리만 탭 중앙에 맞추고 오른쪽으로 뻗는다:
         탭바 위쪽은 페이지 타이틀 자리라, 가운데 정렬하면 타이틀 꼬리를 덮는다. -->
    {#if noticeTab?.notice}
      <div
        transition:fade={{ duration: 150 }}
        class="absolute bottom-full z-10 mb-1 -translate-x-1/2"
        style="left: {noticeLeft}px;"
      >
        <NoticeBubble
          text={noticeTab.notice}
          arrow="bottom"
          onClose={onNoticeClose && (() => onNoticeClose?.(noticeTab.value))}
        />
      </div>
    {/if}
  </div>

  <!-- 우측 컨트롤 -->
  {#if showViewToggle || showSort}
    <div class="flex items-center gap-3">
      <!-- 리스트/그리드 토글 -->
      {#if showViewToggle}
        <div
          class="flex items-center gap-1 rounded-lg border border-gray-200 p-1"
        >
          <Tooltip text="리스트 보기">
            <button
              onclick={() => handleViewClick('list')}
              aria-label="리스트 보기"
              class="rounded p-1.5 {viewType === 'list'
                ? 'bg-gray-100'
                : 'hover:bg-gray-50'}"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                class="text-gray-600"
              >
                <path
                  d="M3 5H17M3 10H17M3 15H17"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip text="그리드 보기">
            <button
              onclick={() => handleViewClick('grid')}
              aria-label="그리드 보기"
              class="rounded p-1.5 {viewType === 'grid'
                ? 'bg-gray-100'
                : 'hover:bg-gray-50'}"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                class="text-gray-600"
              >
                <rect
                  x="3"
                  y="3"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <rect
                  x="11"
                  y="3"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <rect
                  x="3"
                  y="11"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <rect
                  x="11"
                  y="11"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      {/if}

      <!-- 정렬 드롭다운 -->
      {#if showSort}
        <Select
          class="rounded-lg border border-gray-200"
          selected={sort}
          options={sortOptions}
          on:change={(e) => handleSortChange(e.detail.value)}
        />
      {/if}
    </div>
  {/if}
</div>
