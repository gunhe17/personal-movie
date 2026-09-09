/**
 * 받아쓰기 촬영용 배선 — 마이크와 전사 모델만 갈아 끼운다.
 *
 * 제품 경로는 그대로 돈다: getUserMedia → VAD(RMS·침묵) → 조각 → 전사 요청 →
 * 화면에 이어붙기. 우리가 바꾸는 것은 둘뿐이다.
 *
 *   1. 마이크  — Chromium에 WAV 파일을 마이크로 물린다(`--use-file-for-fake-audio-capture`).
 *      말소리·침묵이 번갈아 드는 파형이라 VAD가 진짜처럼 조각을 끊는다.
 *   2. 전사    — `/transcribe-clip`을 가로채 대본의 다음 줄을 돌려준다.
 *      목 에이전트와 같은 원칙이다: 촬영 중에 모델을 부르지 않는다(테이크마다 글자가 달라진다).
 *
 * 대본을 다 쓰면 빈 문자열을 돌려준다 — 제품이 `if (!text) return`으로 무시하므로
 * WAV가 계속 루프해도 화면에 아무 일도 안 생긴다.
 */
import fs from 'node:fs'
import path from 'node:path'

/** VAD 상수(dictation.svelte.ts)에 맞춘 파형 — 말 1.2초 뒤 침묵 1.6초면 조각 하나가 끊긴다 */
const LEAD_S = 0.1, SPEECH_S = 1.2, TAIL_S = 1.6
const RATE = 48000
/** 잡음 RMS ≈ 0.17. 제품의 발화 문턱 SPEECH_RMS=0.05보다 넉넉히 위 */
const AMP = 0.3

/** 말–침묵이 번갈아 드는 16bit PCM WAV를 만든다 (없을 때만) */
export function ensureWav(file) {
  if (fs.existsSync(file)) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const n = Math.round((LEAD_S + SPEECH_S + TAIL_S) * RATE)
  const pcm = Buffer.alloc(n * 2)
  const from = Math.round(LEAD_S * RATE), to = Math.round((LEAD_S + SPEECH_S) * RATE)
  for (let i = from; i < to; i++) {
    // 가장자리를 재워 툭 끊기는 소리(클릭)를 없앤다 — 클릭 하나가 발화로 잡힌다
    const edge = Math.min(1, Math.min(i - from, to - i) / (0.05 * RATE))
    pcm.writeInt16LE(Math.round((Math.random() * 2 - 1) * AMP * edge * 32767), i * 2)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22); head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28)
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
  fs.writeFileSync(file, Buffer.concat([head, pcm]))
  return file
}

/** 브라우저 실행 인자 — 마이크 권한을 묻지 않고 이 WAV를 마이크로 쓴다 */
export function sttArgs(wav) {
  return ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`]
}

/** 전사 응답을 대본으로 갈아 끼운다. `lines`를 순서대로 하나씩 돌려준다 */
export async function installStt(context, lines) {
  const queue = [...lines]
  await context.route('**/transcribe-clip', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(queue.length
        ? { text: queue.shift(), detected: true }
        : { text: '', detected: false })   // 대본 소진 — 제품이 무시한다
    }))
}
