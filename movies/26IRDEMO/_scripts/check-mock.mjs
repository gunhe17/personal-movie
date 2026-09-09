#!/usr/bin/env node
// 목 연동 자체 점검 — node _scripts/check-mock.mjs
// 러너가 거는 sessionStorage 키가 제품 스토어의 KEY와 같은지, _mocks/*.json이 형식을 지키는지.
// 제품이 KEY를 v3로 올리면 촬영은 조용히 목 없이 돌아간다 — 그걸 여기서 깬다.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const store = fs.readFileSync(path.join(ROOT, '_tool/saas-center-platform/apps/web/src/lib/features/agent-mock/store.svelte.ts'), 'utf8')
const runner = fs.readFileSync(path.resolve(ROOT, '../../.claude/skills/capture-service/scripts/capture.mjs'), 'utf8')

const key = store.match(/const KEY = '([^']+)'/)?.[1]
assert.ok(key, '제품 스토어에서 KEY를 못 찾았다')
assert.ok(runner.includes(`'${key}'`), `러너가 거는 키가 제품 KEY(${key})와 다르다 — capture.mjs의 addInitScript를 고쳐라`)

const advance = store.match(/ADVANCE_KEY = '([^']+)'/)?.[1]
assert.equal(advance, 'F9', `다음 턴 키가 ${advance}로 바뀌었다 — SKILL.md와 장면 스크립트의 h.key()를 고쳐라`)

const dir = path.join(ROOT, '_mocks')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
assert.ok(files.length, '_mocks가 비었다')
for (const f of files) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  assert.ok(Array.isArray(s.turns) && s.turns.length, `${f}: turns 배열이 필요하다`)
  for (const [i, t] of s.turns.entries()) {
    const at = `${f} turn[${i}]`
    assert.ok(t.label, `${at}: label이 없다`)
    // 되물음 턴은 사용자 입력을 기다리는 자리 — 여기서 화면을 옮기면 안 된다
    assert.ok(!(t.question && t.tools), `${at}: question 턴에 tools를 넣지 않는다`)
    for (const tool of t.tools ?? []) {
      const fields = tool.args?.fields
      if (!fields) continue
      // 시작시각만 주면 화면이 기본 시간대로 밀린다 (mock-capture 스킬 실측)
      assert.equal(!!fields.start_time, !!fields.end_time, `${at}: start_time과 end_time은 같이 넣는다`)
      if (fields.date) assert.ok(fields.date > new Date().toISOString().slice(0, 10), `${at}: date ${fields.date} — 미래로 둔다`)
    }
  }
}
console.log(`ok — key=${key} · advance=${advance} · mocks=${files.join(', ')}`)
