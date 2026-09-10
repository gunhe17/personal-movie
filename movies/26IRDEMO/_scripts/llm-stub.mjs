#!/usr/bin/env node
// 촬영용 LLM 대역 — **모델만 갈아 끼운다.** s01의 목 에이전트 · s02의 목 전사와 같은 원칙이다
// (촬영 규칙 5: 촬영 중 진짜 LLM을 부르지 않는다 — 테이크마다 문안이 달라지면 컷이 안 맞는다).
//
// 대본은 여기 없다. 제품 자신의 `production_ai_configs.system_prompt`에 들어 있고
// (s07-setup.sql이 넣는다) 이 서버는 그 안의 JSON 블록을 **그대로 받아쓴다.**
// 즉 제품 경로(파이프라인 → AIFacade → AIGateway → provider → llm_calls 기록 → upsert)는
// 전부 진짜로 돌고, 바뀌는 것은 마지막 한 홉인 모델 응답뿐이다.
//
//   node _scripts/llm-stub.mjs &            # :3599
//   .env → OPENAI_API_KEY=local-stub · OPENAI_BASE_URL=http://localhost:3599/v1
//
// 로컬에 OPENAI 키가 없어 s07이 60초 타임아웃으로 막혔던 자리다(2026-09-11).
import http from 'node:http'

const PORT = Number(process.env.LLM_STUB_PORT ?? 3599)

/** 시스템 프롬프트에서 첫 번째 최상위 JSON 객체를 꺼낸다 — 중괄호 균형으로 자른다 */
function extractJson(text) {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}

/**
 * 전사 대역 — `POST /v1/audio/transcriptions`.
 *
 * 시뮬레이터에는 사람의 말이 없다. 앱이 올리는 오디오는 방 안의 잡음이라 진짜 Whisper를 불러도
 * 나올 것이 없고, 부를 키도 없다. 그래서 **모델만 갈아 끼운다** — s02가 웹에서 `/transcribe-clip`을
 * 대본으로 답한 것과 같다(촬영 규칙 5). 제품 경로(업로드 → 청크 → 전사 요청 → 화면에 이어붙이기)는 그대로 돈다.
 *
 * 대본은 s06-setup.sql이 DB에 넣는 **윤도현 1회기 전사**의 앞부분이다. 부를 때마다 다음 줄을 돌려주고,
 * 다 쓰면 빈 문자열을 준다(제품이 빈 전사를 무음으로 처리한다).
 */
const TRANSCRIPT = [
  '도현아, 지난번 검사 때 얘기했던 거 기억나?',
  '…네. 근데 별로 안 해요, 딱히 할 말이 없어서.',
  '학교에서는 어때? 친구들이랑은.',
  '애들이랑 축구도 하고 그래요.',
  '이런 것도 말해도 돼요?',
  '무엇을 말해도 괜찮아. 여기서는 그래도 돼.',
  '말하면 걱정하잖아요. 그냥 제가 참으면 되니까요.',
  '참는 동안 몸은 어때? 잠은 잘 자?',
  '잠이 잘 안 와요. 한 2~3주 됐어요.',
  '오늘 말해 줘서 고마워. 그 이야기를 같이 보자.'
]
let sttCursor = 0

http.createServer((req, res) => {
  let body = ''
  // 오디오는 multipart 바이너리다 — 위 전사 분기가 본문을 읽기 전에 끊으므로 문자열 누적은 무해하다
  req.on('data', (d) => (body += d))
  req.on('end', () => {
    // ── 전사 ─────────────────────────────────────────────────────────────
    if (req.url.includes('/audio/transcriptions')) {
      const text = TRANSCRIPT[sttCursor] ?? ''
      console.error(`[llm-stub] 전사 ${sttCursor + 1}/${TRANSCRIPT.length} "${text.slice(0, 16)}…"`)
      sttCursor++
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ text, language: 'korean', duration: 4.0, segments: [] }))
      return
    }

    if (!req.url.endsWith('/chat/completions')) { res.writeHead(404).end('{}'); return }
    let content = '{}'
    try {
      const msgs = JSON.parse(body).messages ?? []
      const sys = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
      content = extractJson(sys) ?? extractJson(msgs.map((m) => m.content).join('\n')) ?? '{}'
    } catch { /* 그대로 빈 객체 */ }
    console.error(`[llm-stub] ${content.length}자 받아씀`)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      id: 'chatcmpl-stub', object: 'chat.completion', created: Math.floor(Date.now() / 1000),
      model: 'local-stub',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    }))
  })
}).listen(PORT, () => console.error(`[llm-stub] :${PORT}`))
