// phone.mjs — iOS 시뮬레이터 조작 헬퍼 (idb). human.mjs의 폰 판. 모든 조작은 marks에 시각을 남긴다.
//   idb: brew tap facebook/fb && brew install idb-companion && python3 -m pip install fb-idb
import { execSync, spawnSync } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function hasIdb() { try { execSync('which idb', { stdio: 'ignore' }); return true } catch { return false } }

export function phone(udid, T, clock) {
  const marks = [], nocut = []
  // v4: 좌표를 버리지 않는다 — target(라벨)은 그대로 두고 실제로 누른 자리를 x·y로 따로 남긴다.
  //      단위는 idb의 포인트(기기 논리 좌표)다. 촬영본 픽셀과의 배율은 meta의 capture.pxPerPoint.
  // v5: at(시각)을 밖에서 넣을 수 있다 — tap이 `idb ui tap`이 **끝난 뒤**가 아니라 손가락이 닿은 때를 적는다.
  const mark = (kind, target, note, xy, at) => marks.push({ t: +(at ?? clock.now()).toFixed(2), kind, target: String(target ?? ''), ...(note ? { note } : {}), ...xy })
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
      const t = Date.now()
      const { x, y } = at(target)
      await sleep(T.preTap - (Date.now() - t))   // v2: 라벨 조회(describe-all) 시간도 preTap 안에 센다 — 전엔 그만큼 탭 사이가 늘었다
      // v5: `idb ui tap`은 0.15~0.3초 걸린다(파이썬 기동 → 터치 전달 → 응답). 끝난 뒤에 시각을 적으면
      //     탭 링이 그만큼 늦게 떠서 **이미 바뀐 다음 화면 위에** 핀다(t04 실측: 시트가 뜬 0.17초 뒤에 링).
      //     손가락이 닿는 때는 그 사이 어디쯤이다 — 호출 앞뒤의 가운데를 적는다(오차 한 프레임 안).
      const t0 = clock.now()
      idb(['ui', 'tap', String(Math.round(x)), String(Math.round(y))])
      mark('tap', typeof target === 'string' ? target : `${x},${y}`, note, { x: +x.toFixed(1), y: +y.toFixed(1) }, (t0 + clock.now()) / 2)
      await sleep(T.postTap)
    },
    async type(text, note) {
      idb(['ui', 'text', text])
      mark('type', text, note)
      await sleep(T.afterType)
    },
    async swipe(x1, y1, x2, y2, note) {
      idb(['ui', 'swipe', String(x1), String(y1), String(x2), String(y2), '--duration', String(T.swipe / 1000)])
      mark('swipe', `${x1},${y1}→${x2},${y2}`, note, { x: x1, y: y1, x2, y2 })
      await sleep(T.afterSwipe)
    },
    async scrollUp(note) { await this.swipe(200, 700, 200, 350, note ?? '위로 스크롤') },
    async home(note) { idb(['ui', 'button', 'HOME']); mark('home', '', note); await sleep(T.postTap) },
    /**
     * 라벨이 접근성 트리에 나타날 때까지만 기다린다 — 제품이 걸리는 만큼만. 고정 hold의 대체(v3).
     * human.mjs의 until과 같은 계약이다: 나타나면 settle만큼만 더 두고 지나가고,
     * 마크에 경과 시간 `(+N.Ns)`를 남긴다. 안 오면 timeout에서 던진다(조용히 넘어가지 않는다).
     * 대상을 찾는 길은 tap과 같다 — 문자열은 라벨 전체 일치, 부분 일치는 RegExp로.
     */
    async until(label, note, timeout = 20000) {
      const t0 = clock.now()
      for (;;) {
        try { find(label); break } catch (e) {
          if (!String(e.message).startsWith('요소 없음')) throw e
          if ((clock.now() - t0) * 1000 > timeout) throw new Error(`until 시간초과(${timeout}ms): ${label}`)
          await sleep(300)
        }
      }
      await sleep(T.settle)
      mark('until', label, `${note ?? ''}${note ? ' ' : ''}(+${(clock.now() - t0).toFixed(1)}s)`)
    },
    async beat(note) { await sleep(T.beat); mark('beat', '', note) },
    async hold(ms, note) { await sleep(ms); mark('hold', ms, note) },
    nocutStart(note) { nocut.push({ start: +clock.now().toFixed(2), note }) },
    nocutEnd() { const last = nocut[nocut.length - 1]; if (last && last.end == null) last.end = +clock.now().toFixed(2) }
  }
}
