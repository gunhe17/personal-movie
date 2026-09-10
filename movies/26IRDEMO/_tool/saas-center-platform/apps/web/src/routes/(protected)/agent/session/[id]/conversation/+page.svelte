<script lang="ts">
  import { goto } from '$app/navigation'
  import { fly, fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getAgentSessions } from '$lib/hooks/actions/agent.action'
  import { centerId } from '$lib/stores/center.store'
  import { agentChatStore } from '$lib/stores/agent.svelte'
  import { createAgentService } from '$lib/features/agent/chat'
  import AgentSessionSidebar from '$lib/components/agent/AgentSessionSidebar.svelte'
  import AgentChatArea from '$lib/components/agent/AgentChatArea.svelte'

  const queryClient = useQueryClient()
  const chat = agentChatStore
  const service = createAgentService({ queryClient })

  const sessionId = $derived(page.params.id ?? '')

  const sessionsQuery = $derived(
    queryBuilder(
      getAgentSessions,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId
      })
    )
  )
  const sessions = $derived(sessionsQuery.data?.items ?? [])

  // sessions 로드 완료 후 히스토리 복원
  // 직접 URL 접속 시 centerId → sessions 쿼리 완료를 기다린 뒤 로드
  // 라이브 스트림 직후 같은 세션이면 재로드 금지 — startNewChat이 메시지를 지우고
  // first-paint 일괄 마운트로 in:appear 가 스킵됨
  let initialLoaded = $state(false)

  $effect(() => {
    if (!sessionId || sessions.length === 0) return
    if (chat.isStreaming) return

    if (!initialLoaded) {
      initialLoaded = true
      // /agent 에서 세션 생성·스트리밍 중이던 상태를 replaceState 로 이어받은 경우
      if (chat.currentSessionId === sessionId && chat.messages.length > 0) {
        return
      }
      service.loadSession(sessionId, sessions)
      return
    }

    // 세션 간 전환 (사이드바)
    if (chat.currentSessionId && chat.currentSessionId !== sessionId) {
      service.loadSession(sessionId, sessions)
    }
  })

  const selectedSession = $derived(
    sessions.find((s: { id: string }) => s.id === sessionId) ?? null
  )

  function handleNewChat() {
    isDrawerOpen = false
    chat.startNewChat()
    goto('/agent')
  }

  function handleSelectSession(sid: string) {
    isDrawerOpen = false
    if (sid !== sessionId) {
      goto(`/agent/session/${sid}/conversation`)
    }
  }

  let isDrawerOpen = $state(false)
  let gridEl: HTMLDivElement | undefined = $state()
  let drawerTop = $state(0)
  let drawerBottom = $state(0)

  $effect(() => {
    if (!isDrawerOpen || !gridEl) return
    const update = () => {
      if (!gridEl) return
      const rect = gridEl.getBoundingClientRect()
      drawerTop = rect.top
      drawerBottom = window.innerHeight - rect.bottom
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  })
</script>

<div class="flex h-full min-h-0 flex-col">
  <div
    bind:this={gridEl}
    class="relative flex-1 min-h-0 grid gap-4 grid-cols-1 xl:grid-cols-[272px_1fr]"
  >
    <!-- xl부터 데스크톱 2단 — 루트 레이아웃의 높이 고정(xl:h-screen 등)도 xl부터라 lg에서 하면 페이지 전체 스크롤이 생김 -->
    <section
      class="hidden xl:block border border-gray-200 rounded-lg bg-white overflow-hidden p-5"
    >
      <AgentSessionSidebar
        {sessions}
        currentSessionId={chat.currentSessionId}
        isOpen={true}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />
    </section>

    {#if isDrawerOpen}
      <div
        transition:fade={{ duration: 180 }}
        class="xl:hidden fixed left-0 right-0 z-40 bg-black/40"
        style="top: {drawerTop}px; bottom: {drawerBottom}px;"
        onclick={() => (isDrawerOpen = false)}
        role="presentation"
      ></div>
      <aside
        transition:fly={{ x: -280, duration: 220, opacity: 1 }}
        class="xl:hidden fixed left-0 z-50 w-[272px] bg-white border-r border-y border-gray-200 p-5 overflow-hidden"
        style="top: {drawerTop}px; bottom: {drawerBottom}px;"
      >
        <AgentSessionSidebar
          {sessions}
          currentSessionId={chat.currentSessionId}
          isOpen={true}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
        />
      </aside>
    {/if}

    <section
      class="flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded-lg bg-white"
    >
      <!-- sessionId key remount 금지 — 라이브 메시지 first-paint 시 appear 스킵 방지.
           세션 전환은 loadSession 이 messages 를 갈아끼운다. -->
      <AgentChatArea
        title={selectedSession?.title ?? '대화'}
        onOpenSidebar={() => (isDrawerOpen = true)}
      />
    </section>
  </div>
</div>
