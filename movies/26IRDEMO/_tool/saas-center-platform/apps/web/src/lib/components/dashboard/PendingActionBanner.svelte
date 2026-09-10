<script lang="ts" module>
  export interface PendingActionButton {
    label: string
    /**
     * primary = 주 처리 · outline = 보조·이동 · danger = 거절 계열 ·
     * text = 면도 테두리도 없는 텍스트 액션(이동처럼 '처리'가 아닌 것)
     */
    variant: 'primary' | 'outline' | 'danger' | 'text'
    /** run 대신 이동 (배너에서 항목을 빼지 않는다) */
    href?: string
    /** 실행 후 false가 아니면 이 항목을 배너에서 뺀다 */
    run?: () => Promise<boolean | void> | boolean | void
  }

  export interface PendingActionItem {
    id: string
    /**
     * 종류 — 좌측 아이콘과 그 배경 톤을 가른다(라벨 배지는 두지 않는다).
     * notice = 확성기·읽고 확인 · request = 캘린더·승인/반려 응답
     */
    tone: 'notice' | 'request'
    /** 제목 앞에 [ ]로 붙는 종류 표기 — 배지가 아니라 텍스트 (공지의 점검·업데이트 등) */
    category?: string | null
    title: string
    /** 있으면 아이콘·텍스트 영역이 클릭 가능해진다(상세 모달 열기) */
    onOpen?: () => void
    /**
     * 제목 옆 인라인 '변경 전 → 후'. 기존 값은 본문색, 요청된 값은 primary로
     * 찍어 어느 쪽이 새 값인지 색으로 바로 읽히게 한다.
     */
    change?: { from: string; to: string } | null
    actions: PendingActionButton[]
  }
</script>

<script lang="ts">
  /**
   * 확인 요청 배너 — 대시보드 상단의 **응답 대기함**.
   *
   * 헤더 알림 벨과 역할이 다르다. 벨은 "일어난 일"(사건 피드)이라 읽으면 끝이고,
   * 이 배너는 "내 응답을 기다리는 것"이라 **처리해야 사라진다** — 새 공지 확인,
   * 내담자의 일정 변경 요청 승인·반려처럼 상대가 답을 기다리는 항목만 온다.
   * 그래서 건수가 적고(0~3), 각 항목이 그 자리에서 처리 액션을 갖는다.
   *
   * 여러 건이면 좌우 화살표로 넘겨 본다 — 종류가 섞여도 한 줄 높이를 유지한다.
   * (케어보드 새 메시지 등 다음 신호도 같은 PendingActionItem 형태로 합류한다)
   */
  import { twMerge } from 'tailwind-merge'
  import Typography from '@common/components/Typography.svelte'
  import Megaphone20 from '$lib/assets/Megaphone20.svelte'
  import CalendarBlue20 from '$lib/assets/CalendarBlue20.svelte'
  import ChevronIcon from '$lib/assets/ChevronIcon.svelte'
  import CloseStrokeIcon20 from '$lib/assets/CloseStrokeIcon20.svelte'

  interface Props {
    items: PendingActionItem[]
    /**
     * 배치 보정 — 기본값은 대시보드 히어로 위로 끌어올리는 값(`-mt-8 mb-8`,
     * 가운데 1120)이라 그 레이아웃 전용이다. 일반 흐름에 두는 화면(일정 등)은
     * 여기서 마진·최대폭을 덮는다. twMerge라 뒤가 이긴다.
     */
    class?: string
  }

  let { items, class: className = '' }: Props = $props()

  /** 이 화면에서 처리해 배너에서 뺀 항목 */
  let dismissed = $state(new Set<string>())
  /**
   * 지금 이 화면에서만 배너를 접어둔 상태 — **저장하지 않는다.**
   * 새로고침하면 다시 뜬다: 응답 대기 항목은 사라진 게 아니라 잠시 치운 것뿐이고,
   * 영구히 숨기면 처리해야 사라지는 배너의 성격이 무너진다.
   */
  let closed = $state(false)
  const visible = $derived(items.filter((n) => !dismissed.has(n.id)))
  let index = $state(0)
  /** 처리 중인 항목 — 연타·화살표 이동을 함께 막는다 */
  let busyId = $state<string | null>(null)

  const current = $derived(visible[Math.min(index, visible.length - 1)] ?? null)

  function move(delta: number) {
    if (!visible.length || busyId) return
    index = (index + delta + visible.length) % visible.length
  }

  async function run(item: PendingActionItem, action: PendingActionButton) {
    if (!action.run || busyId) return
    busyId = item.id
    try {
      const done = await action.run()
      if (done === false) return
      dismissed = new Set([...dismissed, item.id])
      // 마지막 항목을 처리하면 인덱스가 목록 밖으로 나간다 — 한 칸 당긴다
      if (index > 0) index -= 1
    } finally {
      busyId = null
    }
  }

  // 종류는 좌측 아이콘 도형(확성기/캘린더)이 말한다 — 뒤 배경은 중립 그레이로 통일하고,
  // 색은 아이콘 자신이 갖는다(확성기 몸통 = 코럴, 물결 = primary).
  const ICON_COLOR = {
    notice: 'text-primary-500',
    request: ''
  }

  // 패딩·글자 크기까지 variant가 통째로 갖는다 — 공통 골격에 두고 덮어쓰면
  // twMerge가 커스텀 타이포 클래스(text-body-*)를 색 클래스와 같은 그룹으로 보고
  // 둘 중 하나를 떨어뜨릴 수 있다. 충돌 자체를 만들지 않는다.
  const ACTION_CLASS = {
    primary:
      'px-4 text-body-02-normal-medium bg-primary-500 text-white hover:bg-primary-600 disabled:bg-action-primary-disabled',
    outline:
      'px-4 text-body-02-normal-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:text-gray-400',
    danger:
      'px-4 text-body-02-normal-medium border border-red-200 text-status-danger hover:border-transparent hover:bg-status-danger-bg disabled:text-gray-400',
    // 면·테두리 없이 글자만. 좌우 패딩도 걷어 버튼 영역을 차지하지 않고,
    // 글자도 한 단 작게(15→14) 처리 버튼과 급을 가른다.
    // 높이(h-10)만 남겨 옆의 반려·승인과 세로 중심선을 맞춘다.
    text: 'px-2 text-body-03-normal-medium text-gray-600 underline-offset-4 hover:text-gray-800 hover:underline disabled:text-gray-400'
  }

  const ACTION_BASE =
    'flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg transition-colors'

  const actionClass = (variant: PendingActionButton['variant']) =>
    `${ACTION_BASE} ${ACTION_CLASS[variant]}`
</script>

{#if current && !closed}
  {@const iconColor = ICON_COLOR[current.tone] ?? ''}
  {#snippet leading()}
    <!-- 아이콘은 에셋 네이티브 크기(20) 그대로 -->
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 {iconColor}"
    >
      {#if current.tone === 'request'}
        <CalendarBlue20 />
      {:else}
        <Megaphone20 />
      {/if}
    </span>

    <!-- 제목 + 변경 시각. 사이에 세로 구분선을 두지 않으므로 간격은 8(4배수) —
           6은 인라인 구분선 주변에만 쓰는 값이다(§Spacing) -->
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {#if current.category}
        <Typography
          variant="body-02-normal-medium"
          color="text-body-subtle"
          tag="span"
          className="shrink-0"
        >
          [{current.category}]
        </Typography>
      {/if}
      <Typography
        variant="body-02-normal-medium"
        color="text-body-strong"
        tag="span"
        className="min-w-0 truncate-safe"
      >
        {current.title}
      </Typography>
      {#if current.change}
        <!-- 기존 값 = 본문색 · 요청 값 = primary. 화살표는 둘 사이를 잇기만 하므로 옅게 -->
        <Typography
          variant="body-02-normal-regular"
          color="text-body-default"
          tag="span"
          className="shrink-0"
        >
          {current.change.from}
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color="text-body-subtle"
          tag="span"
          className="shrink-0"
        >
          →
        </Typography>
        <!-- 요청된 값만 한 단 굵게(Regular→Medium) — 색(primary)만으로는 옆의 기존 값과
             같은 무게로 읽혀 "어느 쪽이 새 값인가"가 한 박자 늦게 잡힌다 -->
        <Typography
          variant="body-02-normal-medium"
          color="text-primary-500"
          tag="span"
          className="shrink-0"
        >
          {current.change.to}
        </Typography>
      {/if}
    </div>
  {/snippet}

  <!--
    배너 위에 쌓인 값은 셸 패딩 20 + 대시보드 상단 40 = 60. -mt-8(32)을 걷어내
    상단 헤더(h-16)와의 간격이 **28**이 된다. 아래 32는 히어로와의 간격 —
    떠 있는 바와 페이지 본문을 가르는 최소 폭이다.
    (배너가 없는 날은 이 마진 자체가 렌더되지 않아 레이아웃이 변하지 않는다)

    그림자 = shadow-sticky. 스크롤되는 콘텐츠 위에 얹힌 층만 알리는 최소 그림자로,
    카드 hover용(0 10px 24px α.14)은 상시 떠 있는 이 바에는 과했다.

    면 = 흰색 75% + backdrop-blur 24. 대시보드 캔버스가 유채색 그라디언트라
    밑색이 배어들어 "떠 있는 유리"로 읽힌다(무채색 캔버스였다면 흰 위에 흰이라
    효과 없이 비용만 남는다). 블러를 24로 세게 주는 게 핵심 — 밑을 지나는 카드가
    색 덩어리로 뭉개져야 승인·반려 레이블이 어수선한 배경 위에 놓이지 않는다.
    불투명도를 더 낮추면(/50) 그 조건이 깨진다.
  -->
  <div
    class={twMerge(
      'sticky top-0 z-30 mx-auto -mt-8 mb-8 flex w-full max-w-[1120px] items-center gap-3 rounded-2xl border border-gray-200 bg-white/75 p-3 pl-4 shadow-sticky backdrop-blur-xl',
      className
    )}
  >
    <!--
      onOpen이 있으면 이 영역 전체가 상세를 여는 버튼이 된다.
      액션 버튼·순회 화살표는 이 밖에 있어 클릭이 겹치지 않는다.
    -->
    {#if current.onOpen}
      <button
        type="button"
        onclick={current.onOpen}
        class="group flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {@render leading()}
      </button>
    {:else}
      <div class="flex min-w-0 flex-1 items-center gap-3">
        {@render leading()}
      </div>
    {/if}

    <!-- 액션 묶음 — 버튼끼리는 배너 요소 간격(12)보다 한 단 좁은 8로 붙인다 -->
    <div class="flex shrink-0 items-center gap-2">
      {#each current.actions as action, i (i)}
        {#if action.href}
          <a href={action.href} class={actionClass(action.variant)}>
            {action.label}
          </a>
        {:else}
          <button
            type="button"
            disabled={busyId === current.id}
            onclick={() => run(current, action)}
            class={actionClass(action.variant)}
          >
            {action.label}
          </button>
        {/if}
      {/each}
    </div>

    <!-- 순회 컨트롤은 영역 맨 우측 — 처리 액션(반려·승인)과 성격이 달라 끝으로 뺀다 -->
    {#if visible.length > 1}
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="이전 항목"
          disabled={!!busyId}
          onclick={() => move(-1)}
          class="flex size-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:text-gray-300"
        >
          <ChevronIcon width={7} height={12} strokeColor="currentColor" />
        </button>
        <span
          class="min-w-[28px] text-center text-label-01-normal-medium text-gray-500"
        >
          {Math.min(index, visible.length - 1) + 1}/{visible.length}
        </span>
        <button
          type="button"
          aria-label="다음 항목"
          disabled={!!busyId}
          onclick={() => move(1)}
          class="flex size-7 rotate-180 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:text-gray-300"
        >
          <ChevronIcon width={7} height={12} strokeColor="currentColor" />
        </button>
      </div>
    {/if}

    <!-- 닫기는 영역 맨 우측 — 순회·처리 액션보다 바깥 층이다.
         hit 영역 32는 배너 안의 다른 인라인 컨트롤(순회 28)과 같은 계열 크기다
         (§Components>icon-button의 단독 44는 툴바용). -->
    <button
      type="button"
      aria-label="닫기"
      onclick={() => (closed = true)}
      class="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
    >
      <CloseStrokeIcon20 />
    </button>
  </div>
{/if}
