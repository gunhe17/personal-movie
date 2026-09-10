<!--
  VAD 임계값 측정 — 로르샤하 받아쓰기(dictation.svelte.ts)의 상수를 실측으로 정한다.

  왜 필요한가
  ----------
  현행 상수는 눈대중이다. dictation.svelte.ts의 주석이 스스로 인정한다.
  그 측정을 매번 콘솔에서 손으로 하지 않으려고 페이지로 만든다.

  왜 상수를 import하는가
  ----------------------
  값을 여기 베껴 적으면 dictation.svelte.ts를 고쳤을 때 이 페이지가 **옛 값으로
  조용히 거짓 판정**을 낸다. 측정 도구가 측정 대상과 어긋나는 건 최악이므로
  한 곳에서만 산다.

  왜 /dev인가
  -----------
  예전 측정 페이지는 static/에 있다가 프로덕션에 그대로 배포돼서 지웠다.
  /dev/+layout.server.ts가 프로덕션에서 404를 낸다.

  측정 조건은 실제 검사와 같아야 한다 — 같은 기기·마이크·방, 검사자와
  피검자가 앉는 실제 거리.
-->
<script lang="ts">
  import {
    SPEECH_RMS,
    VOICE_FRAMES,
    SILENCE_MS,
    MIN_CLIP_MS,
    MAX_CLIP_MS
  } from '$lib/features/examination/rorschach/hooks/dictation.svelte'

  const SEG_MS = 10_000
  const SEG_LABEL: Record<SegKey, string> = {
    noise: '① 배경 소음',
    normal: '② 평상시 말소리',
    quiet: '③ 작게 말하기'
  }
  const SEG_HINT: Record<SegKey, string> = {
    noise: '아무도 말하지 않는다',
    normal: '피검자 자리에서 보통 크기로',
    quiet: '가장 조용한 반응을 가정'
  }

  type SegKey = 'noise' | 'normal' | 'quiet'
  type Samples = { rms: number[]; band: number[]; zcr: number[]; flat: number[] }

  // --- 오디오 자원 (반응성 불필요 — 화면이 그리지 않는다) ---
  let stream: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let rafId: number | null = null

  /**
   * 계기 표시값은 **초당 10회만** 갱신한다.
   *
   * 매 프레임 $state에 쓰면 초당 60~120회 무효화가 돈다. 표본 수집은 매
   * 프레임 하되(정확도), 화면에 내보내는 건 묶어서 한다.
   */
  const PUBLISH_MS = 100
  let lastPublishAt = 0

  let live = $state({ rms: 0, floor: 0, band: 0, zcr: 0, flat: 0, speech: false, voicing: false })
  let status = $state('대기 중')
  let running = $state(false)
  let segStatus = $state('—')
  let segProgress = $state(0)
  let loopStat = $state({ dtMedian: 0, hz: 0, voiceFramesMs: 0 })
  let segments = $state<Partial<Record<SegKey, Samples>>>({})
  let jsonText = $state('')
  let copyLabel = $state('측정값 JSON 복사')

  let constraints = $state({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })

  /**
   * 녹취 중인 구간 — **일부러 `$state`가 아니다.**
   *
   * `$state`로 두면 `samples.rms.push(...)`가 깊은 반응성을 건드려 매 프레임
   * 무효화가 돈다(초당 60~120회 × 표본 4종). 화면이 알아야 하는 건 "지금
   * 녹취 중인가" 하나뿐이라, 그것만 `isRecording`으로 따로 내보낸다.
   */
  let recording: { key: SegKey; until: number; samples: Samples } | null = null
  let isRecording = $state(false)
  const recent: number[] = []
  const scope: { rms: number; floor: number }[] = []
  const dts: number[] = []
  let lastFrameAt = 0
  let voiceRun = 0
  let canvas: HTMLCanvasElement | null = null

  const percentile = (arr: number[], p: number) => {
    if (!arr.length) return NaN
    const s = [...arr].sort((a, b) => a - b)
    const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))
    return s[i]
  }
  const fmt = (v: number, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '—')

  let allMeasured = $derived(
    (['noise', 'normal', 'quiet'] as SegKey[]).every((k) => segments[k])
  )

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      status = window.isSecureContext
        ? '이 브라우저는 마이크를 지원하지 않는다.'
        : '보안 컨텍스트가 아니다 — localhost 또는 HTTPS로 열어야 한다.'
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { ...constraints } })
    } catch (err) {
      status = `마이크를 열 수 없다: ${(err as Error).name}`
      return
    }

    audioCtx = new AudioContext()
    const src = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    // 프로덕션은 1024를 쓴다. 여기서는 주파수 분해능을 위해 2048로 올린다
    // (48kHz에서 bin 폭 23Hz). RMS 계산에는 영향이 없다.
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
    src.connect(analyser)

    const track = stream.getAudioTracks()[0]
    const st = track.getSettings?.() ?? {}
    status =
      `측정 중 — ${track.label || '기본 마이크'} · ${audioCtx.sampleRate}Hz` +
      ` · EC=${st.echoCancellation ?? '?'} NS=${st.noiseSuppression ?? '?'} AGC=${st.autoGainControl ?? '?'}`
    running = true
    lastFrameAt = performance.now()
    loop()
  }

  function stop() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    void audioCtx?.close()
    audioCtx = null
    analyser = null
    recording = null
    isRecording = false
    running = false
    status = '중지됨'
  }

  function loop() {
    const tBuf = new Uint8Array(analyser!.fftSize)
    const fBuf = new Float32Array(analyser!.frequencyBinCount)

    const tick = () => {
      if (!analyser || !audioCtx) return
      const now = performance.now()
      const dt = now - lastFrameAt
      lastFrameAt = now
      if (dt > 0 && dt < 100) dts.push(dt)
      if (dts.length > 600) dts.shift()

      analyser.getByteTimeDomainData(tBuf)
      analyser.getFloatFrequencyData(fBuf)

      // RMS — 프로덕션과 **같은 식**이어야 비교가 성립한다.
      let sum = 0
      let crossings = 0
      let prev = (tBuf[0] - 128) / 128
      for (let i = 0; i < tBuf.length; i++) {
        const v = (tBuf[i] - 128) / 128
        sum += v * v
        if (i > 0 && ((v >= 0 && prev < 0) || (v < 0 && prev >= 0))) crossings++
        prev = v
      }
      const rms = Math.sqrt(sum / tBuf.length)
      const zcr = crossings / tBuf.length

      // 주파수: dB → 선형 파워
      const binHz = audioCtx.sampleRate / analyser.fftSize
      let total = 0
      let voice = 0
      let logSum = 0
      let n = 0
      for (let i = 1; i < fBuf.length; i++) {
        const p = Math.pow(10, fBuf[i] / 10)
        total += p
        const hz = i * binHz
        if (hz >= 300 && hz <= 3400) voice += p
        logSum += Math.log(p + 1e-20)
        n++
      }
      const band = total > 0 ? voice / total : 0
      const flat = total > 0 ? Math.exp(logSum / n) / (total / n) : 0

      // 노이즈 플로어 — 최근 3초의 하위 10%
      recent.push(rms)
      if (recent.length > 3000 / (dt || 16)) recent.shift()
      const floor = percentile(recent, 10)

      // 현행 로직 재현 (상수는 dictation.svelte.ts에서 온다)
      const isVoice = rms > SPEECH_RMS
      voiceRun = isVoice ? voiceRun + 1 : 0
      const speech = voiceRun >= VOICE_FRAMES

      scope.push({ rms, floor })
      if (scope.length > 900) scope.shift()
      draw()

      // 표본 수집은 매 프레임 (정확도), 화면 갱신은 아래에서 묶어서 한다.
      if (recording) {
        recording.samples.rms.push(rms)
        recording.samples.band.push(band)
        recording.samples.zcr.push(zcr)
        recording.samples.flat.push(flat)
        if (recording.until - now <= 0) finishSegment()
      }

      // 표시값만 묶어서 내보낸다
      if (now - lastPublishAt >= PUBLISH_MS) {
        lastPublishAt = now
        live = { rms, floor, band, zcr, flat, speech, voicing: isVoice }
        if (recording) {
          const left = recording.until - now
          segProgress = Math.min(100, (1 - left / SEG_MS) * 100)
          segStatus = `${SEG_LABEL[recording.key]} 측정 중… ${(left / 1000).toFixed(1)}초 남음`
        }
        if (dts.length >= 30) {
          const med = percentile(dts, 50)
          loopStat = {
            dtMedian: med,
            hz: Math.round(1000 / med),
            voiceFramesMs: med * VOICE_FRAMES
          }
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function draw() {
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    const W = canvas.width
    const H = canvas.height
    g.clearRect(0, 0, W, H)
    const MAX = 0.3
    const y = (v: number) => H - Math.min(1, v / MAX) * H

    g.strokeStyle = '#d92d20'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(0, y(SPEECH_RMS))
    g.lineTo(W, y(SPEECH_RMS))
    g.stroke()

    if (!scope.length) return
    const step = W / scope.length

    g.strokeStyle = '#6b7280'
    g.setLineDash([6, 6])
    g.beginPath()
    scope.forEach((s, i) => (i ? g.lineTo(i * step, y(s.floor)) : g.moveTo(0, y(s.floor))))
    g.stroke()
    g.setLineDash([])

    g.strokeStyle = '#2979ff'
    g.lineWidth = 2
    g.beginPath()
    scope.forEach((s, i) => (i ? g.lineTo(i * step, y(s.rms)) : g.moveTo(0, y(s.rms))))
    g.stroke()
  }

  function startSegment(key: SegKey) {
    if (!analyser) {
      segStatus = '먼저 마이크를 시작해야 한다.'
      return
    }
    recording = {
      key,
      until: performance.now() + SEG_MS,
      samples: { rms: [], band: [], zcr: [], flat: [] }
    }
    isRecording = true
  }

  function finishSegment() {
    if (!recording) return
    const { key, samples } = recording
    recording = null
    isRecording = false
    segProgress = 0
    segStatus = `${SEG_LABEL[key]} 완료 (${samples.rms.length} 표본)`
    segments = { ...segments, [key]: samples }
  }

  /** 소음이 가장 커질 때(p95)와 발화가 가장 작아질 때(p10)를 견준다. */
  let verdict = $derived.by(() => {
    if (!allMeasured) return null
    const noiseHigh = percentile(segments.noise!.rms, 95)
    const quietLow = percentile(segments.quiet!.rms, 10)
    const normalLow = percentile(segments.normal!.rms, 10)
    const margin = quietLow / noiseHigh
    // 권고값은 기하평균 — 양쪽에서 같은 배율만큼 떨어진 지점이다.
    const suggested = Math.sqrt(noiseHigh * quietLow)
    const bandNoise = percentile(segments.noise!.band, 50)
    const bandQuiet = percentile(segments.quiet!.band, 50)

    let tone: 'ok' | 'warn' | 'bad' = 'ok'
    let head = '에너지 기준만으로 분리된다.'
    if (margin < 1.5) {
      tone = 'bad'
      head =
        '에너지만으로는 분리되지 않는다. 임계값을 어디에 두든 한쪽이 틀린다 — ' +
        '학습된 VAD(Silero 등)나 "VAD 실패가 데이터를 잃지 않는 구조"가 필요하다.'
    } else if (margin < 3) {
      tone = 'warn'
      head = '여유가 빠듯하다. 적응형 임계값 + 음성대역비를 같이 봐야 한다.'
    }

    const currentSays =
      SPEECH_RMS > quietLow
        ? `작은 발화(p10 ${fmt(quietLow)})보다 높다 — 조용한 반응을 통째로 놓친다.`
        : SPEECH_RMS < noiseHigh
          ? `배경 소음(p95 ${fmt(noiseHigh)})보다 낮다 — 잡음이 발화로 잡힌다.`
          : '이 환경에서는 소음과 발화 사이에 있다 (적정).'

    return {
      tone,
      head,
      noiseHigh,
      quietLow,
      normalLow,
      margin,
      suggested,
      currentSays,
      bandNoise,
      bandQuiet,
      bandHelps: bandQuiet > bandNoise * 1.3
    }
  })

  function snapshot() {
    const stat = (a: number[]) => ({
      n: a.length,
      p10: percentile(a, 10),
      p50: percentile(a, 50),
      p90: percentile(a, 90),
      p95: percentile(a, 95),
      max: a.length ? Math.max(...a) : null
    })
    const track = stream?.getAudioTracks?.()[0]
    return {
      measuredAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      sampleRate: audioCtx?.sampleRate ?? null,
      mic: track?.label ?? null,
      trackSettings: track?.getSettings?.() ?? null,
      requestedConstraints: { ...constraints },
      loop: {
        rafIntervalMedianMs: loopStat.dtMedian,
        estimatedHz: loopStat.hz,
        voiceFramesActualMs: loopStat.voiceFramesMs
      },
      currentConstants: { SPEECH_RMS, VOICE_FRAMES, SILENCE_MS, MIN_CLIP_MS, MAX_CLIP_MS },
      segments: Object.fromEntries(
        Object.entries(segments).map(([k, s]) => [
          k,
          { rms: stat(s!.rms), band: stat(s!.band), zcr: stat(s!.zcr), flatness: stat(s!.flat) }
        ])
      ),
      verdict: verdict
        ? {
            noiseP95: verdict.noiseHigh,
            quietSpeechP10: verdict.quietLow,
            normalSpeechP10: verdict.normalLow,
            separationMargin: verdict.margin,
            suggestedSpeechRms: verdict.suggested
          }
        : null
    }
  }

  async function copyJson() {
    const text = JSON.stringify(snapshot(), null, 2)
    jsonText = text
    try {
      await navigator.clipboard.writeText(text)
      copyLabel = '복사됨'
      setTimeout(() => (copyLabel = '측정값 JSON 복사'), 1500)
    } catch {
      copyLabel = '복사 실패 — 아래에서 직접 선택'
    }
  }

  function reset() {
    segments = {}
    jsonText = ''
    segStatus = '—'
  }

  $effect(() => () => stop())

  const SEG_KEYS: SegKey[] = ['noise', 'normal', 'quiet']
</script>

<svelte:head><title>VAD 임계값 측정</title></svelte:head>

<div class="mx-auto max-w-5xl p-6 text-gray-900">
  <h1 class="text-xl font-semibold">VAD 임계값 측정</h1>
  <p class="mt-1 text-sm text-gray-500">
    로르샤하 받아쓰기의 <code class="rounded bg-gray-100 px-1">SPEECH_RMS</code> ·
    <code class="rounded bg-gray-100 px-1">VOICE_FRAMES</code>를 실측으로 정한다.
    상수는 <code class="rounded bg-gray-100 px-1">dictation.svelte.ts</code>에서 직접 읽는다.
    <b>실제 검사와 같은 기기·마이크·방·거리</b>에서 재야 의미가 있다.
  </p>

  <!-- 1. 마이크 -->
  <section class="mt-5 rounded-lg border border-gray-200 bg-white p-4">
    <h2 class="mb-3 text-sm font-semibold">1. 마이크 열기</h2>
    <div class="flex flex-wrap items-center gap-2">
      <button
        class="rounded-lg bg-blue-600 px-3.5 py-2 text-sm text-white disabled:opacity-40"
        disabled={running}
        onclick={start}>마이크 시작</button
      >
      <button
        class="rounded-lg border border-gray-200 px-3.5 py-2 text-sm disabled:opacity-40"
        disabled={!running}
        onclick={stop}>중지</button
      >
      <span class="text-sm text-gray-500">{status}</span>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
      {#each [['echoCancellation', 'echoCancellation'], ['noiseSuppression', 'noiseSuppression'], ['autoGainControl', 'autoGainControl']] as [key, label] (key)}
        <label class="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={constraints[key as keyof typeof constraints]}
            disabled={running}
            onchange={(e) =>
              (constraints = { ...constraints, [key]: e.currentTarget.checked })}
          />
          {label}
        </label>
      {/each}
      <span>— 켠 상태가 프로덕션(<code class="rounded bg-gray-100 px-1">audio: true</code>)의 기본값이다. 끄고 다시 재서 비교할 것.</span>
    </div>
  </section>

  <!-- 2. 실시간 계기 -->
  <section class="mt-4 rounded-lg border border-gray-200 bg-white p-4">
    <h2 class="mb-3 text-sm font-semibold">2. 실시간 계기</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
      {#each [{ l: 'RMS', n: '현행 판정 기준', v: fmt(live.rms) }, { l: '노이즈 플로어', n: '최근 3초 p10', v: fmt(live.floor) }, { l: '음성대역비', n: '300–3400Hz 비중', v: fmt(live.band, 3) }, { l: '영교차율', n: 'ZCR', v: fmt(live.zcr, 3) }, { l: '스펙트럼 평탄도', n: '1에 가까울수록 잡음', v: fmt(live.flat, 3) }] as m (m.l)}
        <div class="rounded-lg bg-gray-50 px-3 py-2.5">
          <div class="text-xs text-gray-500">{m.l} <span class="text-[11px]">({m.n})</span></div>
          <div class="text-xl font-semibold tabular-nums">{m.v}</div>
        </div>
      {/each}
      <div class="rounded-lg bg-gray-50 px-3 py-2.5">
        <div class="text-xs text-gray-500">현행 로직 판정</div>
        <div
          class="text-xl font-semibold"
          class:text-emerald-700={live.speech}
          class:text-gray-400={!live.speech}
        >
          {live.speech ? '발화' : live.voicing ? '(대기)' : '침묵'}
        </div>
        <div class="text-[11px] text-gray-500">
          SPEECH_RMS={SPEECH_RMS} · VOICE_FRAMES={VOICE_FRAMES}
        </div>
      </div>
    </div>
    <p class="mt-3.5 mb-1.5 text-sm text-gray-500">
      최근 12초 RMS — 가로 실선이 현행 임계값 <code class="rounded bg-gray-100 px-1">{SPEECH_RMS}</code>,
      점선이 노이즈 플로어다.
    </p>
    <canvas bind:this={canvas} width="1800" height="280" class="block h-36 w-full rounded-lg bg-white"
    ></canvas>
  </section>

  <!-- 3. 구간 측정 -->
  <section class="mt-4 rounded-lg border border-gray-200 bg-white p-4">
    <h2 class="mb-1 text-sm font-semibold">3. 구간 측정</h2>
    <p class="mb-3 text-sm text-gray-500">각 10초. 세 개를 다 재야 권고가 나온다.</p>
    <div class="flex flex-wrap gap-2">
      {#each SEG_KEYS as key (key)}
        <button
          class="rounded-lg border border-gray-200 px-3.5 py-2 text-sm disabled:opacity-40"
          disabled={!running || isRecording}
          onclick={() => startSegment(key)}
        >
          {SEG_LABEL[key]}
          <span class="text-gray-500">({SEG_HINT[key]})</span>
        </button>
      {/each}
    </div>
    <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
      <div class="h-full bg-blue-600" style="width: {segProgress}%"></div>
    </div>
    <div class="mt-1.5 text-sm text-gray-500">{segStatus}</div>

    <table class="mt-4 w-full border-collapse text-sm tabular-nums">
      <thead>
        <tr class="text-xs text-gray-500">
          {#each ['구간', '표본', 'RMS p10', 'p50', 'p90', 'p95', '최대', '음성대역비 p50'] as h, i (h)}
            <th class="border-b border-gray-200 px-2 py-1.5 {i === 0 ? 'text-left' : 'text-right'} font-medium">{h}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each SEG_KEYS as key (key)}
          {@const s = segments[key]}
          <tr>
            <td class="border-b border-gray-200 px-2 py-1.5 text-left">{SEG_LABEL[key]}</td>
            {#if s}
              {#each [String(s.rms.length), fmt(percentile(s.rms, 10)), fmt(percentile(s.rms, 50)), fmt(percentile(s.rms, 90)), fmt(percentile(s.rms, 95)), fmt(Math.max(...s.rms)), fmt(percentile(s.band, 50), 3)] as cell, i (i)}
                <td class="border-b border-gray-200 px-2 py-1.5 text-right">{cell}</td>
              {/each}
            {:else}
              <td class="border-b border-gray-200 px-2 py-1.5 text-right text-gray-400" colspan="7">
                미측정
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <!-- 4. 결과 -->
  <section class="mt-4 rounded-lg border border-gray-200 bg-white p-4">
    <h2 class="mb-3 text-sm font-semibold">4. 결과</h2>
    {#if !verdict}
      <p class="text-sm text-gray-500">세 구간을 모두 측정하면 여기에 권고가 나온다.</p>
    {:else}
      <div
        class="rounded-lg border px-3.5 py-3 text-sm leading-7"
        class:border-emerald-600={verdict.tone === 'ok'}
        class:bg-emerald-50={verdict.tone === 'ok'}
        class:border-orange-500={verdict.tone === 'warn'}
        class:bg-orange-50={verdict.tone === 'warn'}
        class:border-red-600={verdict.tone === 'bad'}
        class:bg-red-50={verdict.tone === 'bad'}
      >
        <b>{verdict.head}</b><br />
        소음 p95 <b>{fmt(verdict.noiseHigh)}</b> · 작은 발화 p10 <b>{fmt(verdict.quietLow)}</b>
        · 평상시 발화 p10 {fmt(verdict.normalLow)} → 분리 여유
        <b>{verdict.margin.toFixed(2)}배</b><br />
        현행 <code class="rounded bg-white/60 px-1">SPEECH_RMS = {SPEECH_RMS}</code>는
        {verdict.currentSays}<br />
        이 환경 기준 권고값: <b>{fmt(verdict.suggested)}</b><br />
        음성대역비 중앙값 — 소음 {fmt(verdict.bandNoise, 3)} / 작은 발화
        {fmt(verdict.bandQuiet, 3)}
        {verdict.bandHelps
          ? '→ 대역비를 같이 보면 더 잘 갈린다.'
          : '→ 대역비만으로는 큰 차이가 없다.'}
      </div>
    {/if}
    <div class="mt-3.5 flex flex-wrap gap-2">
      <button
        class="rounded-lg border border-gray-200 px-3.5 py-2 text-sm disabled:opacity-40"
        disabled={!verdict}
        onclick={copyJson}>{copyLabel}</button
      >
      <button class="rounded-lg border border-gray-200 px-3.5 py-2 text-sm" onclick={reset}>
        전부 지우고 다시
      </button>
    </div>
    {#if jsonText}
      <pre class="mt-3 max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{jsonText}</pre>
    {/if}
  </section>

  <!-- 부록 -->
  <section class="mt-4 rounded-lg border border-gray-200 bg-white p-4">
    <h2 class="mb-1 text-sm font-semibold">부록 — 루프 주기</h2>
    <p class="mb-3 text-sm text-gray-500">
      현행 코드는 <code class="rounded bg-gray-100 px-1">requestAnimationFrame</code>으로 판정하고,
      <code class="rounded bg-gray-100 px-1">VOICE_FRAMES = {VOICE_FRAMES}</code>를 "≈80ms"라고
      주석에 적어 두었다. 그건 60Hz 가정이다. 이 기기에서 실제로 몇 ms인지 잰다.
    </p>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
      {#each [{ l: 'rAF 간격 중앙값', v: loopStat.dtMedian ? `${loopStat.dtMedian.toFixed(1)} ms` : '—' }, { l: '추정 주사율', v: loopStat.hz ? `${loopStat.hz} Hz` : '—' }, { l: `VOICE_FRAMES=${VOICE_FRAMES}의 실제 시간`, v: loopStat.voiceFramesMs ? `${loopStat.voiceFramesMs.toFixed(0)} ms` : '—' }] as m (m.l)}
        <div class="rounded-lg bg-gray-50 px-3 py-2.5">
          <div class="text-xs text-gray-500">{m.l}</div>
          <div class="text-xl font-semibold tabular-nums">{m.v}</div>
        </div>
      {/each}
    </div>
  </section>
</div>
