<script lang="ts">
  import { S, API, toast, type InstanceNode } from './app.svelte'
  import { fade } from 'svelte/transition'
  import LineageView from './LineageView.svelte'

  /* 개념 목록도 파라미터도 손으로 적지 않는다 — /api-map 이 라우터에서 뽑아 준다.
     그래서 서버에 개념·필터가 늘면 이 화면은 코드 수정 없이 따라간다.

     원래는 온톨로지 표면(/api/v1/ontology/**)만 불렀는데 그 API가 제거됐다
     (d6f190e7a — "온톨로지 조회 API 제거, 익스플로러 디자인만 존치").
     그래서 ontology 모듈이 있으면 그것만, 없으면 살아 있는 GET 목록 표면을
     모듈별로 늘어놓는다. API가 돌아오면 첫 갈래로 저절로 되돌아간다. */

  interface Param { in: string; name: string; required: boolean; type: string; description: string }
  interface Endpoint { module: string; concept: string; method: string; path: string; params: Param[] }

  /* API 개념 이름 → catalog 개념 키.
     여기 없는 개념은 지우거나 색만 다르게 하지 않고 '미등재'라고 카드에 적는다 —
     어휘가 어긋난 자리(sessions 등)가 그래프에 그대로 보여야 고칠 수 있다. */
  const CATALOG_KEY: Record<string, string> = {   // ← 이 표가 필요한 것 자체가 어휘 불일치 (두-트랙 문서 드리프트 2)
    clients: 'subject', client: 'subject',
    guardian: 'guardianRel', guardians: 'guardianRel',
    counselor: 'staff', member: 'staff', members: 'staff',
    center: 'org', institution: 'extInst', person: 'person',
  }
  const UNMAPPED = '__unmapped__'
  const colorOf = (k: string) => (k === UNMAPPED ? '#94a3b8' : S.catalog?.concepts?.[k]?.color || '#94a3b8')
  const conceptLabel = (k: string) => (k === UNMAPPED ? '개념 지도에 없음' : S.catalog?.concepts?.[k]?.label || k)

  let endpoints = $state<Endpoint[]>([])
  let sel = $state(-1)
  let pv = $state<Record<string, string>>({})
  let status = $state('')
  let ok = $state(true)
  let jsonOut = $state('// 로그인 후 왼쪽에서 개념을 고르고 실행하세요.')
  let agg = $state<Record<string, any> | null>(null)
  let tab = $state<'graph' | 'json' | 'lineage'>('graph')
  let trace = $state<any>(null)
  let nodes = $state<InstanceNode[]>([])
  let edges = $state<any[]>([])
  let pos = $state<Record<string, { x: number; y: number }>>({})
  let box = $state({ w: 1120, h: 660 })
  let cols = $state<{ key: string; x: number; label: string; count: number }[]>([])

  /* 지도 탭과 같은 조작 — 굴리면 이동, ⌘/Ctrl+굴리기(핀치)면 확대. 34개 노드가
     한 화면에 다 들어가려면 축소가 필요한데, 축소만 되면 글자를 못 읽는다. */
  let gscale = $state(1), gtx = $state(0), gty = $state(0)
  let gwrap: HTMLDivElement
  let gpan = false, gsx = 0, gsy = 0, gox = 0, goy = 0

  function fitGraph() {
    const r = gwrap?.getBoundingClientRect()
    if (!r || !r.width) { gscale = 1; gtx = 24; gty = 8; return }
    const pad = 24
    gscale = Math.min(1, Math.max(0.4, Math.min((r.width - pad * 2) / box.w, (r.height - pad * 2) / box.h)))
    gtx = pad
    gty = pad
  }
  function gwheel(e: WheelEvent) {
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : 1
    if (!e.ctrlKey && !e.metaKey) { gtx -= e.deltaX * unit; gty -= e.deltaY * unit; return }
    const f = Math.min(1.12, Math.max(0.89, Math.exp(-e.deltaY * unit * 0.0035)))
    const ns = Math.min(2, Math.max(0.3, gscale * f))
    const r = gwrap.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    gtx = mx - ((mx - gtx) * ns) / gscale
    gty = my - ((my - gty) * ns) / gscale
    gscale = ns
  }
  function gdown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.gnode')) return
    gpan = true; gsx = e.clientX; gsy = e.clientY; gox = gtx; goy = gty
  }
  function gmove(e: MouseEvent) { if (gpan) { gtx = gox + e.clientX - gsx; gty = goy + e.clientY - gsy } }
  function gup() { gpan = false }
  let running = $state(false)
  let mapErr = $state('')
  let mapNote = $state('')

  const ep = $derived(sel >= 0 ? endpoints[sel] : null)
  const queryParams = $derived((ep?.params || []).filter((p) => p.in === 'query'))

  const url = $derived.by(() => {
    if (!ep) return ''
    const path = ep.path.replace('{center_id}', S.centerId || '{center_id}')
    const q = new URLSearchParams()
    for (const p of queryParams) {
      const v = (pv[p.name] || '').trim()
      if (!v) continue
      /* 배열 파라미터는 ?ids=a&ids=b — 쉼표 한 덩이는 FastAPI가 값 하나로 읽는다 */
      if (String(p.type).includes('[]')) v.split(',').forEach((x) => x.trim() && q.append(p.name, x.trim()))
      else q.set(p.name, v)
    }
    const s = q.toString()
    return path + (s ? '?' + s : '')
  })

  loadMap()
  async function loadMap() {
    try {
      const d = await (await fetch(API + '/api-map')).json()
      const mods = d.modules || []
      const onto = mods.find((x: any) => x.name === 'ontology')
      endpoints = collect(onto ? [onto] : mods)
      if (!endpoints.length) mapErr = '/api-map 에 GET 목록 엔드포인트가 없습니다'
      else {
        if (!onto) mapNote = '온톨로지 조회 API가 제거되어 살아 있는 GET 목록 표면을 대신 보여줍니다.'
        pick(0)
      }
    } catch {
      mapErr = '/api-map 로드 실패 — localhost:3502 실행 여부 확인'
    }
  }

  /* 콘솔이 실제로 부를 수 있는 것만 고른다:
     주소창은 {center_id} 하나만 채우므로 다른 경로 변수가 있으면 주소를 완성 못 하고,
     /admin·/app 은 이 화면이 쥔 스태프 토큰으로는 어차피 막힌다.
     (이 규칙이 {client_id} 같은 상세 경로도 함께 걸러 낸다 — 상세는 행 배열이 아니라 그래프가 안 그려진다) */
  const runnable = (path: string) =>
    path.includes('{center_id}') &&
    !path.startsWith('/api/v1/admin') &&
    !path.startsWith('/api/v1/app/') &&
    (path.match(/\{[^}]+\}/g) || []).every((v) => v === '{center_id}')

  const conceptOf = (path: string) =>
    String(path).split('/').filter((x) => x && !x.startsWith('{')).pop() || path

  function collect(mods: any[]): Endpoint[] {
    const out: Endpoint[] = []
    for (const m of mods)
      for (const e of m.endpoints || [])
        if (e.method === 'GET' && runnable(e.path))
          out.push({ module: m.name, concept: conceptOf(e.path), method: e.method, path: e.path, params: e.params || [] })
    return out
  }

  function pick(i: number) {
    sel = i
    pv = {}
    /* 그래프가 읽히는 크기로 시작한다 — 비우면 서버 기본값 */
    if (endpoints[i].params.some((p) => p.name === 'limit')) pv.limit = '20'
    nodes = []; edges = []; pos = {}; agg = null; trace = null; status = ''
  }

  /* 온톨로지 봉투는 rows, 모듈 목록은 items, 더러는 맨 배열로 온다 */
  const rowsOf = (d: any): any[] | null =>
    Array.isArray(d?.rows) ? d.rows : Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : null

  async function run() {
    if (!S.token) return toast('먼저 우측 상단에서 로그인하세요')
    if (!S.centerId) return toast('센터가 없습니다 — 다시 로그인하세요')
    if (!ep) return
    running = true
    const t0 = performance.now()
    try {
      const res = await fetch(API + url, { headers: { Authorization: 'Bearer ' + S.token } })
      const ms = Math.round(performance.now() - t0)
      const data = await res.json().catch(() => ({}))
      status = `${res.status} · ${ms}ms`
      ok = res.ok
      jsonOut = JSON.stringify(data, null, 2)
      agg = res.ok ? data.aggregate || null : null
      trace = res.ok ? data.lineage ?? null : null
      if (res.ok && trace) tab = 'lineage'
      else if (res.ok && rowsOf(data)) { build(ep.concept, rowsOf(data)!); tab = 'graph' }
      else tab = 'json'
    } catch (e: any) {
      toast('요청 실패: ' + e.message)
    }
    running = false
  }

  /* ── 봉투 → 그래프 ──────────────────────────────────────────
     행은 노드, 행이 든 참조가 엣지다. 개념별 분기를 두지 않는다 —
     {ref}_id 는 실선(id 있는 관계), {ref}_names 는 점선(이름만 온 다홉 투영).
     같은 id로 온 참조는 한 노드로 합쳐지므로 여러 회기가 한 케이스로 모이는 게 그림에 나온다. */

  const titleOf = (row: any) =>
    row.name || row.case_code || row.code || (row.id ? String(row.id).slice(0, 8) : '?')

  const subOf = (row: any) =>
    [
      row.name && row.code ? row.code : null,
      row.session_number != null ? `${row.session_number}회기` : null,
      row.role || null,
      row.status || null,
    ].filter(Boolean).join(' · ')

  /* 참조의 표시명 — 봉투가 동반한 이름/코드를 쓴다(없으면 id 앞자리).
     counseling_case_id 의 짝이 case_code 처럼 접두가 짧아진 경우까지 본다. */
  function refLabel(row: any, base: string, id: unknown) {
    const tail = base.split('_').pop() as string
    for (const k of [`${base}_name`, `${base}_code`, `${tail}_name`, `${tail}_code`])
      if (row[k]) return String(row[k])
    return String(id).slice(0, 8)
  }

  function build(concept: string, rows: any[]) {
    const ck = CATALOG_KEY[concept] || UNMAPPED
    const ns: InstanceNode[] = []
    const es: any[] = []

    /* 예전엔 가운데 '기관' 노드에 모든 행이 선으로 붙었는데, 행이 20개면 선도 20개라
       가운데가 먹칠이 된다. 어차피 전부 같은 기관 것이므로 그 사실은 위 제목줄이 말한다. */
    const seen = new Set<string>()
    rows.forEach((row, i) => {
      const rid = 'r' + i
      ns.push({ id: rid, title: titleOf(row), concept: ck, sub: subOf(row), data: row, kind: '__row__' } as any)

      for (const [k, v] of Object.entries(row)) {
        if (k === 'id' || v == null) continue

        if (k.endsWith('_id')) {
          const base = k.slice(0, -3)
          const xid = 'x:' + v
          if (!seen.has(xid)) {
            seen.add(xid)
            ns.push({
              id: xid, title: refLabel(row, base, v),
              concept: CATALOG_KEY[base] || UNMAPPED, sub: '', data: { id: v }, kind: base,
            } as any)
          }
          es.push({ a: rid, b: xid, kind: 'ref', label: base })
        } else if (k.endsWith('_names') && Array.isArray(v)) {
          const base = k.slice(0, -6)
          for (const nm of v as string[]) {
            const xid = 'n:' + base + ':' + nm
            if (!seen.has(xid)) {
              seen.add(xid)
              ns.push({
                id: xid, title: nm, concept: CATALOG_KEY[base] || UNMAPPED,
                sub: '이름만 옴', data: {}, kind: base,
              } as any)
            }
            es.push({ a: rid, b: xid, kind: 'proj', label: base })
          }
        }
      }
    })
    layout(ns, es)
  }

  /* 세로줄 배치 — 왼쪽 첫 줄이 조회한 기록, 오른쪽으로 그 기록이 가리키는 것들이
     종류별로 한 줄씩. 선이 왼→오 한 방향이라 가운데서 엉키지 않는다.
     (원형 배치는 20행만 넘어가도 선이 중심에서 뭉친다.) */
  const COL_W = 250, COL_GAP = 96, ROW_H = 54, TOP = 58

  function layout(ns: InstanceNode[], es: any[]) {
    const kindOf = (n: any) => n.kind || '__row__'
    /* 줄 순서: 조회한 기록이 맨 왼쪽, 나머지는 처음 나온 순서 */
    const kinds: string[] = []
    for (const n of ns) { const k = kindOf(n); if (!kinds.includes(k)) kinds.push(k) }
    kinds.sort((a, b) => (a === '__row__' ? -1 : b === '__row__' ? 1 : 0))

    const p: Record<string, { x: number; y: number }> = {}
    const colOf: Record<string, number> = {}
    kinds.forEach((k, i) => (colOf[k] = i))

    /* 1줄(기록) — 같은 것을 가리키는 기록끼리 모아서 세운다.
       응답 순서 그대로 두면 한 케이스의 회기가 흩어져 선이 서로 넘나든다.
       (보이는 순서일 뿐 응답 순서가 아니다 — 그건 JSON 탭이 정본) */
    const rowNodes = ns.filter((n) => kindOf(n) === '__row__')
    const firstRef: Record<string, string> = {}
    for (const e of es) if (e.kind === 'ref' && !firstRef[e.a]) firstRef[e.a] = e.b
    const groupOrder: string[] = []
    for (const n of rowNodes) { const g = firstRef[n.id] ?? n.id; if (!groupOrder.includes(g)) groupOrder.push(g) }
    const orderedRows = [...rowNodes].sort((a, b) =>
      groupOrder.indexOf(firstRef[a.id] ?? a.id) - groupOrder.indexOf(firstRef[b.id] ?? b.id) ||
      rowNodes.indexOf(a) - rowNodes.indexOf(b))
    orderedRows.forEach((n, i) => (p[n.id] = { x: 0, y: TOP + i * ROW_H }))

    /* 나머지 줄은 자기를 가리킨 기록들의 평균 높이에 두고, 겹치면 아래로 민다 */
    for (const k of kinds) {
      if (k === '__row__') continue
      const col = ns.filter((n) => kindOf(n) === k)
      const withY = col.map((n) => {
        const ys = es.filter((e) => e.b === n.id).map((e) => p[e.a]?.y).filter((y) => y != null) as number[]
        return { n, y: ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : TOP }
      }).sort((a, b) => a.y - b.y)
      let last = -Infinity
      for (const it of withY) {
        const y = Math.max(it.y, last + ROW_H)
        p[it.n.id] = { x: colOf[k] * (COL_W + COL_GAP), y }
        last = y
      }
    }

    /* 줄 제목 (기록 11 · 케이스 11 …) */
    cols = kinds.map((k) => ({
      key: k,
      x: colOf[k] * (COL_W + COL_GAP),
      label: k === '__row__' ? (ep?.concept ?? '기록') : k,
      count: ns.filter((n) => kindOf(n) === k).length,
    }))

    const maxY = Math.max(TOP, ...Object.values(p).map((v) => v.y))
    nodes = ns; edges = es; pos = p
    box = { w: kinds.length * (COL_W + COL_GAP) + COL_W, h: maxY + ROW_H + 40 }
  }

  /* box가 바뀌면(= 새로 조회하면) 그려진 뒤에 화면에 맞춘다.
     gscale은 여기서 읽지 않는다 — 읽으면 확대할 때마다 이 effect가 다시 돌아 되돌아간다. */
  $effect(() => { box; if (gwrap) fitGraph() })

  function clickNode(x: InstanceNode) {
    if (x.data?.id && x.concept === 'subject') {
      S.clientId = x.data.id as string
      S.clientName = (x.data.name as string) || x.title
    }
    if (x.data?.person_id) S.personId = x.data.person_id as string
    S.detail = { kind: 'instance', node: x }
  }

  const refCount = $derived(nodes.filter((n) => n.id.startsWith('x:') || n.id.startsWith('n:')).length)
</script>

<div class="console">
  <div class="side">
    <div class="grp">개념 <small>서버에서 자동으로 가져옴</small></div>
    {#if mapErr}
      <p class="err">{mapErr}</p>
    {/if}
    {#if mapNote}
      <p class="note">{mapNote}</p>
    {/if}
    {#each endpoints as e, i}
      {#if i === 0 || e.module !== endpoints[i - 1].module}
        <div class="grp">{e.module}</div>
      {/if}
      <button class="concept" class:on={sel === i} onclick={() => pick(i)}>
        <span class="m">{e.method}</span>
        <span>
          {e.concept}
          <small class="mono">{e.path.replace('/api/v1', '').replace('/centers/{center_id}', '~')}</small>
        </span>
      </button>
    {/each}

    {#if ep}
      <div class="grp">조건으로 거르기 <small>{queryParams.length}개</small></div>
      <div class="fixed">
        <span>어느 기관</span>
        <em class="mono">{S.centerId ? S.centerId.slice(0, 8) + '…' : '— 로그인 필요'}</em>
      </div>
      {#each queryParams as p}
        <label class="param" title={p.description || p.type}>
          <span>{p.name}</span>
          <input bind:value={pv[p.name]} placeholder={String(p.type).replace(' | null', '')} spellcheck="false" />
        </label>
      {/each}
    {/if}
  </div>

  <div class="main">
    <div class="reqbar">
      <span class="method">{ep?.method || 'GET'}</span>
      <input class="mono" value={url} readonly spellcheck="false" placeholder="/api/v1/…" />
      <button class="run" onclick={run} disabled={running || !ep}>실행 ▶</button>
    </div>

    <div class="tabs">
      <button class:on={tab === 'graph'} onclick={() => (tab = 'graph')}>그래프</button>
      {#if trace}<button class:on={tab === 'lineage'} onclick={() => (tab = 'lineage')}>계보</button>{/if}
      <button class:on={tab === 'json'} onclick={() => (tab = 'json')}>JSON</button>
      {#if agg}
        <span class="agg" class:approx={agg.exact === false}>
          {agg.exact === false ? `${agg.count ?? '—'}건 이상` : `전체 ${agg.count ?? '—'}건`}
        </span>
      {/if}
      {#if nodes.length}
        <span class="meta">기록 {nodes.length - refCount}개 · 이어진 것 {refCount}개</span>
      {/if}
      <span class="status" class:bad={!ok}>{status}</span>
    </div>

    <div class="pane">
      {#if tab === 'lineage'}
        <LineageView {trace} {url} />
      {:else if tab === 'graph'}
        {#if !nodes.length}
          <p class="empty">실행하면 응답에 담긴 기록이 왼쪽 줄에 늘어서고,
            그 기록이 가리키는 것들이 오른쪽 줄에 종류별로 놓입니다.</p>
        {:else}
          <div class="gcanvas" bind:this={gwrap} role="presentation"
               onmousedown={gdown} onmousemove={gmove} onmouseup={gup} onmouseleave={gup} onwheel={gwheel}>
            <div class="gzoom">
              <button title="축소" onclick={() => { const n = Math.max(0.3, gscale / 1.15); gscale = n }}>−</button>
              <b title="굴리면 이동 · ⌘(Ctrl)+굴리기로 확대 · 빈 곳을 끌어도 이동">{Math.round(gscale * 100)}%</b>
              <button title="확대" onclick={() => { const n = Math.min(2, gscale * 1.15); gscale = n }}>＋</button>
              <button class="gfit" onclick={fitGraph}>화면 맞춤</button>
            </div>
            <div class="gworld" style="transform: translate({gtx}px,{gty}px) scale({gscale}); width:{box.w}px; height:{box.h}px">
              <svg width={box.w} height={box.h}>
                {#each edges as e}
                  {#if pos[e.a] && pos[e.b]}
                    {@const a = pos[e.a]}
                    {@const b = pos[e.b]}
                    <path d="M {a.x + COL_W} {a.y + 18} C {a.x + COL_W + 48} {a.y + 18}, {b.x - 48} {b.y + 18}, {b.x} {b.y + 18}"
                          fill="none" stroke="#c4cedb" stroke-width="1.3"
                          stroke-dasharray={e.kind === 'proj' ? '4 4' : undefined} />
                  {/if}
                {/each}
              </svg>
              {#each cols as c}
                <div class="gcol-head" style="left:{c.x}px; width:{COL_W}px"
                     title={c.key === '__row__' ? '연결이 겹치지 않게 묶어서 세운 순서입니다 — 응답 순서는 JSON 탭' : ''}>
                  {c.label}<b>{c.count}</b>
                </div>
              {/each}
              {#each nodes as x (x.id)}
                {#if pos[x.id]}
                  <button class="gnode" class:unmapped={x.concept === UNMAPPED}
                          style="left:{pos[x.id].x}px; top:{pos[x.id].y}px; width:{COL_W}px; border-left-color:{colorOf(x.concept)}"
                          onclick={() => clickNode(x)} transition:fade={{ duration: 140 }}>
                    <b>{x.title}</b>
                    {#if x.sub}<small>{x.sub}</small>{/if}
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <pre>{jsonOut}</pre>
      {/if}
    </div>
  </div>
</div>

<style>
  .console { flex: 1; display: flex; overflow: hidden; }
  .side { width: 265px; background: #fff; border-right: 1px solid var(--line); overflow-y: auto; padding: 6px 8px 14px; flex-shrink: 0; }
  .grp { font-size: 10.5px; color: var(--sub); font-weight: 700; margin: 12px 8px 4px; }
  .grp small { font-weight: 400; opacity: .7; }
  .err { margin: 4px 8px; font-size: 11px; color: var(--danger); line-height: 1.5; }
  .note { margin: 4px 8px 8px; font-size: 11px; color: var(--sub); line-height: 1.5; }
  .concept { display: flex; gap: 6px; align-items: baseline; width: 100%; text-align: left; padding: 6px 9px; border: none; background: none; border-radius: 8px; font-size: 12px; font-weight: 600; }
  .concept:hover { background: var(--bg); }
  .concept.on { background: var(--accent-soft); }
  .concept .m { font-size: var(--fs-xs); font-weight: 700; border-radius: 4px; padding: 0 4px; color: #fff; background: #2f855a; flex-shrink: 0; }
  .concept small { display: block; color: var(--sub); font-size: var(--fs-xs); font-weight: 400; margin-top: 1px; }
  .fixed { display: flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: var(--fs-xs); color: var(--sub); }
  .fixed em { font-style: normal; margin-left: auto; font-size: var(--fs-xs); }
  .param { display: flex; align-items: center; gap: 6px; padding: 3px 9px; font-size: var(--fs-xs); }
  .param span { width: 96px; flex-shrink: 0; color: var(--sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .param input { flex: 1; min-width: 0; border: 1.5px solid var(--line); border-radius: 7px; padding: 4px 8px; font-size: var(--fs-xs); font-family: inherit; }
  .param input:focus { outline: none; border-color: var(--accent); }

  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .reqbar { display: flex; gap: 8px; align-items: center; padding: 12px 16px; background: #fff; border-bottom: 1px solid var(--line); }
  .method { font-size: 12px; font-weight: 700; color: #2f855a; }
  .reqbar input { flex: 1; border: 1.5px solid var(--line); border-radius: 9px; padding: 7px 12px; font-size: 12px; background: var(--bg); color: var(--ink); }
  .run { border: none; background: var(--accent); color: #fff; border-radius: 9px; padding: 8px 20px; font-size: 13px; font-weight: 700; }
  .run:disabled { background: #b9c4d6; }

  .tabs { display: flex; gap: 2px; padding: 8px 16px 0; background: var(--bg); align-items: center; }
  .tabs button { border: 1px solid var(--line); border-bottom: none; background: #eef1f6; border-radius: 9px 9px 0 0; padding: 6px 18px; font-size: 12px; font-weight: 600; color: var(--sub); }
  .tabs button.on { background: #fff; color: var(--ink); }
  .agg { margin-left: 10px; background: var(--ok-soft); color: var(--ok); border-radius: 8px; padding: 2px 9px; font-size: 11px; font-weight: 700; }
  .agg.approx { background: var(--warn-soft); color: var(--warn); }
  .meta { margin-left: 8px; font-size: 11px; color: var(--sub); }
  .status { margin-left: auto; font-size: 11.5px; color: var(--ok); font-weight: 700; }
  .status.bad { color: var(--danger); }

  .pane { flex: 1; overflow: auto; background: #fff; border-top: 1px solid var(--line); position: relative; }
  .pane:has(.gcanvas) { overflow: hidden; }
  .pane pre { padding: 14px 18px; font-size: 11.5px; line-height: 1.55; font-family: 'SF Mono', Menlo, monospace; }
  .empty { padding: 40px; color: var(--sub); font-size: 12.5px; }
  .gcanvas { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
  .gcanvas:active { cursor: grabbing; }
  .gworld { position: absolute; transform-origin: 0 0; }
  .gzoom { position: absolute; top: 10px; right: 14px; z-index: 5; display: flex; align-items: center; gap: 2px;
    background: #fff; border: 1.5px solid var(--line); border-radius: 9px; padding: 2px; }
  .gzoom button { border: none; background: none; padding: 3px 9px; font-size: var(--fs-md); color: var(--sub); }
  .gzoom button:hover { background: var(--bg); color: var(--ink); }
  .gzoom b { font-size: var(--fs-xs); color: var(--sub); min-width: 38px; text-align: center; }
  .gzoom .gfit { border-left: 1px solid var(--line); font-size: var(--fs-xs); }

  .gcol-head { position: absolute; top: 16px; display: flex; align-items: baseline; gap: 6px;
    font-size: var(--fs-xs); font-weight: 600; color: var(--sub); padding-bottom: 5px; border-bottom: 1px solid var(--line); }
  .gcol-head b { margin-left: auto; color: #94a3b8; font-variant-numeric: tabular-nums; }

  /* 한 줄 = 한 카드. 왼쪽 색 띠만으로 개념을 구분한다(테두리 전체를 칠하면 목록이 시끄럽다) */
  .gnode { position: absolute; text-align: left; background: #fff; border: 1px solid var(--line);
    border-left: 3px solid; border-radius: 3px 9px 9px 3px; padding: 6px 11px; box-shadow: 0 1px 3px rgba(20,30,60,.06); }
  .gnode:hover { border-color: var(--accent); box-shadow: 0 3px 10px rgba(20,30,60,.12); }
  .gnode.unmapped { border-style: dashed; border-left-style: solid; }
  .gnode b { display: block; font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gnode small { display: block; color: var(--sub); font-size: var(--fs-xs); margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
