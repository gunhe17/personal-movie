// Shared measurement primitives. index.html and render.html predate this file and keep
// their own copies; they are validated, so they were left alone rather than retrofitted.
const STAGE = () => document.getElementById('stage');

const withTimeout = (p, ms, w) => Promise.race([p,
  new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT ' + w)), ms))]);

const stats = a => { const s=[...a].sort((x,y)=>x-y), q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))];
  return {n:s.length, min:+s[0].toFixed(1), med:+q(.5).toFixed(1), p95:+q(.95).toFixed(1), max:+s[s.length-1].toFixed(1)}; };

const nextPainted = v => new Promise(r => v.requestVideoFrameCallback((now, md) => r({now, md})));
const raf = () => new Promise(r => requestAnimationFrame(r));

function mkVideo(url){
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  v.style.width = '150px'; STAGE().appendChild(v); return v;
}
const ready = v => new Promise((res, rej) => { if (v.readyState >= 2) return res();
  v.addEventListener('loadeddata', () => res(), {once:true});
  v.addEventListener('error', () => rej(new Error('재생 불가 코덱/컨테이너')), {once:true}); });

const COMMON_FPS = [23.976,24,25,29.97,30,48,50,59.94,60,120];
async function detectFps(v){
  v.currentTime = Math.min(0.5, v.duration/4); await nextPainted(v);
  const mt = []; await v.play().catch(()=>{});
  await new Promise(res => { const cb=(n,md)=>{mt.push(md.mediaTime); mt.length<25?v.requestVideoFrameCallback(cb):res();};
    v.requestVideoFrameCallback(cb); });
  v.pause();
  const d = []; for (let i=1;i<mt.length;i++){ const x=mt[i]-mt[i-1]; if (x>1e-4) d.push(x); }
  if (!d.length) return 30;
  d.sort((a,b)=>a-b);
  const raw = 1/d[Math.floor(d.length/2)];
  const near = COMMON_FPS.reduce((b,c)=>Math.abs(c-raw)<Math.abs(b-raw)?c:b);
  return Math.abs(near-raw)/near < 0.02 ? near : +raw.toFixed(3);
}

// frame-by-frame stepping via currentTime, from a start offset inside the clip
async function tStep(v, fps, n=60, s0=null){
  const s = s0 != null ? s0 : Math.min(5, v.duration*0.2);
  n = Math.min(n, Math.max(5, Math.floor((v.duration - s - 0.2)*fps)));
  v.currentTime = s + 0.5/fps; await nextPainted(v);
  const lat = [];
  for (let i=1;i<=n;i++){ const t=performance.now();
    v.currentTime = s + (i+0.5)/fps; await nextPainted(v); lat.push(performance.now()-t); }
  return stats(lat);
}

async function tSeek(v, n=30){
  const lat = [], span = Math.max(0.2, v.duration - 1.0);
  for (let i=0;i<n;i++){ const t0=performance.now();
    v.currentTime = 0.5 + Math.random()*span*0.95; await nextPainted(v); lat.push(performance.now()-t0); }
  return stats(lat);
}

function demux(buf){
  return new Promise((resolve, reject) => {
    const file = MP4Box.createFile(); const chunks = []; let cfg = null, total = 0;
    file.onError = e => reject(new Error('mp4box: ' + e));
    file.onReady = info => {
      const tr = info.videoTracks[0]; total = tr.nb_samples;
      const trak = file.getTrackById(tr.id); let desc = null;
      for (const e of trak.mdia.minf.stbl.stsd.entries){
        const box = e.avcC || e.hvcC || e.vpcC || e.av1C;
        if (box){ const st = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
          box.write(st); desc = new Uint8Array(st.buffer, 8); break; }
      }
      cfg = {codec: tr.codec, codedWidth: tr.video.width, codedHeight: tr.video.height,
             description: desc, hardwareAcceleration: 'prefer-hardware', optimizeForLatency: true};
      file.setExtractionOptions(tr.id, null, {nbSamples: 1e6}); file.start();
    };
    file.onSamples = (id, u, samples) => {
      for (const s of samples) chunks.push(new EncodedVideoChunk({type: s.is_sync ? 'key' : 'delta',
        timestamp: 1e6*s.cts/s.timescale, duration: 1e6*s.duration/s.timescale, data: s.data}));
      if (chunks.length >= total) resolve({cfg, chunks});
    };
    setTimeout(() => reject(new Error('demux stalled')), 25000);
    const b = buf.slice(0); b.fileStart = 0; file.appendBuffer(b); file.flush();
  });
}

// bounded queue between a fast producer and a slow consumer
function gate(limit){
  let inflight = 0, waiter = null;
  return {
    async acquire(){ if (inflight >= limit) await new Promise(r => waiter = r); inflight++; },
    release(){ inflight--; if (waiter && inflight < limit){ const w = waiter; waiter = null; w(); } },
  };
}
