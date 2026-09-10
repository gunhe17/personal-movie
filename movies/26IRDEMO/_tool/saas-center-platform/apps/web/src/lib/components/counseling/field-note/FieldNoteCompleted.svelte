<style>
  /* 볼륨 슬라이더 — Figma 9444:374734. 트랙 6 · 노브 16 ·
     채움 gray-400 / 트랙 gray-100 (native input이라 토큰을 var()로 참조) */
  :global(.volume-slider) {
    -webkit-appearance: none;
    appearance: none;
    width: 82px;
    height: 6px;
    background: transparent;
    outline: none;
    cursor: pointer;
  }

  :global(.volume-slider::-webkit-slider-runnable-track) {
    height: 6px;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      var(--color-gray-400) 0%,
      var(--color-gray-400) var(--vol, 0%),
      var(--color-gray-100) var(--vol, 0%),
      var(--color-gray-100) 100%
    );
  }
  :global(.volume-slider::-moz-range-track) {
    height: 6px;
    border-radius: 9999px;
    background: var(--color-gray-100);
  }
  :global(.volume-slider::-moz-range-progress) {
    height: 6px;
    border-radius: 9999px;
    background: var(--color-gray-400);
  }

  :global(.volume-slider::-webkit-slider-thumb) {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: #ffffff;
    border: 1px solid var(--color-gray-300);
    box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.08);
    margin-top: -5px;
    cursor: pointer;
  }
  :global(.volume-slider::-moz-range-thumb) {
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: #ffffff;
    border: 1px solid var(--color-gray-300);
    box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.08);
    cursor: pointer;
  }
</style>

<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import Select from '$lib/components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import type { FieldNoteVM } from '$lib/features/field-note/view-model'
  import type { NoteTemplateType } from '$lib/hooks/actions/field-note.action'
  import { getAudioDownloadUrl } from '$lib/hooks/actions/field-note.action'
  import {
    FIELD_NOTE_MODAL_SIZES,
    NOTE_TEMPLATE_LABELS,
    NOTE_TEMPLATE_SELECT_OPTIONS,
    SPEAKER_COLORS,
    type SpeakerColor
  } from '$lib/features/field-note/constants'
  import { AI_PURPOSE, estimatedCostLabel } from '$lib/features/credit'
  import { modalStore } from '$lib/stores/modal'
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'
  import HighlightStarWhite24 from '$lib/assets/HighlightStarWhite24.svelte'
  import ListenerWithMike20 from '$lib/assets/ListenerWithMike20.svelte'
  import DownloadIcon20 from '$lib/assets/DownloadIcon20.svelte'
  import VolumnIcon24 from '$lib/assets/VolumnIcon24.svelte'
  import PlayIcon24 from '$lib/assets/PlayIcon24.svelte'
  import PlayIcon16 from '$lib/assets/PlayIcon16.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import SpeakerEditModal from './SpeakerEditModal.svelte'

  type FieldNoteTab = 'transcript' | 'memo' | 'analysis'

  interface Props {
    vm: FieldNoteVM
    /** 활성 탭 (전체 대화 / 메모 / AI 분석) */
    activeTab?: FieldNoteTab
    centerId: string | null
    /** 화자 자동 매핑 후보 — 세션 참가자(상담사 먼저, 이어서 내담자들) */
    participantCandidates?: string[]
    /** 연결된 세션의 상담사 이름 — 화자 좌/우 역할 판별용(상담사=우측) */
    counselorName?: string | null
    noteStatus: string
    canGenerateNote: boolean
    selectedTemplateType?: NoteTemplateType
    /** 상담일지가 저장된 케이스 ID (생성 완료 후 이동용) */
    counselingCaseId?: string | null
    /** 연결된 세션의 케이스 ID (counselingCaseId 폴백용) */
    linkedCaseId?: string | null
    /** 연결된 세션의 케이스 타입 (counseling | assessment) */
    linkedCaseType?: string | null
    /** 연결된 세션 ID (케이스 페이지 이동 시 자동 선택용) */
    linkedSessionId?: string | null
    /** 크레딧 소진 여부 — true이면 유료 AI 버튼 비활성화 */
    isCreditExhausted?: boolean
    /** 요약 크레딧 부족 (기본: isCreditExhausted 따라감) */
    isSummaryCreditExhausted?: boolean
    /** 일지 생성 크레딧 부족 (기본: isCreditExhausted 따라감) */
    isNoteCreditExhausted?: boolean
    /**
     * AI 분석 탭 하단의 '노트 템플릿 + 상담일지 초안 생성' 블록 노출 여부.
     * 플로팅 시트 시안(Figma 9444:379013)에는 이 블록이 없어 시트에서는 false로 끈다.
     * 필드노트 상세 페이지(/schedule/field-notes/[id])는 여기가 유일한 초안 생성
     * 진입점이므로 기본값 true를 유지한다.
     */
    showNoteDraft?: boolean
    onGenerateNote?: () => void
    onRegenerateSummary?: () => void | Promise<void>
    onRunPipeline?: () => void | Promise<void>
    onSaveSpeakerMap?: (map: Record<string, string>) => void
    onExportTranscript?: (format: 'text' | 'json') => void
    onTemplateTypeChange?: (type: NoteTemplateType) => void
  }

  let {
    vm,
    activeTab = 'transcript',
    centerId,
    participantCandidates = [],
    counselorName = null,
    noteStatus,
    canGenerateNote,
    selectedTemplateType = 'default',
    counselingCaseId = null,
    linkedCaseId = null,
    linkedCaseType = null,
    linkedSessionId = null,
    isCreditExhausted = false,
    isSummaryCreditExhausted,
    isNoteCreditExhausted,
    showNoteDraft = true,
    onGenerateNote,
    onRegenerateSummary,
    onRunPipeline,
    onSaveSpeakerMap,
    onExportTranscript,
    onTemplateTypeChange
  }: Props = $props()

  // 기능별 크레딧 부족 세분화 (props 우선, 없으면 isCreditExhausted 따라감)
  const summaryCreditBlocked = $derived(
    isSummaryCreditExhausted ?? isCreditExhausted
  )
  const noteCreditBlocked = $derived(isNoteCreditExhausted ?? isCreditExhausted)

  // 실제 콘텐츠(요약·전사)가 없을 때만 "분석 시작" 표시
  const needsAnalysis = $derived(
    (vm.processingStatus === 'idle' || vm.processingStatus === 'skipped') &&
      !vm.hasSummary &&
      vm.timeline.length === 0
  )

  // ── 로컬 pending 상태 ──
  let isRunPending = $state(false)
  let isRegeneratePending = $state(false)

  async function handleRunClick() {
    if (isRunPending) return
    isRunPending = true
    try {
      await onRunPipeline?.()
    } finally {
      isRunPending = false
    }
  }

  async function handleRegenerateClick() {
    if (isRegeneratePending || vm.isSummaryGenerating) return
    isRegeneratePending = true
    try {
      await onRegenerateSummary?.()
    } finally {
      isRegeneratePending = false
    }
  }

  const isSummaryBusy = $derived(isRegeneratePending || vm.isSummaryGenerating)

  // AI 요약 카드 타이틀 — 프레임(node 9444:378879)의 문구는 '요약이 있는 상태'의 것이라,
  // 나머지 상태에서는 같은 문형(해요체)으로 시제만 바꾼다. 요약이 없는데 "요약했어요"라고
  // 말하면 카드가 사실과 어긋난다.
  const summaryCardTitle = $derived(
    isSummaryBusy
      ? 'AI가 상담 내용을 요약하고 있어요'
      : vm.summaryBody
        ? 'AI가 상담 내용을 요약했어요'
        : vm.summaryStatus === 'failed'
          ? 'AI가 요약을 만들지 못했어요'
          : 'AI가 상담 내용을 요약해드려요'
  )

  const generateNoteLabel = $derived(
    // 레이블은 일지 문서 상단 카드의 버튼과 한 벌로 맞춘다(InlineJournalEditor)
    noteStatus === 'processing' ? '생성 중...' : '일지 초안 생성'
  )

  // ── 화자 색상/매핑 ──
  const uniqueSpeakers = $derived.by(() => {
    const set = new Set<string>()
    for (const seg of vm.segments) {
      if (seg.speaker) set.add(seg.speaker)
    }
    return [...set]
  })

  const speakerColorMap = $derived.by(() => {
    const map = new Map<string, SpeakerColor>()
    uniqueSpeakers.forEach((id, idx) => {
      map.set(id, SPEAKER_COLORS[idx % SPEAKER_COLORS.length])
    })
    return map
  })

  const effectiveSpeakerMap = $derived.by(() => {
    const map: Record<string, string> = {}
    uniqueSpeakers.forEach((id, idx) => {
      const saved = vm.speakerMap[id]
      map[id] =
        saved && saved.trim() ? saved : (participantCandidates[idx] ?? id)
    })
    return map
  })

  const hasSavedMapping = $derived(
    uniqueSpeakers.some((id) => {
      const v = vm.speakerMap[id]
      return !!(v && v.trim())
    })
  )

  // ── 전사/메모 타임라인 분리 ──
  // 전체 대화 탭: 전사 + 침묵 / 메모 탭: 메모·태그(entry)
  const transcriptTimeline = $derived(
    vm.timeline.filter(
      (it) => it.kind === 'transcript' || it.kind === 'silence'
    )
  )
  const memoTimeline = $derived(vm.timeline.filter((it) => it.kind === 'entry'))

  // ── 오디오 ↔ 전사 싱크 ──
  // 현재 재생 위치에 해당하는 transcript 줄(transcriptTimeline 기준 인덱스)
  const activeIdx = $derived.by(() => {
    if (currentTime <= 0) return -1
    let active = -1
    for (let i = 0; i < transcriptTimeline.length; i++) {
      const it = transcriptTimeline[i]
      if (it.kind !== 'transcript' || it.timestamp_seconds == null) continue
      if (it.timestamp_seconds <= currentTime + 0.25) active = i
      else break
    }
    return active
  })

  let lineEls: (HTMLElement | null)[] = $state([])
  let scrollContainer = $state<HTMLElement | null>(null)

  // 재생 중 현재 줄이 보이도록 부드럽게 스크롤
  $effect(() => {
    const idx = activeIdx
    if (idx < 0 || !isPlaying) return
    const el = lineEls[idx]
    if (el && scrollContainer) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })

  /** 전사 줄 클릭 → 해당 시점으로 이동 후 재생. 오디오 미로드 시 로드 후 적용. */
  let pendingSeek = $state<number | null>(null)
  function seekTo(sec: number | null) {
    if (sec == null) return
    if (audioEl && duration > 0) {
      applySeek(sec)
      void audioEl.play()
    } else {
      pendingSeek = sec
      if (!audioUrl && !audioLoading) void loadAudio()
    }
  }

  function handleLoadedMeta() {
    if (!audioEl) return
    duration = audioEl.duration || 0
    currentTime = audioEl.currentTime
    if (pendingSeek != null) {
      applySeek(pendingSeek)
      void audioEl.play()
      pendingSeek = null
    }
  }

  function openSpeakerEditModal() {
    modalStore.open({
      component: SpeakerEditModal,
      props: {
        speakers: uniqueSpeakers,
        initialMap: vm.speakerMap,
        participantCandidates,
        onConfirm: (map: Record<string, string>) => {
          onSaveSpeakerMap?.(map)
        }
      },
      options: FIELD_NOTE_MODAL_SIZES.speakerEdit
    })
  }

  // ── 오디오 재생 ──
  let audioUrl = $state<string | null>(null)
  let audioLoading = $state(false)
  let audioError = $state<string | null>(null)
  let audioEl = $state<HTMLAudioElement | null>(null)
  /** 플레이어 실측 높이 — 전사 스크롤 영역 하단 여백이 이 값을 따라간다 */
  let playerHeight = $state(0)

  /** 최상단 이동 버튼 — 한 화면 넘게 내려갔을 때만 나타난다 */
  let showScrollTop = $state(false)
  function handleTranscriptScroll(e: Event) {
    showScrollTop = (e.currentTarget as HTMLElement).scrollTop > 240
  }
  function scrollTranscriptToTop() {
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  let isPlaying = $state(false)
  let currentTime = $state(0)
  let duration = $state(0)
  let volume = $state(1)

  onMount(() => {
    if (vm.audios?.length && centerId) {
      void loadAudio()
    }
  })

  async function loadAudio() {
    if (!browser) return
    if (!centerId || !vm.audios?.length) return
    const firstAudio = vm.audios[0]
    audioLoading = true
    audioError = null
    try {
      const action = getAudioDownloadUrl()
      const result = await action.request({
        centerId,
        fieldNoteId: vm.id,
        audioId: firstAudio.id
      })
      audioUrl = result?.download_url ?? null
    } catch {
      audioError = '오디오를 불러오지 못했어요.'
    } finally {
      audioLoading = false
    }
  }

  function togglePlay() {
    if (!audioEl) return
    if (isPlaying) {
      audioEl.pause()
    } else {
      audioEl.play()
    }
  }

  function handleTimeUpdate() {
    if (!audioEl) return
    // 탐색 중에는 무시한다 — 브라우저가 새 위치로 옮기기 전에 timeupdate 한 번이 더 오면
    // 막대가 옛 위치로 되돌아갔다가 다시 튀어(왕복) 이동이 굼떠 보인다.
    if (isSeeking) return
    currentTime = audioEl.currentTime
    duration = audioEl.duration || 0
  }

  /**
   * 재생 위치 이동 — 화면을 **먼저** 옮기고 오디오를 따라오게 한다.
   * (오디오만 옮기면 timeupdate가 올 때까지 최대 250ms 막대가 가만히 있다가 휙 움직인다)
   * 이동하는 동안은 width 트랜지션을 끊어 곧바로 그 자리에 찍히게 한다.
   */
  let isSeeking = $state(false)
  let seekFallback: ReturnType<typeof setTimeout> | null = null
  function applySeek(sec: number) {
    const target = Math.max(0, duration > 0 ? Math.min(sec, duration) : sec)
    currentTime = target
    isSeeking = true
    if (seekFallback) clearTimeout(seekFallback)
    // seeked 이벤트가 오지 않는 경우(이미 그 위치)의 안전장치
    seekFallback = setTimeout(() => (isSeeking = false), 300)
    if (audioEl) audioEl.currentTime = target
  }

  function handleSeeked() {
    if (seekFallback) clearTimeout(seekFallback)
    seekFallback = null
    isSeeking = false
    if (audioEl) currentTime = audioEl.currentTime
  }

  /**
   * 진행바 드래그(스크럽) — 누른 순간부터 뗄 때까지 포인터를 막대에 붙잡아 두고
   * (setPointerCapture) 막대 밖으로 나가도 계속 따라오게 한다. 클릭 한 번도 같은 경로다
   * (pointerdown 한 번 = 그 지점으로 이동).
   */
  let isScrubbing = $state(false)

  function ratioFromPointer(e: PointerEvent, bar: HTMLElement): number {
    const rect = bar.getBoundingClientRect()
    if (rect.width === 0) return 0
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function handleScrubStart(e: PointerEvent) {
    if (!audioEl || !duration) return
    const bar = e.currentTarget as HTMLElement
    bar.setPointerCapture?.(e.pointerId)
    isScrubbing = true
    applySeek(ratioFromPointer(e, bar) * duration)
  }

  function handleScrubMove(e: PointerEvent) {
    if (!isScrubbing || !duration) return
    applySeek(ratioFromPointer(e, e.currentTarget as HTMLElement) * duration)
  }

  function handleScrubEnd(e: PointerEvent) {
    if (!isScrubbing) return
    isScrubbing = false
    const bar = e.currentTarget as HTMLElement
    if (bar.hasPointerCapture?.(e.pointerId))
      bar.releasePointerCapture(e.pointerId)
  }

  /** 키보드 탐색 — ←/→ 5초, ↑/↓ 10초, Home/End 처음·끝 */
  function handleScrubKey(e: KeyboardEvent) {
    if (!audioEl || !duration) return
    const step = e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 10 : 5
    let next: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
      next = currentTime - step
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
      next = currentTime + step
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = duration
    if (next == null) return
    e.preventDefault()
    applySeek(next)
  }

  function handleVolumeChange(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value)
    volume = v
    if (audioEl) audioEl.volume = v
    if (v > 0) preMuteVolume = v
  }

  let preMuteVolume = $state(1)

  function toggleMute() {
    if (volume > 0) {
      preMuteVolume = volume
      volume = 0
    } else {
      volume = preMuteVolume > 0 ? preMuteVolume : 1
    }
    if (audioEl) audioEl.volume = volume
  }

  const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0)

  function formatMinSec(sec: number): string {
    if (!sec || sec < 0) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── 오디오 파일 메타 (전사 헤더 표시용) ──
  const primaryAudio = $derived(vm.audios?.[0] ?? null)
  const audioFileName = $derived('음성파일.mp3')
  const audioSizeLabel = $derived.by(() => {
    const bytes = (primaryAudio as any)?.size_bytes as number | undefined
    if (!bytes) return null
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
  })

  // ── 상담일지 이동 타겟 ──
  const noteTargetPath = $derived.by(() => {
    const targetCaseId = counselingCaseId || linkedCaseId
    if (!targetCaseId) return null
    const base =
      linkedCaseType === 'assessment'
        ? `/assessment/status/${targetCaseId}`
        : `/counseling/status/${targetCaseId}`
    return `${base}${linkedSessionId ? `?session=${linkedSessionId}` : ''}`
  })

  const ctaDisabled = $derived(
    !canGenerateNote ||
      noteStatus === 'processing' ||
      !vm.scheduleId ||
      noteCreditBlocked
  )
</script>

<!-- 시각 배지 — Figma Badge/Ractangle(9444:378903). tag-blue 채움 + 재생 아이콘 16.
     누르면 그 시점으로 재생이 옮겨간다(전사 줄 클릭과 같은 seekTo). 오디오가 없으면
     점프할 곳이 없으므로 버튼을 비활성으로 두고 라벨만 남긴다 -->
{#snippet timeBadge(seconds: number)}
  <button
    type="button"
    disabled={vm.audios.length === 0}
    onclick={() => seekTo(seconds)}
    aria-label={`${formatMinSec(seconds)}부터 재생`}
    class="shrink-0 rounded-md transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
  >
    <BadgeRectangle label={formatMinSec(seconds)} color="blue" size="lg">
      {#snippet icon()}
        <PlayIcon16 />
      {/snippet}
    </BadgeRectangle>
  </button>
{/snippet}

<div class="relative flex flex-1 flex-col min-h-0">
  {#if activeTab === 'transcript'}
    <!-- ─────────── 전체 대화 탭 ─────────── -->
    <!-- 파일 정보 행 + 전사 = 한 스크롤 영역. 파일명·액션은 고정 헤더가 아니라
         전사의 머리글이라 함께 스크롤된다(탭만 상단에 남는다) -->
    <div
      bind:this={scrollContainer}
      onscroll={handleTranscriptScroll}
      class="flex-1 min-h-0 overflow-y-auto px-6 pt-3"
      style="padding-bottom: {playerHeight + 16}px"
    >
      <!-- 파일 정보 행 — Figma 9444:374210. 파일명 Title_01/Medium(18) + 용량 Body_03(14) gap 8 -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <Typography
            variant="title-01-normal-medium"
            color="text-gray-900"
            className="truncate-safe"
          >
            {audioFileName}
          </Typography>
          {#if audioSizeLabel}
            <span class="text-body-03-normal-regular text-gray-500 shrink-0"
              >{audioSizeLabel}</span
            >
          {/if}
        </div>
        <!-- 액션 행 — Figma 9444:374214. 화자 설정(편집) | 내려받기(텍스트·JSON)는
             성격이 달라 세로 구분선으로 가른다. 구분선 좌우 10 · 내려받기 둘 사이 6 -->
        <div class="flex items-center gap-2.5 shrink-0">
          {#if uniqueSpeakers.length > 0}
            <Tooltip text="화자별 이름을 설정할 수 있어요">
              <button
                type="button"
                onclick={openSpeakerEditModal}
                class="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-transparent text-body-02-normal-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ListenerWithMike20 />
                화자 설정
              </button>
            </Tooltip>
          {/if}
          {#if uniqueSpeakers.length > 0 && vm.timeline.length > 0}
            <span class="h-6 w-px shrink-0 bg-gray-200"></span>
          {/if}
          {#if vm.timeline.length > 0}
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={() => onExportTranscript?.('text')}
                class="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-transparent text-body-02-normal-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <DownloadIcon20 />
                텍스트
              </button>
              <button
                type="button"
                onclick={() => onExportTranscript?.('json')}
                class="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-transparent text-body-02-normal-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <DownloadIcon20 />
                JSON
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- 파일 행 ↔ 전사 16 -->
      <div class="pt-4">
        {#if transcriptTimeline.length === 0}
          <div class="flex flex-col items-center gap-2 py-6 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              class="text-gray-300"
            >
              <path
                d="M8 8h16M8 14h10M8 20h12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              {needsAnalysis
                ? '분석을 시작하면 전사 내용이 여기에 표시돼요.'
                : '전사 데이터가 없어요.'}
            </Typography>
          </div>
        {:else}
          <!-- 발화 블록 사이 32(Figma 9444:374220) — 화자 행↔본문 12보다 크게 둬서
             누가 말했는지가 덩어리로 읽힌다 -->
          <div class="space-y-8">
            {#each transcriptTimeline as item, idx (idx)}
              {#if item.kind === 'transcript'}
                {@const rawId = item.speaker ?? ''}
                {@const displayName = rawId
                  ? (effectiveSpeakerMap[rawId] ?? rawId)
                  : '화자'}
                {@const color = rawId ? speakerColorMap.get(rawId) : undefined}
                {@const isActive = idx === activeIdx}
                {@const seekable =
                  item.timestamp_seconds != null && vm.audios.length > 0}
                <button
                  bind:this={lineEls[idx]}
                  type="button"
                  disabled={!seekable}
                  onclick={() => seekTo(item.timestamp_seconds)}
                  class="block w-full rounded-lg text-left transition-colors {isActive
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'} {seekable
                    ? 'cursor-pointer'
                    : 'cursor-default'}"
                >
                  <!-- 화자 Body_01/Medium(16, category 색) + 시각 Body_02/Regular(15) gap 8 -->
                  <div class="mb-3 flex items-center gap-2">
                    <span
                      class="text-body-01-normal-medium {color
                        ? color.text
                        : 'text-gray-700'}"
                    >
                      {displayName}
                    </span>
                    {#if item.timestamp_seconds != null}
                      <span
                        class="text-body-02-normal-regular tabular-nums text-gray-600"
                      >
                        {formatMinSec(item.timestamp_seconds)}
                      </span>
                    {/if}
                  </div>
                  <p
                    class="whitespace-pre-wrap text-body-01-reading-regular text-gray-900"
                  >
                    {item.content}
                  </p>
                </button>
              {:else if item.kind === 'silence'}
                <div class="flex items-center gap-3 py-1">
                  <span class="h-px flex-1 bg-gray-200"></span>
                  <span
                    class="text-body-03-normal-regular text-gray-400 whitespace-nowrap"
                  >
                    {item.timestamp_seconds != null
                      ? formatMinSec(item.timestamp_seconds) + ' · '
                      : ''}{item.content}
                  </span>
                  <span class="h-px flex-1 bg-gray-200"></span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else if activeTab === 'memo'}
    <!-- ─────────── 메모 탭 ─────────── -->
    <!-- 시안(Figma 9444:379014) 기준 좌우 24 · 탭↔첫 카드 24. 하단은 플레이어 실측 -->
    <div
      class="flex-1 min-h-0 overflow-y-auto px-6 pt-6"
      style="padding-bottom: {playerHeight + 16}px"
    >
      {#if memoTimeline.length === 0}
        <!-- 빈 상태는 전 화면 공용 NoDataSection (아이콘 44 · gap 20 · Body_01/Reading-Medium) -->
        <NoDataSection description="기록된 메모가 없어요" />
      {:else}
        <!-- 카드 사이 12 — Figma I9444:378702;9433:336647;9444:378685 -->
        <div class="flex flex-col gap-3">
          {#each memoTimeline as item, idx (idx)}
            <!-- 흰 카드 · radius 12 · 패딩 16 · 시각↔본문 12 (Figma 9444:378691) -->
            <div class="rounded-xl bg-white p-4">
              <div class="mb-3 flex items-center gap-2">
                <span
                  class="text-body-02-normal-regular tabular-nums text-gray-600"
                >
                  {item.timestamp_seconds != null
                    ? formatMinSec(item.timestamp_seconds)
                    : '--:--'}
                </span>
                <!-- 태그 기록은 메모와 섞이면 구분이 사라져 분류명만 배지로 남긴다
                     (시안은 메모 카드만 그린다) -->
                {#if item.entry_type === 'tag'}
                  <BadgeRectangle
                    label={`#${item.tag_category ?? '태그'}`}
                    color="gray"
                  />
                {/if}
              </div>
              <p
                class="whitespace-pre-wrap text-body-01-reading-regular text-gray-900"
              >
                {item.content}
              </p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- ─────────── AI 분석 탭 ─────────── -->
    <!-- 시안(Figma 9444:379013) 기준 좌우 24 · 탭↔요약 카드 24 · 섹션 사이 24 -->
    <div
      class="flex flex-1 min-h-0 flex-col gap-6 overflow-y-auto px-6 pt-6"
      style="padding-bottom: {playerHeight + 16}px"
    >
      {#if isCreditExhausted}
        <div
          class="shrink-0 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-amber-500 shrink-0"
          >
            <path
              d="M8 1L1 14h14L8 1Z"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
            <path
              d="M8 6v3.5m0 2h.01"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <span class="text-sm text-amber-700">
            AI 크레딧이 부족하여 요약·일지 생성 등 AI 기능을 사용할 수 없어요.
            <a
              href="/subscription/ai-usage"
              class="underline text-amber-800 hover:text-amber-900"
              >사용량 확인</a
            >
          </span>
        </div>
      {:else if summaryCreditBlocked || noteCreditBlocked}
        <div
          class="shrink-0 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-amber-500 shrink-0"
          >
            <path
              d="M8 1L1 14h14L8 1Z"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
            <path
              d="M8 6v3.5m0 2h.01"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <span class="text-sm text-amber-700">
            크레딧이 부족하여 {summaryCreditBlocked ? '요약 생성' : '일지 생성'}
            기능이 제한돼요.
            <a
              href="/subscription/ai-usage"
              class="underline text-amber-800 hover:text-amber-900"
              >사용량 확인</a
            >
          </span>
        </div>
      {/if}

      <!-- AI 요약 카드 — Figma "SaaS V.2 통합" node 9444:378879.
           컨테이너 bg ai-50 · 1px ai-500 · radius 12 · 패딩 16 · 내부 세로 12.
           타이틀 = Body_02/Medium 15 ai-500 · 본문 = Body_01/Reading 16 gray-900.
           프레임은 '요약이 있는 상태'만 그리므로, 실행/재생성 액션은 타이틀 행 우측에
           둔다(프레임 밖 기능 — 이 카드가 유일한 진입점이라 뺄 수 없다). -->
      <section class="shrink-0 rounded-xl border border-ai-500 bg-ai-50 p-4">
        <div class="flex flex-col gap-3">
          <!-- 타이틀 행 — 아이콘(20) ↔ 텍스트 8 -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <AiStarIcon20 />
              <span
                class="truncate-safe text-body-02-normal-medium text-ai-500"
              >
                {summaryCardTitle}
              </span>
            </div>
            {#if needsAnalysis}
              <button
                type="button"
                onclick={handleRunClick}
                disabled={isRunPending || summaryCreditBlocked}
                title={summaryCreditBlocked
                  ? 'AI 크레딧이 부족합니다'
                  : undefined}
                class="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-ai-500 px-4 text-body-03-normal-medium text-white transition-colors hover:bg-ai-600 disabled:cursor-not-allowed disabled:bg-ai-300"
              >
                {#if isRunPending}
                  <span
                    class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  ></span>
                  분석 시작 중...
                {:else}
                  분석 시작
                  <span class="text-label-01-normal-regular text-white/60">
                    ({estimatedCostLabel(AI_PURPOSE.FIELD_NOTE_SUMMARIZE)})
                  </span>
                {/if}
              </button>
            {:else}
              <button
                type="button"
                onclick={handleRegenerateClick}
                disabled={isSummaryBusy || summaryCreditBlocked}
                title={summaryCreditBlocked
                  ? 'AI 크레딧이 부족합니다'
                  : undefined}
                class="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-body-03-normal-medium text-caption-default transition-colors hover:bg-white hover:text-ai-600 disabled:cursor-not-allowed disabled:text-caption-subtle"
              >
                {#if isSummaryBusy}
                  <span
                    class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ai-200 border-t-ai-500"
                  ></span>
                  요약 만드는 중...
                {:else}
                  다시 만들기
                  <span
                    class="text-label-01-normal-regular text-caption-subtle"
                  >
                    ({estimatedCostLabel(AI_PURPOSE.FIELD_NOTE_SUMMARIZE)})
                  </span>
                {/if}
              </button>
            {/if}
          </div>

          <!-- 본문 — 프레임의 요약 본문 자리. 상태별로 같은 자리를 채운다 -->
          {#if isSummaryBusy}
            <div class="flex items-center gap-2">
              <span
                class="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ai-200 border-t-ai-500"
              ></span>
              <span class="text-body-02-normal-regular text-ai-600">
                요약을 다시 만들고 있어요...
              </span>
            </div>
          {:else if vm.summaryBody}
            <!-- 본문은 analysis.narrative(회기 흐름 확장 요약) 우선 — 없으면 평문 요약 -->
            <p
              class="whitespace-pre-wrap text-body-01-reading-regular text-gray-900"
            >
              {vm.summaryBody}
            </p>
          {:else if needsAnalysis}
            <p class="text-body-01-reading-regular text-caption-default">
              아직 분석되지 않은 녹음이에요. "분석 시작"을 누르면 전사와 요약을
              만들어드려요.
            </p>
          {:else if vm.summaryStatus === 'failed'}
            <p class="text-body-01-reading-regular text-status-danger">
              요약 생성에 실패했어요. "다시 만들기"를 눌러 다시 시도해주세요.
            </p>
          {:else}
            <p class="text-body-01-reading-regular text-caption-subtle">
              아직 요약이 생성되지 않았어요.
            </p>
          {/if}
        </div>
      </section>

      <!-- 키워드 — Figma 9444:378885. 섹션 라벨 Body_02/Medium gray-600 ↔ 칩 12 -->
      {#if vm.keywords.length > 0}
        <section class="shrink-0 flex flex-col gap-3">
          <span class="text-body-02-normal-medium text-gray-600">키워드</span>
          <div class="flex flex-wrap items-center gap-2">
            {#each vm.keywords as keyword (keyword)}
              <BadgeRectangle label={keyword} color="gray" size="lg" />
            {/each}
          </div>
        </section>
      {/if}

      <!-- 정서 흐름 — Figma 9444:378893. 흰 카드 안에 시각 배지 + 정서 + 계기.
           배지를 누르면 그 시점으로 재생이 옮겨간다(전사 줄 클릭과 같은 seekTo) -->
      {#if vm.moodFlow.length > 0}
        <section class="shrink-0 flex flex-col gap-3">
          <span class="text-body-02-normal-medium text-gray-600">정서 흐름</span
          >
          <div class="flex flex-col gap-4 rounded-xl bg-white p-4">
            {#each vm.moodFlow as point, i (i)}
              <div class="flex items-center gap-4">
                <div class="relative shrink-0">
                  {@render timeBadge(point.t)}
                  <!-- 배지끼리 잇는 세로 점선(Figma Vector 1542, h 16) — 행 간격 16을
                       그대로 채워 세 지점이 하나의 흐름으로 읽히게 한다 -->
                  {#if i < vm.moodFlow.length - 1}
                    <span
                      class="pointer-events-none absolute top-full left-1/2 h-4 -translate-x-1/2 border-l border-dashed border-gray-300"
                    ></span>
                  {/if}
                </div>
                <div class="flex min-w-0 items-baseline gap-3">
                  <span
                    class="shrink-0 text-title-01-normal-semibold text-gray-900"
                  >
                    {point.mood}
                  </span>
                  {#if point.trigger}
                    <span
                      class="truncate-safe text-body-02-normal-regular text-gray-600"
                    >
                      {point.trigger}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- 의미 있는 발화 — Figma 9444:378923. 발화마다 흰 카드 하나 -->
      {#if vm.keyQuotes.length > 0}
        <section class="shrink-0 flex flex-col gap-3">
          <span class="text-body-02-normal-medium text-gray-600">
            의미 있는 발화
          </span>
          <div class="flex flex-col gap-3">
            {#each vm.keyQuotes as quote, i (i)}
              <div class="flex items-center gap-4 rounded-xl bg-white p-4">
                {@render timeBadge(quote.t)}
                <div class="flex min-w-0 flex-col gap-3">
                  <p class="text-body-01-normal-semibold text-gray-900">
                    {quote.quote}
                  </p>
                  {#if quote.note}
                    <p class="text-body-02-normal-regular text-gray-600">
                      {quote.note}
                    </p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- 상담일지 초안 생성 (템플릿 선택 + CTA).
           플로팅 시트 시안에는 없어 showNoteDraft=false로 꺼지고,
           필드노트 상세 페이지에서는 그대로 남는다(유일한 초안 생성 진입점) -->
      {#if showNoteDraft && vm.scheduleId}
        <section
          class="shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-3"
        >
          <div class="flex items-center justify-between gap-2">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
            >
              노트 템플릿
            </Typography>
            <span class="text-body-03-normal-regular text-gray-400"
              >{NOTE_TEMPLATE_LABELS[selectedTemplateType]}</span
            >
          </div>
          <Select
            options={NOTE_TEMPLATE_SELECT_OPTIONS}
            selected={selectedTemplateType}
            class="w-full"
            btnClass="py-1.5"
            on:change={(e) => {
              const opt = e.detail as SelectOptionType
              onTemplateTypeChange?.(String(opt.value) as NoteTemplateType)
            }}
          />

          {#if noteStatus === 'completed' && noteTargetPath}
            <button
              type="button"
              onclick={() => goto(noteTargetPath)}
              class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm hover:brightness-105 transition-[filter]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.3 4L6 11.3 2.7 8"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <Typography variant="body-01-normal-medium" color="text-white">
                상담일지 확인
              </Typography>
            </button>
          {:else}
            <button
              type="button"
              onclick={() => onGenerateNote?.()}
              disabled={ctaDisabled}
              title={noteCreditBlocked ? 'AI 크레딧이 부족합니다' : undefined}
              class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-white transition-[filter] {ctaDisabled
                ? 'bg-gray-300 cursor-not-allowed'
                : 'hover:brightness-105'}"
              style={ctaDisabled
                ? ''
                : 'background: linear-gradient(to right, #9B5DFF, #FF00B7); box-shadow: 0 2px 15.1px 0 rgba(246, 0, 255, 0.31);'}
            >
              {#if noteStatus === 'processing'}
                <span
                  class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                ></span>
                <Typography variant="body-01-normal-medium" color="text-white">
                  {generateNoteLabel}
                </Typography>
              {:else}
                <HighlightStarWhite24 />
                <Typography variant="body-01-normal-medium" color="text-white">
                  {generateNoteLabel}
                </Typography>
                <span class="text-white/60 text-xs"
                  >({estimatedCostLabel(
                    AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE
                  )})</span
                >
              {/if}
            </button>
          {/if}
        </section>
      {/if}
    </div>
  {/if}

  <!-- 최상단 이동 — 전체 대화 탭에서만. 목록이 긴 탭이 여기뿐이다 -->
  {#if activeTab === 'transcript'}
    <!-- 필터 바(FloatingFilterBar)와 같은 규격의 44 원형 버튼. 플레이어 바로 위 우측에
         뜨고, 사라질 때 클릭을 먹지 않도록 pointer-events를 끊는다 -->
    <button
      type="button"
      onclick={scrollTranscriptToTop}
      aria-label="최상단으로 이동"
      class="absolute right-6 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white shadow-[0_0_16px_-4px_rgb(0_0_0_/_0.16)] transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 {showScrollTop
        ? 'opacity-100'
        : 'pointer-events-none opacity-0'}"
      style="bottom: {playerHeight + 16}px"
    >
      <span class="block rotate-180"><ArrowDownIcon20 /></span>
    </button>
  {/if}

  <!-- 플레이어 위 페이드 — Figma Rectangle 34625695(h 45). 플레이어가 불투명 흰색이라
       스크롤 콘텐츠가 경계에서 잘려 보이는 걸 녹여준다(ScrollFadeArea와 같은 공식) -->
  {#if vm.audios.length > 0}
    <div
      class="pointer-events-none absolute inset-x-0 z-10 h-[45px]"
      style="bottom: {playerHeight}px; background: linear-gradient(to top, white 30%, transparent);"
    ></div>
  {/if}

  <!-- 오디오 플레이어 — 세 탭 공통 하단 고정(Figma 9444:374725 · 379014 · 378151:
       메모·AI 분석 프레임에도 같은 플레이어가 그려져 있다).
       높이 고정 대신 패딩으로 — 하단 40을 둬서 화면 밑단에 겹쳐 붙지 않게 한다
       (옛 h-[66px] + justify-center는 상하 여백이 콘텐츠에 따라 눌렸다) -->
  {#if vm.audios.length > 0}
    <!-- 좌우 24 · 상 20 · 하 40. 시안대로 불투명 흰 바탕이라 콘텐츠는 비치지 않고,
         경계는 바로 위 페이드가 녹인다(옛 bg-white/60 + backdrop-blur 폐기).
         높이는 상태(로딩·에러)에 따라 변하므로 실측해 각 탭 스크롤 영역 하단 여백에 넘긴다 -->
    <div
      bind:clientHeight={playerHeight}
      class="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-center border-t border-gray-200 bg-white px-6 pt-5 pb-10"
    >
      {#if audioLoading}
        <div class="flex items-center justify-center gap-2.5 py-2">
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500"
          ></span>
          <span class="text-sm text-gray-500">오디오 불러오는 중...</span>
        </div>
      {:else if audioUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <audio
          bind:this={audioEl}
          src={audioUrl}
          ontimeupdate={handleTimeUpdate}
          onseeked={handleSeeked}
          onplay={() => (isPlaying = true)}
          onpause={() => (isPlaying = false)}
          onended={() => (isPlaying = false)}
          onloadedmetadata={handleLoadedMeta}
          class="hidden"
        ></audio>
        <div class="flex flex-col gap-3">
          <!-- 진행바 — 클릭 이동 + 드래그 스크럽(터치 포함). touch-none이 없으면
               모바일에서 드래그가 스크롤로 먹힌다 -->
          <div
            role="slider"
            tabindex="0"
            aria-label="재생 위치"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext="{formatMinSec(currentTime)} / {formatMinSec(
              duration
            )}"
            class="group relative h-2 w-full touch-none select-none rounded-full bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-primary-200 {isScrubbing
              ? 'cursor-grabbing'
              : 'cursor-pointer'}"
            onpointerdown={handleScrubStart}
            onpointermove={handleScrubMove}
            onpointerup={handleScrubEnd}
            onpointercancel={handleScrubEnd}
            onkeydown={handleScrubKey}
          >
            <div
              class="absolute inset-y-0 left-0 rounded-full bg-primary-500 {isSeeking
                ? ''
                : 'transition-[width] duration-100 ease-linear'}"
              style="width: {progress}%"
            ></div>
            <div
              class="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white border-2 border-primary-500 shadow-sm transition-opacity {isScrubbing
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'}"
              style="left: calc({progress}% - 6px)"
            ></div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={togglePlay}
                class="flex size-8 shrink-0 items-center justify-center rounded text-gray-700 hover:text-gray-900 transition-colors"
                aria-label={isPlaying ? '일시정지' : '재생'}
              >
                {#if isPlaying}
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <rect x="3.5" y="2" width="3.5" height="12" rx="1" />
                    <rect x="9" y="2" width="3.5" height="12" rx="1" />
                  </svg>
                {:else}
                  <PlayIcon24 />
                {/if}
              </button>
              <span
                class="text-body-03-normal-regular tabular-nums text-gray-500"
              >
                {formatMinSec(currentTime)} / {formatMinSec(duration)}
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                oninput={handleVolumeChange}
                class="volume-slider"
                style="--vol: {volume * 100}%"
                aria-label="볼륨"
              />
              <button
                type="button"
                onclick={toggleMute}
                class="shrink-0 flex items-center justify-center rounded hover:opacity-80 transition-opacity {volume ===
                0
                  ? 'opacity-40'
                  : ''}"
                aria-label={volume === 0 ? '음소거 해제' : '음소거'}
                aria-pressed={volume === 0}
              >
                <VolumnIcon24 />
              </button>
            </div>
          </div>
        </div>
      {:else}
        <button
          type="button"
          onclick={loadAudio}
          class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 text-body-03-normal-medium text-gray-500 hover:border-primary-300 hover:bg-primary-50/30 hover:text-primary-500 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 2l10 6-10 6V2Z" fill="currentColor" />
          </svg>
          오디오 불러오기
        </button>
      {/if}
      {#if audioError}
        <div
          class="mt-2 flex items-center gap-2 rounded-lg bg-status-danger-bg px-3 py-2"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            class="text-status-danger shrink-0"
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
          <span class="text-xs text-red-600">{audioError}</span>
          <button
            type="button"
            onclick={loadAudio}
            class="ml-auto text-xs font-medium text-status-danger hover:text-red-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
