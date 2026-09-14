// human.mjs — 사람이 하는 속도로 조작하는 헬퍼. 모든 조작은 marks에 시각을 남긴다.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// send: sckcap stdin으로 커서 좌표를 흘리는 함수 (없으면 커서 없이 동작).
// 커서는 캡처러가 프레임에 그린다 — 페이지 안 오버레이가 아니라서 내비게이션에도 위치가 유지되고 지연이 없다.
export function human(page, T, clock, park = { x: 40, y: 40 }, send = null) {
  let pos = { ...park }
  let shape = 'arrow'
  const emit = () => send?.(`m ${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${shape}`)
  emit()
  const marks = []
  const nocut = []
  const mark = (kind, target, note) =>
    marks.push({ t: +clock.now().toFixed(2), kind, target: String(target ?? ''), ...(note ? { note } : {}) })

  async function moveTo(x, y, nextShape = 'arrow') {
    const sx = pos.x, sy = pos.y
    // 거리에 비례한 시간 — 가까운 버튼으로 먼 거리와 같은 시간을 들여 날아가지 않게(v4)
    const dist = Math.hypot(x - sx, y - sy)
    const dur = T.moveMin == null ? T.move
      : Math.min(T.moveMax, T.moveMin + dist * T.movePerPx)
    const n = T.moveSteps, dt = dur / n
    for (let i = 1; i <= n; i++) {
      const k = easeOut(i / n)
      pos = { x: sx + (x - sx) * k, y: sy + (y - sy) * k }
      await page.mouse.move(pos.x, pos.y)
      emit()
      await sleep(dt)
    }
    pos = { x, y }
    shape = nextShape          // 도착해서 모양이 바뀐다 — 실제 커서가 요소 위에서 바뀌는 것과 같은 자리
    emit()
  }

  // 그 좌표의 요소가 요구하는 커서 모양 — 진짜 커서와 같은 모양을 그리기 위해
  async function shapeAt(x, y) {
    return page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py)
      if (!el) return 'arrow'
      const c = getComputedStyle(el).cursor
      return c.includes('text') ? 'ibeam' : c.includes('pointer') ? 'pointer' : 'arrow'
    }, [x, y]).catch(() => 'arrow')
  }

  // 비활성 요소를 누르면 브라우저는 조용히 무시한다 — 조작은 성공한 것처럼 보이고 아무 일도 안 일어난다.
  // 촬영에서 이보다 나쁜 실패가 없으므로 여기서 깨뜨린다.
  async function assertEnabled(el, sel) {
    const state = await el.evaluate((n) => {
      const b = n.closest('button,input,select,textarea,[role=button]') ?? n
      return { disabled: b.disabled === true, aria: b.getAttribute('aria-disabled') === 'true' }
    }).catch(() => ({ disabled: false, aria: false }))
    if (state.disabled || state.aria) throw new Error(`비활성 요소를 눌렀다: ${sel}`)
  }

  // 거리를 먼저 정하고, 한 번에 ease-in-out으로 매 프레임 조금씩 휠을 보낸다(v8 — v5는 커서와 같은 ease-out이라 출발이 툭 튀었다).
  // CDP 합성 휠은 smooth scrolling을 타지 않아 델타 하나가 한 프레임 점프다 — 그래서 프레임마다 작은 델타로 쪼갠다.
  // 장면 스크립트는 거리를 손으로 재지 말고 scrollTo(목표)를 쓴다.
  async function scrollBy(dy, note, target = null) {
    const dist = Math.abs(dy)
    const dur = T.scrollMin == null ? Math.min(T.moveMax, T.moveMin + dist * T.movePerPx)
      : Math.min(T.scrollMax, T.scrollMin + dist * T.scrollPerPx)
    const n = Math.max(1, Math.round(dur / T.scrollFrame))
    let done = 0
    for (let i = 1; i <= n; i++) {
      const want = Math.round(dy * (T.scrollMin == null ? easeOut : easeInOut)(i / n))   // 누적 정수 — 델타 합이 정확히 dy
      if (want !== done) await page.mouse.wheel(0, want - done)
      done = want
      await sleep(T.scrollFrame)
    }
    mark('scroll', target ?? dy, note)
    await sleep(T.afterScroll)
  }

  /**
   * 목표 요소까지 **한 번에** 부드럽게 스크롤한다(v8 규칙).
   * block: 'center'(기본) · 'end'(요소 아래가 보이게) · 'start' · 'nearest'(이미 보이면 안 움직인다 — click·type이 쓴다).
   * 스크롤러를 요소에서 거슬러 올라가 찾고(안쪽 overflow div 포함), 남은 거리로 잘라 끝에 부딪혀 멈추지 않게 한다.
   * 휠은 커서 아래 요소로 가므로, 커서가 스크롤러 밖이면 먼저 안으로 들인다.
   */
  async function scrollTo(sel, note, block = 'center') {
    const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
    await el.waitFor({ state: 'attached' })
    const g = await el.evaluate((n, block) => {
      let sc = null
      for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) { sc = p; break }
      }
      const doc = !sc
      sc ??= document.scrollingElement
      const v = doc ? { left: 0, top: 0, w: innerWidth, h: innerHeight } : (() => { const b = sc.getBoundingClientRect(); return { left: b.left, top: b.top, w: sc.clientWidth, h: sc.clientHeight } })()
      const r = n.getBoundingClientRect(), pad = 24
      const inView = r.top >= v.top && r.bottom <= v.top + v.h
      const want = block === 'nearest' && inView ? 0
        : block === 'end' ? r.bottom - (v.top + v.h) + pad
        : block === 'start' ? r.top - v.top - pad
        : r.top + r.height / 2 - (v.top + v.h / 2)
      const dy = Math.max(-sc.scrollTop, Math.min(sc.scrollHeight - sc.clientHeight - sc.scrollTop, want))
      return { dy: Math.round(dy), v }
    }, block)
    if (Math.abs(g.dy) < 8) { if (note) mark('scroll', sel, `${note} (이미 보인다)`); return }
    const { v } = g
    if (pos.x < v.left || pos.x > v.left + v.w || pos.y < v.top || pos.y > v.top + v.h)
      await moveTo(v.left + v.w * 0.6, v.top + v.h * 0.5)
    await scrollBy(g.dy, note, sel)
  }

  async function center(sel) {
    // 문자열 셀렉터 또는 Playwright Locator(codegen 기록 그대로) 둘 다 받는다
    const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
    await el.waitFor({ state: 'visible' })
    await scrollTo(sel, null, 'nearest')   // v8 — 화면 밖이면 목표까지 한 번에 부드럽게 (scrollIntoView는 한 프레임 점프다)
    await el.scrollIntoViewIfNeeded()      // 가로 스크롤 등 위에서 못 잡은 경우만 남는다
    const b = await el.boundingBox()
    if (!b) throw new Error(`boundingBox 없음: ${sel}`)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }

  return {
    marks, nocut,
    async click(sel, note) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
      await el.waitFor({ state: 'visible' })
      await assertEnabled(el, typeof sel === 'string' ? sel : 'locator')
      const { x, y } = await center(sel)
      await moveTo(x, y, await shapeAt(x, y))
      await sleep(T.preClick)
      await page.mouse.down(); await sleep(90); await page.mouse.up()
      mark('click', sel, note)
      await sleep(T.postClick)
    },
    async type(sel, text, note) {
      const { x, y } = await center(sel)
      await moveTo(x, y, await shapeAt(x, y))
      await sleep(T.preClick)
      await page.mouse.click(x, y)
      await page.keyboard.type(text, { delay: T.type })
      mark('type', sel, note ?? text)
      await sleep(T.afterType)
    },
    scroll: scrollBy,
    scrollTo,
    async hover(sel, note) {
      const { x, y } = await center(sel)
      await moveTo(x, y, await shapeAt(x, y))
      mark('hover', sel, note)
    },
    async beat(note) {
      // networkidle은 폴링 때문에 안 오므로 짧게만 기다린다 — 상태 변화는 T.beat로 보여준다
      await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {})
      await sleep(T.beat)
      mark('beat', '', note)
    },
    async modal(note) { await sleep(T.modal); mark('modal', '', note) },
    /**
     * 조건이 될 때까지만 기다린다 — 제품이 걸리는 만큼만. 고정 hold의 대체(v4).
     * sel이 보이면 settle 만큼만 더 두고 지나간다. 안 오면 timeout에서 던진다.
     */
    async until(sel, note, timeout = 20000) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
      const t0 = clock.now()
      await el.waitFor({ state: 'visible', timeout })
      await sleep(T.settle)
      mark('until', sel, `${note ?? ''}${note ? ' ' : ''}(+${(clock.now() - t0).toFixed(1)}s)`)
    },
    /**
     * 캔버스 위에 다각형을 그린다 — 로샤 영역 지정처럼 마우스로 그려야 하는 곳.
     * pts는 요소 박스 기준 0..1 비율. 커서가 실제로 지나가는 게 보인다.
     */
    async drawOnCanvas(sel, pts, note) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
      await el.waitFor({ state: 'visible' })
      const b = await el.boundingBox()
      if (!b) throw new Error(`캔버스 boundingBox 없음: ${sel}`)
      const at = ([fx, fy]) => ({ x: b.x + b.width * fx, y: b.y + b.height * fy })
      const first = at(pts[0])
      await moveTo(first.x, first.y)
      await sleep(T.preClick)
      await page.mouse.down()
      for (const p of pts.slice(1)) { const q = at(p); await moveTo(q.x, q.y) }
      await moveTo(first.x, first.y)
      await page.mouse.up()
      mark('draw', `${pts.length}점`, note)
      await sleep(T.postClick)
    },
    /**
     * 요소를 집어 다른 요소 위에 놓는다 — HTML5 드래그 앤 드롭.
     * mousedown 뒤 커서가 실제로 움직이므로 dragstart → dragover → drop이 브라우저 순서대로 난다.
     * to는 셀렉터 또는 {sel, fx, fy}(요소 박스 기준 0..1 비율 — 문단 끝처럼 특정 자리에 놓을 때).
     */
    async drag(from, to, note) {
      const src = typeof from === 'string' ? page.locator(from).first() : from.first()
      await src.waitFor({ state: 'visible' })
      await assertEnabled(src, typeof from === 'string' ? from : 'locator')
      const s = await center(from)
      await moveTo(s.x, s.y, await shapeAt(s.x, s.y))
      await sleep(T.preClick)
      await page.mouse.down()
      await moveTo(s.x + 12, s.y + 12)              // 드래그 임계값을 넘겨 dragstart를 낸다
      const spec = typeof to === 'object' && to && 'sel' in to ? to : { sel: to, fx: 0.5, fy: 0.5 }
      const el = typeof spec.sel === 'string' ? page.locator(spec.sel).first() : spec.sel.first()
      await el.waitFor({ state: 'visible' })
      await el.scrollIntoViewIfNeeded()
      const b = await el.boundingBox()
      if (!b) throw new Error(`드롭 대상 boundingBox 없음: ${spec.sel}`)
      await moveTo(b.x + b.width * spec.fx, b.y + b.height * spec.fy)
      await sleep(T.preClick)
      await page.mouse.up()
      mark('drag', `${from} → ${spec.sel}`, note)
      await sleep(T.postClick)
    },
    /**
     * 문단 한 줄을 드래그로 선택한다 — 마우스로 긋는 그 동작 그대로.
     * `execCommand`나 Range API로 선택하면 mouseup이 안 나서, 선택을 듣는 기능이 안 열린다.
     */
    async selectText(sel, note) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
      await el.waitFor({ state: 'visible' })
      const b = await el.boundingBox()
      if (!b) throw new Error(`선택할 요소의 boundingBox 없음: ${sel}`)
      const y = b.y + Math.min(b.height / 2, 12)   // 첫 줄 위에서 긋는다
      await moveTo(b.x + 4, y)
      await sleep(T.preClick)
      await page.mouse.down()
      await moveTo(b.x + b.width - 4, y)
      await page.mouse.up()
      mark('select', sel, note)
      await sleep(T.postClick)
    },
    /** 화면 밖 요소를 천천히 끌어올려 보여준다 — 폼 아래쪽을 청자에게 인식시킬 때(v4) */
    async reveal(sel, note) {
      await scrollTo(sel, null, 'center')   // v8 — 스크롤러를 찾아 목표까지 한 번에 (뷰포트 450 고정 계산은 안쪽 div에서 틀렸다)
      mark('reveal', sel, note)
      await sleep(T.beat)
    },
    // 키 입력. 목 에이전트 다음 턴은 F9 — 화면에 조작 흔적이 남지 않는다 (MockAgentController)
    async key(k, note) { await page.keyboard.press(k); mark('key', k, note); await sleep(T.postClick) },
    async hold(ms, note) { await sleep(ms); mark('hold', ms, note) },
    // 6초 노컷 후보 구간 표시 — 시작에 한 번, 끝에 한 번
    nocutStart(note) { nocut.push({ start: +clock.now().toFixed(2), note }) },
    nocutEnd() { const last = nocut[nocut.length - 1]; if (last && last.end == null) last.end = +clock.now().toFixed(2) }
  }
}

// (v2 유물) 페이지 안에 그리던 커서. v3부터는 sckcap이 프레임에 직접 그린다 — 남겨둔 것은 되돌릴 때를 위해서다.
export const CURSOR_INIT = `
(() => {
  if (window.__capCursor) return
  const c = document.createElement('div'); window.__capCursor = c
  c.setAttribute('aria-hidden','true')
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:30px;pointer-events:none;z-index:2147483647;transform:translate(-3px,-2px);transition:transform 80ms ease-out;will-change:transform'
  c.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M2 2 L2 23 L7.5 18.5 L11 27 L14.5 25.5 L11 17 L18 17 Z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  let x = 40, y = 40, down = false
  const draw = () => { c.style.transform = 'translate(' + (x-3) + 'px,' + (y-2) + 'px) scale(' + (down ? 0.85 : 1) + ')' }
  window.addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; draw() }, true)
  window.addEventListener('mousedown', () => { down = true; draw() }, true)
  window.addEventListener('mouseup', () => { down = false; draw() }, true)
  const attach = () => { if (document.body && !c.isConnected) document.body.appendChild(c) }
  attach(); document.addEventListener('DOMContentLoaded', attach); draw()
})()`
