#!/usr/bin/env node
/**
 * 화면 위반 재스캔 → data/audit.json 갱신 (휴리스틱 — 정밀 감사는 에이전트 재실행)
 * 사용: node scripts/audit-screens.mjs (레포 루트 기준 상대 경로 자동 탐지)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const HERE = new URL('.', import.meta.url).pathname;
const REPO = join(HERE, '../../../../');
const WEB = join(REPO, 'apps/web/src');

const VOCAB = { '내담자':'subject', '아동':'subject', '보호자':'guardianRel', '형제':'guardianRel', '상담사':'staff' };
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
    if (!/\.(svelte|ts)$/.test(name)) continue;
    const rel = relative(join(REPO,'apps/web'), p);
    const lines = readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [word, concept] of Object.entries(VOCAB)) {
        // UI 문자열 리터럴 안의 도메인 어휘만 (주석·import 제외 휴리스틱)
        if ((line.includes(`'`) || line.includes('"') || line.includes('`') || /^\s*[가-힣]/.test(line.trim())) &&
            line.includes(word) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          violations.push({ type:'vocab_hardcode', concept, file: rel, line: i+1, code: line.trim().slice(0,80), note: `'${word}' 리터럴` });
          break;
        }
      }
      if (/role\s*===?\s*['"](guardian|both|client)['"]/.test(line))
        violations.push({ type:'role_branch', concept:'guardianRel', file: rel, line: i+1, code: line.trim().slice(0,80), note:'enum 직접 분기' });
    });
  }
}
walk(WEB);
const summary = {};
for (const v of violations) summary[v.type] = (summary[v.type]||0)+1;
summary.total = violations.length;
const out = { audited_at: new Date().toISOString().slice(0,10), method: 'scripts/audit-screens.mjs (휴리스틱 재스캔)', summary, violations };
writeFileSync(join(HERE, '../data/audit.json'), JSON.stringify(out, null, 2));
console.log('audit.json regenerated:', summary);
