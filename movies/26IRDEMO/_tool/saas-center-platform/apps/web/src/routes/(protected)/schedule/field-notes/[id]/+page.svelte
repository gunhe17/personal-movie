<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getFieldNoteDetail,
    getFieldNoteList,
    deleteFieldNote
  } from '$lib/hooks/actions/field-note.action'
  import type {
    FieldNoteDetailResponse,
    NoteTemplateType
  } from '$lib/hooks/actions/field-note.action'
  import { getScheduleDetail } from '$lib/hooks/actions/schedule.action'
  import type { ScheduleDetailResponse } from '$lib/hooks/actions/schedule.action'
  import { getCounselingDetailById } from '$lib/hooks/actions/counseling.action'
  import { getCaseById } from '$lib/hooks/actions/case.action'
  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { buildFieldNoteDetail } from '$lib/features/field-note/query-builders'
  import { mapToFieldNoteVM } from '$lib/features/field-note/view-model'
  import {
    POLLING_INTERVAL_MS,
    FIELD_NOTE_STATUS_LABELS,
    NOTE_TEMPLATE_LABELS,
    NOTE_TEMPLATE_SELECT_OPTIONS
  } from '$lib/features/field-note/constants'
  import Select from '$lib/components/Select.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import { createFieldNoteService } from '$lib/features/field-note/field-note-service'
  import { getMemberList } from '$lib/hooks/actions/member.action'

  import FieldNoteProcessing from '$lib/components/counseling/field-note/FieldNoteProcessing.svelte'
  import FieldNoteCompleted from '$lib/components/counseling/field-note/FieldNoteCompleted.svelte'
  import FieldNoteFailedCard from '$lib/components/counseling/field-note/FieldNoteFailedCard.svelte'
  import LinkCaseSessionModal from '$lib/components/counseling/field-note/LinkCaseSessionModal.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'

  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import FieldNoteSidebarList from '$lib/features/schedule/field-notes/components/FieldNoteSidebarList.svelte'
  import { mapToFieldNoteListVM } from '$lib/features/schedule/field-notes/view-model'
  import { formatUtcToKst } from '$lib/utils/date'
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

  const queryClient = useQueryClient()
  const fieldNoteId = $derived($page.params.id ?? null)

  const service = createFieldNoteService({
    queryClient,
    getCenterId: () => $centerId
  })

  // 크레딧 잔량 쿼리 (유료 AI 기능 게이팅용)
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
  const hasAIFieldNote = $derived(hasFeature(subVM, 'ai_field_note'))
  // 기능별 크레딧 부족 세분화
  const isCreditExhaustedForSummary = $derived(
    !hasAIFieldNote || !canAfford(creditVM, AI_PURPOSE.FIELD_NOTE_SUMMARIZE)
  )
  const isCreditExhaustedForNote = $derived(
    !hasAIFieldNote || !canAfford(creditVM, AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE)
  )
  // 전체 차단 배너는 양쪽 모두 부족할 때만 표시
  const isCreditExhausted = $derived(
    isCreditExhaustedForSummary && isCreditExhaustedForNote
  )

  // 폴링 플래그
  let shouldPoll = $state(false)

  const query = queryBuilder(
    getFieldNoteDetail,
    () => buildFieldNoteDetail($centerId, fieldNoteId),
    () => ({
      enabled: !!$centerId && !!fieldNoteId,
      refetchInterval: shouldPoll ? POLLING_INTERVAL_MS : false,
      throwOnError: false,
      retry: false
    })
  )

  const fieldNote = $derived(query.data as FieldNoteDetailResponse | null)
  const isLoading = $derived(query.isLoading)
  const vm = $derived(fieldNote ? mapToFieldNoteVM(fieldNote) : null)

  // 사이드바 목록 조회 (최대 100개 정도만 로드)
  const sidebarListQuery = $derived(
    queryBuilder(
      getFieldNoteList,
      () => ({ centerId: $centerId!, page: 1, size: 100 }),
      () => ({ enabled: !!$centerId })
    )
  )
  const sidebarItems = $derived(
    (sidebarListQuery.data?.items ?? []).map(mapToFieldNoteListVM)
  )

  // 멤버 목록 (작성자 이름 표시용)
  const memberQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }))
  )
  const memberMap = $derived.by(() => {
    const map = new Map<string, string>()
    for (const m of memberQuery.data?.items ?? []) {
      map.set(m.id, m.person.name)
    }
    return map
  })
  function getAuthorName(authorId: string): string {
    return memberMap.get(authorId) ?? '알 수 없음'
  }

  // 사이드바 검색어
  let searchQuery = $state('')

  // 상담일지 생성 완료 시 해당 케이스로 이동할 수 있도록 caseId 저장
  let generatedCaseId = $state<string | null>(null)
  let prevNoteStatus = $state<string | undefined>(undefined)

  $effect(() => {
    const currentNoteStatus = fieldNote?.note_status
    if (prevNoteStatus === 'processing' && currentNoteStatus === 'completed') {
      service.invalidateSessionNotes()
    }
    prevNoteStatus = currentNoteStatus
  })

  $effect(() => {
    shouldPoll =
      fieldNote?.processing_status === 'processing' ||
      fieldNote?.summary_status === 'generating' ||
      fieldNote?.note_status === 'processing'
  })

  // 노트 서식 선택
  let selectedTemplateType = $state<NoteTemplateType>('default')

  $effect(() => {
    if (fieldNote?.note_template_type) {
      selectedTemplateType = fieldNote.note_template_type
    }
  })

  // 일정 연결 여부
  const isLinked = $derived(!!fieldNote?.schedule_id)
  const isRecording = $derived(
    fieldNote?.status === 'recording' || fieldNote?.status === 'paused'
  )

  // 연결된 스케줄 → 세션 정보 조회
  const scheduleQuery = $derived(
    queryBuilder(
      getScheduleDetail,
      () => ({
        center_id: $centerId!,
        schedule_id: fieldNote?.schedule_id ?? ''
      }),
      () => ({
        enabled: !!$centerId && !!fieldNote?.schedule_id
      })
    )
  )
  const scheduleDetail = $derived(
    scheduleQuery.data as ScheduleDetailResponse | null
  )

  // 연결된 세션 정보 파생
  const linkedSession = $derived.by(() => {
    if (!scheduleDetail?.sessions?.length) return null
    const session = scheduleDetail.sessions[0]
    return {
      sessionId: session.session_id,
      caseId: session.case_id,
      caseCode: session.case_code,
      caseType: session.case_type,
      sessionNumber: session.session_number,
      counselorName: session.counselor_name,
      clientNames: session.clients.map((c) => c.client_name),
      scheduleType: scheduleDetail.schedule_type
    }
  })

  // 화자 자동 매핑 후보 + 역할 판별용 (상담사 먼저, 이어서 내담자들)
  const participantCandidates = $derived(
    linkedSession
      ? [linkedSession.counselorName, ...linkedSession.clientNames].filter(
          (n): n is string => !!n
        )
      : []
  )

  // 케이스 상세 (회기 정보 카드용) — scheduleType 에 따라 분기 조회
  const counselingCaseQuery = $derived(
    queryBuilder(
      getCounselingDetailById,
      () => ({
        centerId: $centerId!,
        counselingId: linkedSession?.caseId ?? ''
      }),
      () => ({
        enabled:
          !!$centerId &&
          !!linkedSession?.caseId &&
          linkedSession?.scheduleType === 'counseling'
      })
    )
  )

  const assessmentCaseQuery = $derived(
    queryBuilder(
      getCaseById,
      () => ({
        centerId: $centerId!,
        caseId: linkedSession?.caseId ?? ''
      }),
      () => ({
        enabled:
          !!$centerId &&
          !!linkedSession?.caseId &&
          linkedSession?.scheduleType === 'assessment'
      })
    )
  )

  interface SessionCardClient {
    name: string
    code: string | null
    birthDate: string | null
    gender: string | null
  }

  const sessionCard = $derived.by(() => {
    if (!linkedSession || !scheduleDetail) return null

    let clients: SessionCardClient[] = []
    let programName: string | null = null

    if (linkedSession.scheduleType === 'counseling') {
      const data = counselingCaseQuery.data
      if (!data) return null
      programName = data.program_name ?? null
      clients = (data.clients ?? []).map((c) => ({
        name: c.name,
        code: c.client_code ?? null,
        birthDate: c.birth_date ?? null,
        gender: c.gender ?? null
      }))
    } else if (linkedSession.scheduleType === 'assessment') {
      const data = assessmentCaseQuery.data?.data
      if (!data) return null
      const assessmentNames = (data.tasks ?? [])
        .map((t) => t.assessment_name)
        .filter(Boolean)
      programName =
        data.set_name ??
        (assessmentNames.length > 0 ? assessmentNames.join(', ') : null)
      clients = (data.clients ?? []).map((c: any) => ({
        name: c.name,
        code: c.client_code ?? null,
        birthDate: c.birth_date ?? null,
        gender: c.gender ?? null
      }))
    }

    const start = scheduleDetail.start ? new Date(scheduleDetail.start) : null
    const end = scheduleDetail.end ? new Date(scheduleDetail.end) : null

    return {
      caseId: linkedSession.caseId,
      caseType: linkedSession.caseType,
      scheduleType: linkedSession.scheduleType,
      sessionId: linkedSession.sessionId,
      programName,
      clients,
      start,
      end
    }
  })

  function formatScheduleRange(start: Date | null, end: Date | null): string {
    if (!start) return ''
    const startLabel = formatUtcToKst(start, 'YYYY-MM-DD (d) HH:mm')
    if (!end) return startLabel
    const endLabel = formatUtcToKst(end, 'HH:mm')
    return `${startLabel} - ${endLabel}`
  }

  function handleOpenCaseDetail() {
    if (!sessionCard) return
    const basePath =
      sessionCard.scheduleType === 'assessment'
        ? `/assessment/status/${sessionCard.caseId}`
        : `/counseling/status/${sessionCard.caseId}`
    const sessionParam = sessionCard.sessionId
      ? `?session=${sessionCard.sessionId}`
      : ''
    goto(`${basePath}${sessionParam}`)
  }

  // 상태 뱃지 스타일
  const statusBadgeClass = $derived.by(() => {
    if (!vm) return ''
    switch (vm.processingStatus) {
      case 'processing':
        return 'bg-blue-50 text-blue-600'
      case 'completed':
        return 'bg-green-50 text-green-700'
      case 'failed':
        return 'bg-status-danger-bg text-red-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  })

  const statusDotClass = $derived.by(() => {
    if (!vm) return ''
    switch (vm.processingStatus) {
      case 'processing':
        return 'bg-blue-500 animate-pulse'
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  })

  // 우측 헤더 타이틀: 연결된 경우 케이스 코드, 아니면 작성자 + 날짜
  const headerTitle = $derived.by(() => {
    if (linkedSession?.caseCode) return linkedSession.caseCode
    if (fieldNote) {
      const author = memberMap.get(fieldNote.author_id)
      if (author) {
        const d = new Date(fieldNote.created_at)
        const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
        return `${author}_${datePart}_필드노트`
      }
    }
    return '필드노트 상세'
  })

  // 핸들러
  async function handleGenerateNote() {
    if (!fieldNote) return
    const caseId = await service.generateCounselingNote(
      fieldNote.id,
      selectedTemplateType
    )
    if (caseId) generatedCaseId = caseId
    shouldPoll = true
  }

  async function handleRegenerateSummary() {
    if (!fieldNote) return
    await service.regenerateSummary(fieldNote.id)
  }

  function handleSaveSpeakerMap(map: Record<string, string>) {
    if (!fieldNote) return
    void service.updateSpeakerMap(fieldNote.id, map)
  }

  async function handleRetry() {
    if (!fieldNote) return
    await service.retryPipeline(fieldNote.id)
  }

  async function handleRunPipeline() {
    if (!fieldNote) return
    await service.runPipeline(fieldNote.id)
  }

  function handleExportTranscript(format: 'text' | 'json') {
    if (!fieldNote) return
    void service.exportTranscript(fieldNote.id, format)
  }

  function handleTemplateTypeChange(type: NoteTemplateType) {
    selectedTemplateType = type
  }

  function handleBack() {
    goto('/schedule/field-notes')
  }

  async function handleDelete() {
    if (!fieldNote) return
    if (!confirm('이 필드노트를 삭제하시겠습니까?')) return
    try {
      await deleteFieldNote().request({
        centerId: requireCenterId(),
        fieldNoteId: fieldNote.id
      })
      snackbarStore.success('삭제되었습니다.')
      queryClient.invalidateQueries({
        queryKey: ['getFieldNoteList'],
        exact: false
      })
      goto('/schedule/field-notes')
    } catch {
      snackbarStore.error('삭제에 실패했습니다.')
    }
  }

  function handleLinkSchedule() {
    if (!fieldNote) return
    modalStore.open({
      component: LinkCaseSessionModal,
      props: {
        onConfirm: async (scheduleId: string) => {
          await service.linkToSchedule(fieldNote.id, scheduleId)
        }
      },
      options: { customWidth: 540, customHeight: 650 }
    })
  }

  function handleSelectSidebarItem(id: string) {
    if (id === fieldNoteId) return
    goto(`/schedule/field-notes/${id}`)
  }

  // ⋮ 더보기 메뉴
  let isMoreMenuOpen = $state(false)
  let moreMenuRef = $state<HTMLDivElement | null>(null)

  function toggleMoreMenu(e: MouseEvent) {
    e.stopPropagation()
    isMoreMenuOpen = !isMoreMenuOpen
  }

  function handleDocClick(e: MouseEvent) {
    if (!isMoreMenuOpen) return
    if (moreMenuRef && !moreMenuRef.contains(e.target as Node)) {
      isMoreMenuOpen = false
    }
  }
</script>

<svelte:window onclick={handleDocClick} />

<div in:fade class="flex flex-col h-full xl:overflow-hidden bg-gray-50">
  <PageTitleSection title="필드노트" className="mb-4" />

  <div class="flex flex-1 min-h-0 gap-4">
    <!-- 좌측: 사이드바 (xl 이상에서만 표시) -->
    <div
      class="hidden xl:flex shrink-0 w-[316px] rounded-2xl border border-gray-200 bg-white overflow-hidden"
    >
      <FieldNoteSidebarList
        items={sidebarItems}
        selectedId={fieldNoteId}
        isLoading={sidebarListQuery.isLoading}
        {getAuthorName}
        onSelect={handleSelectSidebarItem}
        {searchQuery}
        onSearchChange={(q) => (searchQuery = q)}
      />
    </div>

    <!-- 우측: 필드노트 상세 -->
    <div
      class="flex flex-1 min-h-0 flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden"
    >
      <!-- 헤더 -->
      <div
        class="flex shrink-0 items-center gap-3 border-b border-gray-200 px-6 h-16"
      >
        <button
          type="button"
          onclick={handleBack}
          aria-label="목록으로"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div class="flex items-center gap-2.5 min-w-0">
          <Typography
            variant="title-01-semibold"
            color="text-gray-900"
            className="truncate-safe"
          >
            {headerTitle}
          </Typography>
          {#if vm}
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap {statusBadgeClass}"
            >
              <span class="h-1.5 w-1.5 rounded-full {statusDotClass}"></span>
              {vm.processingStatusLabel}
            </span>
          {/if}
        </div>
        <div class="flex-1"></div>
        {#if fieldNote}
          {#if !isLinked}
            <button
              type="button"
              onclick={handleLinkSchedule}
              class="inline-flex h-8 items-center rounded-lg border border-primary-400 bg-white px-3 text-body-03-normal-medium text-primary-400 hover:bg-primary-50/50 transition-colors"
            >
              회기 연결
            </button>
          {/if}
          <div bind:this={moreMenuRef} class="relative">
            <Tooltip text="더보기">
              <button
                type="button"
                onclick={toggleMoreMenu}
                aria-label="더보기"
                aria-expanded={isMoreMenuOpen}
                class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="4.5" r="1.3" fill="currentColor" />
                  <circle cx="10" cy="10" r="1.3" fill="currentColor" />
                  <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
                </svg>
              </button>
            </Tooltip>
            {#if isMoreMenuOpen}
              <div
                class="dropdown-panel absolute top-full right-0 z-20 mt-1 w-64"
              >
                {#if vm && isLinked}
                  <div class="mb-3">
                    <div class="mb-2 flex items-center justify-between">
                      <Typography
                        variant="body-03-normal-medium"
                        color="text-gray-700"
                      >
                        노트 템플릿
                      </Typography>
                      <span class="text-body-03-normal-regular text-gray-400">
                        {NOTE_TEMPLATE_LABELS[selectedTemplateType]}
                      </span>
                    </div>
                    <Select
                      options={NOTE_TEMPLATE_SELECT_OPTIONS}
                      selected={selectedTemplateType}
                      class="w-full"
                      btnClass="py-1.5"
                      on:change={(e) => {
                        const opt = e.detail as SelectOptionType
                        handleTemplateTypeChange(
                          String(opt.value) as NoteTemplateType
                        )
                      }}
                    />
                  </div>
                  <div class="dropdown-divider"></div>
                {/if}
                <button
                  type="button"
                  onclick={() => {
                    isMoreMenuOpen = false
                    handleDelete()
                  }}
                  class="dropdown-item is-danger justify-start gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 4h12M5.3 4V2.7a1.3 1.3 0 0 1 1.4-1.4h2.6a1.3 1.3 0 0 1 1.4 1.4V4m2 0v9.3a1.3 1.3 0 0 1-1.4 1.4H4.7a1.3 1.3 0 0 1-1.4-1.4V4"
                      stroke="currentColor"
                      stroke-width="1.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  삭제
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if isLoading && !fieldNote}
        <div class="flex flex-1 items-center justify-center py-16">
          <div class="flex flex-col items-center gap-3">
            <span
              class="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-primary-500"
            ></span>
            <Typography variant="body-02-normal-regular" color="text-gray-500">
              불러오는 중...
            </Typography>
          </div>
        </div>
      {:else if !fieldNote}
        <div
          class="flex flex-1 flex-col items-center justify-center py-16 gap-4"
        >
          <div
            class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              class="text-gray-400"
            >
              <path
                d="M12 8v5m0 3h.01"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </div>
          <div class="text-center space-y-1">
            <Typography variant="body-02-normal-medium" color="text-gray-700">
              필드노트를 찾을 수 없습니다
            </Typography>
            <button
              type="button"
              onclick={handleBack}
              class="text-sm text-primary-500 hover:text-primary-600 hover:underline transition-colors"
            >
              목록으로 돌아가기
            </button>
          </div>
        </div>
      {:else if vm}
        <!-- 미연결 안내 배너 -->
        {#if !isLinked && !isRecording}
          <div
            class="mx-4 xl:mx-6 mt-4 flex shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 border border-gray-200"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              class="text-gray-400 shrink-0"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                stroke-width="1.2"
              />
              <path
                d="M8 5v3.5m0 2h.01"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              />
            </svg>
            <span class="flex-1 text-xs text-gray-500"
              >회기에 연결되지 않은 필드노트에요</span
            >
          </div>
        {/if}

        <!-- 회기 정보 카드 -->
        {#if isLinked && sessionCard && sessionCard.clients.length > 0}
          {@const primary = sessionCard.clients[0]}
          {@const programLabel =
            sessionCard.scheduleType === 'assessment' ? '검사' : '프로그램'}
          <div
            class="mx-4 xl:mx-6 mt-4 h-[110px] shrink-0 rounded-lg bg-gray-50 px-5"
          >
            <div class="flex h-full items-center gap-4">
              <div class="flex-1 min-w-0 flex flex-col">
                <!-- 1행: 내담자 정보 -->
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Typography
                    variant="title-01-normal-semibold"
                    color="text-gray-900"
                  >
                    {primary.name}
                  </Typography>
                  {#if primary.code}
                    <BadgeRectangle label={primary.code} size="sm" />
                  {/if}
                  <ClientBirthGender
                    birthDate={primary.birthDate}
                    gender={primary.gender}
                  />
                  {#if sessionCard.clients.length > 1}
                    <span class="text-xs text-gray-400">
                      외 {sessionCard.clients.length - 1}명
                    </span>
                  {/if}
                </div>
                <!-- 2행: 프로그램 / 검사 -->
                {#if sessionCard.programName}
                  <div class="flex items-center gap-6 mt-3">
                    <Typography
                      variant="title-02-regular"
                      color="text-gray-600"
                      className="w-14 shrink-0"
                    >
                      {programLabel}
                    </Typography>
                    <Typography
                      variant="body-01-normal-regular"
                      color="text-gray-800"
                    >
                      {sessionCard.programName}
                    </Typography>
                  </div>
                {/if}
                <!-- 3행: 일정 -->
                {#if sessionCard.start}
                  <div class="flex items-center gap-6 mt-2">
                    <Typography
                      variant="title-02-regular"
                      color="text-gray-600"
                      className="w-14 shrink-0"
                    >
                      일정
                    </Typography>
                    <Typography
                      variant="body-01-normal-regular"
                      color="text-gray-800"
                    >
                      {formatScheduleRange(sessionCard.start, sessionCard.end)}
                    </Typography>
                  </div>
                {/if}
              </div>
              <button
                type="button"
                onclick={handleOpenCaseDetail}
                class="shrink-0 self-center inline-flex h-10 w-[90px] items-center justify-center rounded-lg border border-gray-200 bg-transparent text-body-01-normal-medium text-gray-700 hover:border-gray-300 transition-colors"
              >
                회기 상세
              </button>
            </div>
          </div>
        {/if}

        <!-- 본문 -->
        {#if isRecording}
          <div
            class="flex flex-1 flex-col items-center justify-center py-16 gap-5"
          >
            <div class="relative flex h-20 w-20 items-center justify-center">
              <span
                class="absolute inset-0 rounded-full {fieldNote.status ===
                'recording'
                  ? 'bg-red-100 animate-ping opacity-40'
                  : 'bg-yellow-100'}"
              ></span>
              <div
                class="relative flex h-16 w-16 items-center justify-center rounded-full {fieldNote.status ===
                'recording'
                  ? 'bg-red-100'
                  : 'bg-yellow-100'}"
              >
                {#if fieldNote.status === 'recording'}
                  <span class="h-5 w-5 rounded-full bg-red-500 animate-pulse"
                  ></span>
                {:else}
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    class="text-yellow-600"
                  >
                    <rect
                      x="6"
                      y="5"
                      width="4"
                      height="14"
                      rx="1"
                      fill="currentColor"
                    />
                    <rect
                      x="14"
                      y="5"
                      width="4"
                      height="14"
                      rx="1"
                      fill="currentColor"
                    />
                  </svg>
                {/if}
              </div>
            </div>
            <div class="text-center space-y-2">
              <Typography variant="title-02-semibold" color="text-gray-800">
                {FIELD_NOTE_STATUS_LABELS[fieldNote.status]}
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
              >
                모바일 앱에서 녹음이 진행 중이에요.<br />녹음이 완료되면 여기서
                확인할 수 있어요.
              </Typography>
            </div>
          </div>
        {:else if vm.status === 'processing'}
          <div class="flex-1 min-h-0 overflow-y-auto p-6">
            <FieldNoteProcessing steps={vm.pipelineSteps} />
          </div>
        {:else if vm.status === 'failed'}
          <div class="flex-1 min-h-0 overflow-y-auto p-6">
            <FieldNoteFailedCard
              failedStep={vm.failedStep}
              onRetry={handleRetry}
            />
          </div>
        {:else}
          <FieldNoteCompleted
            {vm}
            centerId={$centerId}
            {participantCandidates}
            counselorName={linkedSession?.counselorName ?? null}
            noteStatus={fieldNote.note_status}
            canGenerateNote={(vm.isCompleted || vm.hasSummary) && isLinked}
            {isCreditExhausted}
            isSummaryCreditExhausted={isCreditExhaustedForSummary}
            isNoteCreditExhausted={isCreditExhaustedForNote}
            {selectedTemplateType}
            counselingCaseId={generatedCaseId}
            linkedCaseId={linkedSession?.caseId ?? null}
            linkedCaseType={linkedSession?.scheduleType ?? null}
            linkedSessionId={linkedSession?.sessionId ?? null}
            onGenerateNote={handleGenerateNote}
            onRegenerateSummary={handleRegenerateSummary}
            onRunPipeline={handleRunPipeline}
            onSaveSpeakerMap={handleSaveSpeakerMap}
            onExportTranscript={handleExportTranscript}
            onTemplateTypeChange={handleTemplateTypeChange}
          />
        {/if}
      {/if}
    </div>
  </div>
</div>
