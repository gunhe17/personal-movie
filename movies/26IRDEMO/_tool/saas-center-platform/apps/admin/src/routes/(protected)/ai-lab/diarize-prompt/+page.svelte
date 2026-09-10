<script lang="ts">
  import { queryBuilder } from '$hooks/queries/builder'
  import { snackbarStore } from '$stores/snackbar'
  import {
    getLabMetadata,
    runTextDiarizeEval,
    type LabMetadataResponse,
    type TextDiarizeEvalResponse,
    type TextDiarizeEvalSegmentInput,
  } from '$hooks/actions/aiLab.action'
  import { getLlmModels, getDefaultSystemPrompt } from '$lib/features/ai-lab/metadata-helpers'

  // ── 메타데이터 (LLM 모델 + 기본 프롬프트) ──
  const metaQ = $derived(queryBuilder(getLabMetadata, () => ({}), () => ({ throwOnError: false })))
  const metadata = $derived(metaQ.data as LabMetadataResponse | undefined)
  const llmModels = $derived(getLlmModels(metadata))

  // ── 입력 상태 ──
  let clovaText = $state('')
  let model = $state('')
  let prompt = $state('')
  let promptSeeded = $state(false)

  // 메타 로드되면 기본 모델·프롬프트 시드 (1회)
  $effect(() => {
    if (!promptSeeded && metadata) {
      prompt = getDefaultSystemPrompt(metadata, 'stt_text_diarize')
      model = llmModels[0]?.value ?? 'gpt-4.1'
      promptSeeded = true
    }
  })

  function resetPrompt() {
    if (metadata) prompt = getDefaultSystemPrompt(metadata, 'stt_text_diarize')
  }

  // ── 클로바 .txt 파싱 ──
  // 형식: `참석자 N MM:SS` (또는 HH:MM:SS) 헤더 줄 + 다음 헤더 전까지 내용(여러 줄).
  const HEADER_RE = /^(.+?)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/
  function parseClova(raw: string): TextDiarizeEvalSegmentInput[] {
    const lines = raw.split(/\r?\n/)
    const out: TextDiarizeEvalSegmentInput[] = []
    let cur: { speaker: string; text: string; start: number } | null = null
    for (const line of lines) {
      const m = line.match(HEADER_RE)
      if (m) {
        if (cur && cur.text.trim()) out.push(cur)
        const h = Number(m[2]); const mm = Number(m[3]); const ss = m[4] != null ? Number(m[4]) : null
        const start = ss != null ? h * 3600 + mm * 60 + ss : h * 60 + mm
        cur = { speaker: m[1].trim(), text: '', start }
      } else if (cur) {
        const t = line.trim()
        if (t) cur.text += (cur.text ? ' ' : '') + t
      }
    }
    if (cur && cur.text.trim()) out.push(cur)
    return out
  }

  const segments = $derived(parseClova(clovaText))
  const speakerSet = $derived(new Set(segments.map((s) => s.speaker)))

  // ── 원본(화자분리 안 된 실제 전사) 파싱 ──
  // 화자 없이 `[mm:ss] 텍스트` 또는 `mm:ss\n텍스트`(클로바형, 화자 무시) 모두 허용.
  let rawText = $state('')
  const RAW_HEADER_RE = /^(?:(.+?)\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/
  const RAW_INLINE_RE = /^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s+(.+)$/
  function parseRaw(input: string): { text: string; start: number }[] {
    const lines = input.split(/\r?\n/)
    const out: { text: string; start: number }[] = []
    let cur: { text: string; start: number } | null = null
    for (const line of lines) {
      const inline = line.match(RAW_INLINE_RE)
      if (inline) {
        if (cur && cur.text.trim()) out.push(cur)
        const h = Number(inline[1]); const mm = Number(inline[2]); const ss = inline[3] != null ? Number(inline[3]) : null
        const start = ss != null ? h * 3600 + mm * 60 + ss : h * 60 + mm
        out.push({ text: inline[4].trim(), start })
        cur = null
        continue
      }
      const head = line.match(RAW_HEADER_RE)
      if (head) {
        if (cur && cur.text.trim()) out.push(cur)
        const h = Number(head[2]); const mm = Number(head[3]); const ss = head[4] != null ? Number(head[4]) : null
        const start = ss != null ? h * 3600 + mm * 60 + ss : h * 60 + mm
        cur = { text: '', start }
      } else if (cur) {
        const t = line.trim()
        if (t) cur.text += (cur.text ? ' ' : '') + t
      }
    }
    if (cur && cur.text.trim()) out.push(cur)
    return out
  }
  const rawSegments = $derived(rawText.trim() ? parseRaw(rawText) : [])
  const useRaw = $derived(rawSegments.length > 0)
  // 침묵 간격 병합 임계값(초). AWS 실시간 전사의 과도한 파편(727개 등)을 턴 단위로 묶어
  // 화자분리 정확도를 올리는 핵심 레버. 0 = 병합 안 함. 원본 모드에서만 적용.
  let mergeGap = $state(0.8)

  // ── 실행 ──
  let running = $state(false)
  let result = $state<TextDiarizeEvalResponse | null>(null)

  async function run() {
    if (segments.length === 0) {
      snackbarStore.error('정답 전사를 붙여넣어 주세요. 파싱된 발화가 없습니다.')
      return
    }
    if (!model) {
      snackbarStore.error('모델을 선택해 주세요.')
      return
    }
    running = true
    try {
      result = await runTextDiarizeEval().request({
        segments,
        input_segments: useRaw ? rawSegments : undefined,
        merge_gap: useRaw ? mergeGap : 0,
        model_name: model,
        system_prompt: prompt || undefined,
      })
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      snackbarStore.error(msg ?? '평가를 실행하지 못했습니다.')
    } finally {
      running = false
    }
  }

  function fmtTime(sec: number): string {
    const s = Math.floor(sec)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const accColor = $derived(
    !result ? '' : result.accuracy_pct >= 90 ? 'text-emerald-600'
      : result.accuracy_pct >= 75 ? 'text-amber-600' : 'text-red-500',
  )
</script>

<div class="mx-auto max-w-5xl px-4 py-6">
  <div class="mb-5">
    <a href="/ai-lab/lab" class="text-sm text-gray-400 hover:text-gray-600">← AI Lab</a>
    <h1 class="mt-1 text-xl font-semibold text-gray-900">화자분리 프롬프트 튜닝 (정답 기반)</h1>
    <p class="mt-1 text-sm text-gray-500">
      정확한 외부 전사(클로바노트 등)를 정답으로 붙여넣으면 — 화자 라벨을 떼고 LLM이 재배정한 결과를
      정답과 비교해 정확도를 측정합니다. 오디오·전사 불필요. 프롬프트만 바꿔가며 정확도가 오르는 걸 확인하세요.
    </p>
  </div>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <!-- 좌: 정답 입력 -->
    <div class="space-y-3">
      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-700">정답 전사 (클로바 .txt 붙여넣기)</p>
          <span class="text-xs text-gray-400">
            {segments.length}발화 · 화자 {speakerSet.size}명
          </span>
        </div>
        <textarea
          bind:value={clovaText}
          rows="12"
          placeholder={'참석자 2 00:51\n네\n\n참석자 1 00:52\n그리고 상담은 전화 상담으로 진행이 되고...'}
          class="w-full resize-y rounded-lg border border-gray-200 bg-[#FDFDFD] px-3 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
        ></textarea>
        {#if segments.length > 0}
          <div class="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
            {#each segments as s}
              <div class="flex gap-2 text-xs">
                <span class="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 font-medium text-gray-600">{s.speaker}</span>
                <span class="shrink-0 font-mono text-gray-400">{fmtTime(s.start ?? 0)}</span>
                <span class="truncate text-gray-700">{s.text}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 원본 (화자분리 안 된 전사) -->
      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <div class="mb-1 flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-700">원본 전사 (화자분리 안 됨) · 선택</p>
          <span class="text-xs text-gray-400">{rawSegments.length}발화</span>
        </div>
        <p class="mb-2 text-xs text-gray-400">
          실제 STT 전사(화자 없음)를 넣으면 <b>이걸 LLM에 돌려</b> 정답과 시간 기반 비교 — production에 가장 가까운 테스트.
          비우면 정답에서 화자만 떼어 입력으로 사용(이상적 입력).
        </p>
        <textarea
          bind:value={rawText}
          rows="8"
          placeholder={'[00:51] 네\n[00:52] 그리고 상담은 전화 상담으로 진행이 되고...\n\n또는 클로바형(화자 줄은 무시):\n참석자 1 00:52\n그리고 상담은...'}
          class="w-full resize-y rounded-lg border border-gray-200 bg-[#FDFDFD] px-3 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
        ></textarea>
        {#if useRaw}
          <div class="mt-3 rounded-lg bg-primary-50/60 p-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-primary-700">침묵 간격 병합</p>
              <span class="text-xs text-gray-500">간격 &lt; <b>{mergeGap}s</b> 면 같은 턴으로 합침</span>
            </div>
            <p class="mb-2 mt-0.5 text-[11px] leading-relaxed text-amber-600">
              ⚠️ 실험용. 파편을 줄이지만 <b>전화상담처럼 화자 전환이 빠르면</b>(간격 0.2~0.5초) 다중 화자가
              한 덩어리로 뭉쳐 오히려 정확도가 떨어진다. 화자분리 '전' 병합은 비권장 — <b>0 = 병합 안 함</b>.
            </p>
            <div class="flex items-center gap-3">
              <input
                type="range"
                min="0" max="3" step="0.1"
                bind:value={mergeGap}
                class="h-2 flex-1 cursor-pointer accent-primary-600"
              />
              <input
                type="number"
                min="0" max="5" step="0.1"
                bind:value={mergeGap}
                class="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-primary-400"
              />
            </div>
            {#each [0, 0.5, 0.8, 1.2, 2.0] as g}
              <button
                class="mr-1 mt-2 rounded-md border px-2 py-0.5 text-[11px] {mergeGap === g
                  ? 'border-primary-400 bg-primary-100 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}"
                onclick={() => (mergeGap = g)}
              >{g === 0 ? '병합없음' : `${g}s`}</button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 모델 -->
      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="mb-2 text-xs font-semibold text-gray-700">화자 추론 LLM</p>
        <select
          bind:value={model}
          class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-500"
        >
          {#each llmModels as m}
            <option value={m.value}>{m.label}{m.cost_label ? ` (${m.cost_label})` : ''}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- 우: 프롬프트 -->
    <div class="rounded-2xl border border-gray-200 bg-white p-4">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-xs font-semibold text-gray-700">화자 추론 프롬프트</p>
        <button class="text-xs text-gray-400 hover:text-gray-600" onclick={resetPrompt}>기본값으로</button>
      </div>
      <textarea
        bind:value={prompt}
        rows="20"
        class="w-full resize-y rounded-lg border border-gray-200 bg-[#FDFDFD] px-3 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
      ></textarea>
    </div>
  </div>

  <!-- 실행 -->
  <p class="mt-4 text-center text-xs text-gray-400">
    {#if useRaw}
      <span class="font-medium text-primary-600">원본 모드</span> — 원본({rawSegments.length}발화)을 LLM이 화자분리 → 정답({segments.length}발화)과 시간 기반 비교
    {:else}
      <span class="font-medium text-gray-500">이상적 입력 모드</span> — 정답에서 화자만 떼어 LLM 재배정(세그먼트 동일). 원본을 넣으면 production에 가까운 테스트로 전환
    {/if}
  </p>
  <button
    class="mt-2 w-full rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
    onclick={run}
    disabled={running || segments.length === 0}
  >
    {running ? '측정 중…' : '화자분리 정확도 측정'}
  </button>

  <!-- 결과 -->
  {#if result}
    <div class="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
      <!-- 핵심 지표 3종: 전체 정확도(부풀려짐) vs 베이스라인 vs 균형 -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <p class="text-xs font-semibold text-gray-400">전체 정확도</p>
          <p class="text-3xl font-bold {accColor}">{result.accuracy_pct}%</p>
          <p class="text-xs {result.accuracy_pct - result.majority_baseline_pct >= 5 ? 'text-emerald-600' : 'text-amber-600'}">
            베이스라인 대비 {result.accuracy_pct - result.majority_baseline_pct >= 0 ? '+' : ''}{(result.accuracy_pct - result.majority_baseline_pct).toFixed(1)}%p
          </p>
        </div>
        <div class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <p class="text-xs font-semibold text-gray-400">베이스라인 (전부 다수화자)</p>
          <p class="text-3xl font-bold text-gray-400">{result.majority_baseline_pct}%</p>
          <p class="text-xs text-gray-400">이걸 넘어야 실력</p>
        </div>
        <div class="rounded-xl border border-primary-100 bg-primary-50/40 px-3 py-3">
          <p class="text-xs font-semibold text-primary-600">균형 정확도 (진짜 신호)</p>
          <p class="text-3xl font-bold {result.balanced_accuracy_pct >= 80 ? 'text-emerald-600' : result.balanced_accuracy_pct >= 60 ? 'text-amber-600' : 'text-red-500'}">{result.balanced_accuracy_pct}%</p>
          <p class="text-xs text-primary-500">화자별 recall 평균</p>
        </div>
      </div>

      <!-- 화자별 recall (소수 화자 = 튜닝 타깃) -->
      <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="text-gray-400">화자별 적중:</span>
        {#each Object.entries(result.per_speaker_recall).sort((a, b) => a[1] - b[1]) as [sp, rec], i}
          <span class="rounded-md px-2 py-0.5 font-medium {rec >= 80 ? 'bg-emerald-50 text-emerald-700' : rec >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}">
            {sp} {rec}%{#if i === 0 && Object.keys(result.per_speaker_recall).length > 1}<span class="ml-1 opacity-60">(소수)</span>{/if}
          </span>
        {/each}
        <span class="ml-2 text-gray-400">·
          {result.correct}/{result.total} 발화 · 지연 {result.latency_ms}ms ·
          {#each Object.entries(result.label_mapping) as [pred, ref]}
            <span class="ml-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono">{pred}→{ref}</span>
          {/each}
        </span>
        {#if result.input_count && result.merged_count && result.input_count !== result.merged_count}
          <span class="rounded-md bg-primary-100 px-2 py-0.5 font-medium text-primary-700">
            침묵 병합 {result.input_count}→{result.merged_count}
          </span>
        {/if}
      </div>

      <div class="mt-4 max-h-[28rem] space-y-1 overflow-auto rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
        {#each result.per_segment as seg}
          <div class="flex gap-2 rounded-md px-1.5 py-1 {seg.correct ? '' : 'bg-red-50'}">
            <span class="shrink-0 pt-0.5 font-mono text-xs tabular-nums text-gray-400">{fmtTime(seg.start)}</span>
            <span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold {seg.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
              {seg.ref_speaker}
            </span>
            <span class="text-sm leading-relaxed {seg.correct ? 'text-gray-700' : 'text-red-700'}">{seg.text}</span>
            {#if !seg.correct}
              <span class="shrink-0 pt-0.5 font-mono text-xs text-red-400">LLM→{seg.mapped_pred}</span>
            {/if}
          </div>
        {/each}
      </div>
      <p class="mt-2 text-xs text-gray-400">
        빨간 줄 = 정답과 다르게 분리된 발화. 프롬프트를 고치고 다시 측정해 정확도 변화를 확인하세요.
      </p>
    </div>
  {/if}
</div>
