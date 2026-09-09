// Drives @ffmpeg/core directly. The official @ffmpeg/ffmpeg UMD wrapper resolves its
// worker against a hardcoded "file:///home/jeromewu/..." base and cannot load here.
let core = null, logLines = [];

self.onmessage = async ({data}) => {
  try {
    if (data.cmd === 'load') {
      const t0 = performance.now();
      importScripts(data.coreURL);
      core = await self.createFFmpegCore({
        mainScriptUrlOrBlob: data.coreURL + '#' + btoa(JSON.stringify({
          wasmURL: data.wasmURL, workerURL: data.coreURL.replace(/\.js$/, '.worker.js')})),
      });
      core.setLogger(e => { if (e.message) logLines.push(e.message); });
      core.setProgress(() => {});
      return postMessage({ok: true, load_ms: performance.now() - t0});
    }
    if (data.cmd === 'run') {
      logLines = [];
      core.FS.writeFile('in.mp4', new Uint8Array(data.buf));
      const t0 = performance.now();
      core.setTimeout(-1);
      core.exec(...data.args);
      const exit = core.ret;
      core.reset();
      const ms = performance.now() - t0;
      let out = null;
      try { out = core.FS.readFile('out.mp4'); } catch (e) {}
      try { core.FS.unlink('in.mp4'); core.FS.unlink('out.mp4'); } catch (e) {}
      return postMessage({ok: true, exec_ms: ms, exit, bytes: out ? out.byteLength : 0,
                          log: logLines.slice(-6)});
    }
  } catch (e) {
    postMessage({ok: false, error: String(e && e.message || e), log: logLines.slice(-6)});
  }
};
