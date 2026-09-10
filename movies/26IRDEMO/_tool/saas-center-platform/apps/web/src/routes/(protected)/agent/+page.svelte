<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getAgentSessions } from '$lib/hooks/actions/agent.action'
  import { centerId } from '$lib/stores/center.store'
  import { agentChatStore } from '$lib/stores/agent.svelte'
  import AgentSessionSidebar from '$lib/components/agent/AgentSessionSidebar.svelte'
  import AgentChatArea from '$lib/components/agent/AgentChatArea.svelte'

  const chat = agentChatStore

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

  const selectedSession = $derived(
    sessions.find((s: { id: string }) => s.id === chat.currentSessionId) ?? null
  )

  // /agent 진입 시 새 채팅 시작 (단, agent가 navigate한 페이지에서 뒤로 돌아온 경우 유지)
  onMount(() => {
    if (!chat.currentSessionId) {
      chat.startNewChat()
    }
    chat.isAgentControlling = true
  })

  function handleNewChat() {
    chat.startNewChat()
    goto('/agent')
  }

  function handleSelectSession(sessionId: string) {
    isDrawerOpen = false
    goto(`/agent/session/${sessionId}/conversation`)
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
    <!-- 데스크톱 사이드바 (xl 이상 — 루트 레이아웃의 높이 고정도 xl부터라 lg에서 하면 페이지 전체 스크롤이 생김) -->
    <section
      class="hidden xl:block border border-gray-200 rounded-2xl bg-white overflow-hidden p-5"
    >
      <AgentSessionSidebar
        {sessions}
        currentSessionId={chat.currentSessionId}
        isOpen={true}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />
    </section>

    <!-- 모바일/태블릿 드로어 (xl 미만) -->
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
          onNewChat={() => {
            isDrawerOpen = false
            handleNewChat()
          }}
          onSelectSession={handleSelectSession}
        />
      </aside>
    {/if}

    <section
      class="flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded-2xl bg-white"
    >
      <!-- key 금지: 세션 생성 직후 remount 되면 first paint에 메시지가 있어 in:appear 가 스킵됨 -->
      <AgentChatArea
        title={selectedSession?.title ?? '새 대화'}
        onOpenSidebar={() => (isDrawerOpen = true)}
      />
    </section>
  </div>
</div>
