<script lang="ts" module>
  export type StepVariant = 'active' | 'completed' | 'pending'

  export interface SidebarStep {
    label: string
    /**
     * Material Symbols 이름.
     *
     * 필수다 — 하나만 빠져도 그 행의 라벨이 아이콘 폭만큼 왼쪽으로 밀려
     * 사이드바 정렬이 어긋난다. 값은 ExamStep.icon(모듈 선언)에서 온다.
     */
    icon: string
    active: boolean
    badge: { label: string; variant: StepVariant }
    /** 잠긴 단계(아직 진입 불가). true면 클릭 비활성. */
    locked?: boolean
    /** locked일 때 마우스 오버로 보일 사유. */
    lockedHint?: string
    /** 단계 클릭 시 이동 핸들러. 없으면(또는 active) 클릭 불가. */
    onClick?: () => void
  }

  export interface ClientFooter {
    id: string
    name: string
    birth_date: string | null
    gender: string | null
  }

  export interface ExamFooter {
    scheduled_at?: string | null
    created_at?: string | null
  }
</script>

<script lang="ts">
  /**
   * 검사(HTP/SCT/로르샤하) 공통 레이아웃 셸.
   *
   * 이전에는 검사마다 사이드바 마크업이 따로 있어서 헤더 높이·부제 유무·
   * 상태 점 애니메이션이 조금씩 어긋났다. 여기로 합쳐 한 벌만 둔다.
   *
   * 검사 화면은 목록 화면과 크롬 구성이 다르다 — 알림 드롭다운은 두지 않고
   * (검사 중 주의를 뺏는다), 마스킹 토글은 마스킹 대상인 내담자 이름 옆
   * 사이드바에 둔다. 이탈 경로는 헤더의 '검사 중단' 하나로 모은다.
   */
  import type { Snippet } from 'svelte'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { createExamExit } from './exam-exit.svelte'
  import { page } from '$app/state'
  import { getExamContext } from './exam-context.svelte'
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'
  import Close from '$lib/assets/icons/Close.svelte'
  import Drawer from '$lib/components/layout/Drawer.svelte'
  import HamburgerButton from '$lib/components/layout/HamburgerButton.svelte'
  import SecretModeToggle from '$lib/components/layout/SecretModeToggle.svelte'
  import PersonAvatar from '$lib/components/ui/PersonAvatar.svelte'
  import Icon from '$lib/components/ui/Icon.svelte'
  import {
    calcAge,
    clientCode,
    formatDate,
    genderLabel
  } from '$lib/utils/format'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { maskName } from '$lib/utils/masking'

  interface Props {
    /** 헤더 좌측 제목 — 현재 단계명 */
    headerTitle: string
    /** 헤더 제목 아래 보조 설명 */
    headerSubtitle?: string
    /**
     * 사이드바 단계 목록 — 생략하면 컨텍스트가 만들어 준 것을 그대로 쓴다.
     *
     * 넘길 일은 거의 없다. 일시 작업 표시는 ctx.setBusy()가 담당하므로
     * 뱃지를 갈아끼우려고 손으로 map한 배열을 넘기지 않는다.
     */
    steps?: SidebarStep[]
    /** 헤더 우측, 이탈 버튼 왼편에 놓일 페이지별 액션 */
    headerExtras?: Snippet
    /**
     * 화면을 벗어나는 액션. 헤더 우측에 항상 하나 렌더된다 —
     * 사이드바의 '검사 목록' 링크를 걷어냈으므로 여기가 유일한 출구다.
     * 넘기지 않으면 검사 목록으로 이동한다.
     */
    onExit?: () => void
    /**
     * 이탈 버튼의 성격.
     * - 'cancel': 진행 중인 검사를 중단하고 나간다(주의 색).
     * - 'leave': 볼 일이 끝난 화면에서 목록으로 돌아간다(중립 색).
     * 확정된 검사에서 '중단'은 뜻이 맞지 않으므로 결과 화면은 'leave'를 쓴다.
     */
    exitMode?: 'cancel' | 'leave'
    /** 이탈 버튼 라벨 — 기본값은 exitMode에 따라 결정된다 */
    exitLabel?: string
    /**
     * 본문 <main>에 덧붙일 클래스. 골격(flex-1/flex-col/overflow-hidden/bg-background)은
     * 셸이 고정하고, 여기서는 패딩·정렬처럼 페이지마다 다른 것만 넘긴다.
     */
    mainClass?: string
    /**
     * 화면 하단 고정 푸터. <main> 밖 형제로 렌더되므로 mainClass의 패딩을 타지 않고
     * 항상 바닥에 붙는다 — 푸터를 children 안에 넣으면 본문 패딩만큼 떠 보인다.
     */
    footer?: Snippet
    children: Snippet
  }

  let {
    headerTitle,
    headerSubtitle,
    steps: stepsOverride,
    headerExtras,
    onExit,
    exitMode = 'cancel',
    exitLabel,
    mainClass = '',
    footer,
    children
  }: Props = $props()

  /**
   * 검사명·내담자·단계는 전부 컨텍스트에서 온다.
   *
   * 예전에는 8개 step 컴포넌트가 examTitle/examSubtitle/steps/client/exam/
   * isLoading 6개를 넘겼는데 전부 layoutCtx를 그대로 통과시키는 값이었다.
   * 특히 검사명은 모듈 선언에 title/subtitle이 있는데도 쓰는 곳이 하나도 없고
   * 8곳이 리터럴로 다시 적고 있었다("HTP 검사"·"로샤 검사"...). 선언과 화면이
   * 어긋나도 아무도 모르는 구조였다.
   */
  const ctx = getExamContext()
  let examTitle = $derived(ctx.module.title)
  let examSubtitle = $derived(ctx.module.subtitle)
  let steps = $derived(stepsOverride ?? ctx.steps)
  let client = $derived(ctx.client)
  let exam = $derived(ctx.exam)
  let isLoading = $derived(ctx.isLoading)

  /**
   * ?embed=1 — 종합보고서 모달이 결과 화면을 iframe으로 띄우는 경로.
   *
   * 예전에는 세 Results가 각자 searchParams를 읽고 {#if embed} 분기를 복붙했다.
   * 새 검사가 이걸 잊으면 리포트 모달 안에 사이드바가 두 겹으로 뜨는데,
   * 잊었는지 알 방법이 없었다. 셸이 흡수해 호출부는 embed를 모르게 한다.
   *
   * 임베드에서는 헤더·사이드바뿐 아니라 footer/headerExtras도 그리지 않는다 —
   * '확정하기'·'PDF 다운로드' 같은 액션은 모달 안에 있을 자리가 아니다.
   * (세 Results가 이미 그렇게 하고 있었다.)
   */
  let embed = $derived(page.url.searchParams.get('embed') === '1')

  let drawerOpen = $state(false)

  // 이탈 버튼 — 사이드바 '검사 목록' 링크를 걷어냈으므로 화면마다 반드시 하나 있어야 한다.
  let resolvedExitLabel = $derived(
    exitLabel ?? (exitMode === 'cancel' ? '검사 중단' : '목록으로')
  )
  let exitToneClass = $derived(
    exitMode === 'cancel'
      ? 'text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
      : 'text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
  )
  /** 보던 목록 페이지·필터로 돌아가기 위한 주소 (exam-exit 주석 참고) */
  const exit = createExamExit()

  /**
   * 단계 사이드바 접힘 — 메인 사이드바와 같은 방식(localStorage 기억).
   * 드로어(< lg)에서는 접힘을 무시하고 항상 펼친다.
   */
  const COLLAPSE_KEY = 'exam-sidebar-collapsed'
  let isCollapsed = $state(
    browser ? localStorage.getItem(COLLAPSE_KEY) === 'true' : false
  )
  function toggleCollapse() {
    isCollapsed = !isCollapsed
    if (browser) localStorage.setItem(COLLAPSE_KEY, String(isCollapsed))
  }

  function handleExit() {
    if (onExit) onExit()
    else goto(exit.listUrl)
  }

  // 흰 크롬 위에서는 옅은 면 + 진한 글자로 대비를 잡는다(다크의 /30 반투명 면은
  // 흰 배경에서 글자가 뜨지 않는다).
  function badgeColors(variant: StepVariant): string {
    if (variant === 'active') return 'bg-primary-50 text-primary-700'
    if (variant === 'completed') return 'bg-green-50 text-green-700'
    return 'bg-gray-100 text-gray-500'
  }
</script>

{#snippet stepInner(step: SidebarStep, iconClass: string, collapsed = false)}
  <span class="material-icons-round shrink-0 text-xl {iconClass}">{step.icon}</span>
  {#if !collapsed}
    <!-- 클래스명을 문자열로 조합하면 Tailwind가 스캔하지 못한다 — 완전한 이름으로 분기 -->
    <!--
      **whitespace-nowrap이 필수다.** 폭이 280→64px로 줄어드는 동안 텍스트가
      아직 남아 있어서, 줄바꿈이 허용되면 전환 내내 2줄로 찌그러졌다 펴진다.
      nowrap이면 줄이 유지된 채 컨테이너 밖으로 밀려나고 overflow-hidden이 자른다.
      (메인 사이드바가 쓰는 것과 같은 방법)
    -->
    <span
      class="whitespace-nowrap {step.active
        ? 'text-body-03-normal-semibold'
        : 'text-body-03-normal-regular'}"
    >
      {step.label}
    </span>
    <span
      class="ml-auto shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-label-02-normal-medium {badgeColors(
        step.badge.variant
      )}"
    >
      {step.badge.label}
    </span>
  {/if}
{/snippet}

<!--
  단계 사이드바 접기 — 메인 사이드바(`components/layout/Sidebar.svelte`)와
  같은 방식이다: localStorage 기억, 가장자리 원형 토글, 접히면 아이콘만.

  검사 화면은 카드가 클수록 좋다(§14-3). 단계 목록은 이동할 때만 필요하므로
  상시 280px를 먹을 이유가 없다.

  **키를 메인 사이드바와 따로 쓴다** — 둘은 다른 축이다. 메뉴를 접어둔
  사람이 검사 단계까지 접히길 원한다고 볼 수 없다.
-->
{#snippet sidebarContent(inDrawer = false)}
  {@const collapsed = inDrawer ? false : isCollapsed}
  <div
    style="width: {collapsed ? 'var(--spacing-aside-collapsed)' : 'var(--spacing-aside)'};"
    class="relative flex h-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-300"
  >
    <!-- 가장자리 접기 토글 — 메인 사이드바와 같은 위치·크기 -->
    {#if !inDrawer}
    <button
      type="button"
      onclick={toggleCollapse}
      class="absolute -right-3 top-1/2 z-50 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-600"
      title={collapsed ? '단계 펼치기' : '단계 접기'}
      aria-label={collapsed ? '단계 펼치기' : '단계 접기'}
    >
      <svg
        class="h-3.5 w-3.5 transition-transform duration-300 {collapsed
          ? 'rotate-180'
          : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>
    {/if}

    <!--
      검사명은 헤더(전폭)로 올라갔다. 여기서 반복하면 같은 문구가 두 번 보인다.
      '검사 목록' 링크와 '검사 진행 중' 뱃지도 걷어냈다 —
      전자는 헤더 이탈 버튼과 중복이고, 후자는 아래 단계별 뱃지와 중복이었다.
    -->
    <nav class="flex-1 overflow-y-auto px-3 pt-4">
      <ul class="flex flex-col gap-1">
        {#each steps as step (step.label)}
          <li>
            {#if step.active}
              <!-- 활성: 앱 사이드바와 같은 rounded-xl 면 (왼쪽 파란 바 대신) -->
              <div
                title={collapsed ? step.label : ''}
                class="flex items-center gap-3 overflow-hidden rounded-xl bg-gray-50 py-3 text-gray-900 {collapsed
                  ? 'justify-center px-0'
                  : 'px-4'}"
              >
                {@render stepInner(step, 'text-primary-500', collapsed)}
              </div>
            {:else if step.locked || !step.onClick}
              <div
                class="flex cursor-not-allowed items-center gap-3 overflow-hidden py-3 text-gray-300 {collapsed
                  ? 'justify-center px-0'
                  : 'px-4'}"
                title={collapsed
                  ? `${step.label} — ${step.lockedHint ?? ''}`
                  : step.lockedHint}
              >
                {@render stepInner(step, '', collapsed)}
              </div>
            {:else}
              <button
                type="button"
                onclick={() => {
                  drawerOpen = false
                  step.onClick?.()
                }}
                title={collapsed ? step.label : ''}
                class="group flex w-full items-center gap-3 overflow-hidden rounded-xl py-3 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 {collapsed
                  ? 'justify-center px-0'
                  : 'px-4'}"
              >
                {@render stepInner(
                  step,
                  'text-gray-400 group-hover:text-gray-600',
                  collapsed
                )}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </nav>

    <!--
      검사 메타 — 스텝 목록의 꼬리. 검사일은 내담자가 아니라 검사의 속성이라
      아래 내담자 블록과 층을 나눴다. (중단 버튼은 헤더 우측에 있다)
    -->
    <div class="shrink-0 px-5 pb-4 {collapsed ? 'hidden' : ''}">
      <div
        class="flex items-center gap-1.5 overflow-hidden border-t border-gray-100 pt-3 whitespace-nowrap"
      >
        <Icon name="event" size="sm" class="text-gray-400" />
        <!--
          일정이 없으면 '검사일'이라 부르지 않는다 — 등록일을 검사일로 표시하면
          아무도 그 날로 잡은 적 없는 날짜가 검사일이 된다(앵커가 만들던 거짓말과
          같은 종류다. docs/온톨로지/앵커개념-제거.md).
          여기서는 타임라인처럼 숨기는 대신 라벨을 바꿔 사실대로 적는다 —
          검사 헤더는 "이 검사가 언제 것인지"를 알려주는 자리이므로.
        -->
        <span class="shrink-0 text-label-01-normal-regular text-gray-400"
          >{exam?.scheduled_at ? '검사일' : '등록일'}</span
        >
        <span class="truncate text-label-01-normal-regular text-gray-600">
          {#if isLoading}
            -
          {:else}
            {formatDate(exam?.scheduled_at ?? exam?.created_at ?? null)}
          {/if}
        </span>
      </div>
    </div>

    <!--
      내담자 정보 — 검사 중 가장 자주 확인하는 정보라 시선이 먼저 닿아야 한다.
      이전에는 h-16(64px)에 3줄을 욱여넣어 전부 12px로 눌려 눈에 띄지 않았다.
      아바타로 시선을 걸고 이름을 키웠다.
    -->
    <!-- h-16 — 본문 푸터와 같은 높이라 바닥선이 맞는다. -->
    <div
      class="flex h-16 shrink-0 items-center border-t border-gray-200 {collapsed
        ? 'justify-center px-0'
        : 'px-5'}"
    >
      <div
        class="flex w-full items-center gap-3 overflow-hidden {collapsed
          ? 'justify-center'
          : ''}"
      >
        {#if isLoading}
          <div
            class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100"
          ></div>
          {#if !collapsed}
            <div class="min-w-0 flex-1">
              <div class="h-4 w-24 animate-pulse rounded bg-gray-100"></div>
              <div
                class="mt-1.5 h-3 w-32 animate-pulse rounded bg-gray-100"
              ></div>
            </div>
          {/if}
        {:else if client}
          {@const displayName = secretModeStore.enabled
            ? maskName(client.name)
            : client.name}
          <span class="shrink-0" title={collapsed ? displayName : ''}>
            <PersonAvatar
              name={client.name}
              gender={client.gender}
              role="client"
              size={40}
            />
          </span>
          {#if !collapsed}
          <div class="min-w-0 flex-1">
            <p class="flex items-baseline gap-1.5 leading-snug">
              <span class="truncate text-body-02-normal-semibold text-gray-900">
                {displayName}
              </span>
              <span class="shrink-0 text-label-02-normal-regular text-gray-400">
                {clientCode(client.id)}
              </span>
            </p>
            <p
              class="mt-0.5 truncate text-label-01-normal-regular leading-snug text-gray-500"
            >
              {#if calcAge(client.birth_date) !== null}만 {calcAge(
                  client.birth_date
                )}세{:else}만 -{/if}
              · {genderLabel(client.gender)}
            </p>
          </div>
          <!-- 마스킹 토글은 마스킹 대상(내담자 이름) 바로 옆에 둔다. -->
          <SecretModeToggle tone="light" class="shrink-0" />
          {/if}
        {:else}
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
          >
            <Icon name="person" size="md" />
          </span>
          {#if !collapsed}
            <div class="min-w-0 flex-1">
              <p class="text-body-02-normal-semibold leading-snug text-gray-400">
                내담자 없음
              </p>
              <p
                class="mt-0.5 text-label-01-normal-regular leading-snug text-gray-400"
              >
                —
              </p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#if embed}
  <!-- 임베드: 크롬 없이 본문만. mainClass는 일반 모드와 같은 것을 쓴다. -->
  <main class="flex h-screen flex-col overflow-hidden bg-background {mainClass}">
    {@render children()}
  </main>
{:else}
<!--
  골격 — 헤더가 전폭 최상단, 사이드바는 그 아래.
  (메인 레이아웃 routes/(protected)/+layout.svelte와 같은 순서. 검사명은
  헤더가 갖는다 — 메인에서 로고가 있는 자리와 같다.)
-->
<div class="fixed inset-0 z-50 flex h-screen flex-col overflow-hidden bg-gray-50">
  <header
    class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:px-6"
  >
    <div class="flex min-w-0 items-center gap-2">
      <HamburgerButton
        onClick={() => (drawerOpen = true)}
        hideAt="lg"
        tone="light"
      />
      <!--
        검사명 · 부제 / 현재 단계 — 큰 것에서 작은 것 순으로 좁혀 읽힌다.
        부제는 검사명에 딸린 설명이라 검사명 옆에 붙고, 구분선 뒤에 현재 단계가 온다.
      -->
      <div class="flex min-w-0 items-baseline gap-2">
        <h1 class="shrink-0 text-body-01-normal-bold text-gray-900">
          {examTitle}
        </h1>
        {#if examSubtitle}
          <span
            class="hidden shrink-0 text-label-01-normal-regular text-gray-400 md:inline"
          >
            {examSubtitle}
          </span>
        {/if}
        <span class="shrink-0 text-gray-300">/</span>
        <h2 class="truncate text-body-02-normal-medium text-gray-700">
          {headerTitle}
        </h2>
        {#if headerSubtitle}
          <span
            class="hidden truncate text-label-01-normal-regular text-gray-400 md:inline"
          >
            {headerSubtitle}
          </span>
        {/if}
      </div>
    </div>

    <!--
      알림 드롭다운은 두지 않는다 — 검사 수행 중에 다른 알림으로 주의를
      돌리게 하는 자리가 아니다. 마스킹 토글은 마스킹 대상(내담자 이름)
      옆이 소속이 맞아 사이드바로 내렸다.
    -->
    <div class="flex shrink-0 items-center gap-2">
      {#if headerExtras}
        {@render headerExtras()}
      {/if}

      <!--
        출구는 화면마다 반드시 하나 있어야 한다(사이드바 목록 링크를 걷어냈다).
        진행 중이면 '검사 중단', 볼 일이 끝난 화면이면 '목록으로'.
      -->
      <button
        type="button"
        onclick={handleExit}
        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-label-01-normal-medium transition-colors {exitToneClass}"
      >
        {#if exitMode === 'cancel'}
          <Close size={16} />
        {:else}
          <ArrowLeft size={16} />
        {/if}
        {resolvedExitLabel}
      </button>
    </div>
  </header>

  <div class="flex min-h-0 flex-1">
    <!-- Sidebar (lg+ 인라인) -->
    <div class="hidden lg:contents">
      {@render sidebarContent(false)}
    </div>

    <!-- Sidebar (< lg 드로어) -->
    <Drawer
      open={drawerOpen}
      onClose={() => (drawerOpen = false)}
      side="left"
      hideAt="lg"
    >
      {@render sidebarContent(true)}
    </Drawer>

    <!--
      단계 전환 페이드 — 앱의 다른 페이지들과 **같은 방식**이다(목록·대시보드·
      설정이 페이지 루트에 `in:fade`를 건다). 검사 화면만 딱 갈리던 것을 맞춘다.

      **본문에만 건다.** 단계 사이드바와 헤더는 그대로 두어야 어디에 있는지가
      끊기지 않는다 — 크롬까지 함께 페이드하면 단계를 옮길 때마다 화면 전체가
      깜빡여 [step]/+page.svelte가 폴백을 한 번만 띄우도록 애써 만든 이유가
      사라진다.

      `out:`은 두지 않는다. 나가는 화면을 전이가 끝날 때까지 DOM에 남겨두면
      두 단계가 잠시 함께 존재하는데, 검사 화면은 캔버스·팝오버가 viewport
      좌표를 재므로(ResponsePopover) 그 사이 측정이 엉킨다.

      ⚠️ **`|global`이 없으면 아예 재생되지 않는다.** 전이는 기본이 local이라
      "자기가 속한 블록"이 생길 때만 돈다. 이 div는 `{#if embed}…{:else}`
      블록 안에 있고, 단계를 옮길 때 새로 만들어지는 것은 그 블록이 아니라
      **셸 컴포넌트 자체**다(부모가 만든다) — 그래서 억제된다.
    -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden" in:fade|global>
      <main
        class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 {mainClass}"
      >
        {@render children()}
      </main>

      {#if footer}
        {@render footer()}
      {/if}
    </div>
  </div>
</div>
{/if}
