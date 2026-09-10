<script lang="ts">
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { formatLatency, formatCostKRW } from '../../constants'
  import { snackbarStore } from '$stores/snackbar'
  import { parseSyncSegments, findActiveSegment } from '../../shared/audio-sync'
  import { getDiarizationAccuracy, getPromptSuggestion, getSampleAudioUrl, type DiarizationAccuracyResponse } from '$hooks/actions/aiLab.action'
  import type { TestResult } from '../types'

  function simplifyModel(name: string): string {
    return name.replace(/-\d{4}-\d{2}-\d{2}$/, '')
  }

  const SPEAKER_COLORS: Record<string, string> = {
    A: 'bg-violet-100 text-violet-700',
    B: 'bg-emerald-100 text-emerald-700',
    C: 'bg-orange-100 text-orange-700',
    D: 'bg-blue-100 text-blue-700',
  }
  function speakerColor(s: string): string {
    return SPEAKER_COLORS[s] ?? 'bg-gray-100 text-gray-600'
  }

  let {
    result,
    isLatest = false,
    forceExpanded = false,
    compareLabel = '',
    /** 외부에서 관리하는 평가 상태 — 카드 재마운트/A/B 비교 전환에도 점수 유지 */
    savedEval,
    onEvaluate,
    onPromote,
    onMakeReference,
  }: {
    result: TestResult
    isLatest?: boolean
    forceExpanded?: boolean
    compareLabel?: string
    savedEval?: { score: number | null; note: string; saved: boolean }
    onEvaluate: (experimentId: string, score: number, note: string) => void
    onPromote: (experimentId: string) => void
    onMakeReference?: (result: TestResult) => void
  } = $props()

  // STT 화자분리 결과 → 세그먼트 파싱 (화자 2명 이상일 때만 화자 뷰로 표시)
  const speakerSegments = $derived(result.isStt ? parseSyncSegments(result.outputJson) : null)
  const showSpeakerView = $derived(
    !!speakerSegments && new Set(speakerSegments.map((s) => s.speaker)).size >= 2,
  )
  function fmtTime(sec: number): string {
    const s = Math.floor(sec)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  // ── 오디오 싱크 검증 (재생바 ↔ 텍스트 양방향) ──
  // 텍스트 클릭 → 해당 위치 재생, 재생 진행 → 해당 세그먼트 액티브 하이라이트.
  // 세그먼트 타임스탬프(start/end)가 실제 오디오와 맞는지 눈으로 확인하는 용도.
  let audioEl = $state<HTMLAudioElement | null>(null)
  let audioUrl = $state<string | null>(null)
  let loadingAudio = $state(false)
  let currentTime = $state(0)
  let segContainer = $state<HTMLDivElement | null>(null)
  const activeIdx = $derived(
    audioUrl && speakerSegments ? findActiveSegment(speakerSegments, currentTime) : -1,
  )

  async function loadAudio() {
    if (!result.sampleId || audioUrl || loadingAudio) return
    loadingAudio = true
    try {
      const res = await getSampleAudioUrl().request({ sampleId: result.sampleId })
      audioUrl = res.download_url
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      snackbarStore.error(msg ?? '오디오를 불러올 수 없습니다.')
    } finally {
      loadingAudio = false
    }
  }

  function seekTo(sec: number) {
    if (!audioEl) return
    audioEl.currentTime = sec
    void audioEl.play()
  }

  // 재생 진행에 따라 액티브 세그먼트를 목록 안에서 보이게 스크롤
  $effect(() => {
    if (activeIdx < 0 || !segContainer) return
    const el = segContainer.querySelector(`[data-seg="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  })

  onDestroy(() => {
    if (browser && audioEl) audioEl.pause()
  })

  // 정확도 측정 (정답 대비)
  let accuracy = $state<DiarizationAccuracyResponse | null>(null)
  let measuring = $state(false)
  async function measureAccuracy() {
    measuring = true
    try {
      accuracy = await getDiarizationAccuracy().request({ experimentId: result.experimentId })
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      snackbarStore.error(msg ?? '정확도를 측정할 수 없습니다. 먼저 정답을 만들어주세요.')
    } finally {
      measuring = false
    }
  }

  // AI 프롬프트 개선 제안 (텍스트 화자분리 전용)
  const isTextDiarize = $derived(result.stepKey === 'stt_text_diarize')
  let suggestion = $state<string | null>(null)
  let suggesting = $state(false)
  async function fetchSuggestion() {
    suggesting = true
    try {
      const res = await getPromptSuggestion().request({ experimentId: result.experimentId })
      suggestion = res.suggestion
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      snackbarStore.error(msg ?? '제안을 생성할 수 없습니다. 먼저 정답을 만들어주세요.')
    } finally {
      suggesting = false
    }
  }

  let isExpanded = $state(isLatest || forceExpanded)
  let evalScore = $state(0)
  let evalNote = $state('')
  let showEvalForm = $state(isLatest)
  // 저장된 평가 점수: 외부 평가 상태(savedEval, SSOT) 기반 derived.
  // 로컬 state가 아니므로 카드 재마운트·A/B 비교 전환에도 점수가 유지된다.
  const savedScore = $derived(savedEval?.score ?? null)

  function toggleExpand() {
    isExpanded = !isExpanded
  }

  function handleEvaluate() {
    if (evalScore < 1) {
      snackbarStore.error('평점을 선택해주세요.')
      return
    }
    onEvaluate(result.experimentId, evalScore, evalNote)
    showEvalForm = false
  }

  const SCORE_LABELS = ['부족', '미흡', '보통', '좋음', '매우 좋음'] as const
</script>

<div class="overflow-hidden rounded-2xl border {isLatest ? 'border-primary-200 bg-white' : 'border-gray-200 bg-white'}">
  <!-- 헤더 -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 transition-colors"
    onclick={toggleExpand}
  >
    <span class="flex items-center gap-1.5 shrink-0">
      {#if compareLabel}
        <span class="flex h-5 w-5 items-center justify-center rounded-full text-label-01-normal-bold
          {compareLabel === 'A' ? 'bg-primary-500 text-white' : 'bg-amber-400 text-white'}">
          {compareLabel}
        </span>
      {:else}
        <span class="h-2.5 w-2.5 rounded-full {isLatest ? 'bg-primary-500' : 'bg-emerald-500'}"></span>
      {/if}
      <span class="text-body-03-normal-semibold text-gray-700">#{result.index}</span>
    </span>
    <span class="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-label-01-normal-medium font-mono text-gray-500">
      {simplifyModel(result.model)}
    </span>
    <span class="min-w-0 flex-1 truncate text-body-03-normal-regular text-gray-400">
      {result.inputText.slice(0, 50).replace(/\n/g, ' ')}{result.inputText.length > 50 ? '...' : ''}
    </span>
    <span class="shrink-0 text-label-01-normal-regular tabular-nums text-gray-400">
      {formatLatency(result.latencyMs)} · {formatCostKRW(result.costUsd)}
    </span>
    {#if savedScore}
      <span class="shrink-0 flex items-center gap-0.5">
        {#each Array(5) as _, i}
          <svg class="h-3.5 w-3.5 {i < savedScore ? 'text-amber-400' : 'text-gray-200'}" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        {/each}
      </span>
    {/if}
    <svg
      class="h-4 w-4 shrink-0 text-gray-400 transition-transform {isExpanded ? 'rotate-180' : ''}"
      fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  </div>

  {#if isExpanded}
    <div class="border-t border-gray-100 divide-y divide-gray-100">
      <!-- AI 결과 -->
      <div class="px-4 py-4">
        <p class="mb-2 text-label-01-normal-bold uppercase tracking-wider text-gray-400">AI 결과</p>
        <pre class="whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 font-mono text-body-03-normal-regular leading-relaxed text-gray-700 overflow-auto max-h-64">{result.content}</pre>
      </div>

      <!-- 입력값 -->
      <details class="group">
        <summary class="cursor-pointer px-4 py-3.5 text-label-01-normal-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors">
          입력값 <span class="text-label-01-normal-regular text-gray-300 group-open:hidden">펼치기</span>
        </summary>
        <div class="px-4 pb-4">
          <div class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p class="whitespace-pre-wrap text-body-03-normal-regular text-gray-700">{result.inputText}</p>
          </div>
        </div>
      </details>

      <!-- 프롬프트 (STT 제외) -->
      {#if !result.isStt && result.systemPrompt}
        <details class="group">
          <summary class="cursor-pointer px-4 py-3.5 text-label-01-normal-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors">
            사용된 프롬프트
            {#if result.versionName}
              <span class="ml-1.5 rounded-md bg-primary-50 px-1.5 py-0.5 text-label-01-normal-medium normal-case text-primary-600">{result.versionName}</span>
            {:else}
              <span class="ml-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-medium normal-case text-gray-500">기본 프롬프트</span>
            {/if}
            <span class="text-label-01-normal-regular text-gray-300 group-open:hidden">펼치기</span>
          </summary>
          <div class="px-4 pb-4">
            <div class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p class="whitespace-pre-wrap font-mono text-body-03-normal-regular leading-relaxed text-gray-600">{result.systemPrompt}</p>
            </div>
          </div>
        </details>
      {/if}

      <!-- 인라인 평가 + 프로덕션 반영 -->
      <div class="px-4 py-4">
        {#if savedScore}
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="text-label-01-normal-bold uppercase tracking-wider text-gray-400">평가</span>
              <div class="flex items-center gap-0.5">
                {#each Array(5) as _, i}
                  <svg class="h-4 w-4 {i < savedScore ? 'text-amber-400' : 'text-gray-200'}" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                {/each}
              </div>
              <span class="text-body-03-normal-regular text-gray-500">{savedScore}점 · {SCORE_LABELS[savedScore - 1]}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="rounded-lg px-3.5 py-2 text-label-01-normal-medium transition-colors {savedScore >= 4
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'}"
                disabled={savedScore < 4}
                onclick={() => onPromote(result.experimentId)}
              >
                프로덕션 반영
              </button>
              {#if savedScore < 4}
                <span class="text-label-01-normal-regular text-gray-400">4점 이상일 때 반영 가능</span>
              {/if}
            </div>
          </div>
        {:else if showEvalForm}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-label-01-normal-bold uppercase tracking-wider text-gray-400">평가</p>
              <p class="text-label-01-normal-regular text-gray-400">4점 이상 시 프로덕션 반영 가능</p>
            </div>
            <!-- 별점 -->
            <div class="flex items-center gap-1">
              {#each [1, 2, 3, 4, 5] as score}
                <button
                  class="p-0.5 transition-colors"
                  onclick={() => evalScore = score}
                  title={SCORE_LABELS[score - 1]}
                >
                  <svg class="h-6 w-6 {evalScore >= score ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'}" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              {/each}
              {#if evalScore > 0}
                <span class="ml-2 text-body-03-normal-regular text-gray-500">
                  {evalScore}점 · {SCORE_LABELS[evalScore - 1]}
                </span>
              {/if}
            </div>
            <!-- 코멘트 -->
            <input
              type="text"
              class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
              placeholder="간단한 평가 코멘트 (선택)"
              bind:value={evalNote}
            />
            <div class="flex gap-2">
              <button
                class="flex-1 rounded-lg border border-gray-200 py-2.5 text-body-03-normal-medium text-gray-600 hover:bg-gray-50 transition-colors"
                onclick={() => { showEvalForm = false; evalScore = 0; evalNote = '' }}
              >취소</button>
              <button
                class="flex-1 rounded-lg bg-primary-600 py-2.5 text-body-03-normal-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                disabled={evalScore < 1}
                onclick={handleEvaluate}
              >저장</button>
            </div>
          </div>
        {:else}
          <button
            class="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 py-2.5 text-body-03-normal-medium text-primary-600 hover:bg-primary-100 transition-colors"
            onclick={() => showEvalForm = true}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            평가하기
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
