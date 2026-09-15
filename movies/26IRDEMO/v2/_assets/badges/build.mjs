#!/usr/bin/env node
// 뱃지 · 목차 표시 PNG. 1500×420 알파(투명 여백은 그림자 자리) — 알약은 1920 화면에 얹는 크기 그대로다.
//   node build.mjs
// 흐름 뱃지 둘은 steps.json 색, 목차 표시 다섯은 ../toc/spec.json의 rows 이름을 그대로 쓴다.
// 목차 표시는 모서리 탭 — 캔버스 맨 위에 붙어 있으니 프레임 위쪽 y=0에 그대로 맞춘다(잉크 바탕이라 두 흐름 공용).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const flows = JSON.parse(readFileSync(path.join(HERE, '../steps/steps.json'), 'utf8')).flows;
const rows = JSON.parse(readFileSync(path.join(HERE, '../toc/spec.json'), 'utf8')).rows;

const shot = (q, out) => execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--disable-lcd-text',
  '--force-color-profile=srgb', '--no-first-run', '--default-background-color=00000000',
  '--window-size=1500,420', '--virtual-time-budget=400',
  `--screenshot=${path.join(HERE, out)}`,
  `file://${path.join(HERE, 'badge.html')}?${new URLSearchParams(q)}`,
], { stdio: 'ignore' });

shot({ t: '기존', g: flows.기존.ground, i: flows.기존.ink }, '기존.png');
shot({ t: 'mindscope', g: flows.우리.ground, i: flows.우리.ink }, 'mindscope.png');
rows.forEach((r, k) => {
  const n = String(k + 1).padStart(2, '0');
  shot({ t: r.name, n, m: 'tab', g: '#151A1E', i: '#FFFFFF', a: flows.우리.accent, oa: flows.우리.onAccent },
       `toc-${n}-${r.name.replace(/\s+/g, '')}.png`);
});
