// human.mjs — 사람이 하는 속도로 조작하는 헬퍼. 모든 조작은 marks에 시각을 남긴다.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

export function human(page, T, clock, park = { x: 40, y: 40 }) {
  let pos = { ...park }
  const marks = []
  const nocut = []
  const mark = (kind, target, note) =>
    marks.push({ t: +clock.now().toFixed(2), kind, target: String(target ?? ''), ...(note ? { note } : {}) })

  async function moveTo(x, y) {
    const n = T.moveSteps, dt = T.move / n, sx = pos.x, sy = pos.y
    for (let i = 1; i <= n; i++) {
      const k = easeOut(i / n)
      await page.mouse.move(sx + (x - sx) * k, sy + (y - sy) * k)
      await sleep(dt)
    }
    pos = { x, y }
  }

  async function center(sel) {
    // 문자열 셀렉터 또는 Playwright Locator(codegen 기록 그대로) 둘 다 받는다
    const el = typeof sel === 'string' ? page.locator(sel).first() : sel.first()
    await el.waitFor({ state: 'visible' })
    await el.scrollIntoViewIfNeeded()
    const b = await el.boundingBox()
    if (!b) throw new Error(`boundingBox 없음: ${sel}`)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }

  return {
    marks, nocut,
    async click(sel, note) {
      const { x, y } = await center(sel)
      await moveTo(x, y)
      await sleep(T.preClick)
      await page.mouse.down(); await sleep(90); await page.mouse.up()
      mark('click', sel, note)
      await sleep(T.postClick)
    },
    async type(sel, text, note) {
      const { x, y } = await center(sel)
      await moveTo(x, y)
      await sleep(T.preClick)
      await page.mouse.click(x, y)
      await page.keyboard.type(text, { delay: T.type })
      mark('type', sel, note ?? text)
      await sleep(T.afterType)
    },
    async scroll(dy, note) {
      const n = Math.max(1, Math.round(Math.abs(dy) / T.scrollStep))
      const s = Math.sign(dy) * T.scrollStep
      for (let i = 0; i < n; i++) { await page.mouse.wheel(0, s); await sleep(T.scrollEvery) }
      mark('scroll', dy, note)
      await sleep(T.afterScroll)
    },
    async hover(sel, note) {
      const { x, y } = await center(sel)
      await moveTo(x, y)
      mark('hover', sel, note)
    },
    async beat(note) {
      // networkidle은 폴링 때문에 안 오므로 짧게만 기다린다 — 상태 변화는 T.beat로 보여준다
      await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {})
      await sleep(T.beat)
      mark('beat', '', note)
    },
    async modal(note) { await sleep(T.modal); mark('modal', '', note) },
    async hold(ms, note) { await sleep(ms); mark('hold', ms, note) },
    // 6초 노컷 후보 구간 표시 — 시작에 한 번, 끝에 한 번
    nocutStart(note) { nocut.push({ start: +clock.now().toFixed(2), note }) },
    nocutEnd() { const last = nocut[nocut.length - 1]; if (last && last.end == null) last.end = +clock.now().toFixed(2) }
  }
}

// 페이지 안에 그리는 커서 — Playwright 마우스는 OS 커서를 움직이지 않으므로 오버레이로 대신 보여준다.
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
