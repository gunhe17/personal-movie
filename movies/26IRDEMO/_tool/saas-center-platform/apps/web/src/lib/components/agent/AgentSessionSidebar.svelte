<script lang="ts">
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import PlusWhiteIcon20 from '$lib/assets/PlusWhiteIcon20.svelte'
  import { formatSessionTime } from '$lib/features/agent/chat/view-model'
  import {
    patchAgentSession,
    deleteAgentSession
  } from '$lib/hooks/actions/agent.action'
  import { requireCenterId } from '$lib/stores/center.store'
  import { useQueryClient } from '@tanstack/svelte-query'
  import type { AgentSession } from '$lib/features/agent/chat/types'

  interface Props {
    sessions: AgentSession[]
    currentSessionId: string | null
    isOpen: boolean
    onNewChat: () => void
    onSelectSession: (sessionId: string) => void
  }

  let {
    sessions,
    currentSessionId,
    isOpen,
    onNewChat,
    onSelectSession
  }: Props = $props()

  const queryClient = useQueryClient()

  let searchQuery = $state('')
  let menuOpenId = $state<string | null>(null)
  let editingId = $state<string | null>(null)
  let editingTitle = $state('')
  let isRenaming = $state(false)

  const filteredSessions = $derived(
    searchQuery.trim()
      ? sessions.filter((s) =>
          (s.title ?? '')
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase())
        )
      : sessions
  )

  function toggleMenu(e: MouseEvent, sessionId: string) {
    e.stopPropagation()
    menuOpenId = menuOpenId === sessionId ? null : sessionId
  }

  function startRename(e: MouseEvent, session: AgentSession) {
    e.stopPropagation()
    editingId = session.id
    editingTitle = session.title ?? ''
    menuOpenId = null
  }

  async function confirmRename(sessionId: string) {
    if (isRenaming) return
    const title = editingTitle.trim()
    if (!title) {
      editingId = null
      return
    }
    isRenaming = true
    try {
      await patchAgentSession().request({
        centerId: requireCenterId(),
        sessionId,
        payload: { title }
      })
      queryClient.invalidateQueries({
        queryKey: ['getAgentSessions'],
        exact: false
      })
    } finally {
      editingId = null
      isRenaming = false
    }
  }

  function handleRenameKeydown(e: KeyboardEvent, sessionId: string) {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmRename(sessionId)
    } else if (e.key === 'Escape') {
      editingId = null
    }
  }

  async function handleDelete(e: MouseEvent, sessionId: string) {
    e.stopPropagation()
    menuOpenId = null
    if (!confirm('이 대화를 삭제하시겠습니까?')) return
    await deleteAgentSession().request({
      centerId: requireCenterId(),
      sessionId
    })
    queryClient.invalidateQueries({
      queryKey: ['getAgentSessions'],
      exact: false
    })
  }

  function handleClickOutside() {
    if (menuOpenId) menuOpenId = null
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if isOpen}
  <div in:fade={{ duration: 150 }} class="flex flex-col h-full">
    <Button
      color="primary-dark"
      size="md"
      weight="medium"
      class="w-full gap-2 h-11 rounded-lg mb-4"
      onclick={onNewChat}
    >
      <PlusWhiteIcon20 />
      <Typography variant="body-01-normal-medium" color="text-white">
        새로운 대화
      </Typography>
    </Button>

    <!-- 검색 -->
    <div class="mb-3">
      <Typography
        variant="body-03-normal-medium"
        className="mb-1.5 text-gray-500">검색</Typography
      >
      <div class="relative">
        <input
          type="text"
          placeholder="검색어를 입력해주세요"
          class="field-input pr-9"
          bind:value={searchQuery}
        />
        <svg
          class="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>

    <div class="border-t border-gray-100 pt-3">
      <Typography variant="body-03-normal-medium" className="mb-2 text-gray-500"
        >최근 대화</Typography
      >
    </div>

    <div class="flex flex-col gap-1 flex-1 overflow-y-auto scrollbar-none">
      {#each filteredSessions as session}
        <div
          class="group relative w-full px-3 py-2 flex items-center rounded-lg duration-200 hover:bg-gray-50 cursor-pointer"
          class:bg-gray-50={session.id === currentSessionId}
          role="button"
          tabindex="0"
          onclick={() => onSelectSession(session.id)}
          onkeydown={(e) => e.key === 'Enter' && onSelectSession(session.id)}
        >
          {#if editingId === session.id}
            <input
              type="text"
              class="flex-1 min-w-0 text-label-01-normal-regular text-gray-700 bg-white border border-primary-400 rounded px-2.5 py-0.5 outline-none"
              bind:value={editingTitle}
              onkeydown={(e) => handleRenameKeydown(e, session.id)}
              onblur={() => confirmRename(session.id)}
              onclick={(e) => e.stopPropagation()}
              autofocus
            />
          {:else}
            <span
              class="text-label-01-normal-regular text-gray-700 truncate-safe min-w-0 flex-1"
            >
              {session.title ?? '새 대화'}
            </span>

            <!-- ... 메뉴 버튼 -->
            <button
              class="shrink-0 ml-1 h-6 w-6 flex items-center justify-center rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all"
              class:!opacity-100={session.id === currentSessionId}
              onclick={(e) => toggleMenu(e, session.id)}
            >
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
          {/if}

          <!-- 드롭다운 메뉴 -->
          {#if menuOpenId === session.id}
            <div
              class="dropdown-panel absolute top-full right-0 z-20 mt-1"
              onclick={(e) => e.stopPropagation()}
            >
              <button
                class="dropdown-item"
                onclick={(e) => startRename(e, session)}
              >
                제목 변경
              </button>
              <button
                class="dropdown-item is-danger"
                onclick={(e) => handleDelete(e, session.id)}
              >
                삭제
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
