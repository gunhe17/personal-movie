<style>
  /* 저장됨 체크가 그려지는 애니메이션 (stroke-dasharray) */
  .save-check {
    stroke-dasharray: 16;
    stroke-dashoffset: 16;
    animation: draw-check 0.4s ease-out forwards;
  }
  @keyframes draw-check {
    to {
      stroke-dashoffset: 0;
    }
  }

  /* 필드노트 카드 — 카드 전체가 '열기'라 배경에 hover를 준다.
     다만 안쪽 버튼 위에 있을 때는 그 버튼만 반응해야 한다(둘이 동시에 밝아지면
     무엇을 누르는지 흐려진다) → 자식 버튼 hover 동안 카드 배경을 되돌린다. */
  .fieldnote-entry:has(button:hover) {
    background-color: var(--color-bg-base);
  }
</style>

<script lang="ts">
  // 회기 상세 우측 패널의 인라인 일지 에디터.
  // CounselingJournalModal의 저장/전환 코어를 복제(모달은 보존)하되,
  // selectedClientId(=participant_id)를 부모가 제어하는 "제어 컴포넌트"이다.
  // 부모는 좌측 리스트에서 내담자를 바꾸기 전에 flush()를 await 해야 한다.
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getSessionNoteList,
    postCreateSessionNote,
    patchModifySessionNote,
    type SessionNotePayload
  } from '$lib/hooks/actions/counseling.action'
  import type {
    CaseClient,
    CounselingSession,
    CounselingSessionNote,
    SessionParticipant
  } from '$lib/types/counseling'
  import { formatUtcToKst } from '$lib/utils/date'
  import { maskName } from '$lib/utils/maskingHandler'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import NoticeBubble from '$lib/components/common/NoticeBubble.svelte'
  import BillingActionButton from '$lib/features/billing/components/BillingActionButton.svelte'
  import LockIcon20 from '$lib/assets/LockIcon20.svelte'
  import CancelledScheduleIcon54 from '$lib/assets/CancelledScheduleIcon54.svelte'
  import StackCounselingIcon102 from '$lib/assets/StackCounselingIcon102.svelte'
  import AiDraftHistoryModal from './AiDraftHistoryModal.svelte'
  import TransferNoteModal from './TransferNoteModal.svelte'
  import FieldnoteIcon24 from '$lib/assets/FieldnoteIcon24.svelte'
  import TimerIcon16 from '$lib/assets/TimerIcon16.svelte'
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { getCounselingNoteAiDrafts } from '$lib/hooks/actions/counseling-note-ai-draft.action'

  interface Props {
    session: CounselingSession
    caseClients: CaseClient[]
    /** = participant_id. 부모(좌측 리스트)가 제어 */
    selectedClientId: string
    isSecretMode?: boolean
    attendanceEditable?: boolean
    onAttendanceChange?: (sessionParticipantId: string, status: string) => void
    onEditNoShow?: (client: SessionParticipant) => void
    /** 이 회기 녹음(필드노트) 상태 — 문서 맨 위 블록 */
    fieldNoteStatus?: 'none' | 'processing' | 'completed' | 'failed'
    fieldNoteDurationLabel?: string
    /** 필드노트 표시명 — "필드노트 {note_number}" (전문가앱 목록과 같은 규칙) */
    fieldNoteName?: string
    /** 필드노트 시트 열기. 없으면 문서 맨 위 블록을 띄우지 않는다 */
    onOpenFieldNote?: (tab?: 'transcript' | 'memo' | 'analysis') => void
    /**
     * 일지 초안 생성 — 전사를 분석해 만든 초안을 돌려준다(완료까지 대기).
     * 주면 「일지 초안 생성」이 시트를 여는 대신 그 자리에서 돌고 칸을 채운다.
     */
    onGenerateNoteDraft?: () => Promise<Record<string, any> | null>
    billingState?: 'none' | 'pending' | 'completed'
    billingSource?: 'case' | 'session'
    canWriteBilling?: boolean
    canReadBilling?: boolean
    onCreateBilling?: () => void
    onViewBilling?: () => void
  }

  let {
    session,
    caseClients,
    selectedClientId,
    isSecretMode = false,
    attendanceEditable = true,
    onAttendanceChange,
    onEditNoShow,
    fieldNoteStatus = 'none',
    fieldNoteDurationLabel = '',
    fieldNoteName = '이 회기 녹음',
    onOpenFieldNote,
    onGenerateNoteDraft,
    billingState = 'none',
    billingSource,
    canWriteBilling = false,
    canReadBilling = false,
    onCreateBilling,
    onViewBilling
  }: Props = $props()

  const queryClient = useQueryClient()

  // 현재 선택된 참여자(객체)
  const selectedClient = $derived(
    session.clients.find((c) => c.participant_id === selectedClientId) ?? null
  )
  // 예정 회기 = 출결이 아직 성립하지 않은 회기. 저장된 출결값이 남아 있어도
  // (레거시 데이터·되돌리기 잔재) 전부 미확정으로 본다 — 예정인데 참석/불참이
  // 찍혀 있으면 참석 확인 화면이 통째로 건너뛰어진다.
  // 되돌아옴 방지는 서비스가 담당한다: 예정 회기에서 출결을 확정하면 회기 상태도
  // 함께 확정된다(detail-service getSuggestedSessionStatus) → 예정+확정 출결 조합이 남지 않는다.
  const attendanceStatus = $derived(
    session?.status === 'scheduled'
      ? 'scheduled'
      : (selectedClient?.attendance_status ?? '')
  )
  const selectedOut = $derived(
    attendanceStatus === 'absent' || attendanceStatus === 'no_show'
  )

  // 출석 미확인(기본값) 상태 — 일지/상단바 대신 출석 확인 안내를 먼저 띄운다.
  // 상태를 고른 뒤에야 일지 작성 영역이 나타난다.
  // 수정 불가 상태(attendanceEditable=false)면 고를 수단이 없으므로 안내를 건너뛴다.
  const ATTENDANCE_CONFIRMED = ['attended', 'absent', 'no_show']
  // 판정 기준은 정규화된 출결값(attendanceStatus) — 예정 회기면 저장값과 무관하게 미확정이다.
  const isUnconfirmed = $derived(
    !!selectedClient &&
      attendanceEditable &&
      !ATTENDANCE_CONFIRMED.includes(attendanceStatus)
  )

  // 아직 시작하지 않은 회기 — 출석은 '회기가 진행되어야' 성립하는 개념이라
  // 시작 전에는 출결 선택을 열지 않고 안내만 띄운다.
  const isBeforeStart = $derived.by(() => {
    if (!session?.start) return false
    const start = new Date(session.start)
    if (isNaN(start.getTime())) return false
    return start.getTime() > Date.now()
  })

  // 출석 미확인 안내의 선택지 (아이콘은 CircleCautionOrangeIcon20과 동일한 기하: r=7 @ 20)
  const ATTENDANCE_CHOICES: { value: string; label: string; tone: string }[] = [
    { value: 'attended', label: '참석했어요', tone: 'text-green-500' },
    { value: 'absent', label: '취소했어요', tone: 'text-etc-red' },
    { value: 'no_show', label: '노쇼했어요', tone: 'text-orange-500' }
  ]

  // 출결 세그먼트는 참여자 바(SessionDetailPanel)가 소유한다.
  // 여기서는 '미확인' 안내의 선택지(ATTENDANCE_CHOICES)만 다룬다.
  function handleAttendanceChange(value: string) {
    // 비교도 정규화값으로 — 예정 회기에 남아 있던 옛 값과 같은 항목을 골라도 확정으로 처리해야 한다
    if (!selectedClient || value === attendanceStatus) return
    onAttendanceChange?.(selectedClient.session_participant_id, value)
  }

  // ── 일지 조회 (모달과 동일) ────────────────────────────────────
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

  // ── 폼 상태 (모달과 동일) ──────────────────────────────────────
  let goal = $state('')
  let progress = $state('')
  let nextPlan = $state('')
  let privateMemo = $state('')
  let isSaving = $state(false)
  // 저장 직후 잠깐 "저장됨" 피드백을 띄우는 플래그 (재미/안심 요소)
  let justSaved = $state(false)
  let justSavedTimer: ReturnType<typeof setTimeout> | null = null
  function flashSaved() {
    justSaved = true
    if (justSavedTimer) clearTimeout(justSavedTimer)
    justSavedTimer = setTimeout(() => (justSaved = false), 1800)
  }
  let baseline = $state({
    goal: '',
    progress: '',
    nextPlan: '',
    privateMemo: ''
  })

  // 선택 참여자/서버 데이터 변경 시 폼 재초기화 (모달과 동일)
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

  // AI 초안을 본문 끝에 이어붙인다 — 덮어쓰지 않으므로 상담사가 쓴 내용은 유지된다.
  function insertDraftText(
    field: 'goal' | 'progress' | 'nextPlan',
    text: string
  ) {
    const append = (prev: string) => (prev.trim() ? `${prev}\n\n${text}` : text)
    if (field === 'goal') goal = append(goal)
    else if (field === 'progress') progress = append(progress)
    else nextPlan = append(nextPlan)
  }

  // 초안 → 일지 칸 매핑. private_notes 는 작성자 전용이라 자동으로 채우지 않는다.
  const DRAFT_FIELD_MAP = [
    { field: 'goal', key: 'main_topic', label: '상담 목표' },
    { field: 'progress', key: 'progress', label: '진행 내용' },
    { field: 'nextPlan', key: 'next_goal', label: '다음 상담 내용' }
  ] as const

  let isGeneratingDraft = $state(false)

  function currentValue(field: 'goal' | 'progress' | 'nextPlan') {
    return field === 'goal' ? goal : field === 'progress' ? progress : nextPlan
  }
  function setValue(field: 'goal' | 'progress' | 'nextPlan', value: string) {
    if (field === 'goal') goal = value
    else if (field === 'progress') progress = value
    else nextPlan = value
  }

  /**
   * 초안을 칸에 옮긴다. 빈 칸은 조용히 채우고, 이미 쓴 칸이 있으면 한 번만 물어본다
   * — 상담사가 쓴 글을 말없이 덮는 건 되돌릴 수 없는 손실이다.
   */
  function applyDraft(content: Record<string, any>): void {
    const usable = DRAFT_FIELD_MAP.filter(({ key }) => {
      const v = content?.[key]
      return typeof v === 'string' && v.trim()
    })
    if (usable.length === 0) {
      snackbarStore.info('초안에서 옮길 내용을 찾지 못했어요.')
      return
    }

    const occupied = usable.filter(({ field }) => currentValue(field).trim())
    let overwrite = false
    if (occupied.length > 0) {
      overwrite = confirm(
        `${occupied.map((f) => f.label).join(' · ')}에 이미 작성한 내용이 있어요.\n` +
          '초안으로 덮어쓸까요? (취소하면 빈 칸만 채워요)'
      )
    }

    const filled: string[] = []
    for (const { field, key, label } of usable) {
      if (currentValue(field).trim() && !overwrite) continue
      setValue(field, String(content[key]).trim())
      filled.push(label)
    }

    if (filled.length === 0) {
      snackbarStore.info(
        '이미 모든 칸에 내용이 있어요. 초안은 「초안 보기」에서 확인할 수 있어요.'
      )
      return
    }
    snackbarStore.success(`${filled.join(' · ')}을(를) 초안으로 채웠어요.`)
  }

  async function handleGenerateDraft() {
    if (!onGenerateNoteDraft) {
      onOpenFieldNote?.('analysis')
      return
    }
    if (isGeneratingDraft) return
    isGeneratingDraft = true
    try {
      const content = await onGenerateNoteDraft()
      if (content) applyDraft(content)
    } finally {
      isGeneratingDraft = false
    }
  }

  // 초안 개수 — 문서 맨 위 블록이 '초안 N건'으로 노출한다.
  // 같은 쿼리를 모달도 쓰므로 TanStack이 중복 요청을 합친다.
  const aiDraftQuery = queryBuilder(
    getCounselingNoteAiDrafts,
    () => ({ centerId: $centerId, sessionId: session.session_id }),
    () => ({
      enabled: !!$centerId && !!session.session_id,
      throwOnError: false
    })
  )
  const aiDraftCount = $derived(
    ((aiDraftQuery.data as unknown[] | undefined) ?? []).length
  )
  function openAiDraftHistory() {
    modalStore.open({
      component: AiDraftHistoryModal,
      props: { sessionId: session.session_id, onInsert: insertDraftText },
      options: { size: 'md' }
    })
  }

  // 전달문(내담자용 변환 · 전송) — 필드노트 유무와 무관하다.
  // 재료는 일지 본문뿐이고 필드노트는 그 위 단계(초안 만들기)에서 이미 소비되므로,
  // 녹음이 없어도 손으로 쓴 일지로 전달문을 만들 수 있어야 한다.
  // 개인 메모는 넘기지 않는다 — 재료에서 구조적으로 빠진다.
  const hasTransferMaterial = $derived(
    !!(goal.trim() || progress.trim() || nextPlan.trim())
  )
  // 전달 버튼 위 고지 — hover 툴팁이 아니라 상시 노출(닫기 가능). 청구 '미청구 N건' 말풍선과 같은 규격
  let transferTipClosed = $state(false)
  // 전달문은 저장된 일지를 원문으로 읽는다(서버가 DB의 일지를 재료로 쓴다)
  // → 미저장분을 먼저 넘기고 연다. 모달의 openShare와 같은 순서.
  async function openTransferNote() {
    if (!hasTransferMaterial || !selectedClientId) return
    await flush()
    modalStore.open({
      component: TransferNoteModal,
      props: {
        goal,
        progress,
        nextPlan,
        sourceLabel: `${formatUtcToKst(session.start, 'YYYY-MM-DD')} 회기 · ${displayName}`,
        audienceLabel: `${displayName}님 가족이 앱에서 봐요`,
        sessionId: session.session_id,
        clientId: selectedClientId,
        clientName: displayName
      },
      options: { size: 'xl' }
    })
  }

  const isDirty = $derived(
    goal !== baseline.goal ||
      progress !== baseline.progress ||
      nextPlan !== baseline.nextPlan ||
      privateMemo !== baseline.privateMemo
  )

  const clientCodeFor = (clientId: string) =>
    caseClients.find((c) => c.client_id === clientId)?.client_code ?? ''
  // 저장 시각 = 하단 바가 소유(옛 상단바 '작성일'을 대체).
  // 미작성(내용 없음)이면 null — 레코드 생성일을 저장 시각으로 오인하지 않게 한다.
  const savedLabel = $derived.by(() => {
    const c = currentNote?.content
    const hasContent = !!(
      c?.main_topic ||
      c?.progress ||
      c?.next_goal ||
      c?.private_notes ||
      currentNote?.summary
    )
    return currentNote?.updated_at && hasContent
      ? formatUtcToKst(currentNote.updated_at as any, 'YYYY-MM-DD HH:mm')
      : null
  })
  const displayName = $derived(
    isSecretMode
      ? maskName(selectedClient?.participant_name ?? '')
      : (selectedClient?.participant_name ?? '')
  )

  // ── 저장 코어 (모달 persistNote 그대로 복제) ──────────────────
  type JournalValues = {
    goal: string
    progress: string
    nextPlan: string
    privateMemo: string
  }
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
        // 폼 비노출 필드는 값이 있을 때만 보존
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

  // 명시 저장 (저장 버튼)
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
      flashSaved()
      snackbarStore.success(isNew ? '일지를 작성했어요!' : '일지를 수정했어요!')
      await invalidateNotes()
    } catch {
      snackbarStore.error('일지 저장에 실패했어요.')
    } finally {
      isSaving = false
    }
  }

  /**
   * 미저장 변경분 저장 (참여자 전환/이탈 직전 부모가 await).
   * 변경 없거나 빈 일지면 스킵해 불필요한 빈 일지 생성을 막는다.
   * 전환 전 refetch까지 완료해 같은 참여자 중복 생성을 방지.
   */
  export async function flush(): Promise<void> {
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

  // 컴포넌트 파괴 시(페이지 이탈 등) 미저장분 저장 (모달과 동일, browser 가드)
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
  onDestroy(() => {
    if (justSavedTimer) clearTimeout(justSavedTimer)
  })

  // ── 괘선 그리드 auto-grow textarea ────────────────────────────
  // 노트 영역은 {#key selectedClientId}로 전환 시 재마운트되므로,
  // autoGrow가 마운트 시 resize()로 높이를 잡고 ScrollFadeArea도 새로 측정한다.
  const LINE = 36
  const MIN_LINES = 3
  // 입력으로 높이가 바뀔 때 ScrollFadeArea가 fade를 재계산하도록 deps 트리거
  let growTick = $state(0)
  function autoGrow(node: HTMLTextAreaElement) {
    let prev = ''
    const resize = () => {
      node.style.height = `${LINE * MIN_LINES}px`
      const needed = Math.max(node.scrollHeight, LINE * MIN_LINES)
      const lines = Math.ceil(needed / LINE)
      const next = `${lines * LINE}px`
      node.style.height = next
      if (next !== prev) {
        prev = next
        growTick++
      }
    }
    resize()
    node.addEventListener('input', resize)
    return { destroy: () => node.removeEventListener('input', resize) }
  }
</script>

{#if selectedClient}
  <!-- 이름·프로그램·상담실·출결은 참여자 바(SessionDetailPanel)로 올라갔다.
       여기서는 문서(일지)만 소유한다. -->
  <!-- 본문: 시작 전 → 안내만, 출결 미확인은 확인 안내, 취소/노쇼는 정보 카드, 그 외 노트 일지 -->
  {#if isBeforeStart}
    <!-- 시작 전 — 출결·일지 모두 열지 않는다. 출석은 회기가 진행되어야 성립하는 개념이라
         출결이 이미 찍혀 있어도(과거 오조작) 시각 기준으로 일괄 차단한다. -->
    <div
      class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-30"
      in:fade={{ duration: 180 }}
    >
      <StackCounselingIcon102 />
      <p class="mt-6 text-title-01-normal-semibold text-body-strong">
        아직 진행되지 않은 회기예요
      </p>
      <!-- 타이틀↔서브내용 12 -->
      <p class="mt-3 text-body-02-normal-regular text-body-subtle">
        {formatUtcToKst(session.start, 'M월 D일 (d) HH:mm')}에 시작해요.
        출결여부는 회기가 끝난 뒤에 확정할 수 있어요.
      </p>
    </div>
  {:else if isUnconfirmed}
    <!-- 아이콘 상단 여백 120(pt-30) — 상단 고정. 중앙 정렬은 너무 내려가 폐기 -->
    <div
      class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-30"
      in:fade={{ duration: 180 }}
    >
      <StackCounselingIcon102 />
      <p class="mt-6 text-title-01-normal-semibold text-body-strong">
        {displayName}님이 상담에 참석했나요?
      </p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        {#each ATTENDANCE_CHOICES as choice (choice.value)}
          <button
            type="button"
            onclick={() => handleAttendanceChange(choice.value)}
            class="flex h-12 w-[222px] items-center justify-center gap-2 rounded-lg bg-bg-base px-5 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            <svg
              class="h-5 w-5 shrink-0 {choice.tone}"
              viewBox="0 0 20 20"
              fill="none"
            >
              <circle cx="10" cy="10" r="7" fill="currentColor" />
              {#if choice.value === 'attended'}
                <path
                  d="M6.8 10.2 9 12.4 13.2 7.8"
                  stroke="white"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              {:else if choice.value === 'absent'}
                <path
                  d="M7.6 7.6 12.4 12.4M12.4 7.6 7.6 12.4"
                  stroke="white"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              {:else}
                <path
                  d="M10 6.4V10.9"
                  stroke="white"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <circle cx="10" cy="13.4" r="0.9" fill="white" />
              {/if}
            </svg>
            {choice.label}
          </button>
        {/each}
      </div>
    </div>
  {:else if selectedOut}
    {@const isNoShow = attendanceStatus === 'no_show'}
    <!-- 진행되지 않은 회기 — 시작 전·미확인 안내와 같은 빈 상태 규격(아이콘 → 타이틀 24 → 서브 12).
         노쇼만 사유를 남긴다(취소는 사전 통보라 사유를 받지 않는다). -->
    <div
      class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-30"
      in:fade={{ duration: 180 }}
    >
      <CancelledScheduleIcon54 />
      <p class="mt-6 text-title-01-normal-semibold text-body-strong">
        {displayName}님이 {isNoShow ? '노쇼한' : '취소한'} 회기예요
      </p>
      <!-- 타이틀↔서브내용 12 -->
      <p class="mt-3 text-center text-body-02-normal-regular text-body-subtle">
        상담일지는 완료된 회기에만 작성할 수 있어요.{isNoShow
          ? ' 청구는 센터 정책에 따라 진행할 수 있어요.'
          : ''}
      </p>

      {#if isNoShow}
        <!-- 사유 = 구분되는 블록이라 위와 24. 안쪽 radius는 한 단 아래(12) -->
        <div class="mt-6 w-full max-w-[440px] rounded-xl bg-bg-base p-4">
          <div class="flex items-center justify-between gap-2">
            <span class="text-body-03-normal-medium text-gray-500">
              노쇼 사유
            </span>
            {#if selectedClient.is_consumed}
              <span
                class="shrink-0 rounded-full bg-status-warning-bg px-2 py-1 text-label-01-normal-medium text-status-warning"
              >
                회기 차감
              </span>
            {/if}
          </div>
          <!-- 레이블↔값 8 -->
          <p
            class="mt-2 whitespace-pre-line text-body-02-normal-regular {selectedClient.memo
              ? 'text-gray-900'
              : 'text-gray-400'}"
          >
            {selectedClient.memo || '기록된 사유가 없어요'}
          </p>
        </div>

        {#if attendanceEditable}
          <button
            type="button"
            class="mt-3 h-10 rounded-lg border border-gray-200 bg-white px-4 text-body-02-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
            onclick={() => onEditNoShow?.(selectedClient)}
          >
            사유 수정
          </button>
        {/if}
      {/if}
    </div>
  {:else}
    <!-- 노트 일지 (괘선 한 장 + auto-grow + fade 스크롤).
         {#key loadedKey}로 감싸 폼 값이 새 내담자 내용으로 set된 "뒤"에 재마운트한다.
         (selectedClientId로 감싸면 폼 값 갱신 전에 재마운트돼 이전 높이가 남음)
         → textarea가 새 내용으로 마운트되며 auto-grow 높이·ScrollFadeArea·스크롤이
           새 내용 기준으로 초기화됨. -->
    {#key loadedKey}
      <ScrollFadeArea deps={growTick} fadeColor="white" bounceArrow>
        <div in:fade={{ duration: 180 }} class="flex min-h-full flex-col">
          <!-- 이 회기 녹음 — 일지의 재료라 문서 맨 위에 둔다(고정 층이 아니라 함께 스크롤).
             괘선 그리드(36px)가 어긋나지 않도록 journal-paper '밖'의 형제로 놓는다.
             형태는 카드 하나 — 일지 작성 여부로 접지 않는다. -->
          {#if onOpenFieldNote && fieldNoteStatus !== 'none'}
            {@const isReady = fieldNoteStatus === 'completed'}
            <!-- 카드 한 형태만 쓴다 — 일지에 내용이 있다고 접지 않는다(작성 중에도
                 초안 생성은 그대로 쓰는 재료다). 노쇼 사유 카드와 동일 규격
                 (bg-bg-base · rounded-xl · p-4).
                 좌: 파일명·길이 / 우: 액션 — 파일명과 같은 선상 우측 끝.
                 카드 전체가 '열기'다 — 옛 '자세히' 버튼을 배경 클릭이 대신한다.
                 안쪽 버튼(초안 생성 등)은 자기 동작만 하도록 전파를 끊는다. -->
            <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
            <div
              role="button"
              tabindex="0"
              aria-label="{fieldNoteName} 열기"
              onclick={() => onOpenFieldNote?.()}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenFieldNote?.()
                }
              }}
              class="fieldnote-entry mx-6 mb-4 mt-6 cursor-pointer rounded-xl bg-bg-base p-4 outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary-200"
            >
              <div
                class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
              >
                <!-- 아이콘은 파일명+시간 두 줄 전체 기준 세로 가운데. 아이콘↔텍스트 12 -->
                <div class="flex min-w-0 items-center gap-3">
                  <span class="shrink-0">
                    <FieldnoteIcon24 />
                  </span>
                  <div class="flex min-w-0 flex-col">
                    <span
                      class="truncate-safe text-body-01-normal-medium text-gray-700"
                    >
                      {fieldNoteName}
                    </span>
                    <!-- 파일명↔부가정보 8 -->
                    {#if isReady}
                      {#if fieldNoteDurationLabel}
                        <!-- 러닝타임 — 아이콘이 시각이 아니라 '길이'임을 알린다 -->
                        <span
                          class="mt-2 flex items-center gap-1 text-body-03-normal-regular text-body-subtle"
                        >
                          <TimerIcon16 />
                          {fieldNoteDurationLabel}
                        </span>
                      {/if}
                    {:else}
                      <span
                        class="mt-2 text-body-03-normal-regular text-body-subtle"
                      >
                        {fieldNoteStatus === 'processing'
                          ? '정리하는 중 — 먼저 일지를 작성하셔도 돼요'
                          : '정리하지 못했어요'}
                      </span>
                    {/if}
                  </div>
                </div>
                <!-- 액션 — 파일명과 같은 선상 우측 끝 -->
                <div class="flex shrink-0 items-center gap-2">
                  {#if isReady}
                    <!-- 그 자리에서 돌고 칸을 채운다. 생성은 워커라 수십 초가 걸려
                         버튼이 진행 상태를 그대로 진다(핸들러가 없으면 옛 경로로 시트를 연다) -->
                    <button
                      type="button"
                      disabled={isGeneratingDraft}
                      class="bg-ai-gradient-subtle flex h-10 items-center gap-2 rounded-lg px-4 text-body-02-normal-medium text-ai-500 transition-colors hover:text-ai-600 disabled:cursor-not-allowed disabled:opacity-60"
                      onclick={(e) => {
                        e.stopPropagation()
                        handleGenerateDraft()
                      }}
                    >
                      {#if isGeneratingDraft}
                        <span
                          class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ai-500 border-t-transparent"
                        ></span>
                        전사 분석 중…
                      {:else}
                        <AiStarIcon20 />
                        일지 초안 생성
                      {/if}
                    </button>
                  {/if}
                  {#if aiDraftCount > 0}
                    <button
                      type="button"
                      class="h-10 rounded-lg px-3 text-body-02-normal-medium text-body-subtle transition-colors hover:text-gray-700"
                      onclick={(e) => {
                        e.stopPropagation()
                        openAiDraftHistory()
                      }}
                    >
                      초안 {aiDraftCount}건 보기
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
          <!-- 내담자 전환 시 노트 내용이 부드럽게 나타남 -->
          <div class="journal-paper flex-1 pb-9">
            <div class="mx-6">
              <div
                class="flex h-9 items-center text-[16px] font-medium text-gray-600"
              >
                상담 목표
              </div>
              <!-- svelte-ignore element_invalid_self_closing_tag -->
              <textarea
                bind:value={goal}
                maxlength={3000}
                placeholder="상담 목표를 작성해주세요"
                use:autoGrow
                class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
              ></textarea>
            </div>

            <div class="mx-6 mt-9">
              <div
                class="flex h-9 items-center text-[16px] font-medium text-gray-600"
              >
                진행 내용
              </div>
              <!-- svelte-ignore element_invalid_self_closing_tag -->
              <textarea
                bind:value={progress}
                maxlength={5000}
                placeholder="진행 내용을 작성해주세요"
                use:autoGrow
                class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
              ></textarea>
            </div>

            <div class="mx-6 mt-9">
              <div
                class="flex h-9 items-center text-[16px] font-medium text-gray-600"
              >
                다음 상담 내용
              </div>
              <!-- svelte-ignore element_invalid_self_closing_tag -->
              <textarea
                bind:value={nextPlan}
                maxlength={3000}
                placeholder="다음 상담 내용을 작성해주세요"
                use:autoGrow
                class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
              ></textarea>
            </div>

            <div class="mx-6 mt-9">
              <div class="flex h-9 items-center gap-1.5">
                <LockIcon20 />
                <span class="text-[16px] font-medium text-gray-600"
                  >개인 메모</span
                >
                <span class="text-[14px] text-gray-500">
                  개인 기록용 메모로 본인만 확인가능해요
                </span>
              </div>
              <!-- svelte-ignore element_invalid_self_closing_tag -->
              <textarea
                bind:value={privateMemo}
                maxlength={3000}
                placeholder="개인 메모를 작성해주세요"
                use:autoGrow
                class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
              ></textarea>
            </div>
          </div>
        </div>
      </ScrollFadeArea>
    {/key}

    <!-- 저장 (명시 저장 버튼) + 저장 시각/피드백.
         relative z-10 = 위 스크롤 영역(ScrollFadeArea가 position:relative)이 정적 형제인
         이 바보다 위에 그려져 위쪽 그림자를 덮는 것을 막는다.
         xl:rounded-b-2xl = 패널 카드(xl:rounded-2xl)의 아래 모서리 안쪽으로 흰 면을 맞춘다
         (각진 면이면 둥근 모서리 밖으로 삐져나온다).
         저장 시각은 옛 상단바 '작성일'을 대체한다 — 저장 버튼 옆이라 무엇의 시각인지 설명이 필요 없다 -->
    <div
      class="shadow-sticky-top relative z-10 flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white px-5 py-3 xl:rounded-b-2xl"
    >
      <span
        class="min-w-0 truncate-safe text-body-03-normal-regular text-body-subtle"
      >
        {savedLabel ? `${savedLabel} 저장됨` : ''}
      </span>
      <!-- 버튼 간 8 (하단 고정 바 규격) -->
      <div class="flex shrink-0 items-center gap-2">
        <!-- 전달문 = 이 일지에서 나가는 것(내담자용 변환 · 전송). 저장(주행동) 옆 보조라
             아웃라인 위계. 재료가 없으면 만들 게 없어 비활성.
             툴팁은 상태와 무관하게 '무엇이 만들어지는지' 하나만 말한다 — 작성 전·작성 중에
             문구가 갈리면 같은 버튼이 두 기능처럼 읽힌다 -->
        <div class="relative shrink-0">
          {#if !transferTipClosed}
            <div
              class="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2"
            >
              <NoticeBubble
                text="작성된 일지를 바탕으로 내담자용 초안이 생성돼요"
                arrow="bottom"
                onClose={() => (transferTipClosed = true)}
                closeLabel="안내 닫기"
              />
            </div>
          {/if}
          <button
            type="button"
            onclick={openTransferNote}
            disabled={!hasTransferMaterial}
            class="h-11 shrink-0 rounded-lg border border-gray-200 bg-white px-4 text-body-01-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-caption-subtle disabled:hover:border-gray-200"
          >
            내담자에게 전달
          </button>
        </div>
        <!-- 저장됨 플래시: 체크가 그려지며 fade in -->
        {#if justSaved}
          <span
            in:fade={{ duration: 200 }}
            out:fade={{ duration: 400 }}
            class="flex items-center gap-1 text-[14px] font-medium text-mint-500"
          >
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path
                class="save-check"
                d="M3.5 8.5L6.5 11.5L12.5 4.5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            저장됨
          </span>
        {/if}
        <button
          type="button"
          disabled={isSaving || !isDirty}
          class="flex h-11 w-20 items-center justify-center gap-2 rounded-lg bg-primary-500 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          onclick={handleSave}
        >
          {#if isSaving}
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2.5"
                opacity="0.25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
            저장 중
          {:else}
            저장
          {/if}
        </button>
      </div>
    </div>
  {/if}
{/if}
