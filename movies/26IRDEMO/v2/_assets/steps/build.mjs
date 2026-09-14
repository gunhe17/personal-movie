#!/usr/bin/env node
// 씬 상단 절차 표시줄 — steps.json을 읽어 흐름(기존 · 우리)마다 굽는다. 무대는 motion-stage의 steps.
//   node build.mjs          전부
//   node build.mjs S1 S4    그 씬만
// 산출물 SN-흐름/: 00_in.mov · 01.png · 01-02.mov · 02.png · … · 99_out.mov  (mov = ProRes 4444 알파, 1920×1080 · 30fps)
// 편집: 위 트랙 0,0에 이름순으로 깐다. 이동 클립의 첫/끝 프레임이 앞뒤 PNG와 같다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.resolve(HERE, '../../../../../.claude/skills/motion-stage/scripts/render.mjs');
const T = { in: 0.6, move: 0.6, out: 0.5 };
const pad = n => String(n).padStart(2, '0');

const cfg = JSON.parse(readFileSync(path.join(HERE, 'steps.json'), 'utf8'));
const only = process.argv.slice(2);
const spec = path.join(mkdtempSync(path.join(tmpdir(), 'steps-')), 'spec.json');

for (const [scene, flows] of Object.entries(cfg.scenes)){
  if (only.length && !only.includes(scene)) continue;
  for (const [flow, steps] of Object.entries(flows)){
    const dir = path.join(HERE, `${scene}-${flow}`);
    mkdirSync(dir, { recursive: true });
    const base = { stage: 'steps', size: [1920, 1080], fps: 30, bg: 'transparent', steps, ...cfg.flows[flow] };
    const jobs = [['00_in.mov', { from: 0, to: 1, duration: T.in }]];
    steps.forEach((_, i) => {
      const k = i + 1;
      jobs.push([`${pad(k)}.png`, { from: k, to: k }]);
      if (k < steps.length) jobs.push([`${pad(k)}-${pad(k + 1)}.mov`, { from: k, to: k + 1, duration: T.move }]);
    });
    jobs.push(['99_out.mov', { from: steps.length, to: 0, duration: T.out }]);
    for (const [name, s] of jobs){
      writeFileSync(spec, JSON.stringify({ ...base, ...s }));
      execFileSync('node', [RENDER, spec, '--out', path.join(dir, name)], { stdio: 'inherit' });
    }
  }
}
