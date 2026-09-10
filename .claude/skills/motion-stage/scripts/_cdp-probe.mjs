// CDP 단일 프로세스 캡처 실험 — Chrome 한 번 띄우고, 프레임마다 render(t) 평가 + 스크린샷. 의존성 0 (Node 22 WebSocket/fetch).
import { spawn } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [W, H, N, FPS] = [1920, 1080, 60, 30];

// 무대: motion-stage icons 무대에 spec 주입
const stageSrc = await readFile('/Users/gunhee/workspace/codespace/service/personal-movie/.claude/skills/motion-stage/scripts/stages/icons.html','utf8');
const spec = { duration: 2, fps: FPS, size:[W,H], bg:'transparent', ink:'#3F5B66', push:0.03,
  beats:[{icon:'phone',at:0.2,x:0.3,y:0.4,size:0.2,drift:[0.05,0.06]},{icon:'chat',at:0.6,x:0.7,y:0.4,size:0.2}],
  face:{x:0.5,y:0.7,size:0.3,at:0.1,change:1.0} };
const stage = path.resolve('stage.html');
await writeFile(stage, stageSrc.replace('/*__SPEC__*/ null', JSON.stringify(spec)));

const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--no-sandbox',
  '--disable-lcd-text','--force-color-profile=srgb','--remote-debugging-port=0','--remote-allow-origins=*',
  `--window-size=${W},${H}`, 'about:blank'], { stdio:['ignore','ignore','pipe'] });
const wsBrowser = await new Promise(res => chrome.stderr.on('data', d => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m) res(m[0]); }));
const port = new URL(wsBrowser).port;
const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?file://${stage}`, { method:'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id:i, method, params})); });

await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
await send('Emulation.setDefaultBackgroundColorOverride', { color:{ r:0,g:0,b:0,a:0 } });
await send('Page.enable');
await new Promise(r => setTimeout(r, 400));               // 페이지 로드 여유 (실전에선 loadEventFired)
const t0 = Date.now();
for (let i = 0; i < N; i++){
  await send('Runtime.evaluate', { expression: `render(${(i/FPS).toFixed(4)})` });
  const { result } = await send('Page.captureScreenshot', { format:'png', fromSurface:true });
  await writeFile(`f${String(i).padStart(4,'0')}.png`, Buffer.from(result.data, 'base64'));
}
const dt = (Date.now() - t0) / 1000;
console.log(`CDP: ${N}프레임 ${W}×${H} 알파 → ${dt.toFixed(1)}s = ${(N/dt).toFixed(1)} fps`);
ws.close(); chrome.kill();
