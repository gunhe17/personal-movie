<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getFieldNoteBySchedule } from '$lib/hooks/actions/field-note.action'
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
  import type { FieldNoteDetailResponse } from '$lib/hooks/actions/field-note.action'
  import { untrack } from 'svelte'
  import { centerId } from '$lib/stores/center.store'
  import { modalStore } from '$lib/stores/modal'
  import { buildFieldNoteBySchedule } from '$lib/features/field-note/query-builders'
  import { mapToFieldNoteVM } from '$lib/features/field-note/view-model'
  import { FIELD_NOTE_MODAL_SIZES } from '$lib/features/field-note/constants'
  import { POLLING_INTERVAL_MS } from '$lib/features/field-note/constants'
  import type { FieldNoteService } from '$lib/features/field-note/field-note-service'

  import CloseIcon32 from '$lib/assets/CloseIcon32.svelte'
  import FieldNoteEmpty from './FieldNoteEmpty.svelte'
  import FieldNoteProcessing from './FieldNoteProcessing.svelte'
  import FieldNoteCompleted from './FieldNoteCompleted.svelte'
  import FieldNoteFailedCard from './FieldNoteFailedCard.svelte'
  import LinkUnlinkedFieldNoteModal from './LinkUnlinkedFieldNoteModal.svelte'

  interface Props {
    scheduleId: string
    service: FieldNoteService
    onBack?: () => void
    /**
     * 이 일정/세션에 속한 참가자 이름 후보(화자 자동 매핑 제안용).
     * 일반적으로 [상담사 이름들..., 내담자 이름들...] 순으로 전달.
     * 화자 편집 모드에서 아직 매핑되지 않은 speaker id 에 순서대로 프리필된다.
     */
    participantCandidates?: string[]
    /** 열릴 때 선택되어 있을 탭 — 일지 문서 상단에서 '초안 생성'으로 열면 analysis */
    initialTab?: 'transcript' | 'memo' | 'analysis'
  }

  let {
    scheduleId,
    service,
    onBack,
    participantCandidates = [],
    initialTab = 'transcript'
  }: Props = $props()

  // ── 탭 (전체 대화 / 메모 / AI 분석) ──
  // 시트는 열 때마다 재마운트되므로 initialTab은 초기값으로만 읽는다(이후엔 사용자 선택이 이긴다)
  type FieldNoteTab = 'transcript' | 'memo' | 'analysis'
  let activeTab = $state<FieldNoteTab>(untrack(() => initialTab))
  const TABS: { key: FieldNoteTab; label: string }[] = [
    { key: 'transcript', label: '전체 대화' },
    { key: 'memo', label: '메모' },
    { key: 'analysis', label: 'AI 분석' }
  ]

  // 활성 탭 언더라인 슬라이드: 각 탭 버튼의 위치/폭을 측정해 단일 언더라인을 이동
  let tabEls = $state<(HTMLButtonElement | null)[]>([])
  let underline = $state({ left: 0, width: 0 })
  $effect(() => {
    const idx = TABS.findIndex((t) => t.key === activeTab)
    const el = tabEls[idx]
    if (el) underline = { left: el.offsetLeft, width: el.offsetWidth }
  })

  // 진행 중일 때만 폴링하기 위한 플래그.
  // queryOptions 안에서 query 자신을 참조하면 TDZ 에러가 나므로,
  // $effect로 data를 관측해 별도 $state에 복사한 뒤 refetchInterval에 사용한다.
  // 폴링 조건: 전체 파이프라인 처리 중 | 요약 재생성 중
  let shouldPoll = $state(false)

  // by-schedule 쿼리 — 진행 중이면 폴링
  const query = queryBuilder(
    getFieldNoteBySchedule,
    () => buildFieldNoteBySchedule($centerId, scheduleId),
    () => ({
      enabled: !!$centerId && !!scheduleId,
      refetchInterval: shouldPoll ? POLLING_INTERVAL_MS : false,
      // 필드노트 미존재(404)를 null로 받아 이미 action 레이어에서 처리했지만,
      // 기타 네트워크 에러가 세션 상세 전체를 깨지 않도록 차단
      throwOnError: false,
      retry: false
    })
  )

  const fieldNote = $derived(query.data as FieldNoteDetailResponse | null)
  const isLoading = $derived(query.isLoading)
  const vm = $derived(fieldNote ? mapToFieldNoteVM(fieldNote) : null)

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
  const hasAIFieldNote = $derived(hasFeature(subVM, 'ai_field_note'))

  // 기능별 크레딧 부족 여부 (Backend estimated_credits 기반)
  // summarize와 generate_note는 비용이 다르므로 각각 독립 체크
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

  function handleLinkExisting() {
    modalStore.open({
      component: LinkUnlinkedFieldNoteModal,
      props: {
        onConfirm: async (fieldNoteId: string) => {
          await service.linkToSchedule(fieldNoteId, scheduleId)
        }
      },
      options: FIELD_NOTE_MODAL_SIZES.linkUnlinked
    })
  }

  // 탭을 보여줄 수 있는 상태(완료·전사 존재)인지
  const showTabs = $derived(
    !!vm && vm.status !== 'processing' && vm.status !== 'failed'
  )
</script>

<!-- 헤더 = 모달 헤더 규격(Web_Design.md §Components>modal) — 좌우 20 · 상하 16(높이 65) ·
     타이틀 Headline_02/SemiBold(20) gray-800 · 닫기 아이콘 32(gray-400) 세로 가운데 정렬.
     닫기 아이콘(32)이 타이틀보다 커서 헤더 높이를 결정하므로 고정 높이를 주지 않는다 -->
<div
  class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4"
>
  <Typography variant="headline-02-normal-semibold" color="text-gray-800">
    필드노트
  </Typography>

  <button
    type="button"
    onclick={() => onBack?.()}
    aria-label="닫기"
    class="text-gray-400 transition-colors hover:text-gray-600"
  >
    <CloseIcon32 />
  </button>
</div>

<!-- 탭 -->
{#if showTabs}
  <div class="relative flex shrink-0 items-center px-6">
    {#each TABS as tab, i (tab.key)}
      <!-- Underline 탭 규격(Web_Design.md §Components>tab) — 셀 140 · 상하 패딩 20 ·
           Body_01(16) Medium 고정. 활성/비활성은 굵기가 아니라 색으로만 가른다. -->
      <!-- Underline 탭 규격(Web_Design.md §Components>tab) — 셀 140 · 상하 패딩 20 ·
           Body_01(16) Medium 고정. 활성/비활성은 굵기가 아니라 색으로만 가른다. -->
      <button
        bind:this={tabEls[i]}
        type="button"
        onclick={() => (activeTab = tab.key)}
        class="flex w-35 shrink-0 items-center justify-center py-5 transition-colors {activeTab ===
        tab.key
          ? 'text-primary-500'
          : 'text-gray-400 hover:text-gray-600'}"
      >
        <span class="text-body-01-normal-medium whitespace-nowrap">
          {tab.label}
        </span>
      </button>
    {/each}
    <!-- 하단 구분선 — border-b는 패딩을 무시하고 폭 전체를 긋기 때문에
         좌우 24px를 맞추려면 별도 요소로 그린다 -->
    <span
      class="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gray-200"
    ></span>
    <!-- 슬라이드 언더라인 (구분선 위에 겹쳐 그림) -->
    <span
      class="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary-500 transition-all duration-300 ease-out"
      style="left: {underline.left}px; width: {underline.width}px;"
    ></span>
  </div>
{/if}

<!-- 본문 -->
{#if isLoading && !fieldNote}
  <div class="flex flex-1 items-center justify-center py-12">
    <Typography variant="body-02-normal-regular" color="text-gray-500">
      불러오는 중...
    </Typography>
  </div>
{:else if !fieldNote}
  <FieldNoteEmpty onLinkExisting={handleLinkExisting} />
{:else if vm}
  {#if vm.status === 'processing'}
    <FieldNoteProcessing steps={vm.pipelineSteps} />
  {:else if vm.status === 'failed'}
    <FieldNoteFailedCard failedStep={vm.failedStep} onRetry={handleRetry} />
  {:else}
    <FieldNoteCompleted
      {vm}
      {activeTab}
      centerId={$centerId}
      {participantCandidates}
      noteStatus={fieldNote.note_status}
      canGenerateNote={vm.isCompleted || vm.hasSummary}
      {isCreditExhausted}
      isSummaryCreditExhausted={isCreditExhaustedForSummary}
      isNoteCreditExhausted={isCreditExhaustedForNote}
      showNoteDraft={false}
      onRegenerateSummary={handleRegenerateSummary}
      onRunPipeline={handleRunPipeline}
      onSaveSpeakerMap={handleSaveSpeakerMap}
      onExportTranscript={handleExportTranscript}
    />
  {/if}
{/if}
