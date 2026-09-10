<script lang="ts">
  import { agentChatStore } from '$lib/stores/agent.svelte'
  import { createAgentService } from '$lib/features/agent/chat'
  import { renderMessageMarkdown } from '$lib/features/agent/chat/view-model'
  import {
    fadeOut,
    EXIT_MS,
    MOTION_IN_CLASS
  } from '$lib/features/agent/chat/transitions'
  import { useQueryClient } from '@tanstack/svelte-query'
  import ToolResultTable from '$lib/features/agent/chat/components/ToolResultTable.svelte'
  import SelectionList from '$lib/features/agent/chat/components/SelectionList.svelte'
  import CheckpointForm from '$lib/features/agent/chat/components/CheckpointForm.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import SendButton from '$lib/features/agent/chat/components/SendButton.svelte'
  import CreditGauge from '$lib/features/credit/components/CreditGauge.svelte'
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

  interface Props {
    title?: string
    onOpenSidebar?: () => void
  }

  let { title = '새 대화', onOpenSidebar }: Props = $props()

  const SUGGESTIONS = [
    '오늘 상담 몇 건이야?',
    '김 씨 내담자 누구 있지?',
    '내일 14시에 검사 접수해줘.'
  ]

  const queryClient = useQueryClient()
  const chat = agentChatStore
  const service = createAgentService({ queryClient })
  /**
   * 등장 허용.
   * - 라이브 스트림 중 항상 on
   * - 히스토리 일괄 복원(suppressEnterMotion)만 off
   * 등장은 CSS 클래스(MOTION_IN_CLASS)
   */
  const motionOn = $derived(chat.enterMotion || chat.isStreaming)
  const exitMs = $derived(motionOn ? EXIT_MS : 0)

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
  // 플랜에 AI 미포함(Free 등) vs 크레딧 소진(유료·0) 구분 — 배너 문구가 달라야 오해가 없다
  const noAiPlan = $derived(!hasFeature(subVM, 'ai_agent'))
  const isExhausted = $derived(
    noAiPlan || !canAfford(creditVM, AI_PURPOSE.SKILL_SELECTION)
  )

  let inputText = $state('')
  let inputRef: HTMLTextAreaElement | undefined = $state()
  let scrollRef: HTMLDivElement | undefined = $state()
  let containerWidth = $state(0)

  // 헤더 케밥 메뉴 (제목 변경 · 삭제) — 현재 대화 대상
  let menuOpen = $state(false)
  let isEditingTitle = $state(false)
  let editTitle = $state('')

  function openRename() {
    menuOpen = false
    editTitle = title
    isEditingTitle = true
  }

  async function saveRename() {
    if (!isEditingTitle) return
    isEditingTitle = false
    const next = editTitle.trim()
    if (next && next !== title && chat.currentSessionId) {
      await service.renameSession(chat.currentSessionId, next)
    }
  }

  function renameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveRename()
    } else if (e.key === 'Escape') {
      isEditingTitle = false
    }
  }

  async function deleteConversation() {
    menuOpen = false
    if (!chat.currentSessionId) return
    if (!confirm('이 대화를 삭제하시겠습니까?')) return
    await service.removeSession(chat.currentSessionId)
  }

  // 입력창 자동 높이 조절 (내용에 따라 가변, max-h-48 = 192px 까지)
  $effect(() => {
    inputText // track
    if (!inputRef) return
    inputRef.style.height = 'auto'
    const next = Math.min(inputRef.scrollHeight, 192)
    inputRef.style.height = `${next}px`
  })

  // 메시지 추가·스트리밍 시 자동 스크롤
  function scrollToBottom(smooth = true) {
    if (!scrollRef) return
    scrollRef.scrollTo({
      top: scrollRef.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    })
  }

  // 메시지 개수 변경 시 스크롤 (표 push 등)
  $effect(() => {
    chat.messages.length // track
    // tick 후 스크롤 (DOM 반영 대기)
    setTimeout(() => scrollToBottom(true), 50)
  })

  // 스트리밍 진행 라벨 변경 시 스크롤
  $effect(() => {
    chat.viewProgress // track
    if (chat.isStreaming) setTimeout(() => scrollToBottom(true), 50)
  })

  // 답 말풍선 타이핑(content 성장) — done 이후 잔여 리빌 동안에도 typingMessageId가 유지됨
  $effect(() => {
    const id = chat.typingMessageId
    if (!id) return
    const live = chat.messages.find((m) => m.id === id)?.content?.length ?? 0
    live // track
    // smooth 연속 호출은 스크롤이 lagged 됨 — 타이핑 구간은 auto
    setTimeout(() => scrollToBottom(false), 0)
  })

  // waitingInput 변경 시 자동 포커스 + 스크롤
  $effect(() => {
    if (chat.waitingInput && inputRef) {
      setTimeout(() => {
        inputRef?.focus()
        scrollToBottom()
      }, 50)
    }
  })

  async function handleSend() {
    const text = inputText.trim()
    if (!text || (chat.isStreaming && !chat.waitingInput) || isExhausted) return
    inputText = ''

    if (chat.waitingInput) {
      await service.sendInput({ message: text })
    } else {
      await service.sendMessage(text)
    }
  }

  async function handleSelectionSelect(item: unknown) {
    // write_confirm(assistant_write_confirm)에서 "취소" = 구조화 취소 플래그.
    // 안 보내면 backend가 cancelled=false로 보고 gate(=write)를 실행해버린다.
    const isConfirm = chat.waitingInput?.stepId === 'assistant_write_confirm'
    // SelectionList에서 선택 시
    if (typeof item === 'string') {
      await service.sendInput({
        message: item,
        is_selection: true,
        cancelled: isConfirm && item === '취소'
      })
      return
    }
    // HITL checkpoint {label, value} — value만 서버에 전송 (UUID 등)
    if (item && typeof item === 'object' && 'value' in item) {
      const value = (item as Record<string, unknown>).value
      await service.sendInput({
        message: String(value ?? ''),
        is_selection: true
      })
      return
    }
    // 그 외 객체는 form_data로 전송 (기존 mutation checkpoint 호환)
    await service.sendInput({
      form_data: item as Record<string, unknown>,
      is_selection: true
    })
  }

  async function handleFormSubmit(formData: Record<string, unknown>) {
    // 다필드 폼(-4) 제출 → form_data(dict)로 resume (is_form=true)
    await service.sendInput({ form_data: formData })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      handleSend()
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
</script>

{#snippet chevron()}
  <svg
    class="h-3 w-3 transition-transform group-open:rotate-180"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
  >
{/snippet}

{#snippet foldSummary(label: string)}
  <summary
    class="flex cursor-pointer select-none items-center gap-1 text-label-01-normal-regular text-gray-400 hover:text-gray-600 [&::-webkit-details-marker]:hidden [list-style:none]"
  >
    <span>{label}</span>
    {@render chevron()}
  </summary>
{/snippet}

<svelte:window
  onclick={() => {
    if (menuOpen) menuOpen = false
  }}
/>

<!-- 본문: 채팅 가운데 고정 -->
<div
  class="flex-1 min-h-0 relative flex flex-col"
  bind:clientWidth={containerWidth}
>
  <!-- 채팅 헤더 (대화 시작 후에만 표시, 카드 풀-너비 구분선) -->
  {#if chat.messages.length > 0}
    <div
      class="shrink-0 w-full border-b border-gray-200 px-8 py-4 flex items-center gap-3"
    >
      {#if onOpenSidebar}
        <Tooltip text="사이드바 열기">
          <button
            type="button"
            class="xl:hidden shrink-0 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="사이드바 열기"
            onclick={onOpenSidebar}
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </Tooltip>
      {/if}
      {#if isEditingTitle}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="flex-1 min-w-0 text-body-01-normal-semibold text-gray-800 bg-white border border-primary-400 rounded px-2.5 py-0.5 outline-none"
          bind:value={editTitle}
          onkeydown={renameKeydown}
          onblur={saveRename}
          onclick={(e) => e.stopPropagation()}
          autofocus
        />
      {:else}
        <p
          class="flex-1 min-w-0 text-body-01-normal-semibold text-gray-800 truncate-safe"
        >
          {title}
        </p>
      {/if}
      {#if creditVM}
        <CreditGauge credit={creditVM} mode="compact" />
      {/if}
      <div class="relative shrink-0">
        <Tooltip text="메뉴">
          <button
            type="button"
            class="flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="메뉴"
            onclick={(e) => {
              e.stopPropagation()
              menuOpen = !menuOpen
            }}
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="12" cy="19" r="1.2" />
            </svg>
          </button>
        </Tooltip>
        {#if menuOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="dropdown-panel absolute top-full right-0 z-20 mt-1"
            onclick={(e) => e.stopPropagation()}
          >
            <button class="dropdown-item" onclick={openRename}>
              제목 변경
            </button>
            <button
              class="dropdown-item is-danger"
              onclick={deleteConversation}
            >
              삭제
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- 본문 영역 (패딩) -->
  <div class="flex-1 min-h-0 flex flex-col px-6 pb-6">
    <!-- 채팅 영역 (항상 가운데) -->
    <div class="flex-1 min-h-0 w-full max-w-3xl mx-auto flex flex-col">
      <!-- 입력창 snippet (빈 상태/대화 모드에서 재사용) -->
      {#snippet inputArea()}
        {#if chat.waitingInput?.inputType === 'form' && chat.waitingInput.formFields}
          <!-- 폼 입력 모드 (-4 다필드) -->
          <div
            class="rounded-lg border border-primary-400 bg-white px-6 py-5 transition-colors"
          >
            <CheckpointForm
              fields={chat.waitingInput.formFields}
              title={chat.waitingInput.formTitle}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                chat.waitingInput = null
              }}
            />
          </div>
        {:else if chat.waitingInput?.inputType === 'selection' && chat.waitingInput.options}
          <!-- 선택 입력 모드 — Frame 디자인 -->
          <div
            class="rounded-lg border border-primary-400 bg-white transition-colors"
          >
            {#if chat.waitingInput.question}
              <div
                class="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100"
              >
                <p class="text-body-02-normal-medium text-gray-800">
                  {chat.waitingInput.question}
                </p>
                <button
                  type="button"
                  class="ml-3 shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="닫기"
                  onclick={() => {
                    chat.waitingInput = null
                  }}
                >
                  <svg
                    class="h-5 w-5"
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
            {/if}
            <div class="px-5 py-3">
              <SelectionList
                options={chat.waitingInput.options}
                onSelect={handleSelectionSelect}
              />
            </div>
          </div>
        {:else}
          <!-- 텍스트 입력 모드 (기본) -->
          <div
            class="rounded-lg border border-gray-200 bg-white px-5 py-4 focus-within:border-border-active transition-colors"
          >
            {#if isExhausted}
              <div
                class="flex items-center gap-2 px-1 py-2 text-body-03-normal-regular text-red-600"
              >
                <svg
                  class="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                {#if noAiPlan}
                  <span
                    >현재 플랜은 AI 기능을 포함하지 않습니다. <a
                      href="/subscription"
                      class="underline hover:text-red-700">구독 확인</a
                    ></span
                  >
                {:else}
                  <span
                    >AI 크레딧이 소진되었습니다. <a
                      href="/subscription/ai-usage"
                      class="underline hover:text-red-700">사용량 확인</a
                    ></span
                  >
                {/if}
              </div>
            {:else}
              {#if chat.waitingInput}
                <div class="pb-2 mb-2 border-b border-gray-100">
                  <p class="text-label-01-normal-regular text-gray-800">
                    <span class="font-medium">Q.</span>
                    {chat.waitingInput.question}
                  </p>
                </div>
              {/if}
              <textarea
                rows="1"
                placeholder={chat.waitingInput
                  ? '답변을 입력하세요...'
                  : '무엇이든 물어보세요'}
                class="w-full bg-transparent outline-none resize-none text-body-03-reading-regular text-gray-800 placeholder:text-placeholder overflow-y-auto scrollbar-none px-3 py-3.5"
                style="min-height: 28px;"
                bind:value={inputText}
                bind:this={inputRef}
                onkeydown={handleKeydown}
              ></textarea>
              <div class="flex items-center justify-between pt-3">
                <div class="flex items-center gap-3">
                  <Tooltip text="음성 입력 (준비 중)">
                    <button
                      type="button"
                      disabled
                      aria-label="음성 입력 (준비 중)"
                      class="text-gray-400 cursor-not-allowed hover:text-gray-500"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
                        />
                      </svg>
                    </button>
                  </Tooltip>
                  <Tooltip text="파일 첨부 (준비 중)">
                    <button
                      type="button"
                      disabled
                      aria-label="파일 첨부 (준비 중)"
                      class="text-gray-400 cursor-not-allowed hover:text-gray-500"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                        />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
                <SendButton
                  onClick={handleSend}
                  disabled={(chat.isStreaming && !chat.waitingInput) ||
                    !inputText.trim() ||
                    isExhausted}
                  size="sm"
                />
              </div>
            {/if}
          </div>
        {/if}
      {/snippet}

      <!-- 메시지 목록 / 빈 상태 -->
      <div
        class="flex-1 min-h-0 overflow-y-auto space-y-6 pt-6 pb-4 scrollbar-none"
        bind:this={scrollRef}
      >
        {#if chat.messages.length > 0}
          {#each chat.messages as msg (msg.id)}
            {#if msg.role === 'user'}
              <!-- 텍스트: 애니 없음 -->
              <div class="flex justify-end">
                <div class="max-w-[70%]">
                  <div class="bg-gray-100 text-gray-800 rounded-lg px-4 py-2.5">
                    <p class="text-body-03-reading-regular whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            {:else}
              <div class="pr-12">
                {#if msg.processHeader && msg.processTools && msg.processTools.length > 0}
                  <!-- 컴포넌트: 작업 과정 — CSS motion (Svelte in: first-paint 스킵 회피) -->
                  <details class="group mb-2 {motionOn ? MOTION_IN_CLASS : ''}">
                    {@render foldSummary('작업 과정')}
                    <div
                      class="mt-1.5 space-y-3 border-l-2 border-gray-200 pl-3"
                    >
                      {#each msg.processTools as pt, pti (`${msg.id}-pt-${pt.tool}-${pt.hop ?? 'x'}-${pti}`)}
                        <ToolResultTable
                          tool={pt.tool}
                          output={pt.output}
                          isError={pt.isError}
                          rolledBack={pt.rolledBack}
                          truncated={pt.truncated}
                          limit={pt.limit}
                        />
                      {/each}
                    </div>
                  </details>
                {/if}
                {#if msg.toolResult}
                  <!-- 컴포넌트: 표 CSS appear / 중간 hop fadeOut. 텍스트 애니 없음 -->
                  {#if !msg.toolResult.inProcess}
                    {@const toolMotion =
                      motionOn && msg.toolResult.playEnter !== false}
                    <div
                      class={toolMotion ? MOTION_IN_CLASS : ''}
                      out:fadeOut={{ duration: exitMs }}
                    >
                      <ToolResultTable
                        tool={msg.toolResult.tool}
                        output={msg.toolResult.output}
                        content={msg.content}
                        isError={msg.toolResult.isError}
                        rolledBack={msg.toolResult.rolledBack}
                        truncated={msg.toolResult.truncated}
                        limit={msg.toolResult.limit}
                      />
                    </div>
                  {/if}
                  {#if msg.content}
                    <p
                      class="text-body-03-reading-regular whitespace-pre-wrap text-gray-800 mt-3"
                    >
                      {@html renderMessageMarkdown(msg.content)}
                    </p>
                  {/if}
                {:else if msg.segments && msg.segments.length > 0}
                  {#each msg.segments as seg, si (`${msg.id}-seg-${si}-${seg.type}`)}
                    {#if seg.type === 'question'}
                      <div class="my-1.5 flex items-center gap-2.5">
                        <span
                          class="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-label-02-normal-medium text-gray-500"
                          >Q</span
                        >
                        <p class="text-body-03-reading-regular text-gray-600">
                          {seg.content}
                        </p>
                      </div>
                    {:else if seg.type === 'answer'}
                      <div class="my-1.5 flex items-center gap-2.5">
                        <span
                          class="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-label-02-normal-medium text-white"
                          >A</span
                        >
                        <p class="text-body-03-reading-regular text-gray-800">
                          {seg.content}
                        </p>
                      </div>
                    {:else}
                      <p
                        class="text-body-03-reading-regular whitespace-pre-wrap text-gray-800"
                      >
                        {@html renderMessageMarkdown(seg.content)}
                      </p>
                    {/if}
                  {/each}
                  {#if msg.content}
                    {@const lastAnswer = msg.segments.findLast(
                      (s) => s.type === 'answer'
                    )}
                    {#if lastAnswer}
                      <p
                        class="text-body-03-reading-regular whitespace-pre-wrap text-gray-800 mt-1"
                      >
                        {@html renderMessageMarkdown(msg.content)}
                      </p>
                    {/if}
                  {/if}
                {:else if msg.content}
                  <p
                    class="text-body-03-reading-regular whitespace-pre-wrap text-gray-800"
                  >
                    {@html renderMessageMarkdown(msg.content)}
                  </p>
                {/if}
                {#if msg.showTime}
                  <p class="text-label-02-normal-regular text-gray-400 mt-1.5">
                    {formatMessageTime(msg.time)}
                  </p>
                {/if}
              </div>
            {/if}
          {/each}
          {#if chat.isStreaming && chat.workingLabel}
            <!-- 컴포넌트: 상태 — CSS motion + unmount fadeOut -->
            <div
              class="pr-12 {motionOn ? MOTION_IN_CLASS : ''}"
              out:fadeOut={{ duration: exitMs }}
            >
              <div class="flex select-none items-center gap-2 text-gray-500">
                <span class="flex items-center gap-1" aria-hidden="true">
                  <span
                    class="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"
                    style="animation-delay: 0ms;"
                  ></span>
                  <span
                    class="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"
                    style="animation-delay: 150ms;"
                  ></span>
                  <span
                    class="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"
                    style="animation-delay: 300ms;"
                  ></span>
                </span>
                <span class="text-body-03-reading-regular"
                  >{chat.workingLabel}</span
                >
              </div>
            </div>
          {/if}
        {:else}
          <div class="flex flex-col items-center justify-center h-full gap-6">
            <div class="text-center">
              <p class="text-headline-02-normal-semibold text-gray-800">
                안녕하세요
              </p>
              <p class="text-headline-02-normal-semibold text-gray-800">
                무엇을 도와드릴까요?
              </p>
            </div>
            <div class="w-full max-w-2xl">
              {@render inputArea()}
            </div>
            <div
              class="w-full max-w-2xl flex justify-center gap-2 overflow-x-auto scrollbar-none whitespace-nowrap"
            >
              {#each SUGGESTIONS as suggestion}
                <button
                  class="shrink-0 px-4 py-2 text-label-01-normal-regular text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isExhausted}
                  onclick={() => {
                    inputText = suggestion
                    handleSend()
                  }}>{suggestion}</button
                >
              {/each}
            </div>
          </div>
        {/if}

        <!-- 구 progress 점 3개 UI 제거 — "... {workingLabel}" 한 줄이 진행 표시를 단독 소유 -->
      </div>

      <!-- 입력창 (대화 모드: 하단 고정) -->
      {#if chat.messages.length > 0}
        <div class="shrink-0 pt-3">
          {@render inputArea()}
        </div>
      {/if}
    </div>
  </div>
</div>
