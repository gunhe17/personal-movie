<script lang="ts">
  import { S, activeProfile } from './app.svelte'
  import NodeCard from './NodeCard.svelte'
  import { fade, fly } from 'svelte/transition'
  import { onMount, untrack } from 'svelte'

  // ── 3층 레이아웃. 위=어디서나 있는 것, 아래=기관 안의 기록 ──
  const W = 2400, H = 900
  const BAND = { globalEnd: 210, boundaryEnd: 285 }
  const ORG_BOX = { x: 140, y: 320, w: 1160, h: 560, header: 52 }
  const POS: Record<string, [number, number]> = {
    extInst: [330, 110], person: [760, 110],
    guardianRel: [390, 520], subject: [760, 520], staff: [1090, 470], orgUnit: [1090, 720],
  }
  const CARD_W = 240
  /* 검사 초안을 뺀 '사람 축'만의 범위 — 화면 맞춤은 기본적으로 이만큼만 본다 */
  const CORE = { x: 100, y: 0, w: 1220, h: H }

  let scale = $state(0.78), tx = $state(20), ty = $state(16)
  let panning = false, sx = 0, sy = 0, otx = 0, oty = 0
  let wrap: HTMLDivElement

  function down(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.node-slot, .pf-bar, .legend')) return
    panning = true; sx = e.clientX; sy = e.clientY; otx = tx; oty = ty
  }
  function move(e: MouseEvent) {
    if (!panning) return
    tx = otx + e.clientX - sx; ty = oty + e.clientY - sy
  }
  function up() { panning = false }
  const ZOOM_MIN = 0.28, ZOOM_MAX = 2.2

  /* 버튼 확대·축소 — 화면 한가운데를 기준으로 (휠은 커서 기준) */
  function zoomBy(f: number) {
    const r = wrap?.getBoundingClientRect()
    if (!r) return
    const ns = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale * f))
    const mx = r.width / 2, my = r.height / 2
    tx = mx - ((mx - tx) * ns) / scale
    ty = my - ((my - ty) * ns) / scale
    scale = ns
  }

  function wheel(e: WheelEvent) {
    e.preventDefault()
    /* deltaMode 1 = 줄 단위(구형 휠 마우스) — 픽셀로 환산해 같은 잣대로 잰다 */
    const unit = e.deltaMode === 1 ? 16 : 1
    const dx = e.deltaX * unit, dy = e.deltaY * unit

    /* 핀치(트랙패드·매직마우스)는 ctrlKey가 켜져서 온다. ⌘도 같이 받는다. */
    if (!e.ctrlKey && !e.metaKey) {
      tx -= dx
      ty -= dy
      return
    }

    /* 굴린 양에 비례해 배율을 바꾼다(지수). 이벤트 하나가 크게 튀지 않게 상한도 둔다. */
    const f = Math.min(1.12, Math.max(0.89, Math.exp(-dy * 0.0035)))
    const ns = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale * f))
    const r = wrap.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    tx = mx - ((mx - tx) * ns) / scale
    ty = my - ((my - ty) * ns) / scale
    scale = ns
  }
  /* 창에 맞춰 배율을 계산한다 — 검사 초안을 켜면 그만큼 넓은 범위를 본다 */
  function fit() {
    const r = wrap?.getBoundingClientRect()
    const box = S.showDrafts ? { x: 60, y: 0, w: W - 80, h: H } : CORE
    if (!r || !r.width) { scale = 0.78; tx = 20; ty = 16; return }
    const pad = 28
    /* 창이 낮다고 28%까지 줄이면 맞추기만 하고 못 읽는다 — 읽히는 하한을 지키고
       모자란 세로는 끌어서 보게 둔다(휠·드래그는 그대로 살아 있다). */
    const FIT_MIN = 0.55
    const ns = Math.min(1.2, Math.max(FIT_MIN, Math.min((r.width - pad * 2) / box.w, (r.height - pad * 2) / box.h)))
    tx = pad - box.x * ns + Math.max(0, (r.width - pad * 2 - box.w * ns) / 2)
    ty = pad - box.y * ns
    scale = ns
  }
  /* 처음 한 번만. $effect로 부르면 fit()이 쓰는 값을 effect가 구독해서
     휠·버튼으로 확대한 즉시 원래 배율로 되돌아간다(2026-08-18 회귀). */
  onMount(fit)

  /* 오른쪽 상세 패널이 열리고 닫힐 때 — 배율은 그대로, 가로 위치만 보정.
     fit()을 다시 부르면 사용자가 확대해 둔 상태가 날아간다.
     untrack: 여기서 tx를 읽으므로 감싸지 않으면 팬할 때마다 이 effect가 다시 돈다. */
  const PANEL_W = 330
  let panelWasOpen = !!S.detail   /* 이미 열린 채로 시작하면 fit()이 그 폭으로 맞춘 뒤라 보정하면 두 번 민다 */
  $effect(() => {
    const open = !!S.detail
    untrack(() => {
      if (open === panelWasOpen) return
      tx += (open ? -1 : 1) * (PANEL_W / 2)
      panelWasOpen = open
    })
  })

  function toggleDrafts() {
    S.showDrafts = !S.showDrafts
    fit()   /* 보이는 범위가 달라졌으니 다시 맞춘다 */
  }

  const prof = $derived(activeProfile())
  const exists = (k: string) => prof?.exists?.[k] !== false

  // 엣지 경로 (곡선 + 화살표 + 카디널리티)
  function edgePath(r: any) {
    const [ax, ay] = POS[r.a], [bx, by] = POS[r.b]
    const mx = (ax + bx) / 2, my = (ay + by) / 2
    const dx = bx - ax, dy = by - ay, n = Math.hypot(dx, dy) || 1
    const cx = mx - (dy / n) * 30, cy = my + (dx / n) * 30
    return { d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`, cx, cy, ax, ay, bx, by }
  }
  function lerpQ(t: number, p: any) {
    // 2차 베지어 위 점 (카디널리티 라벨 위치)
    const x = (1 - t) ** 2 * p.ax + 2 * (1 - t) * t * p.cx + t ** 2 * p.bx
    const y = (1 - t) ** 2 * p.ay + 2 * (1 - t) * t * p.cy + t ** 2 * p.by
    return { x, y }
  }
</script>

<div class="canvas-wrap" bind:this={wrap}
     onmousedown={down} onmousemove={move} onmouseup={up} onmouseleave={up} onwheel={wheel} role="presentation">

  <!-- 지도에서만 쓰는 조작. 기관 종류 스위처는 셸(App.svelte) 소유 — 다른 탭에서도 필요하다 -->
  <div class="pf-bar">
    <span class="zoom">
      <button title="축소" onclick={() => zoomBy(1 / 1.15)}>−</button>
      <b title="굴리면 이동 · ⌘(Ctrl)+굴리기 또는 핀치로 확대·축소 · 빈 곳을 끌어도 이동">{Math.round(scale * 100)}%</b>
      <button title="확대" onclick={() => zoomBy(1.15)}>＋</button>
    </span>
    <button class="fit" onclick={fit}>화면 맞춤</button>
    {#if S.drafts}
      <button class="fit" class:draft-on={S.showDrafts} onclick={toggleDrafts}>
        검사 초안 {S.showDrafts ? '숨기기' : '표시'}
      </button>
    {/if}
  </div>

  <div class="world" style="transform: translate({tx}px,{ty}px) scale({scale});
       width:{S.showDrafts ? W : CORE.x + CORE.w}px; height:{H}px">

    <!-- 밴드 배경 -->
    <div class="band global" style="height:{BAND.globalEnd}px">
      <span class="band-label">기관 밖 — 어느 기관에도 속하지 않는 것 (사람 본인, 바깥 기관)</span>
    </div>
    <div class="band boundary" style="top:{BAND.globalEnd}px; height:{BAND.boundaryEnd - BAND.globalEnd}px">
      <span class="band-label">연결선 — 앱 계정을 만들었을 때만 이어진다</span>
    </div>
    <div class="band tenant" style="top:{BAND.boundaryEnd}px; height:{H - BAND.boundaryEnd}px">
      <span class="band-label">기관 안 — 이 상자 안의 기록은 다른 기관과 섞이지 않는다</span>
    </div>

    <!-- org 컨테이너: "기관 안의 기록"을 포함관계로 -->
    <div class="org-box" style="left:{ORG_BOX.x}px; top:{ORG_BOX.y}px; width:{ORG_BOX.w}px; height:{ORG_BOX.h}px">
      <button class="org-header" onclick={(e) => { e.stopPropagation(); S.detail = { kind: 'concept', key: 'org' } }}>
        {#key prof?.vocab?.org}
          <b in:fly={{ y: 10, duration: 300 }}>{prof?.vocab?.org || '기관'}</b>
        {/key}
        <small>이 상자 하나가 기관 하나 — 안쪽 기록은 여기서 나가지 않는다</small>
        <span class="org-bind">기관 종류를 담을 칸이 아직 없음</span>
      </button>
    </div>

    <!-- 엣지 (SVG) -->
    <svg class="edges" width={W} height={H}>
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
        </marker>
      </defs>
      {#each S.catalog.relations as r (r.a + r.b + r.label)}
        {#if exists(r.a) && exists(r.b)}
          {@const p = edgePath(r)}
          {@const la = lerpQ(0.14, p)}
          {@const lb = lerpQ(0.86, p)}
          <g transition:fade={{ duration: 300 }}>
            <path d={p.d} class:dashed={!r.required} marker-end={r.direction !== 'none' ? 'url(#arrow)' : undefined}
                  marker-start={r.direction === 'both' ? 'url(#arrow)' : undefined} />
            <text x={p.cx} y={p.cy - 5} text-anchor="middle" class="e-label">{r.label}</text>
            <text x={la.x} y={la.y - 6} text-anchor="middle" class="e-card">{r.cardA}</text>
            <text x={lb.x} y={lb.y - 6} text-anchor="middle" class="e-card">{r.cardB}</text>
          </g>
        {/if}
      {/each}
    </svg>

    <!-- 노드 -->
    {#each Object.entries(S.catalog.concepts) as [key, c] (key)}
      {#if key !== 'org'}
        <div class="node-slot" style="left:{POS[key][0]}px; top:{POS[key][1]}px; width:{CARD_W}px">
          <NodeCard {key} concept={c} exists={exists(key)} flip={POS[key][1] > 400} />
        </div>
      {/if}
    {/each}

    <!-- 검사 축 초안 (drafts 조각 — 정본과 분리) -->
    {#if S.drafts && S.showDrafts}
      {#each Object.entries(S.drafts.zones) as [zk, z]}
        <div class="draft-zone" style="left:{z.x}px; top:{z.y}px; width:{z.w}px; height:{z.h}px">
          {#if zk === 'mindbom'}
            <button class="dz-label as-btn" onclick={(e) => { e.stopPropagation(); S.detail = { kind: 'boundary' } }}>
              {z.label} <em>초안</em> <em class="map-hint">상태 사상표 →</em>
            </button>
          {:else}
            <span class="dz-label">{z.label} <em>초안</em></span>
          {/if}
          <span class="dz-sub">{z.sub}</span>
        </div>
      {/each}
      <svg class="edges" width={W} height={H}>
        {#each S.drafts.relations as r}
          {@const pa = S.drafts.concepts[r.a]?.pos ?? (POS[r.a] || null)}
          {@const pb = S.drafts.concepts[r.b]?.pos ?? (POS[r.b] || null)}
          {#if pa && pb}
            {@const mx = (pa[0]+pb[0])/2}
            {@const my = (pa[1]+pb[1])/2}
            <path d="M {pa[0]} {pa[1]} Q {mx} {my+26} {pb[0]} {pb[1]}" class:dashed={!r.required}
                  class="draft-edge" marker-end="url(#arrow)" />
            <text x={mx} y={my-4} text-anchor="middle" class="e-label">{r.label}</text>
          {/if}
        {/each}
      </svg>
      {#each Object.entries(S.drafts.concepts) as [dk, dc]}
        <div class="node-slot" style="left:{dc.pos[0]}px; top:{dc.pos[1]}px; width:230px">
          <button class="draft-card" style="border-color:{dc.color}"
                  onclick={(e) => { e.stopPropagation(); S.detail = { kind: 'draftConcept', key: dk } }}>
            <span class="d-badge">초안</span>
            <b style="color:{dc.color}">{dc.label}</b>
            <small>{dc.bind}</small>
            <span class="chips">
              {#each dc.decisions || [] as d}
                <span class="dchip" role="button" tabindex="0"
                      onclick={(e) => { e.stopPropagation(); S.modalDecision = d }} onkeydown={() => {}}>{d}</span>
              {/each}
            </span>
          </button>
        </div>
      {/each}
    {/if}

    <!-- 범례 (상시, P0) -->
    <div class="legend">
      <b>읽는 법</b>
      <div><span class="line-s"></span> 반드시 있는 연결 &nbsp; <span class="line-d"></span> 있을 수도 없을 수도 &nbsp;
        <span class="mono">1 — 0..N</span> 한 명당 몇 개인지</div>
      <div><span class="mini core"></span> 어디서나 같은 정보 &nbsp; <span class="mini record"></span> 기관이 가진 정보 &nbsp;
        <span class="mini variable"></span> 기관마다 다른 정보</div>
      <div>점선 카드 = 이 기관엔 <b>없는</b> 것. 다른 말로 바꾸는 게 아니라 화면에서 사라진다.</div>
      <div class="dim">카드를 누르면 오른쪽에 자세한 내용 — 어느 표에 저장되는지, 왜 그렇게 정했는지.</div>
    </div>
  </div>
</div>

<style>
  .canvas-wrap { flex: 1; position: relative; overflow: hidden; background: #fff; border-top: 1px solid var(--line); cursor: grab; }
  .canvas-wrap:active { cursor: grabbing; }
  .world { position: absolute; transform-origin: 0 0; }

  .band { position: absolute; left: 0; width: 100%; }
  .band.global { top: 0; background: #eef2f7; }
  .band.boundary {
    background: repeating-linear-gradient(-45deg, #f8fafc 0 10px, #eef2f7 10px 20px);
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .band.tenant { background: #fbfcfe; }
  .band-label { position: absolute; left: 18px; top: 11px; font-size: var(--fs-md); font-weight: 700; color: #8593a8; }

  .org-box { position: absolute; border: 2px dashed #7fb8c9; border-radius: 22px; background: rgba(14, 116, 144, 0.03); }
  .org-header { position: absolute; top: -1px; left: -1px; right: -1px; border: none; background: rgba(14, 116, 144, 0.08); border-radius: 20px 20px 0 0; padding: 8px 18px; text-align: left; display: flex; align-items: baseline; gap: 10px; }
  .org-header b { font-size: var(--fs-xl); color: #0e7490; }
  .org-header small { font-size: var(--fs-sm); color: var(--sub); }
  .org-bind { margin-left: auto; font-size: var(--fs-xs); border-radius: 7px; padding: 2px 9px; background: var(--warn-soft); color: var(--warn); }

  .edges { position: absolute; left: 0; top: 0; pointer-events: none; }
  .edges path { stroke: #94a3b8; stroke-width: 1.6; fill: none; }
  .edges path.dashed { stroke-dasharray: 5 4; }
  .e-label { font-size: 13px; fill: #5b6577; paint-order: stroke; stroke: #fbfcfe; stroke-width: 3px; }
  .e-card { font-size: 11.5px; font-weight: 700; fill: #8593a8; paint-order: stroke; stroke: #fbfcfe; stroke-width: 3px; }

  .node-slot { position: absolute; transform: translate(-50%, -50%); }

  .pf-bar { position: absolute; top: 10px; left: 14px; z-index: 10; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; max-width: 75%; }
  .fit { border: 1.5px solid var(--line); background: #fff; border-radius: 8px; padding: 5px 12px; font-size: var(--fs-sm); color: var(--sub); }
  .zoom { display: inline-flex; align-items: center; border: 1.5px solid var(--line); background: #fff; border-radius: 8px; overflow: hidden; }
  .zoom button { border: none; background: none; padding: 4px 10px; font-size: var(--fs-md); color: var(--sub); line-height: 1.4; }
  .zoom button:hover { background: var(--bg); color: var(--ink); }
  .zoom b { font-size: var(--fs-xs); color: var(--sub); min-width: 40px; text-align: center; cursor: default; }


  .legend { position: absolute; left: 20px; bottom: 20px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; font-size: var(--fs-sm); line-height: 1.95; box-shadow: 0 2px 10px rgba(20, 30, 60, 0.06); width: 420px; }
  .legend b { font-size: var(--fs-md); }
  .legend .dim { color: var(--sub); }
  .legend .mono { font-size: var(--fs-xs); }
  .sw { display: inline-block; width: 14px; height: 10px; border-radius: 3px; vertical-align: -1px; }
  .line-s, .line-d { display: inline-block; width: 22px; border-top: 1.6px solid #94a3b8; vertical-align: 3px; }
  .line-d { border-top-style: dashed; }
  .mini { display: inline-block; width: 14px; height: 7px; border-radius: 2px; vertical-align: 1px; margin: 0 4px 0 10px; }
  .mini.core { background: var(--core); }
  .mini.record { background: var(--record); }
  .mini.variable { background: var(--variable); outline: 1px dashed var(--variable); outline-offset: 1px; }

  .fit.draft-on { border-color: #6d3fc0; color: #6d3fc0; background: #f1ecfb; }
  .draft-zone { position: absolute; border: 2px dashed #d8c9f2; border-radius: 18px; background: rgba(109,63,192,.03); }
  .dz-label { position: absolute; top: 8px; left: 14px; font-size: var(--fs-md); font-weight: 700; color: #6d3fc0; }
  .dz-label.as-btn { border: none; background: none; cursor: pointer; padding: 0; font-family: inherit; }
  .dz-label .map-hint { background: #6d3fc0; color: #fff; }
  .dz-label em { font-style: normal; font-size: var(--fs-xs); background: #f1ecfb; border-radius: 7px; padding: 0 7px; vertical-align: 2px; }
  .dz-sub { position: absolute; top: 30px; left: 14px; font-size: var(--fs-xs); color: var(--sub); }
  .draft-edge { stroke: #b9a5e0 !important; }
  .draft-card { width: 100%; border: 2px dashed; border-radius: 13px; background: #fff; padding: 9px 13px; text-align: center; cursor: pointer; position: relative; font-family: inherit; }
  .draft-card b { display: block; font-size: var(--fs-lg); }
  .draft-card small { display: block; color: var(--sub); font-size: var(--fs-xs); line-height: 1.5; margin-top: 3px; }
  .draft-card .d-badge { position: absolute; top: -9px; right: 10px; font-size: var(--fs-xs); font-weight: 700; background: #6d3fc0; color: #fff; border-radius: 7px; padding: 0 7px; }
  .draft-card .chips { display: block; margin-top: 4px; }
  .draft-card .dchip { display: inline-block; font-size: var(--fs-xs); font-weight: 700; border-radius: 6px; padding: 1px 7px; margin: 1px; background: #f1ecfb; color: #6d3fc0; cursor: pointer; }
</style>
