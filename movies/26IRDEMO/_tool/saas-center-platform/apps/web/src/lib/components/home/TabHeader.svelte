<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  import Button from '$lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'

  type TabType = 'schedule' | 'home'

  interface TabInfo {
    key: TabType
    label: string
    showCount?: boolean
  }

  interface ButtonConfig {
    label: string
    show: boolean
  }

  interface Props {
    activeTab?: TabType
    todoCount?: number
    onTabChange?: (tab: TabType) => void
    onActionClick?: (tab: TabType) => void
  }

  let {
    activeTab = $bindable('schedule'),
    todoCount = 0,
    onTabChange,
    onActionClick
  }: Props = $props()

  const tabs: TabInfo[] = [
    { key: 'schedule', label: '오늘의 일정' },
    { key: 'home', label: '일정 요약' }
  ]

  // 탭별 버튼 설정
  const buttonConfigs: Record<TabType, ButtonConfig> = {
    home: { label: '', show: false },
    schedule: { label: '스케줄 확인', show: true }
  }

  // 현재 탭의 버튼 설정
  let currentButtonConfig = $derived(buttonConfigs[activeTab])
  // 각 탭 버튼의 ref를 저장
  let tabRefs: Record<TabType, HTMLButtonElement | null> = $state({
    home: null,
    schedule: null,
    todo: null,
    custom: null
  })
  // 탭 컨테이너 ref
  let tabContainerRef: HTMLDivElement | null = $state(null)
  // 인디케이터 위치 계산
  let indicatorStyle = $state('left: 0px;')
  // 초기 렌더링 여부 (트랜지션 제어용)
  let isInitialRender = $state(true)
  // 위치 계산 완료 여부 (블링크 방지용)
  let isPositionReady = $state(false)

  const updateIndicatorPosition = (tab: TabType) => {
    const buttonEl = tabRefs[tab]
    const containerEl = tabContainerRef

    if (buttonEl && containerEl) {
      const containerRect = containerEl.getBoundingClientRect()
      const buttonRect = buttonEl.getBoundingClientRect()

      // 버튼 중앙에서 인디케이터(40px) 중앙이 오도록 계산
      const buttonCenter =
        buttonRect.left - containerRect.left + buttonRect.width / 2
      const indicatorLeft = buttonCenter - 20 // 40px / 2 = 20px

      indicatorStyle = `left: ${indicatorLeft}px;`

      // 위치 계산 완료 표시
      if (!isPositionReady) {
        isPositionReady = true
      }

      // 초기 렌더링 후 트랜지션 활성화
      if (isInitialRender) {
        requestAnimationFrame(() => {
          isInitialRender = false
        })
      }
    }
  }

  const handleTabClick = (tab: TabType) => {
    activeTab = tab
    onTabChange?.(tab)

    // URL 업데이트 (히스토리에 추가)
    const url = new URL(page.url)
    url.searchParams.set('tab', tab)
    goto(url.toString(), { replaceState: false, keepFocus: true })
  }

  const handleActionClick = () => {
    onActionClick?.(activeTab)
  }

  // URL에서 탭 상태 초기화
  $effect(() => {
    const urlTab = page.url.searchParams.get('tab') as TabType | null
    if (urlTab && tabs.some((t) => t.key === urlTab)) {
      activeTab = urlTab
    }
  })

  // activeTab 변경 시 인디케이터 위치 업데이트
  $effect(() => {
    updateIndicatorPosition(activeTab)
  })
</script>

<div
  class="flex h-18 items-center justify-between rounded-lg bg-white px-5 py-6.5 shadow-sm border border-gray-200"
>
  <div class="relative flex items-center gap-6" bind:this={tabContainerRef}>
    {#each tabs as tab}
      <button
        class="relative"
        bind:this={tabRefs[tab.key]}
        onclick={() => handleTabClick(tab.key)}
      >
        <div class="flex items-center gap-1">
          <Typography
            variant="headline-02-semibold"
            color={activeTab === tab.key ? 'text-primary-400' : 'text-gray-300'}
          >
            {tab.label}
          </Typography>
          {#if tab.showCount && todoCount > 0}
            <div class="flex-center h-5 w-5 rounded-md bg-[#256EF41A]">
              <Typography variant="body-02-semibold" color="text-primary">
                {todoCount}
              </Typography>
            </div>
          {/if}
        </div>
      </button>
    {/each}
    <!-- 슬라이딩 인디케이터 -->
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div
      class="absolute -bottom-6.5 h-0.5 w-10 bg-primary-500 {isInitialRender
        ? ''
        : 'transition-all duration-300 ease-out'} {isPositionReady
        ? 'opacity-100'
        : 'opacity-0'}"
      style={indicatorStyle}
    />
  </div>
  {#if currentButtonConfig.show}
    <Button
      size="md"
      class="h-10 rounded-lg bg-primary-400 px-[13.5px]"
      onclick={handleActionClick}
    >
      <Typography variant="body-02-semibold" color="white">
        {currentButtonConfig.label}
      </Typography>
    </Button>
  {/if}
</div>
