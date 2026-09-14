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

/** 탭 링 — 촬영본 좌표에 흰 원이 퍼지며 사라진다. 시뮬레이터의 회색 점은 4K 무대 안에서 안 보인다(실측).
    spec.taps: 마크 배열 `[{t,x,y}]` 또는 **촬영 meta 경로**(문자열). meta를 주면 누른 마크와 배율을 거기서 읽는다.
    누른 마크는 폰(시뮬레이터)의 `tap`과 웹(폰 프로파일)의 `click` 둘 다다 — 폰 모양 화면끼리 표시를 통일한다.
    좌표 단위는 기기 논리 좌표(폰은 idb 포인트 · 웹은 CSS px)이고, 촬영본 픽셀로 옮기는 배율은
    `capture.pxPerPoint`(폰 2) 또는 `viewport.dpr`(폰 프로파일 웹 3)다. **무대가 배율을 손으로 받지 않는다** —
    tapRadius가 논리 좌표(pt)라 두 기기의 화면 폭(402pt · 390pt)이 같은 만큼 링도 화면에서 같은 크기로 보인다. */
async function readTaps(spec, specDir){
  let taps = spec.taps, scale = spec.tapScale ?? 2;
  if (typeof taps === 'string'){
    const meta = JSON.parse(await readFile(path.resolve(specDir, taps), 'utf8'));
    scale = spec.tapScale ?? meta.capture?.pxPerPoint ?? meta.viewport?.dpr ?? 2;
    taps = (meta.steps ?? []).filter(m => (m.kind === 'tap' || m.kind === 'click') && m.x != null);
  }
  // 링도 같은 배율로 굽는다 — scale을 같이 돌려준다(전엔 ringClip이 2로 하드코딩해 dpr 3에서 링만 2/3 크기였다)
  return { scale, taps: (taps ?? []).map(m => ({ t: m.t - (spec.start ?? 0), x: m.x * scale, y: m.y * scale })) };   // start만큼 당겨 클립 시간으로
}

/** 링 한 번의 애니메이션을 straight-RGBA 원본 프레임으로 굽는다 — 링은 다 같으니 한 파일을 탭마다 다시 연다.
    **절제가 기본이다** — 손끝만 한 원이 한 번 퍼지고 처음부터 옅어진다. 눌렀다는 걸 알아챌 만큼만.
    흰 띠 양옆에 잉크색 테를 두른다: 흰 시트에서도, 어두운 녹음 화면에서도 같은 원이 보여야 한다(흰 원만 그리면 밝은 화면에서 사라진다). */
async function ringClip(dir, spec, fps, scale){
  const R = (spec.tapRadius ?? 24) * scale;                 // 끝 반지름(포인트). 24pt → 지름 48pt = 화면 폭(402pt)의 12%
  const dur = spec.tapDur ?? 0.34;                          // postTap(450ms)보다 짧다 — 화면이 바뀌기 전에 끝난다
  const aW0 = spec.tapOpacity ?? 0.62;                      // 흰 띠 최대 알파 (컷마다 조절)
  const th = (spec.tapWidth ?? 2) * scale, halo = 1.25 * scale;   // 흰 띠 두께 · 바깥 잉크 테
  const n = Math.max(2, Math.round(dur * fps));
  const S = Math.ceil(R) * 2 + 8, c = (S - 1) / 2;
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const buf = Buffer.alloc(S * S * 4 * n);
  for (let f = 0; f < n; f++){
    const p = f / (n - 1), e = 1 - (1 - p) ** 3;            // ease-out — 빠르게 퍼지고 천천히 선다
    const r = R * (0.35 + 0.65 * e), fade = 1 - p;          // 처음부터 서서히 옅어진다 (가운데 점은 없다 — 링만으로 읽힌다)
    const base = f * S * S * 4;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
      const d = Math.hypot(x - c, y - c), dr = Math.abs(d - r);
      const aW = clamp(th / 2 + .5 - dr) * aW0 * fade;
      const aD = clamp(th / 2 + halo + .5 - dr) * aW0 * .8 * fade;
      const a = aW + (1 - aW) * aD;
      const i = base + (y * S + x) * 4;
      if (a > 0){
        const mix = a === 0 ? 0 : (1 - aW) * aD / a;         // 잉크가 차지하는 몫
        buf[i] = Math.round(255 * (1 - mix) + 0x0E * mix);
        buf[i + 1] = Math.round(255 * (1 - mix) + 0x1B * mix);
        buf[i + 2] = Math.round(255 * (1 - mix) + 0x2E * mix);
        buf[i + 3] = Math.round(a * 255);
      }
    }
  }
  const file = path.join(dir, 'ring.rgba');
  await writeFile(file, buf);
  return { file, S, n };
}

/** 디퍼런스 매트 합성 — 흑/백 무대 두 장에서 정확한 알파를 뽑아 영상 위에 얹는다. ffmpeg 한 번. */
async function compose(black, white, screen, rect, spec, out){
  const [w, h] = spec.size;
  const isVideo = /\.(mov|mp4|webm|m4v)$/i.test(screen);
  const dur = spec.duration ?? (isVideo ? await probeDuration(screen) - (spec.start ?? 0) : 5);
  await mkdir(path.dirname(out), { recursive: true });
  // 가장자리 안티에일리어싱을 덮으려 촬영본을 사방 1px 크게 얹는다(ov). 그런데 촬영본 크기가 화면 슬롯과 **정확히 같으면**
  // 그 1px 확대가 804→806 리샘플이 되어 1:1이 깨진다(C3.6 4K 실측 PSNR 24dB). 그때는 확대 없이 그대로 얹는다.
  let ov = 1, sw = null, sh = null;
  if (isVideo || /\.(png|jpe?g)$/i.test(screen)) {
    const { stdout: dim } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', screen]);
    [sw, sh] = dim.trim().split(',').map(Number);
    if (sw === rect.w && sh === rect.h) ov = 0;
  }
  const filter =
    // 알파 = 1 − |흰 − 검|. 검정판은 이미 알파가 곱해진 색이라 unpremultiply로 되돌린다
    `[1:v]format=rgb24,split[a1][a2];[2:v]format=rgb24[b];` +   // 한 스트림은 한 번만 소비된다 → split
    `[b][a1]blend=all_mode=difference,format=gray,negate[al];` +
    `[a2][al]alphamerge,unpremultiply=inplace=1[fg];` +
    `[0:v]scale=${rect.w + ov * 2}:${rect.h + ov * 2}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${rect.w + ov * 2}:${rect.h + ov * 2},setsar=1[sv];` +
    `color=c=black:s=${w}x${h}:r=${spec.fps}:d=${dur}[base];` +
    `[base][sv]overlay=${rect.x - ov}:${rect.y - ov}:shortest=1[u]`;
  // 절차 표시줄(steps) — head는 0초부터, hold는 head 뒤에서 tail 앞까지, tail은 끝에. 전부 무대 위 전면 알파 레이어.
  // mov는 ProRes 4444(곱한 알파로 구웠다), png는 straight — overlay의 alpha 모드를 각각 맞춘다(안 맞추면 테두리가 어둡다).
  const L = Object.fromEntries((spec.stepLayers ?? []).map(l => [l.k, l.file]));
  const hd = L.head ? await probeDuration(L.head) : 0, tl = L.tail ? await probeDuration(L.tail) : 0;
  const extra = []; let top = '[u]', n = 3, layers = '';

  // ── 탭 링 ── 촬영본 픽셀 → 무대 좌표는 **눈이 아니라 계산**이다.
  // 위 오버레이가 촬영본을 `scale=…:force_original_aspect_ratio=increase` + crop(=cover)로 슬롯에 앉힌다.
  // 같은 식을 그대로 푼다: 배율 f, crop이 잘라낸 만큼을 빼면 촬영본 (0,0)이 무대 어디인지 나온다.
  const { taps: allTaps, scale: tapScale } = await readTaps(spec, spec.specDir);
  const taps = allTaps.filter(p => p.t >= 0 && p.t < dur);
  if (taps.length && sw){
    const bw = rect.w + ov * 2, bh = rect.h + ov * 2;
    const f = Math.max(bw / sw, bh / sh);
    const ox = (rect.x - ov) - (sw * f - bw) / 2, oy = (rect.y - ov) - (sh * f - bh) / 2;
    const ring = await ringClip(path.dirname(black), spec, spec.fps, tapScale);
    const RS = Math.round(ring.S * f);
    for (const tp of taps){
      extra.push('-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${ring.S}x${ring.S}`, '-framerate', String(spec.fps), '-i', ring.file);
      const cx = Math.round(ox + tp.x * f - RS / 2), cy = Math.round(oy + tp.y * f - RS / 2);
      layers += `;[${n}:v]scale=${RS}:${RS}:flags=lanczos,tpad=start_duration=${tp.t.toFixed(3)}:start_mode=add:color=black@0[r${n}]` +
                `;${top}[r${n}]overlay=${cx}:${cy}:eof_action=pass:repeatlast=0:format=auto[q${n}]`;
      top = `[q${n}]`; n++;
    }
    console.error(`  탭 링 ${taps.length}개 · 논리좌표→촬영본 ${tapScale} · 촬영본→무대 ${f.toFixed(4)} · 지름 ${(2 * (spec.tapRadius ?? 24) * tapScale * f).toFixed(0)}px`);
  }
  layers += `;${top}[fg]overlay=0:0:format=auto[o]`;
  top = '[o]';
  const layer = (args, alpha) => {
    extra.push(...args);
    // 절차 표시줄 자산은 1920×1080이다 — 무대가 그보다 크면(4K) 무대 크기로 늘려 얹는다(안 늘리면 왼쪽 위 1/4에 작게 붙는다)
    layers += `;[${n}:v]scale=${w}:${h}:flags=lanczos[l${n}];${top}[l${n}]overlay=0:0:eof_action=pass:format=auto:alpha=${alpha}[s${n}]`;
    top = `[s${n}]`; n++;
  };
  if (L.head) layer(['-i', L.head], 'premultiplied');
  if (L.hold) layer(['-loop', '1', '-t', String(Math.max(0.1, dur - hd - tl)), '-itsoffset', String(hd), '-i', L.hold], 'straight');
  if (L.tail) layer(['-itsoffset', String(Math.max(0, dur - tl)), '-i', L.tail], 'premultiplied');
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    ...(isVideo ? [...(spec.start ? ['-ss', String(spec.start)] : []), '-i', screen] : ['-loop', '1', '-t', String(dur), '-i', screen]),
    '-loop', '1', '-t', String(dur), '-i', black,
    '-loop', '1', '-t', String(dur), '-i', white,
    ...extra,
    '-filter_complex', filter + layers, '-map', top, '-t', String(dur),
    '-c:v', 'libx264', '-crf', String(spec.crf ?? 14), '-preset', 'slow',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    { maxBuffer: 1 << 26 });
  return dur;
}

async function render(specPath, opts = {}){
  if (!existsSync(CHROME)) die(`Google Chrome이 없다: ${CHROME}`);
  const raw = JSON.parse(await readFile(specPath, 'utf8'));
  const spec = { ...DEFAULTS, ...raw, specDir: path.dirname(path.resolve(specPath)) };
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
  if (raw.steps?.dir){                                           // 절차 표시줄 레이어 — 경로는 spec 기준 dir (steps 무대의 `steps` 이름 배열과 구분)
    const d = path.resolve(path.dirname(specPath), raw.steps.dir);
    spec.stepLayers = ['head', 'hold', 'tail'].filter(k => raw.steps[k]).map(k => ({ k, file: path.join(d, raw.steps[k]) }));
    for (const l of spec.stepLayers) if (!existsSync(l.file)) die(`steps 파일이 없다: ${l.file}`);
  }

  if (screen) still = false;
  const alpha = !spec.matte && (spec.bg === 'transparent' || stage === 'wipe' || (stage === 'logo' && spec.ground0 === 'transparent'));
  const shutter = Math.max(1, Number(spec.shutter ?? 1) | 0);
  if (screen && spec.pull) still = false;
  const ext = screen ? '.mp4' : still ? '.png' : (alpha ? '.mov' : '.mp4');
  // --out은 지금 있는 자리 기준, spec의 out은 **spec 파일 자리 기준**이다 — spec 안의 다른 경로(screen·taps·steps.dir)와 같은 규칙이라야
  // 어느 폴더에서 돌려도 같은 데로 나간다(CWD 기준으로 풀었더니 v2/ 루트에 떨어졌다).
  const out = opts.out ? path.resolve(opts.out)
    : raw.out ? path.resolve(spec.specDir, raw.out)
    : path.resolve(specPath.replace(/\.json$/, ext));

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
  // ④ 폰 무대 · 탭 링 — 링이 실제로 픽셀을 바꾸는지까지 본다(없으면 탭 없는 판과 똑같이 나온다)
  const base = { stage: 'phone', size: [480, 270], fps: 12, screen: 'b.png', duration: 1,
    statusH: 0, homeH: 0, screenBg: 'transparent', shotRatio: 960 / 540, screenRadius: 6.8 };
  const d0 = path.join(dir, 'd0.json'), d1 = path.join(dir, 'd1.json');
  await writeFile(d0, JSON.stringify(base));
  await writeFile(d1, JSON.stringify({ ...base, taps: [{ t: 0.2, x: 240, y: 135 }], tapScale: 2, tapRadius: 30 }));
  const v0 = await render(d0, { out: path.join(dir, 'd0.mp4') }), v1 = await render(d1, { out: path.join(dir, 'd1.mp4') });
  const psnr = await run('ffmpeg', ['-hide_banner', '-i', v1, '-i', v0, '-lavfi', 'psnr', '-f', 'null', '-'])
    .then(r => Number(r.stderr.match(/average:([\d.]+|inf)/)?.[1] ?? NaN));
  assert.ok(psnr < 60, `탭 링이 화면을 안 바꿨다 (PSNR ${psnr})`);
  await rm(dir, { recursive: true, force: true });
  console.error(`✓ selftest 통과 — 무대 셋 · 스틸 · 영상 · 합성 · 탭 링(PSNR ${psnr})`);
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
