// phone.mjs — iOS 시뮬레이터 조작 헬퍼 (idb). human.mjs의 폰 판. 모든 조작은 marks에 시각을 남긴다.
//   idb: brew tap facebook/fb && brew install idb-companion && python3 -m pip install fb-idb
import { execSync, spawnSync } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function hasIdb() { try { execSync('which idb', { stdio: 'ignore' }); return true } catch { return false } }

export function phone(udid, T, clock) {
  const marks = [], nocut = []
  const mark = (kind, target, note) => marks.push({ t: +clock.now().toFixed(2), kind, target: String(target ?? ''), ...(note ? { note } : {}) })
  const idb = (args) => {
    const r = spawnSync('idb', [...args, '--udid', udid], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`idb ${args.join(' ')}: ${r.stderr.trim()}`)
    return r.stdout
  }
  // 접근성 트리에서 라벨로 요소 찾기 → 중심 좌표(points)
  function find(label) {
    const out = idb(['ui', 'describe-all', '--json'])
    const els = out.split('\n').filter(Boolean).flatMap((l) => { try { const j = JSON.parse(l); return Array.isArray(j) ? j : [j] } catch { return [] } })
    const re = label instanceof RegExp ? label : new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
    const el = els.find((e) => re.test(e.AXLabel ?? '') || re.test(e.AXValue ?? '') || re.test(e.title ?? ''))
    if (!el?.frame) throw new Error(`요소 없음: ${label}`)
    const f = el.frame
    return { x: f.x + f.width / 2, y: f.y + f.height / 2 }
  }
  const at = (target) => (typeof target === 'object' && 'x' in target) ? target : find(target)

  return {
    marks, nocut,
    async tap(target, note) {
      const { x, y } = at(target)
      await sleep(T.preTap)
      idb(['ui', 'tap', String(Math.round(x)), String(Math.round(y))])
      mark('tap', typeof target === 'string' ? target : `${x},${y}`, note)
      await sleep(T.postTap)
    },
    async type(text, note) {
      idb(['ui', 'text', text])
      mark('type', text, note)
      await sleep(T.afterType)
    },
    async swipe(x1, y1, x2, y2, note) {
      idb(['ui', 'swipe', String(x1), String(y1), String(x2), String(y2), '--duration', String(T.swipe / 1000)])
      mark('swipe', `${x1},${y1}→${x2},${y2}`, note)
      await sleep(T.afterSwipe)
    },
    async scrollUp(note) { await this.swipe(200, 700, 200, 350, note ?? '위로 스크롤') },
    async home(note) { idb(['ui', 'button', 'HOME']); mark('home', '', note); await sleep(T.postTap) },
    async beat(note) { await sleep(T.beat); mark('beat', '', note) },
    async hold(ms, note) { await sleep(ms); mark('hold', ms, note) },
    nocutStart(note) { nocut.push({ start: +clock.now().toFixed(2), note }) },
    nocutEnd() { const last = nocut[nocut.length - 1]; if (last && last.end == null) last.end = +clock.now().toFixed(2) }
  }
}
