<style>
  /* journal-paper / journal-line-input 은 app.css 공통 유틸 사용 */

  /* 모달 루트: 상단 탭 + 단일 카드 */
  .modal-root {
    position: relative;
    height: 90vh;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  /* 참여자 탭 bar: 모달 상단 바깥 + 탭 영역 flex-1 / 페이지네이션 122px 고정 */
  .participant-tabs {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 0;
    pointer-events: auto;
  }
  .participant-tabs-container {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 4px;
  }
  .participant-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 0 0 calc((100% - 20px) / 6);
    min-width: 0;
    height: 36px;
    padding: 0 14px;
    background: #f3f4f6; /* gray-100 */
    border: 1px solid #f3f4f6;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    color: #6b7280;
    overflow: hidden;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
    cursor: pointer;
  }
  .participant-tab:hover {
    background: #e5e7eb; /* gray-200 */
    border-color: #e5e7eb;
  }
  .participant-tab.is-active {
    background: #ffffff;
    color: #111827;
    border-color: #ffffff;
  }
  /* 플로팅 이전/다음 버튼: 모달 바깥(backdrop)에 절대 배치 */
  .floating-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .floating-nav:hover {
    opacity: 0.85;
  }
  .floating-nav :global(svg) {
    width: 100%;
    height: 100%;
  }
  .floating-nav-prev {
    left: -64px;
    transform: translateY(-50%) rotate(180deg);
  }
  .floating-nav-next {
    right: -64px;
  }

  /* 모바일 (<768px): 플로팅 화살표 숨기고 탭은 가로 스크롤, 페이지네이션 숨김 */
  @media (max-width: 767px) {
    .floating-nav {
      display: none !important;
    }
    .participant-tabs-container {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .participant-tabs-container::-webkit-scrollbar {
      display: none;
    }
    .participant-tab {
      flex: 0 0 auto;
      padding: 0 12px;
    }
    .participant-pagination {
      display: none !important;
    }
  }

  /* 페이지네이션: 우측 끝 122px 고정. "< N/M 완료 >" */
  .participant-pagination {
    flex: 0 0 122px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    height: 36px;
    padding: 0 4px;
  }
  /* 닫기 — 탭 줄 우측 끝. 탭 높이(36)에 맞춰 정렬하고 색은 backdrop 위라 흰색 */
  .tabs-close {
    flex: 0 0 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    color: #ffffff;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .tabs-close:hover {
    opacity: 0.7;
  }

  .pagination-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: #ffffff;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .pagination-arrow:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .pagination-arrow:not(:disabled):hover {
    opacity: 0.8;
  }

  .tab-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #9ca3af; /* gray-400 */
  }
  .participant-tab.is-active .tab-dot {
    width: 6px;
    height: 6px;
    background: #f47500; /* etc-orange */
  }
  .participant-tab.has-note .tab-dot {
    display: none;
  }
</style>

<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getSessionNoteList,
    postCreateSessionNote,
    patchModifySessionNote,
    type SessionNotePayload
  } from '$lib/hooks/actions/counseling.action'
  import {
    getNoteShares,
    type CounselingNoteShare
  } from '$lib/hooks/actions/counseling-note-share.action'
  import { modalStore } from '$lib/stores/modal'
  import TransferNoteModal from '$lib/components/counseling/TransferNoteModal.svelte'
  import type {
    CaseClient,
    CounselingSession,
    CounselingSessionNote
  } from '$lib/types/counseling'
  import { formatUtcToKst } from '$lib/utils/date'
  import { maskName } from '$lib/utils/maskingHandler'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { useQueryClient } from '@tanstack/svelte-query'
  import LockIcon20 from '$root/src/lib/assets/LockIcon20.svelte'
  import CompleteCheckIcon20 from '$root/src/lib/assets/CompleteCheckIcon20.svelte'
  import CircleArrowGrayIcon64 from '$root/src/lib/assets/CircleArrowGrayIcon64.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'

  interface Props {
    modalId?: string
    closeModal?: () => void
    session: CounselingSession
    caseClients: CaseClient[]
    programName: string
    initialClientId: string
    isSecretMode?: boolean
  }

  let {
    closeModal = () => {},
    session,
    caseClients,
    programName,
    initialClientId,
    isSecretMode = false
  }: Props = $props()

  const queryClient = useQueryClient()

  // 참여자 정렬: 가나다
  const sortedClients = $derived(
    session.clients
      .slice()
      .sort((a, b) =>
        a.participant_name.localeCompare(b.participant_name, 'ko')
      )
  )

  // svelte-ignore state_referenced_locally
  let selectedClientId = $state(
    initialClientId || sortedClients[0]?.participant_id || ''
  )

  // 세션 일지 목록 조회 (참여자별)
  const sessionNoteQuery = queryBuilder(
    getSessionNoteList,
    () => ({ centerId: $centerId ?? '', sessionId: session.session_id }),
    () => ({ enabled: !!$centerId && !!session.session_id })
  )

  const sessionNotes = $derived(
    (sessionNoteQuery.data as CounselingSessionNote[] | undefined) ?? []
  )

  const currentNote = $derived(
    sessionNotes.find((n) => n.client_id === selectedClientId) ?? null
  )

  // 공유문 — 버튼이 "만들기 / 확인 / 공유 중"을 구분해 보여주기 위한 상태
  const noteShareQuery = queryBuilder(
    getNoteShares,
    () => ({ centerId: $centerId ?? '', sessionId: session.session_id }),
    () => ({ enabled: !!$centerId && !!session.session_id })
  )

  const currentShare = $derived(
    ((noteShareQuery.data as CounselingNoteShare[] | undefined) ?? []).find(
      (s) => s.client_id === selectedClientId
    ) ?? null
  )

  const shareButtonLabel = $derived(
    currentShare?.status === 'published'
      ? '전달됨'
      : currentShare
        ? '전달문 확인'
        : '내담자에게 전달'
  )

  // 공유문은 저장된 일지를 원문으로 읽는다 — 미저장분을 먼저 넘기고 연다
  async function openShare() {
    await flushCurrent()
    const client = sortedClients.find(
      (c) => c.participant_id === selectedClientId
    )
    if (!client) return
    const name = isSecretMode
      ? maskName(client.participant_name)
      : client.participant_name
    modalStore.open({
      component: TransferNoteModal,
      props: {
        goal,
        progress,
        nextPlan,
        sourceLabel: `${formatUtcToKst(session.start, 'YYYY-MM-DD')} 회기 · ${name}`,
        audienceLabel: `${name}님 가족이 앱에서 봐요`,
        sessionId: session.session_id,
        clientId: client.participant_id,
        clientName: name
      },
      options: { size: 'xl' }
    })
  }

  const currentIndex = $derived(
    sortedClients.findIndex((c) => c.participant_id === selectedClientId)
  )
  const totalClients = $derived(sortedClients.length)

  // 탭 페이지네이션: 한 페이지당 6명. 7명 이상이면 페이지 분할.
  const PAGE_SIZE = 6
  let tabPage = $state(0)

  const totalPages = $derived(
    Math.max(1, Math.ceil(sortedClients.length / PAGE_SIZE))
  )
  // 모바일은 페이지네이션 대신 가로 스크롤로 전체 참여자 표시
  const visibleClients = $derived(
    responsive.isMobile
      ? sortedClients
      : sortedClients.slice(tabPage * PAGE_SIZE, (tabPage + 1) * PAGE_SIZE)
  )
  const hasPrevPage = $derived(tabPage > 0)
  const hasNextPage = $derived(tabPage < totalPages - 1)

  function prevTabPage() {
    if (hasPrevPage) tabPage -= 1
  }
  function nextTabPage() {
    if (hasNextPage) tabPage += 1
  }

  // 작성된 일지를 가진 client_id 집합 (라디오 표식용)
  const writtenClientIds = $derived.by(() => {
    const set = new Set<string>()
    for (const n of sessionNotes) {
      const hasContent = !!(
        n.content?.main_topic ||
        n.content?.progress ||
        n.content?.next_goal ||
        n.content?.private_notes ||
        n.summary
      )
      if (hasContent) set.add(n.client_id)
    }
    return set
  })

  // 폼 상태 (top 카드 전용 — 편집 가능한 현재 참여자 폼)
  let goal = $state('') // 상담 목표 → main_topic
  let progress = $state('') // 진행 내용 → progress
  let nextPlan = $state('') // 다음 상담 내용 → next_goal
  /**
   * 전달문은 저장된 일지를 원문으로 삼는다 — 쓴 내용이 하나도 없으면 만들 재료가 없다.
   * 목표·진행·다음 계획 중 하나라도 채워져 있어야 누를 수 있다.
   * (이미 만들어 둔 전달문이 있으면 '확인'은 언제나 열 수 있어야 하므로 잠그지 않는다)
   */
  const hasJournalContent = $derived(
    !!goal.trim() || !!progress.trim() || !!nextPlan.trim()
  )
  const shareDisabled = $derived(!currentShare && !hasJournalContent)
  let privateMemo = $state('') // 개인 메모 → private_notes
  let isSaving = $state(false)

  // ── 괘선(36px) 정렬 ────────────────────────────────────────────────
  // 본문 배경은 36px 괘선이고, 타이틀 행(h-36)·textarea(line-height 36)가 그 칸에
  // 얹혀야 한다. 메타 카드는 반 칸(18) 아래에서 시작하고 높이가 데이터로 변하므로,
  // 카드 뒤에 "다음 36 배수까지의 나머지"만큼 스페이서를 깔아 격자로 복귀시킨다.
  const GRID = 36
  const META_TOP_OFFSET = 18
  let metaCardEl = $state<HTMLDivElement | null>(null)
  let metaSnapPx = $state(0)

  $effect(() => {
    const el = metaCardEl
    if (!el) return
    const sync = () => {
      const used = META_TOP_OFFSET + el.offsetHeight
      metaSnapPx = (GRID - (used % GRID)) % GRID
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  })

  // 불러온 시점의 기준값 — dirty 판별 + 중복 저장 방지용
  let baseline = $state({
    goal: '',
    progress: '',
    nextPlan: '',
    privateMemo: ''
  })

  // 선택된 참여자가 바뀌거나 서버 데이터가 오면 폼 재초기화
  let loadedKey = $state('')
  $effect(() => {
    const key = `${selectedClientId}:${currentNote?.id ?? ''}:${currentNote?.updated_at ?? ''}`
    if (key === loadedKey) return
    loadedKey = key
    const g = currentNote?.content?.main_topic ?? ''
    const p = currentNote?.content?.progress ?? ''
    const n = currentNote?.content?.next_goal ?? ''
    const pm = currentNote?.content?.private_notes ?? ''
    goal = g
    progress = p
    nextPlan = n
    privateMemo = pm
    baseline = { goal: g, progress: p, nextPlan: n, privateMemo: pm }
  })

  // 현재 폼이 불러온 기준값과 달라졌는지 (자동 저장 여부 판단)
  const isDirty = $derived(
    goal !== baseline.goal ||
      progress !== baseline.progress ||
      nextPlan !== baseline.nextPlan ||
      privateMemo !== baseline.privateMemo
  )

  const subtitleText = $derived(
    `${formatUtcToKst(session.start, 'YYYY-MM-DD(d) HH:mm')} 상담의 일지를 작성해주세요`
  )

  const clientCodeFor = (clientId: string) =>
    caseClients.find((c) => c.client_id === clientId)?.client_code ?? ''

  // 미작성(내용 없음)이면 레코드 생성일을 작성일로 오인하지 않게 공란 처리
  const createdLabelFor = (note: CounselingSessionNote | null) => {
    const hasContent = !!(
      note?.content?.main_topic ||
      note?.content?.progress ||
      note?.content?.next_goal ||
      note?.content?.private_notes ||
      note?.summary
    )
    return note?.created_at && hasContent
      ? formatUtcToKst(note.created_at as any, 'YYYY-MM-DD')
      : '–'
  }

  function syncTabPageTo(idx: number) {
    tabPage = Math.floor(idx / PAGE_SIZE)
  }

  async function handleSelect(clientId: string) {
    if (clientId === selectedClientId) return
    await flushCurrent()
    selectedClientId = clientId
    const idx = sortedClients.findIndex((c) => c.participant_id === clientId)
    if (idx >= 0) syncTabPageTo(idx)
  }

  async function gotoPrev() {
    if (totalClients === 0) return
    await flushCurrent()
    const prevIdx = (currentIndex - 1 + totalClients) % totalClients
    selectedClientId = sortedClients[prevIdx].participant_id
    syncTabPageTo(prevIdx)
  }
  async function gotoNext() {
    if (totalClients === 0) return
    await flushCurrent()
    const nextIdx = (currentIndex + 1) % totalClients
    selectedClientId = sortedClients[nextIdx].participant_id
    syncTabPageTo(nextIdx)
  }

  function autoScroll(node: HTMLTextAreaElement) {
    const scroll = () => {
      requestAnimationFrame(() => {
        if (node.selectionStart === node.value.length) {
          node.scrollTop = node.scrollHeight
        }
      })
    }
    node.addEventListener('input', scroll)
    return {
      destroy() {
        node.removeEventListener('input', scroll)
      }
    }
  }

  /**
   * textarea를 내용에 맞게 자동 리사이즈.
   * min 이하로는 줄지 않고, max를 넘으면 스크롤.
   */
  function autoResize(
    node: HTMLTextAreaElement,
    params: { min: number; max: number; value?: string }
  ) {
    let current = params
    const GRID = 30
    const resize = () => {
      node.style.height = 'auto'
      const sh = node.scrollHeight
      const snapped = Math.ceil(sh / GRID) * GRID
      const next = Math.min(Math.max(snapped, current.min), current.max)
      node.style.height = `${next}px`
      node.style.overflowY = sh > current.max ? 'auto' : 'hidden'
    }
    requestAnimationFrame(resize)
    node.addEventListener('input', resize)
    return {
      update(newParams: { min: number; max: number; value?: string }) {
        current = newParams
        requestAnimationFrame(resize)
      },
      destroy() {
        node.removeEventListener('input', resize)
      }
    }
  }

  type JournalValues = {
    goal: string
    progress: string
    nextPlan: string
    privateMemo: string
  }

  async function invalidateNotes() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['getSessionNoteList'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getCounselingDetailById'],
        exact: false
      })
    ])
  }

  /**
   * 일지 저장 코어 — 신규는 POST, 기존은 PATCH.
   * 호출 시점의 값을 명시적으로 받아 reactive 상태 변화(참여자 전환)와 무관하게 동작.
   */
  async function persistNote(
    clientId: string,
    existingNote: CounselingSessionNote | null,
    values: JournalValues
  ): Promise<void> {
    const cid = $centerId
    if (!cid) throw new Error('center id 없음')

    const payload: SessionNotePayload & { client_id?: string } = {
      content: {
        main_topic: values.goal,
        progress: values.progress,
        next_goal: values.nextPlan,
        private_notes: values.privateMemo,
        // 폼에 비노출되는 기존 키는 값이 있을 때만 보존
        ...(existingNote?.content?.homework
          ? { homework: existingNote.content.homework }
          : {}),
        ...(existingNote?.content?.intervention
          ? { intervention: existingNote.content.intervention }
          : {}),
        ...(existingNote?.content?.mood
          ? { mood: existingNote.content.mood }
          : {}),
        ...(existingNote?.content?.raw_notes
          ? { raw_notes: existingNote.content.raw_notes }
          : {})
      },
      summary: existingNote?.summary ?? ''
    }

    if (existingNote) {
      await patchModifySessionNote().request({
        centerId: cid,
        noteId: existingNote.id,
        payload
      })
    } else {
      await postCreateSessionNote().request({
        centerId: cid,
        sessionId: session.session_id,
        payload: { ...payload, client_id: clientId } as any
      })
    }
  }

  // 저장 버튼: 명시적 저장(토스트 노출)
  async function handleSave() {
    if (!selectedClientId || !$centerId || isSaving) return
    const isNew = !currentNote
    isSaving = true
    try {
      await persistNote(selectedClientId, currentNote, {
        goal,
        progress,
        nextPlan,
        privateMemo
      })
      baseline = { goal, progress, nextPlan, privateMemo }
      snackbarStore.success(isNew ? '일지를 작성했어요!' : '일지를 수정했어요!')
      await invalidateNotes()
    } catch {
      snackbarStore.error('일지 저장에 실패했어요.')
    } finally {
      isSaving = false
    }
  }

  /**
   * 자동 저장 — 참여자 전환/모달 닫기 직전, 현재 참여자의 미저장 변경분을 저장.
   * 변경이 없거나(빈 일지) 내용이 비었으면 저장하지 않아 불필요한 빈 일지를 만들지 않음.
   * 전환 전 refetch까지 완료해 같은 참여자에 대한 중복 생성(POST)을 방지.
   */
  async function flushCurrent(): Promise<void> {
    if (isSaving || !isDirty) return
    const hasContent = !!(goal || progress || nextPlan || privateMemo)
    if (!currentNote && !hasContent) return
    if (!selectedClientId || !$centerId) return

    const clientId = selectedClientId
    const existing = currentNote
    const values: JournalValues = { goal, progress, nextPlan, privateMemo }
    isSaving = true
    try {
      await persistNote(clientId, existing, values)
      baseline = values
      await invalidateNotes()
    } catch {
      snackbarStore.error('일지 자동 저장에 실패했어요.')
    } finally {
      isSaving = false
    }
  }

  // 닫기 버튼: 미저장분 저장 후 닫기
  async function handleClose() {
    await flushCurrent()
    closeModal()
  }

  // 배경 클릭/ESC 등 모든 닫힘 경로 커버 — 컴포넌트 파괴 시 미저장분을 저장.
  // 컴포넌트가 이미 사라진 뒤이므로 await 불가(fire-and-forget).
  onDestroy(() => {
    if (!browser || isSaving || !isDirty) return
    const hasContent = !!(goal || progress || nextPlan || privateMemo)
    if (!currentNote && !hasContent) return
    if (!selectedClientId || !$centerId) return
    const clientId = selectedClientId
    const existing = currentNote
    const values: JournalValues = { goal, progress, nextPlan, privateMemo }
    persistNote(clientId, existing, values)
      .then(() => invalidateNotes())
      .catch(() => snackbarStore.error('일지 자동 저장에 실패했어요.'))
  })
</script>

<div class="modal-root">
  <!-- 참여자 탭 bar (모달 상단 외부에 부착) -->
  <div class="participant-tabs">
    <div class="participant-tabs-container">
      {#each visibleClients as client (client.participant_id)}
        {@const isActive = client.participant_id === selectedClientId}
        {@const hasNote = writtenClientIds.has(client.participant_id)}
        <button
          type="button"
          class="participant-tab"
          class:is-active={isActive}
          class:has-note={hasNote && !isActive}
          onclick={() => handleSelect(client.participant_id)}
        >
          {#if hasNote && !isActive}
            <CompleteCheckIcon20 />
          {:else}
            <span class="tab-dot" aria-hidden="true"></span>
          {/if}
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color={isActive ? 'text-gray-900' : 'text-gray-600'}
            className="block truncate-safe min-w-0 flex-1"
          >
            {isSecretMode
              ? maskName(client.participant_name)
              : client.participant_name}
          </Typography>
        </button>
      {/each}
    </div>
    {#if totalPages > 1}
      <div class="participant-pagination">
        <button
          type="button"
          aria-label="이전 페이지"
          onclick={prevTabPage}
          disabled={!hasPrevPage}
          class="pagination-arrow"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-white"
        >
          {writtenClientIds.size}/{totalClients} 완료
        </Typography>
        <button
          type="button"
          aria-label="다음 페이지"
          onclick={nextTabPage}
          disabled={!hasNextPage}
          class="pagination-arrow"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    {/if}
    <!-- 닫기 — 헤더가 아니라 탭 줄 우측 끝. 헤더의 액션(전달·저장)과 섞이지 않게 분리한다 -->
    <button
      type="button"
      aria-label="닫기"
      onclick={handleClose}
      class="tabs-close"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path
          d="M7 7L21 21M21 7L7 21"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <!-- 플로팅 이전/다음 버튼 (모달 좌우 바깥 backdrop 영역) -->
  <button
    type="button"
    aria-label="이전 참여자"
    onclick={gotoPrev}
    class="floating-nav floating-nav-prev"
  >
    <CircleArrowGrayIcon64 />
  </button>
  <button
    type="button"
    aria-label="다음 참여자"
    onclick={gotoNext}
    class="floating-nav floating-nav-next"
  >
    <CircleArrowGrayIcon64 />
  </button>

  <!-- Header -->
  <!-- 2줄 헤더 규격(§Components>modal): 패딩 좌우 20·상하 16 · 타이틀 Headline_02(20/600)
       · 타이틀↔부제 8 · 부제 Body_02/Regular(15) gray-500 · 상단 정렬 -->
  <div
    class="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4"
  >
    <div class="min-w-0 flex-1">
      <Typography
        variant="headline-02-normal-semibold"
        className="truncate-safe block"
        color="text-gray-800"
      >
        {isSecretMode
          ? maskName(sortedClients[currentIndex]?.participant_name ?? '')
          : (sortedClients[currentIndex]?.participant_name ?? '')}의 상담일지
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-500"
        className="mt-2 block"
      >
        {subtitleText}
      </Typography>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled={shareDisabled}
        class="h-10 rounded-lg border px-3 text-body-02-normal-medium transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-white disabled:text-gray-400 {currentShare?.status ===
        'published'
          ? 'border-blue-200 bg-blue-50 text-blue-600'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'}"
        onclick={openShare}
      >
        {shareButtonLabel}
      </button>
      <button
        type="button"
        onclick={handleSave}
        disabled={isSaving}
        class="w-19 h-10 rounded-lg bg-blue-500 text-body-02-normal-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        저장
      </button>
    </div>
  </div>

  <!-- Body -->
  <div class="journal-paper flex-1 min-h-0 overflow-y-auto pb-6">
    <!-- 메타 카드 위 여백 — 괘선 한 칸(36)이 아니라 반 칸(18).
         카드가 줄 경계가 아니라 줄 가운데에서 시작한다 -->
    <div class="h-[18px]"></div>

    <!-- 메타 카드 -->
    <!-- 메타 카드 — radius 12(한 단 위) · 레이블+데이터 가로형 카드 규격
         (15 · 레이블 gray-600 / 값 gray-900 · 레이블↔값 24 · 행 높이 20 · 행 간격 8) -->
    <div bind:this={metaCardEl} class="mx-6 rounded-xl bg-gray-50 p-4">
      <div class="flex items-center gap-2">
        <Typography variant="body-01-normal-semibold" color="text-gray-900">
          {isSecretMode
            ? maskName(sortedClients[currentIndex]?.participant_name ?? '')
            : (sortedClients[currentIndex]?.participant_name ?? '')}
        </Typography>
        {#if clientCodeFor(selectedClientId)}
          <BadgeRectangle label={clientCodeFor(selectedClientId)} size="sm" />
        {/if}
      </div>
      <div
        class="mt-3 grid auto-rows-[20px] grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2"
      >
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          프로그램
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-gray-900">
          {programName}
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          작성일
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-gray-900">
          {createdLabelFor(currentNote)}
        </Typography>
      </div>
    </div>

    <!-- 괘선 복귀 스페이서 — 반 칸(18) + 카드 높이를 36 배수로 올림해 다음 줄부터
         타이틀·본문이 괘선 칸에 정확히 얹히게 한다(카드 높이는 데이터로 변한다) -->
    <div style="height: {metaSnapPx}px" aria-hidden="true"></div>

    <!-- 상담 목표 -->
    <div class="mt-[36px] mx-6">
      <div class="h-[36px] flex items-center">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          상담 목표
        </Typography>
      </div>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={goal}
        maxlength={3000}
        placeholder={'상담 목표를 작성해주세요.\n작성된 내용은 상담일지와 바우처 관련 서류에 활용될 수 있어요'}
        class="journal-line-input h-[180px] overflow-y-auto px-3 py-0"
        use:autoScroll
      />
    </div>

    <!-- 진행 내용 -->
    <div class="mx-6 mt-[36px]">
      <div class="h-[36px] flex items-center">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          진행 내용
        </Typography>
      </div>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={progress}
        maxlength={5000}
        placeholder="진행 내용을 작성해주세요"
        class="journal-line-input h-[180px] overflow-y-auto px-3 py-0"
        use:autoScroll
      />
    </div>

    <!-- 다음 상담 내용 -->
    <div class="mx-6 mt-[36px]">
      <div class="h-[36px] flex items-center">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          다음 상담 내용
        </Typography>
      </div>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={nextPlan}
        maxlength={3000}
        placeholder="다음 상담 내용을 작성해주세요"
        class="journal-line-input h-[180px] overflow-y-auto px-3 py-0"
        use:autoScroll
      />
    </div>

    <!-- 개인 메모 -->
    <div class="mx-6 mt-[36px]">
      <div class="h-[36px] flex items-center gap-1.5">
        <LockIcon20 />
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          개인 메모
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-500">
          개인 기록용 메모로 본인만 확인가능해요
        </Typography>
      </div>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={privateMemo}
        maxlength={3000}
        placeholder="개인 메모를 작성해주세요"
        class="journal-line-input h-[180px] overflow-y-auto px-3 py-0"
        use:autoScroll
      />
    </div>
  </div>
</div>
