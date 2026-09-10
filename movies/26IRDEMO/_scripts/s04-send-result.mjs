#!/usr/bin/env node
// s04 준비 — **센터가 결과를 전송한다**(진짜 API). 받는 쪽 조회 테이크(B)의 전제다.
//
// 왜 필요한가: 바로링크 목록의 `결과지 보기`는 `report_available`이 켜져야 뜨고, 그 값은
//   status == completed && report_document_id && **is_report_visible_to_guardian**
// 인데 마지막 플래그는 오직 **결과 전송**(create_send_result)이 켠다(케이스 단위 일괄).
// SQL로 플래그만 뒤집지 않는 이유는 그것이 제품이 하는 일이 아니기 때문이다 — 여기서는
// 상담사 계정으로 실제 엔드포인트를 부른다(s08이 김원장의 답을 실제 API로 남긴 것과 같은 원칙).
//
//   node _scripts/s04-send-result.mjs            # 바로링크가 가리키는 케이스에 결과 전송
//
// 되돌리기: `_scripts/s04-task-reset.sql`이 공개 플래그까지 되돌린다.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const API = process.env.S04_API ?? 'http://localhost:3502'
const STATE = path.resolve('_state/local-saas-counselor1.json')

const psql = (q) =>
  execSync(`docker exec saas-postgres psql -U imomtae -d imomtae -t -A -c ${JSON.stringify(q)}`)
    .toString().trim()

const caseId = psql('select case_id from assessment_send_links order by created_at desc limit 1')
if (!caseId) { console.error('바로링크가 없다 — s04 보내는 쪽을 먼저 돌려라'); process.exit(1) }

// 제출이 안 돼 있으면 먼저 제출한다 — 결과 전송은 완료된 검사에만 붙는다.
// 링크 토큰으로 제품 경로 그대로 낸다(로그인 경로와 같은 submit_task_handler · actor_id=None).
const [linkId, code] = psql(
  "select id||'|'||verification_code from assessment_send_links order by created_at desc limit 1"
).split('|')
const verified = await (await fetch(`${API}/api/v1/assessment-send-links/${linkId}/verify`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ verification_code: code })
})).json()

for (const t of verified.tasks ?? []) {
  if (['submitted', 'completed'].includes(t.status)) continue
  const detail = await (await fetch(`${API}/api/v1/assessment-send-links/${linkId}/tasks/${t.task_id}`, {
    headers: { Authorization: `Bearer ${verified.access_token}` }
  })).json()
  const questions = detail?.assessment?.definition?.questions ?? []
  // 화면이 보내는 모양 그대로다(+page.svelte:870-879) — `value`가 아니라 **`answer_value`**이고
  // `current_item`이 있어야 채점·보고서까지 간다. 형식이 어긋나면 `completed`는 되는데
  // 보고서가 안 생겨 결과 전송이 "보고서가 준비된 검사가 없습니다"로 막힌다(실측).
  const body = {
    workflow_type: detail?.assessment?.workflow_type ?? 'self_report',
    responses: questions.map((q, i) => ({
      question_number: q.number ?? q.question_number ?? i + 1,
      answer_value: 2
    })),
    current_item: questions.length
  }
  const res = await fetch(`${API}/api/v1/assessment-send-links/${linkId}/tasks/${t.task_id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${verified.access_token}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) { console.error(`제출 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1) }
  console.log(`제출 — ${t.assessment_name} (문항 ${questions.length})`)
}

const state = JSON.parse(fs.readFileSync(STATE, 'utf8'))
const cookie = Object.fromEntries(state.cookies.map((c) => [c.name, c.value]))
if (!cookie.accessToken) { console.error(`토큰 없음 — login.mjs로 ${STATE}를 다시 만들어라`); process.exit(1) }

// 라우터 prefix가 `/centers/{center_id}`다(send_result/router.py:41)
const res = await fetch(`${API}/api/v1/centers/${cookie.currentCenterId}/assessment-cases/${caseId}/send-result`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cookie.accessToken}`,
    'X-Center-Id': cookie.currentCenterId ?? ''
  },
  body: JSON.stringify({
    recipients: [{ name: '윤보호', phone: '01033360118', relation: '엄마' }],
    channel: 'sms'
  })
})
const body = await res.text()
if (!res.ok) { console.error(`결과 전송 실패 ${res.status}\n${body.slice(0, 400)}`); process.exit(1) }

// 한 줄로 — execSync에 줄바꿈이 섞이면 psql -c가 깨진다
console.log('결과 전송 완료 —', psql(
  `select t.status||' · 보고서 '||(t.report_document_id is not null)::text||' · 공개 '||t.is_report_visible_to_guardian::text from assessment_tasks t where t.case_id='${caseId}' and t.report_document_id is not null`))
