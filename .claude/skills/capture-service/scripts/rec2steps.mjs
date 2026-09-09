#!/usr/bin/env node
// rec2steps.mjs — Playwright codegen 기록(_rec-sNN.js)을 장면 스크립트 초안(sNN-<action>.mjs)으로 바꾼다.
//   node rec2steps.mjs _scripts/_rec-s01.js > _scripts/s01-receive.mjs
// 로케이터는 codegen이 준 그대로 h.click/h.type에 넘긴다(human.mjs가 Locator를 받는다).
// 사람이 할 일: note 채우기, beat/modal/nocut 넣기, 불필요한 클릭 지우기.
import fs from 'node:fs'
const src = fs.readFileSync(process.argv[2], 'utf8')
const out = []
let startUrl = null
for (const raw of src.split('\n')) {
  const l = raw.trim()
  let m
  if ((m = l.match(/^await page\.goto\('([^']+)'\);?$/))) { if (!startUrl) startUrl = m[1]; else out.push(`  // goto ${m[1]}`); continue }
  if ((m = l.match(/^await (page\..+)\.click\(\);?$/)))            { out.push(`  await h.click(${m[1]}, '')`); continue }
  if ((m = l.match(/^await (page\..+)\.fill\('((?:[^'\\]|\\.)*)'\);?$/))) { out.push(`  await h.type(${m[1]}, '${m[2]}')`); continue }
  if ((m = l.match(/^await (page\..+)\.press\('([^']+)'\);?$/)))   { out.push(`  await page.keyboard.press('${m[2]}'); await h.hold(400, '${m[2]}')`); continue }
  if ((m = l.match(/^await (page\..+)\.check\(\);?$/)))            { out.push(`  await h.click(${m[1]}, '체크')`); continue }
  if ((m = l.match(/^await (page\..+)\.selectOption\((.+)\);?$/))) { out.push(`  await ${m[1]}.selectOption(${m[2]}); await h.hold(600, '선택')`); continue }
  if (/^(import|const|test\(|\}\)|await context|await browser|await page\.close|const page|const context|const browser|\(async|headless|colorScheme|storageState|viewport|height|width|\}|\/\/ -+)/.test(l) || l === '' || l === '});') continue
  out.push(`  // 미변환: ${l}`)
}
process.stdout.write(`// ${process.argv[2]} 에서 변환. 시작 URL: ${startUrl ?? '(기록 없음)'}
// 할 일: note 채우기 · 상태가 바뀐 곳에 h.beat('…') · 모달 뒤 h.modal() · 노컷 구간 h.nocutStart/End · 필요 없는 클릭 삭제
export default async function steps(page, h) {
  await h.beat('첫 화면')
${out.join('\n')}
  await h.hold(1500, '끝')
}
`)
