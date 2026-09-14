#!/usr/bin/env node
// 카카오톡 명단 PNG — 같은 폴더의 HTML을 Chrome 헤드리스로 @2x 투명 PNG로 굽는다. 설치할 것 없음.
//   node render.mjs
// NN-*.html  → body 상자(내용 + 사방 24px)로 자른다 — 편집에서 메시지 한 개씩 얹는 조각
// 그 밖(kakao-명단.html) → 980×1200 창 한 장 — 합본
import { spawn } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 980, H = 1200, SCALE = 2;

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-color-profile=srgb', '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });   // stdout을 파이프로 받지 않는다 — 로그가 버퍼를 넘긴다
const wsUrl = await new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('Chrome DevTools 포트를 못 읽었다')), 15000);
  chrome.stderr.on('data', d => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m) { clearTimeout(to); res(m[0]); } });
});
const port = new URL(wsUrl).port;

try {
  for (const f of readdirSync(HERE).filter(f => f.endsWith('.html')).sort()) {
    const piece = /^\d\d-/.test(f);
    const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURI('file://' + path.join(HERE, f))}`, { method: 'PUT' })).json();
    const ws = new WebSocket(tgt.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });   // 없으면 흰 배경
    let rect = null;
    for (let i = 0; i < 100 && !rect; i++) {   // 로드 + 웹폰트(IBM Plex Sans KR)까지 기다린다
      const { result } = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
        if (document.readyState !== 'complete' || !location.href.startsWith('file:')) return null;
        await document.fonts.ready;
        // body(padding 24px, inline-block)째로 자른다 — 첫 요소 상자로 자르면 기운 종이의 그림자와 글자 그림자가 잘린다.
        // 여백이 사방 같아 내용의 중심은 그대로다
        const b = document.body.getBoundingClientRect();
        return { x: b.left, y: b.top, width: b.width, height: b.height };
      })()` });
      rect = result?.result?.value ?? null;
      if (!rect) await new Promise(r => setTimeout(r, 100));
    }
    if (!rect) throw new Error(`${f}: 페이지가 뜨지 않았다`);
    const clip = piece ? { ...rect, scale: 1 } : { x: 0, y: 0, width: W, height: H, scale: 1 };
    const { result } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
    if (!result?.data) throw new Error(`${f}: 캡처 실패`);
    const out = path.join(HERE, f.replace(/\.html$/, '.png'));
    writeFileSync(out, Buffer.from(result.data, 'base64'));
    console.log(`✓ ${path.basename(out)}`);
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${tgt.id}`).catch(() => {});
  }
} finally {
  chrome.kill();
}
