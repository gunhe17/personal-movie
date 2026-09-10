<script lang="ts">
  import { parseSyncSegments } from '../shared/audio-sync'
  import type { DiarizationAccuracyResponse } from '$hooks/actions/aiLab.action'

  let {
    title,
    icon,
    accent = 'violet',
    model = '',
    outputJson = null,
    latencyMs = null,
    accuracy = null,
    refSpeakers = null,
    loading = false,
    error = null,
    onSuggest,
    suggestion = null,
    suggesting = false,
  }: {
    title: string
    icon: string
    accent?: string
    model?: string
    outputJson?: string | null
    latencyMs?: number | null
    accuracy?: DiarizationAccuracyResponse | null
    refSpeakers?: number | null
    loading?: boolean
    error?: string | null
    onSuggest?: () => void
    suggestion?: string | null
    suggesting?: boolean
  } = $props()

  const COLORS: Record<string, string> = {
    A: 'bg-violet-100 text-violet-700',
    B: 'bg-emerald-100 text-emerald-700',
    C: 'bg-orange-100 text-orange-700',
    D: 'bg-blue-100 text-blue-700',
  }
  const segments = $derived(parseSyncSegments(outputJson))
  const speakerCount = $derived(segments ? new Set(segments.map((s) => s.speaker)).size : 0)

  function fmtTime(sec: number): string {
    const s = Math.floor(sec)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  function accColor(pct: number): string {
    if (pct >= 85) return 'bg-emerald-50 text-emerald-700'
    if (pct >= 65) return 'bg-amber-50 text-amber-700'
    return 'bg-red-50 text-red-700'
  }
</script>

<div class="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white">
  <!-- 헤더 -->
  <div class="shrink-0 border-b border-gray-100 px-4 py-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5">
        <span class="text-sm">{icon}</span>
        <span class="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      {#if accuracy}
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {accColor(accuracy.accuracy_pct)}">
          정확도 {accuracy.accuracy_pct}%
        </span>
      {/if}
    </div>
    <div class="mt-1 flex items-center gap-2 text-xs text-gray-400">
      {#if model}<span class="font-mono">{model}</span>{/if}
      {#if speakerCount > 0}
        <span class="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
          화자 {speakerCount}명{#if refSpeakers != null}<span class={speakerCount === refSpeakers ? 'text-gray-400' : 'text-amber-600'}> / 정답 {refSpeakers}명</span>{/if}
        </span>
      {/if}
      {#if latencyMs != null}<span>{(latencyMs / 1000).toFixed(1)}s</span>{/if}
    </div>
  </div>

  <!-- 본문 -->
  <div class="min-h-0 flex-1 overflow-auto px-3 py-3">
    {#if loading}
      <div class="flex h-full min-h-32 items-center justify-center gap-2 text-sm text-gray-400">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-{accent}-500"></span>
        실행 중…
      </div>
    {:else if error}
      <div class="rounded-lg border border-red-100 bg-red-50 px-3 py-4 text-xs text-red-600">
        실패: {error}
      </div>
    {:else if segments && segments.length > 0}
      <div class="space-y-1.5">
        {#each segments as seg, i}
          {@const wrong = accuracy ? accuracy.segment_correct[i] === false : false}
          <div class="flex gap-2 {wrong ? 'rounded-md bg-red-50 px-1' : ''}">
            <span class="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold {COLORS[seg.speaker] ?? 'bg-gray-100 text-gray-600'}">{seg.speaker}</span>
            <span class="shrink-0 pt-0.5 font-mono text-xs text-gray-400 tabular-nums">{fmtTime(seg.start)}</span>
            <span class="text-sm leading-relaxed {wrong ? 'text-red-700' : 'text-gray-700'}">{seg.text}</span>
            {#if wrong}<span class="shrink-0 pt-0.5 text-xs text-red-400">✗</span>{/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="py-12 text-center text-xs text-gray-300">결과 없음</p>
    {/if}
  </div>

  <!-- 취약 포인트 + 개선 제안 (텍스트 모델 전용: onSuggest 있을 때) -->
  {#if onSuggest && !loading && !error}
    <div class="shrink-0 border-t border-gray-100 px-3 py-2.5">
      {#if accuracy && accuracy.confusion && accuracy.confusion.length > 0}
        <ul class="mb-2 space-y-0.5 text-xs text-gray-500">
          {#if refSpeakers != null && accuracy.cand_speakers !== refSpeakers}
            <li>· 화자 {accuracy.cand_speakers}명 (정답 {refSpeakers}명) {accuracy.cand_speakers < refSpeakers ? '과소' : '과다'}</li>
          {/if}
          {#each accuracy.confusion.slice(0, 3) as c}
            <li>· <b class="text-gray-700">{c.predicted}</b>로 본 게 정답 <b class="text-gray-700">{c.correct}</b> ({c.count})</li>
          {/each}
        </ul>
      {/if}
      <button
        class="w-full rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2 py-1.5 text-xs font-semibold text-fuchsia-600 transition-colors hover:bg-fuchsia-100 disabled:opacity-50"
        onclick={onSuggest}
        disabled={suggesting}
      >{suggesting ? '분석 중…' : '✨ 프롬프트 개선 제안'}</button>
      {#if suggestion}
        <pre class="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-fuchsia-100 bg-white px-2.5 py-2 text-xs leading-relaxed text-gray-700">{suggestion}</pre>
      {/if}
    </div>
  {/if}
</div>
