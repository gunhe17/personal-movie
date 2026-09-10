<style>
  .agent-floating-icon {
    position: fixed;
    z-index: 9999;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    cursor: grab;
    transition:
      left 0.4s ease,
      top 0.4s ease;
    box-shadow: 0 4px 12px rgba(37, 110, 244, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .agent-icon-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(37, 110, 244, 1) 0%,
      rgba(28, 130, 202, 1) 45%,
      rgba(19, 149, 161, 1) 100%
    );
  }

  .agent-icon-pattern {
    position: absolute;
    inset: -20px;
    background: rgba(255, 255, 255, 0.35);
    -webkit-mask-image: url('/patterns/circuit-board.svg');
    -webkit-mask-size: 100px 100px;
    mask-image: url('/patterns/circuit-board.svg');
    mask-size: 100px 100px;
  }

  /* 채팅 팝업 */
  .agent-chat-popup {
    position: fixed;
    z-index: 9998;
    width: 320px;
    height: 400px;
    border-radius: 1rem;
    background: white;
    display: flex;
    flex-direction: column;
    transition:
      left 0.3s ease,
      top 0.3s ease;
    box-shadow:
      0 8px 32px rgba(37, 110, 244, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .agent-chat-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(249, 250, 251, 0.8);
    border-radius: 1rem 1rem 0 0;
  }

  /* 말풍선 */
  .agent-bubble {
    position: fixed;
    z-index: 9998;
    max-width: 260px;
    padding: 10px 14px;
    background: white;
    border-radius: 12px;
    box-shadow:
      0 8px 32px rgba(37, 110, 244, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.06);
    animation: bubble-in 0.3s ease-out;
    cursor: pointer;
    transition:
      left 0.4s ease,
      top 0.4s ease;
  }

  .agent-bubble-arrow {
    position: absolute;
    left: -6px;
    top: 14px;
    width: 12px;
    height: 12px;
    background: white;
    border-left: 1px solid rgba(0, 0, 0, 0.06);
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    transform: rotate(45deg);
  }

  @keyframes bubble-in {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .agent-chat-footer {
    flex-shrink: 0;
    padding: 8px 12px;
    border-radius: 0 0 1rem 1rem;
  }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { agentChatStore } from '$lib/stores/agent.svelte'
  import SendButton from '$lib/features/agent/chat/components/SendButton.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getCreditBalance } from '$lib/hooks/actions/credit.action'
  import { mapToCreditVM, canAfford } from '$lib/features/credit/view-model'
  import {
    AI_PURPOSE,
    CREDIT_STALE_TIME,
    CREDIT_REFETCH_INTERVAL
  } from '$lib/features/credit/constants'
  import { getSubscription } from '$lib/hooks/actions/subscription.action'
  import {
    mapToSubscriptionVM,
    hasFeature
  } from '$lib/features/subscription/view-model'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import { centerId } from '$lib/stores/center.store'

  const chat = agentChatStore

  // 크레딧 잔량 쿼리
  const creditQuery = $derived(
    queryBuilder(
      getCreditBalance,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: CREDIT_STALE_TIME,
        refetchInterval: CREDIT_REFETCH_INTERVAL
      })
    )
  )
  const creditVM = $derived(
    creditQuery.data ? mapToCreditVM(creditQuery.data) : null
  )
  // 구독 플랜 쿼리 (AI 기능 게이팅용)
  const subQuery = $derived(
    queryBuilder(
      getSubscription,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME,
        refetchInterval: SUBSCRIPTION_REFETCH_INTERVAL
      })
    )
  )
  const subVM = $derived(
    subQuery.data ? mapToSubscriptionVM(subQuery.data) : null
  )
  const isExhausted = $derived(
    !hasFeature(subVM, 'ai_agent') ||
      !canAfford(creditVM, AI_PURPOSE.SKILL_SELECTION)
  )

  let x = $state(0)
  let y = $state(0)
  const isAgentPage = $derived($page.url.pathname.startsWith('/agent'))
  let visible = $derived(agentChatStore.isAgentControlling && !isAgentPage)
  let initialized = $state(false)
  let chatOpen = $state(false)

  let inputText = $state('')
  let bubbleText = $state<string | null>(null)
  let bubbleTimer: ReturnType<typeof setTimeout> | null = null
  let prevMessageCount = $state(0)

  // assistant 메시지가 추가되면 말풍선 표시 (채팅 팝업이 닫혀있을 때만)
  $effect(() => {
    const msgs = chat.messages
    if (msgs.length > prevMessageCount) {
      const last = msgs[msgs.length - 1]
      if (last.role === 'assistant' && !chatOpen) {
        showBubble(last.content)
      }
    }
    prevMessageCount = msgs.length
  })

  function showBubble(text: string) {
    bubbleText = text.length > 80 ? text.slice(0, 80) + '...' : text
    if (bubbleTimer) clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(() => {
      bubbleText = null
    }, 5000)
  }

  function dismissBubble() {
    bubbleText = null
    if (bubbleTimer) {
      clearTimeout(bubbleTimer)
      bubbleTimer = null
    }
  }

  const IGNORE_TAGS = new Set([
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'OPTION',
    'LABEL'
  ])
  const ICON_SIZE = 48
  const GAP = 12
  const MARGIN = 8
  const POPUP_H = 400
  const POPUP_W = 320

  // 드래그 상태
  let dragging = $state(false)
  let didDrag = $state(false)
  let dragOffset = { dx: 0, dy: 0 }
  let dragStart = { x: 0, y: 0 }
  const DRAG_THRESHOLD = 4

  function handleIconMouseDown(e: MouseEvent) {
    if (!visible) return
    e.preventDefault()
    dragging = true
    didDrag = false
    dragOffset = { dx: e.clientX - x, dy: e.clientY - y }
    dragStart = { x: e.clientX, y: e.clientY }
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }

  function handleDragMove(e: MouseEvent) {
    if (!dragging) return
    const dist =
      Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y)
    if (dist > DRAG_THRESHOLD) didDrag = true
    if (!didDrag) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    x = Math.max(
      MARGIN,
      Math.min(e.clientX - dragOffset.dx, vw - ICON_SIZE - MARGIN)
    )
    y = Math.max(
      MARGIN,
      Math.min(e.clientY - dragOffset.dy, vh - ICON_SIZE - MARGIN)
    )
  }

  function handleDragEnd() {
    dragging = false
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
    // didDrag가 false면 클릭으로 처리 (handleWindowClick에서)
  }

  function handleWindowClick(e: MouseEvent) {
    if (!visible) return
    const target = e.target as HTMLElement
    // 채팅 팝업 내부 클릭 무시
    if (target?.closest('.agent-chat-popup')) return
    // 아이콘 클릭 → 채팅 토글 (드래그가 아닌 순수 클릭만)
    if (target?.closest('.agent-floating-icon')) {
      if (!didDrag) chatOpen = !chatOpen
      return
    }
    // 채팅이 열려있으면 닫기
    if (chatOpen) chatOpen = false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // TODO: sendMessage 연결
    }
  }

  function formatMessageTime(isoStr: string): string {
    try {
      return new Date(isoStr).toLocaleTimeString('ko-KR', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return ''
    }
  }

  // 팝업 X: 아이콘 오른쪽, 공간 없으면 왼쪽, 항상 화면 내
  const popupX = $derived.by(() => {
    const vw = browser ? window.innerWidth : 1200
    const rightX = x + ICON_SIZE + GAP
    if (rightX + POPUP_W <= vw - MARGIN) return rightX
    const leftX = x - POPUP_W - GAP
    return Math.max(MARGIN, leftX)
  })

  // 팝업 Y: 아이콘 상단 정렬, 하단 넘으면 하단 정렬, 항상 화면 내
  const popupY = $derived.by(() => {
    const vh = browser ? window.innerHeight : 800
    const top = y
    if (top + POPUP_H > vh - MARGIN) {
      return Math.max(MARGIN, y + ICON_SIZE - POPUP_H)
    }
    return Math.max(MARGIN, top)
  })

  // store에서 좌표가 설정되면 이동
  $effect(() => {
    const pos = chat.floatingPosition
    if (pos && initialized) {
      x = pos.x
      y = pos.y
      chat.floatingPosition = null // 소비 후 초기화
    }
  })

  onMount(() => {
    x = window.innerWidth - 72
    y = window.innerHeight - 72
    initialized = true
    window.addEventListener('click', handleWindowClick)
  })

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('click', handleWindowClick)
    }
  })
</script>

{#if visible && initialized}
  <!-- 채팅 팝업 -->
  {#if chatOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="agent-chat-popup"
      style="left: {popupX}px; top: {popupY}px;"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- 헤더 -->
      <div class="agent-chat-header">
        <span class="text-[13px] font-semibold text-gray-700">AI 에이전트</span>
        <div class="flex items-center gap-1">
          <button
            onclick={() => {
              chat.startNewChat()
              chat.isAgentControlling = true
            }}
            class="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            title="새 대화"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            onclick={() => (chatOpen = false)}
            class="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            title="닫기"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- 메시지 목록 -->
      <div
        class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 scrollbar-none"
      >
        {#each chat.messages as msg (msg.id)}
          {#if msg.role === 'user'}
            <div class="flex justify-end">
              <div class="max-w-[85%]">
                <div
                  class="bg-blue-500 text-white rounded-lg rounded-br-sm px-3 py-2"
                >
                  <p class="text-[13px] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
                <p
                  class="text-body-03-normal-regular text-gray-400 mt-0.5 text-right"
                >
                  {formatMessageTime(msg.time)}
                </p>
              </div>
            </div>
          {:else if msg.processHeader || msg.toolResult}
            <!-- 플로팅은 본문 요약만 — 작업 과정/표는 본 채팅과 동일하게 접힘·숨김 -->
          {:else}
            {@const isProgress =
              chat.viewProgress &&
              chat.isStreaming &&
              msg.content === chat.viewProgress.message}
            <div class="flex items-start gap-2">
              <div
                class="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-50"
              >
                <svg
                  class="h-3 w-3 text-blue-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 2l2.09 6.26L20.18 9l-4.91 3.82L16.91 19 12 15.27 7.09 19l1.64-6.18L3.82 9l6.09-.74z"
                  />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p
                  class="text-[13px] leading-relaxed whitespace-pre-wrap {isProgress
                    ? 'text-gray-400 animate-pulse'
                    : 'text-gray-700'}"
                >
                  {msg.content}
                </p>
                {#if !isProgress}
                  <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                    {formatMessageTime(msg.time)}
                  </p>
                {/if}
              </div>
            </div>
          {/if}
        {/each}
        {#if chat.messages.length === 0}
          <div class="flex items-center justify-center h-full">
            <p class="text-[12px] text-gray-400">대화가 없습니다</p>
          </div>
        {/if}
      </div>

      <!-- 입력창 -->
      <div class="agent-chat-footer">
        <div class="flex items-center gap-2">
          <div
            class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 flex items-center h-9 focus-within:border-blue-400 focus-within:bg-white transition-colors"
          >
            <input
              type="text"
              placeholder={isExhausted
                ? 'AI 크레딧이 소진되었습니다'
                : '메시지 입력...'}
              class="w-full bg-transparent outline-none text-[13px] text-gray-800 placeholder:text-placeholder"
              bind:value={inputText}
              onkeydown={handleKeydown}
              disabled={chat.isStreaming || isExhausted}
            />
          </div>
          <SendButton
            size="sm"
            disabled={chat.isStreaming || !inputText.trim() || isExhausted}
          />
        </div>
      </div>
    </div>
  {/if}

  <!-- 말풍선 -->
  {#if bubbleText && !chatOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="agent-bubble"
      style="left: {x + ICON_SIZE + GAP}px; top: {y + 6}px;"
      onclick={dismissBubble}
    >
      <p class="text-[13px] leading-relaxed text-gray-700">{bubbleText}</p>
      <div class="agent-bubble-arrow"></div>
    </div>
  {/if}

  <!-- 플로팅 아이콘 -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="agent-floating-icon"
    style="left: {x}px; top: {y}px; {dragging
      ? 'transition: none; cursor: grabbing;'
      : ''}"
    onmousedown={handleIconMouseDown}
  >
    <div class="agent-icon-bg"></div>
    <div class="agent-icon-pattern"></div>
  </div>
{/if}
