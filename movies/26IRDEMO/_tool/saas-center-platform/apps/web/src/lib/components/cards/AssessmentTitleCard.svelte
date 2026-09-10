<script lang="ts">
  import type { SvelteComponent } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import AssessmentCardDefault from '$lib/assets/assessmentStartBg/AssessmentCardDefault.png'

  interface Props {
    title_ko: string
    title_en?: string
    backgroundImage?: string
    backgroundComponent?: typeof SvelteComponent<any>
    iconComponent?: typeof SvelteComponent<any>
    bgColor: string
    isOnlineAvailable?: boolean
    /** 운영 상태 Switch 표시 여부 (기본 true) */
    showSwitch?: boolean
    /** 운영 중 여부 (Switch 상태) */
    isActive?: boolean
    /** Switch 토글 콜백 */
    onToggle?: () => void
    /** 카드 클릭 콜백 — 지정 시 카드 전체가 검사 상세 진입점이 된다 */
    onCardClick?: () => void
  }

  let {
    title_ko,
    title_en = '',
    backgroundImage = '',
    backgroundComponent = undefined,
    iconComponent = undefined,
    bgColor,
    isOnlineAvailable = false,
    showSwitch = true,
    isActive = false,
    onToggle = () => {},
    onCardClick = undefined
  }: Props = $props()

  // 검사명이 길어 잘릴 때 → 카드 호버 시 텍스트를 슬라이드해 뒷부분 노출
  let titleEl = $state<HTMLElement | null>(null)
  let slidePx = $state(0)

  $effect(() => {
    title_ko // 검사명 변경 시 재측정
    const el = titleEl
    if (!el) return
    const measure = () => {
      const over = el.scrollWidth - el.clientWidth
      slidePx = over > 0 ? over : 0
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  })

  // 오버플로우 px에 비례한 슬라이드 지속시간(일정 속도), 최소 500ms
  const slideDuration = $derived(slidePx > 0 ? Math.max(slidePx * 16, 500) : 0)

  const clickable = $derived(!!onCardClick)

  function handleKeydown(e: KeyboardEvent) {
    if (!onCardClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCardClick()
    }
  }
</script>

{#if showSwitch}
  <!-- 헤더(색+패턴) + 흰 본문(온라인/오프라인·검사명 좌 · 운영 토글 우) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md {clickable
      ? 'cursor-pointer'
      : ''}"
    style="height: 176px;"
    role={clickable ? 'button' : undefined}
    tabindex={clickable ? 0 : undefined}
    onclick={onCardClick}
    onkeydown={handleKeydown}
  >
    <!-- 이미지 헤더 (색상 + 패턴) — 운영 안 하면 색을 빼서 카드 전체로 비활성을 알린다
         (선례: RoomCard 비활성 썸네일) -->
    <div
      class="flex-1 transition-all duration-200 {isActive
        ? ''
        : 'opacity-60 grayscale'}"
      style="background-color: {bgColor}; background-image: url('{AssessmentCardDefault}'); background-size: cover; background-position: center;"
    ></div>

    <!-- 흰 본문: 온라인/오프라인 + 검사명 (좌) · 운영 토글 (우) -->
    <div class="flex items-center justify-between gap-2 bg-white p-4">
      <div class="flex min-w-0 flex-col gap-3">
        <Typography variant="body-03-normal-medium" color="text-gray-500">
          {isOnlineAvailable ? '온라인' : '오프라인'}
        </Typography>
        <!-- 검사명: 잘리면 호버 시 슬라이드로 뒷내용 노출 -->
        <div class="overflow-hidden">
          <p
            bind:this={titleEl}
            class="w-full truncate-safe text-body-01-normal-semibold {isActive
              ? 'text-gray-800'
              : 'text-gray-500'} transition-transform ease-linear group-hover:w-max group-hover:[text-overflow:clip] group-hover:[transform:translateX(var(--slide))]"
            style="--slide:-{slidePx}px; transition-duration:{slideDuration}ms"
          >
            {title_ko}
          </p>
        </div>
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="flex shrink-0 items-center gap-2"
        onclick={(e) => e.stopPropagation()}
      >
        <Typography
          variant="body-02-medium"
          color={isActive ? 'text-primary-500' : 'text-gray-400'}
        >
          {isActive ? '운영중' : '운영안함'}
        </Typography>
        <Switch
          checked={isActive}
          onclick={onToggle}
          ariaLabel="{title_ko} 운영 토글"
        />
      </div>
    </div>
  </div>
{:else}
  <!-- 검사 세트 내 카드: 메인 카드와 동일(상단 그래픽 + 하단 온라인/오프라인·검사명), 토글 없음 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white {clickable
      ? 'cursor-pointer transition-shadow hover:shadow-md'
      : ''}"
    style="height: 176px;"
    role={clickable ? 'button' : undefined}
    tabindex={clickable ? 0 : undefined}
    onclick={onCardClick}
    onkeydown={handleKeydown}
  >
    <!-- 이미지 헤더 (색상 + 패턴) -->
    <div
      class="flex-1"
      style="background-color: {bgColor}; background-image: url('{AssessmentCardDefault}'); background-size: cover; background-position: center;"
    ></div>

    <!-- 흰 본문: 온라인/오프라인 + 검사명 -->
    <div class="flex flex-col gap-3 bg-white p-4">
      <Typography variant="body-03-normal-medium" color="text-gray-500">
        {isOnlineAvailable ? '온라인' : '오프라인'}
      </Typography>
      <!-- 검사명: 잘리면 호버 시 슬라이드로 뒷내용 노출 -->
      <div class="overflow-hidden">
        <p
          bind:this={titleEl}
          class="w-full truncate-safe text-body-01-normal-semibold text-gray-800 transition-transform ease-linear group-hover:w-max group-hover:[text-overflow:clip] group-hover:[transform:translateX(var(--slide))]"
          style="--slide:-{slidePx}px; transition-duration:{slideDuration}ms"
        >
          {title_ko}
        </p>
      </div>
    </div>
  </div>
{/if}
