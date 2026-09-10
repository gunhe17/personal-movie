#!/usr/bin/env node
// 무대 렌더러 — HTML 무대를 Chrome 헤드리스로 굽고 ffmpeg으로 잇는다.
// 설치할 것 없음: /Applications/Google Chrome.app + ffmpeg 만 쓴다.
//
//   node render.mjs <spec.json> [--stage icons|imac|cards] [--out path] [--fps 30] [--keep-frames]
//   node render.mjs --selftest
//
// spec 에 duration 이 있으면 영상(CDP 한 프로세스로 캡처), 없으면 스틸 PNG.
// wipe 무대: matte:true → 루마 매트 mp4, 아니면 RGBA ProRes 4444(premultiplied). shutter:4 → 4배로 찍고 tmix 평균.
// imac 무대에 screen(영상·이미지 경로)이 있으면: 무대를 화면 검정/흰색으로 두 장 굽고,
// 둘의 차이로 정확한 알파를 만들어(디퍼런스 매트) 그 아래로 영상을 깐다. Chrome은 두 번만 뜬다.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STAGES = path.join(HERE, 'stages');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CONCURRENCY = 4;

const die = m => { console.error(`✗ ${m}`); process.exit(1); };
const DEFAULTS = { fps: 30, size: [1920, 1080], bg: '#E9EAEA', ink: '#191E21', push: 0.02, beats: [], face: null };

const chromeArgs = (w, h, out, url) => [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
  '--disable-lcd-text', '--force-color-profile=srgb',
  '--disable-component-update', '--no-first-run', '--no-default-browser-check',
  `--window-size=${w},${h}`, `--screenshot=${out}`,
  '--default-background-color=00000000', '--virtual-time-budget=400',
  url
];

async function buildStage(stage, spec, dir){
  const file = path.join(STAGES, `${stage}.html`);
  if (!existsSync(file)) die(`그런 무대가 없다: ${stage} (${STAGES})`);
  const html = (await readFile(file, 'utf8')).replace('/*__SPEC__*/ null', JSON.stringify(spec));
  const out = path.join(dir, 'stage.html');
  await writeFile(out, html);
  return out;
}

/** Chrome은 업데이터까지 따라 붙어 stderr를 쏟는다 — 파이프로 받지 않고 버린다.
    (execFile로 받으면 버퍼가 넘쳐 죽는다. 실측으로 40프레임쯤에서 터졌다.)
    종료 코드가 0이 아니어도 스크린샷이 나왔으면 성공으로 본다. */
const chromeOnce = (args, out) => new Promise((res, rej) => {
  const p = spawn(CHROME, args, { stdio: 'ignore' });
  const kill = setTimeout(() => p.kill('SIGKILL'), 60000);
  p.on('error', rej);
  p.on('close', () => {
    clearTimeout(kill);
    existsSync(out) ? res() : rej(new Error(`프레임을 못 만들었다: ${out}`));
  });
});

/** 병렬로 돌리면 Chrome이 이따금 스크린샷을 안 남긴다 — 한 번은 다시 시켜 본다. */
async function chromeShot(args, out){
  try { return await chromeOnce(args, out); }
  catch { return await chromeOnce(args, out); }
}

/** 흑/백 두 장의 차이가 밝은 곳 = 화면. 같은 그림에서 읽는다 — 다른 실행에서 재면 레이아웃이 어긋난다. */
async function matteRect(black, white){
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-i', black, '-i', white, '-filter_complex',
    '[1:v][0:v]blend=all_mode=difference,format=gray,bbox=min_val=16,metadata=print', '-f', 'null', '-'],
    { maxBuffer: 1 << 24 });
  const g = k => { const m = stderr.match(new RegExp(`lavfi\\.bbox\\.${k}=(\\d+)`)); return m ? Number(m[1]) : null; };
  const x1 = g('x1'), x2 = g('x2'), y1 = g('y1'), y2 = g('y2');
  if ([x1, x2, y1, y2].some(v => v === null)) die('무대에서 화면 자리를 못 찾았다 (흑/백 차이가 없다)');
  return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
}

/** CDP 한 프로세스 캡처 — Chrome을 한 번 띄우고 프레임마다 render(t)를 평가해 찍는다.
    프레임마다 스폰하는 것보다 15배 빠르다(실측 17.5 vs 1.2 fps). 의존성 0 — Node 22의 WebSocket·fetch. */
/** 화면 소스를 프레임으로 펼친다 — 무대 폭으로 줄여서 (원본 해상도로 뽑으면 수 GB가 버려진다). */
async function explodeScreen(screen, spec, dir, inFps, duration){
  const out = path.join(dir, 'shot');
  await mkdir(out, { recursive: true });
  const isVideo = /\.(mov|mp4|webm|m4v)$/i.test(screen);
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    ...(isVideo ? [] : ['-loop', '1']), '-i', screen, '-t', String(duration),
    '-vf', `fps=${inFps},scale=${spec.size[0]}:-2:flags=lanczos`, path.join(out, 's%05d.png')], { maxBuffer: 1 << 26 });
  const files = (await readdir(out)).filter(f => f.endsWith('.png')).sort();
  assert.ok(files.length, '화면 소스에서 프레임을 못 뽑았다');
  return files.map(f => path.join(out, f));
}

async function captureCDP(stageFile, spec, dir, n, inFps, query = '', shots = null){
  const [w, h] = spec.size;
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
    '--disable-lcd-text', '--force-color-profile=srgb', '--disable-component-update', '--no-first-run',
    '--remote-debugging-port=0', '--remote-allow-origins=*', `--window-size=${w},${h}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('Chrome DevTools 포트를 못 읽었다')), 15000);
    chrome.stderr.on('data', d => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m){ clearTimeout(to); res(m[0]); } });
  });
  let ws;
  try {
    const port = new URL(wsUrl).port;
    const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?file://${stageFile}${query}`, { method: 'PUT' })).json();
    ws = new WebSocket(tgt.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });  // 없으면 흰 배경
    await send('Page.enable');
    for (let i = 0; i < 60; i++){   // 로드 + render 정의 대기
      const { result } = await send('Runtime.evaluate', { expression: 'document.readyState === "complete" && typeof render === "function"', returnByValue: true });
      if (result?.result?.value) break;
      await new Promise(r => setTimeout(r, 100));
    }
    for (let i = 0; i < n; i++){
      const shot = shots ? `, ${JSON.stringify('file://' + shots[Math.min(i, shots.length - 1)])}` : '';
      await send('Runtime.evaluate', { expression: `render(${(i / inFps).toFixed(5)}${shot})`, awaitPromise: true });
      const { result } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      if (!result?.data) throw new Error(`프레임 ${i} 캡처 실패`);
      await writeFile(path.join(dir, `f${String(i).padStart(5, '0')}.png`), Buffer.from(result.data, 'base64'));
      if ((i + 1) % 30 === 0 || i + 1 === n) process.stderr.write(`\r  프레임 ${i + 1}/${n}`);
    }
    process.stderr.write('\n');
  } finally {
    try { ws?.close(); } catch {}
    chrome.kill();
  }
}

async function shootFrames(stageFile, spec, dir, { fill = null, name = 'f' } = {}){
  const n = spec.duration ? Math.round(spec.duration * spec.fps) : 1;
  const [w, h] = spec.size;
  const jobs = [...Array(n).keys()];
  let done = 0;

  const shoot = async i => {
    const t = (i / spec.fps).toFixed(4);
    const out = path.join(dir, `${name}${String(i).padStart(5, '0')}.png`);
    await chromeShot(chromeArgs(w, h, out, `file://${stageFile}?t=${t}${fill ? `&fill=${fill}` : ''}`), out);
  };

  let failed = null;
  const results = await Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, n) }, async () => {
    while (jobs.length && !failed){
      const i = jobs.shift();
      try { await shoot(i); }
      catch (e) { failed = e; throw e; }
      if (++done % 10 === 0 || done === n) process.stderr.write(`\r  프레임 ${done}/${n}`);
    }
  }));
  const bad = results.find(r => r.status === 'rejected');
  if (bad) throw bad.reason;
  if (n > 1) process.stderr.write('\n');
  return n;
}

const probeDuration = async f => {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]);
  return parseFloat(stdout.trim());
};

async function encodeSequence(dir, spec, out, { inFps = null, shutter = 1, alpha = false } = {}){
  await mkdir(path.dirname(out), { recursive: true });
  const vf = [];
  if (alpha) vf.push('premultiply=inplace=1');            // PNG는 straight, ProRes 4444는 곱한 값을 기대한다 (실측)
  if (shutter > 1) vf.push(`tmix=frames=${shutter}`, `framestep=${shutter}`);   // 시간 슈퍼샘플링 = 셔터
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(inFps ?? spec.fps), '-i', path.join(dir, 'f%05d.png'),
    ...(vf.length ? ['-vf', vf.join(',')] : []), '-r', String(spec.fps),
    ...(alpha ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
              : ['-c:v', 'libx264', '-crf', String(spec.crf ?? 14), '-preset', 'slow', '-pix_fmt', 'yuv420p']),
    out], { maxBuffer: 1 << 26 });
}

/** 디퍼런스 매트 합성 — 흑/백 무대 두 장에서 정확한 알파를 뽑아 영상 위에 얹는다. ffmpeg 한 번. */
async function compose(black, white, screen, rect, spec, out){
  const [w, h] = spec.size;
  const isVideo = /\.(mov|mp4|webm|m4v)$/i.test(screen);
  const dur = spec.duration ?? (isVideo ? await probeDuration(screen) : 5);
  await mkdir(path.dirname(out), { recursive: true });
  const ov = 1;
  const filter =
    // 알파 = 1 − |흰 − 검|. 검정판은 이미 알파가 곱해진 색이라 unpremultiply로 되돌린다
    `[1:v]format=rgb24,split[a1][a2];[2:v]format=rgb24[b];` +   // 한 스트림은 한 번만 소비된다 → split
    `[b][a1]blend=all_mode=difference,format=gray,negate[al];` +
    `[a2][al]alphamerge,unpremultiply=inplace=1[fg];` +
    `[0:v]scale=${rect.w + ov * 2}:${rect.h + ov * 2}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${rect.w + ov * 2}:${rect.h + ov * 2},setsar=1[sv];` +
    `color=c=black:s=${w}x${h}:r=${spec.fps}:d=${dur}[base];` +
    `[base][sv]overlay=${rect.x - ov}:${rect.y - ov}:shortest=1[u];` +
    `[u][fg]overlay=0:0:format=auto[o]`;
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    ...(isVideo ? ['-i', screen] : ['-loop', '1', '-t', String(dur), '-i', screen]),
    '-loop', '1', '-t', String(dur), '-i', black,
    '-loop', '1', '-t', String(dur), '-i', white,
    '-filter_complex', filter, '-map', '[o]', '-t', String(dur),
    '-c:v', 'libx264', '-crf', String(spec.crf ?? 14), '-preset', 'slow',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    { maxBuffer: 1 << 26 });
  return dur;
}

async function render(specPath, opts = {}){
  if (!existsSync(CHROME)) die(`Google Chrome이 없다: ${CHROME}`);
  const raw = JSON.parse(await readFile(specPath, 'utf8'));
  const spec = { ...DEFAULTS, ...raw };
  if (opts.fps) spec.fps = opts.fps;
  const stage = opts.stage || raw.stage || 'icons';
  let still = !spec.duration;
  const screen = raw.screen ? path.resolve(path.dirname(specPath), raw.screen) : null;
  if (raw.logo){                                                 // logo 무대: SVG 파일을 읽어 spec에 넣는다
    const lp = path.resolve(path.dirname(specPath), raw.logo);
    if (!existsSync(lp)) die(`logo 파일이 없다: ${lp}`);
    spec.logoSvg = await readFile(lp, 'utf8');
  }
  if (raw.assets) spec.assets = 'file://' + path.resolve(path.dirname(specPath), raw.assets);   // cards 무대: 이미지 폴더
  if (raw.areas){                                                // cards 무대: file:// 페이지는 fetch가 안 되므로 JSON을 spec에 넣는다
    const d = path.resolve(path.dirname(specPath), raw.areas);
    spec.areasData = {};
    for (let n = 1; n <= 10; n++){ const f = path.join(d, `card-${n}.json`); if (existsSync(f)) spec.areasData[n] = JSON.parse(await readFile(f, 'utf8')).areas; }
  }
  if (screen && !existsSync(screen)) die(`screen 파일이 없다: ${screen}`);

  if (screen) still = false;
  const alpha = !spec.matte && (spec.bg === 'transparent' || stage === 'wipe' || (stage === 'logo' && spec.ground0 === 'transparent'));
  const shutter = Math.max(1, Number(spec.shutter ?? 1) | 0);
  if (screen && spec.pull) still = false;
  const ext = screen ? '.mp4' : still ? '.png' : (alpha ? '.mov' : '.mp4');
  const out = path.resolve(opts.out || raw.out || specPath.replace(/\.json$/, ext));

  const dir = await mkdtemp(path.join(tmpdir(), 'stage-'));
  try {
    const stageFile = await buildStage(stage, spec, dir);
    console.error(`· ${stage} · ${path.basename(specPath)} → ${spec.size.join('×')}${still && !screen ? ' 스틸' : ` ${spec.duration ?? '자동'}s @ ${spec.fps}fps`}`);

    if (screen && spec.pull){                                   // 애니메이션 목업 — 프레임마다 화면이 바뀐다
      if (!spec.duration) spec.duration = (spec.pull.hold || 0) + (spec.pull.duration || 1.2) + 0.4;
      const inFps = spec.fps * shutter, n = Math.round(spec.duration * inFps);
      const shots = await explodeScreen(screen, spec, dir, inFps, spec.duration);
      console.error(`  화면 프레임 ${shots.length}장 · 카메라 풀백`);
      await captureCDP(stageFile, spec, dir, n, inFps, '', shots);
      await encodeSequence(dir, spec, out, { inFps, shutter, alpha: false });
      const d = await probeDuration(out);
      console.error(`✓ ${out}  ${d.toFixed(2)}s · ${n}프레임${shutter > 1 ? ` (셔터 ×${shutter})` : ''}`);
    } else if (screen){
      const still = { ...spec, duration: null };
      await shootFrames(stageFile, still, dir, { fill: 'black', name: 'k' });
      await shootFrames(stageFile, still, dir, { fill: 'white', name: 'w' });
      const black = path.join(dir, 'k00000.png'), white = path.join(dir, 'w00000.png');
      const rect = await matteRect(black, white);
      console.error(`  화면 자리 ${rect.w}×${rect.h} @ ${rect.x},${rect.y}`);
      const t0 = Date.now();
      const d = await compose(black, white, screen, rect, spec, out);
      assert.ok(existsSync(out), '합성 결과가 없다');
      console.error(`✓ ${out}  ${d.toFixed(2)}s · 합성 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } else if (still){
      await shootFrames(stageFile, spec, dir);
      await mkdir(path.dirname(out), { recursive: true });
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
        '-i', path.join(dir, 'f00000.png'), out]);
      console.error(`✓ ${out}`);
    } else {
      const inFps = spec.fps * shutter;
      const n = Math.round(spec.duration * inFps);
      await captureCDP(stageFile, spec, dir, n, inFps);
      const got = (await readdir(dir)).filter(f => f.endsWith('.png')).length;
      assert.equal(got, n, `프레임 수가 안 맞는다: ${got}/${n}`);
      await encodeSequence(dir, spec, out, { inFps, shutter, alpha });
      const d = await probeDuration(out);
      assert.ok(Math.abs(d - spec.duration) < 0.2, `길이가 안 맞는다: ${d}s`);
      console.error(`✓ ${out}  ${d.toFixed(2)}s · ${n}프레임${shutter > 1 ? ` (셔터 ×${shutter})` : ''}${alpha ? ' · 알파' : ''}${spec.matte ? ' · 매트' : ''}`);
    }
    return out;
  } finally {
    // 정리 실패가 진짜 원인을 덮으면 안 된다 (ENOTEMPTY로 한 번 크게 헤맸다)
    if (!opts.keepFrames) await rm(dir, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
    else console.error(`  프레임: ${dir}`);
  }
}

async function selftest(){
  const dir = await mkdtemp(path.join(tmpdir(), 'stage-test-'));
  // ① 아이콘 무대 · 영상
  const a = path.join(dir, 'a.json');
  await writeFile(a, JSON.stringify({ duration: 1, fps: 12, size: [480, 270],
    beats: [{ icon: 'phone', at: 0, x: 0.5, y: 0.5 }], face: { x: 0.5, y: 0.8, change: 0.5 } }));
  assert.ok(existsSync(await render(a, { stage: 'icons', out: path.join(dir, 'a.mp4') })));
  // ② iMac 무대 · 스틸
  const b = path.join(dir, 'b.json');
  await writeFile(b, JSON.stringify({ size: [960, 540] }));
  const png = await render(b, { stage: 'imac', out: path.join(dir, 'b.png') });
  assert.ok(existsSync(png));
  // ③ iMac 무대 · 화면 합성 (스틸을 화면으로)
  const c = path.join(dir, 'c.json');
  await writeFile(c, JSON.stringify({ size: [960, 540], duration: 1, fps: 12, screen: 'b.png' }));
  assert.ok(existsSync(await render(c, { stage: 'imac', out: path.join(dir, 'c.mp4') })));
  await rm(dir, { recursive: true, force: true });
  console.error('✓ selftest 통과 — 무대 둘 · 스틸 · 영상 · 합성');
}

const argv = process.argv.slice(2);
const flag = k => { const i = argv.indexOf(k); return i < 0 ? null : argv[i + 1]; };
if (argv[0] === '--selftest') await selftest();
else if (!argv[0] || argv[0].startsWith('--')) die('사용: render.mjs <spec.json> [--stage icons|imac|cards] [--out x.mp4] [--fps 30] [--keep-frames]');
else await render(argv[0], {
  stage: flag('--stage'), out: flag('--out'),
  fps: flag('--fps') ? Number(flag('--fps')) : null,
  keepFrames: argv.includes('--keep-frames')
});
