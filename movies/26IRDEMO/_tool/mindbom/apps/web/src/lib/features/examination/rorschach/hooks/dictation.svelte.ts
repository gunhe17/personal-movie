/**
 * 음성 전사 모드 — 발화를 감지해 그 구간만 전사한다.
 *
 * 문서 §3-3의 "반응 단위 즉시 배치"를 화면 쪽에서 구현한 것이다.
 * 스트리밍을 쓰지 않는다: whisper 인코더는 입력이 3초든 30초든 항상 30초
 * mel을 처리하므로, 1초마다 갱신하면 같은 하드웨어에서 배치 대비 15배
 * 느리고 지연이 누적된다.
 *
 * **경계는 사람이 정한다.** VAD는 "언제 전사를 보낼지"만 정하고, 결과는
 * 입력란에 이어붙기만 한다. 반응 확정(Enter)은 임상가의 몫이다 —
 * 한 반응이 침묵으로 끊길 수 있어(“박쥐 같아요… 날개가 펴져 있어서”)
 * VAD 경계를 반응 경계로 삼으면 한 반응이 두 개로 쪼개져 R이 틀어진다.
 *
 * 시간 좌표계는 recording.svelte.ts와 같은 원칙을 따른다 — MediaRecorder의
 * start 이벤트를 t=0으로 본다.
 */

/**
 * 음량이 이보다 크면 발화로 본다 (0..1 정규화 RMS).
 *
 * 노트북 내장 마이크의 상시 노이즈는 보통 0.005~0.02에 걸친다 — 0.015는
 * 그 위에 얹혀 조용한 방에서도 발화로 잡혔다. 사람의 평상시 말소리는
 * 0.05를 넘으므로 여유를 두고 올린다.
 *
 * 실제 환경에서 다시 재려면 `/dev/vad` 측정 페이지를 쓴다. 그 페이지는
 * 이 상수들을 **여기서 import한다** — 값을 베껴 두면 이쪽을 고쳤을 때
 * 측정 페이지가 옛 값으로 조용히 거짓 판정을 낸다.
 *
 * 예전 측정 페이지는 `static/`에 있었는데, 거기 두면 프로덕션에 그대로
 * 배포돼서 지웠다. `/dev`는 라우트 가드가 프로덕션에서 404를 낸다.
 */
export const SPEECH_RMS = 0.05

/**
 * 이만큼 연속으로 발화 판정돼야 "말이 시작됐다"고 본다.
 *
 * 프레임 하나(≈16ms)로 판정하면 키보드 소리·문 닫는 소리 한 번에
 * 녹음이 시작된다. 5프레임이면 약 80ms — 사람의 말소리는 이보다 길다.
 *
 * ⚠️ "≈16ms"는 60Hz 가정이다. rAF 주기는 기기의 주사율을 따르므로
 * 120Hz에서는 같은 5프레임이 40ms가 된다. `/dev/vad`가 이 기기의 실제
 * 주기를 잰다.
 */
export const VOICE_FRAMES = 5
/** 이만큼 조용하면 발화가 끝났다고 본다 */
export const SILENCE_MS = 1200
/** 이보다 짧은 조각은 보내지 않는다 — 잡음 한 번에 문장이 생겨난다 */
export const MIN_CLIP_MS = 400
/** 이보다 길어지면 끊어서 보낸다 — whisper는 30초를 넘기면 잘린다 */
export const MAX_CLIP_MS = 25_000

export type DictationPhase = 'idle' | 'recording' | 'transcribing'

/** 전사된 조각이 **언제의 말이었는지** — 주인을 찾는 데 쓴다. */
export interface DictationClip {
  /** 조각 녹음이 시작된 시각(벽시계). 앞쪽 침묵을 포함한다. */
  startedAt: Date
  /** 조각을 끊은 시각 — 발화가 끝나고 침묵이 확인된 순간 */
  endedAt: Date
}

export interface DictationOptions {
  /** 조각 하나가 준비됐다 — 전사해서 텍스트를 돌려준다 */
  transcribe: (clip: Blob, durationSec: number) => Promise<string>
  /**
   * 전사된 텍스트가 왔다 (빈 문자열이면 인식 실패).
   *
   * `clip`이 **어느 발화였는지**를 말한다. 전사는 비동기라 도착 순간에는
   * 이미 다음 반응이 진행 중일 수 있다 — 도착 시점으로 주인을 정하면
   * 텍스트가 한 칸씩 밀린다. 호출부는 이 시각으로 주인을 찾아야 한다.
   */
  onText: (text: string, clip: DictationClip) => void
  onError?: (message: string) => void
}

export function createDictation(opts: DictationOptions) {
  let phase = $state<DictationPhase>('idle')
  /** 지금 소리가 들리는가 — 화면이 말하는 중임을 보여줄 때 쓴다 */
  let speaking = $state(false)

  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let rafId: number | null = null

  let chunks: Blob[] = []
  let clipStartedAt = 0
  let lastVoiceAt = 0
  /** 이번 조각에 실제 발화가 있었는가 — 없으면 보내지 않는다 */
  let hadVoice = false
  /** 연속으로 발화 판정된 프레임 수 — 순간 잡음을 거른다 */
  let voiceRun = 0
  /** 조각을 끊는 중 — 이 사이 판정을 멈춘다(중복 전송 방지) */
  let flushing = false
  /** 전사 요청이 겹치지 않게 — 이전 요청이 끝나기 전에 다음을 보내지 않는다 */
  let inFlight = 0

  async function start(): Promise<boolean> {
    if (phase !== 'idle') return false

    if (!navigator.mediaDevices?.getUserMedia) {
      // getUserMedia는 보안 컨텍스트(HTTPS 또는 localhost)에서만 노출된다.
      opts.onError?.(
        window.isSecureContext
          ? '이 브라우저는 마이크 녹음을 지원하지 않습니다.'
          : '마이크는 보안 연결(HTTPS) 또는 localhost에서만 쓸 수 있습니다.'
      )
      return false
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      opts.onError?.('마이크 권한이 필요합니다.')
      return false
    }

    audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)

    beginClip()
    phase = 'recording'
    watch()
    return true
  }

  /** 새 조각을 시작한다 — MediaRecorder를 조각마다 새로 만든다. */
  function beginClip() {
    if (!stream) return
    chunks = []
    hadVoice = false
    voiceRun = 0
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstart = () => {
      // t=0은 start 호출이 아니라 start 이벤트다 — 호출 시점을 쓰면
      // 첫 샘플보다 수십 ms 빨라 구간이 어긋난다.
      clipStartedAt = performance.now()
      lastVoiceAt = clipStartedAt
    }
    recorder.start()
  }

  /**
   * 조각을 끊어 전사로 보낸다.
   *
   * 발화가 없었으면 보내지 않는다 — 침묵을 whisper에 넣으면 한국어는
   * "시청해주셔서 감사합니다" 같은 환각을 만들어낸다. 로르샤하는
   * 반응잠재시간이 임상 지표라 침묵이 길어 정확히 그 발동 조건이다.
   */
  function flushClip(thenStop: boolean) {
    const rec = recorder
    if (!rec || rec.state === 'inactive') {
      if (thenStop) finish()
      return
    }

    // 끊는 동안 판정을 멈춘다 — onstop이 올 때까지 tick이 계속 돌기 때문에
    // 막지 않으면 같은 조각을 여러 번 보낸다.
    flushing = true

    const durationMs = performance.now() - clipStartedAt
    const voiced = hadVoice
    // performance.now()는 페이지 기준 상대시각이다. 주인을 찾으려면 반응 생성
    // 시각(Date)과 같은 자를 써야 하므로 timeOrigin을 더해 벽시계로 옮긴다.
    const clip: DictationClip = {
      startedAt: new Date(performance.timeOrigin + clipStartedAt),
      endedAt: new Date(performance.timeOrigin + performance.now())
    }

    rec.onstop = () => {
      const blob = chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null
      chunks = []

      const worth = blob && voiced && durationMs >= MIN_CLIP_MS
      if (worth) void send(blob, durationMs / 1000, clip)

      if (thenStop) {
        finish()
      } else {
        beginClip()
        flushing = false
      }
    }
    rec.stop()
  }

  async function send(blob: Blob, durationSec: number, clip: DictationClip) {
    inFlight += 1
    if (phase !== 'recording') phase = 'transcribing'
    try {
      const text = await opts.transcribe(blob, durationSec)
      // 빈 문자열도 그대로 넘긴다 — 호출부가 "인식 실패"를 표시할 수 있다.
      opts.onText(text, clip)
    } catch {
      opts.onError?.('전사에 실패했습니다.')
    } finally {
      inFlight -= 1
      // 아직 녹음 중이면 recording으로 되돌린다. 마지막 요청이 끝나야 idle.
      if (inFlight === 0) phase = recorder ? 'recording' : 'idle'
    }
  }

  /** 음량을 계속 보며 발화 시작·종료를 판정한다. */
  function watch() {
    if (!analyser) return
    const buf = new Uint8Array(analyser.fftSize)

    const tick = () => {
      if (!analyser) return
      analyser.getByteTimeDomainData(buf)

      // 0..255에서 128이 무음 기준선 — 편차의 RMS를 본다.
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)

      const now = performance.now()
      const isVoice = rms > SPEECH_RMS
      speaking = isVoice
      if (isVoice) {
        // 짧은 딸깍 소리 하나로 발화가 시작됐다고 보지 않는다 —
        // 연속으로 이어져야 사람이 말하는 것이다.
        voiceRun += 1
        if (voiceRun >= VOICE_FRAMES) {
          hadVoice = true
          lastVoiceAt = now
        }
      } else {
        voiceRun = 0
      }

      const silentFor = now - lastVoiceAt
      const clipFor = now - clipStartedAt

      // flushing 중에는 판정하지 않는다. flushClip은 비동기(rec.onstop)라
      // 새 recorder가 생기기 전에 tick이 몇 번 더 도는데, 그때 조건이 여전히
      // 참이면 같은 조각을 여러 번 보내게 된다.
      if (!flushing) {
        // 발화가 있었고 충분히 조용해졌으면 한 조각이 끝난 것이다.
        if (hadVoice && silentFor >= SILENCE_MS) flushClip(false)
        // 너무 길어지면 끊는다 — whisper가 30초를 넘기면 잘린다.
        // **발화가 있었을 때만** 끊는다. 조용한데도 끊으면 25초마다
        // MediaRecorder를 헛되이 재생성한다.
        else if (hadVoice && clipFor >= MAX_CLIP_MS) flushClip(false)
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  /** 남은 조각까지 보내고 멈춘다. */
  function stop() {
    if (phase === 'idle') return
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    flushClip(true)
  }

  function finish() {
    recorder = null
    speaking = false
    flushing = false
    voiceRun = 0
    hadVoice = false
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    void audioCtx?.close()
    audioCtx = null
    analyser = null
    // 전사가 아직 돌고 있으면 그 완료가 idle로 되돌린다.
    if (inFlight === 0) phase = 'idle'
  }

  function toggle() {
    if (phase === 'idle') void start()
    else stop()
  }

  function dispose() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    try {
      recorder?.stop()
    } catch {
      // 이미 멈춘 상태면 무시 — 정리 중이므로 실패해도 할 일이 없다
    }
    recorder = null
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    void audioCtx?.close()
    audioCtx = null
    analyser = null
    phase = 'idle'
  }

  return {
    get phase() {
      return phase
    },
    get speaking() {
      return speaking
    },
    toggle,
    stop,
    dispose
  }
}
