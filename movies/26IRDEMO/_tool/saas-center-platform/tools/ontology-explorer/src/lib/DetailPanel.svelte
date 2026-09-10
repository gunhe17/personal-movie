<script lang="ts">
  import { S, activeProfile, setProfile, toast } from './app.svelte'
  import { fly } from 'svelte/transition'

  const d = $derived(S.detail)
  const prof = $derived(activeProfile())

  // ── 개념 상세 ──
  const concept = $derived(d?.kind === 'concept' ? S.catalog.concepts[d.key] : null)
  const binding = $derived(d?.kind === 'concept' ? S.bindings[d.key] || {} : {})
  const attrInfo = $derived(d?.kind === 'concept' ? S.attributes[d.key] || {} : {})
  const traces = $derived(d?.kind === 'concept' ? S.audit.violations.filter((v: any) => v.concept === d.key) : [])
  const BIND_LABEL: Record<string, string> = { bound: '연결됨', partial: '일부만', missing: '아직 없음' }

  /* DB 타입은 그대로 두면 String(100)·JSONB 같은 말이 그대로 읽힌다.
     뜻만 한 줄로 요약하고 원문은 title(마우스 올림)로 남긴다. */
  function typeKo(t?: string): string {
    if (!t || t === '—') return ''
    let m = /^String\((\d+)\)/.exec(t)
    if (m) return `글자 ${m[1]}자`
    if (/^Text/i.test(t)) return '긴 글'
    if (/^DateTime/.test(t)) return '날짜·시각'
    if (/^Date$/.test(t)) return '날짜'
    if (/^Boolean/.test(t)) return '예 / 아니오'
    if (/^(Integer|Numeric|Float|Number)/.test(t)) return '숫자'
    if (/JSONB?/.test(t)) return '묶음 값'
    return t
  }
  /* 컬럼 자리에 문장이 들어온 경우(= 아직 컬럼이 없다는 뜻)는 따로 표시 */
  const isMissingColumn = (c: string) => c.startsWith('(')
  const CLASS_LABEL: Record<string, string> = {
    core: '어디서나 같은 정보 — 기관이 달라도 뜻이 같다',
    record: '기관이 가진 정보 — 그 기관 안에서만 뜻이 있다',
    variable: '기관에 따라 쓰거나 안 쓰는 정보 — 칸은 이미 있다',
    system: '시스템이 쓰는 값 — 화면에 안 나온다',
    'record?': '아직 분류 안 된 것 — 모델에 없는 컬럼',
  }
  const CLASS_ORDER = ['core', 'record', 'variable', 'system', 'record?']
  const attrsByClass = $derived.by(() => {
    const out: Record<string, any[]> = {}
    for (const a of attrInfo.attributes || []) (out[a.class] ||= []).push(a)
    return out
  })

  // ── 드래프트 에디터 ──
  function ensureDraft() {
    if (!S.draft) S.draft = {
      name: '', loop: '', vocab: {}, exists: { guardianRel: true, orgUnit: false },
      variable: { subject: [] }, hierarchy: null, identifier: { type: '', temporal: 'stable' }, sections: { sibling: false },
    }
    return S.draft
  }
  let varText = $state('')
  let judge = $state<{ lv: string; msg: string }[] | null>(null)
  $effect(() => { if (d?.kind === 'draft') { ensureDraft(); varText = (S.draft.variable.subject || []).join(', ') } })

  function syncDraft() {
    S.draft.variable.subject = varText.split(',').map((s: string) => s.trim()).filter(Boolean)
    for (const k of Object.keys(S.catalog.concepts)) if (S.draft.exists[k] === false) S.draft.vocab[k] = null
  }
  function applyDraft() {
    syncDraft(); S.draft.name = S.draft.name || '드래프트'
    setProfile('__draft__')
    toast(`'${S.draft.name}' 드래프트 적용 — 미리보기 탭에서 화면도 확인하세요`)
  }
  function judgeDraft() {
    syncDraft()
    const issues: { lv: string; msg: string }[] = []
    if (!S.draft.loop) issues.push({ lv: 'danger', msg: '이 기관이 일하는 방식을 안 골랐습니다 — 이게 정해져야 화면을 얼마나 만들지 압니다' })
    if (S.draft.loop === '제3의 루프') issues.push({ lv: 'danger', msg: '일하는 방식이 아예 다르면 설정 파일로는 안 됩니다 — 화면을 새로 만들어야 합니다' })
    for (const [k, c] of Object.entries(S.catalog.concepts) as [string, any][]) {
      if (k === 'org') continue
      if (S.draft.exists[k] !== false && !S.draft.vocab[k] && k !== 'orgUnit')
        issues.push({ lv: 'warn', msg: `'${c.label}'을 이 기관에서 뭐라고 부르는지 안 적었습니다 (모르겠으면 이 기관엔 없는 것일 수도)` })
    }
    if (S.draft.exists.orgUnit && !S.draft.hierarchy) issues.push({ lv: 'warn', msg: '소속 단위가 있다고 했는데 몇 단계로 나뉘는지 안 적었습니다 (예: 학년 > 반)' })
    if (!S.draft.identifier.type) issues.push({ lv: 'warn', msg: '그 사람임을 무엇으로 확인하는지 안 적었습니다 (학번·군번·환자번호 등)' })
    if (S.draft.exists.orgUnit) issues.push({ lv: 'info', msg: '소속 단위는 아직 저장할 표가 없습니다 — 실제로 쓰려면 먼저 만들어야 합니다' })
    judge = issues
  }
  function exportDraft() {
    syncDraft()
    const blob = new Blob([JSON.stringify(S.draft, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = (S.draft.name || 'draft') + '.profile.json'
    a.click()
    toast('내보냈습니다 — ontology/profiles/ 에 넣으면 정식 기관으로 등장 (코드 수정 없음)')
  }
</script>

<aside class="panel" transition:fly={{ x: 40, duration: 200 }}>
  <div class="head">
    {#if d?.kind === 'concept' && concept}
      <h2>{prof?.vocab?.[d.key] || concept.label}
        {#if prof?.vocab?.[d.key] && prof.vocab[d.key] !== concept.label}<small>({concept.label})</small>{/if}
      </h2>
      <small>{concept.plain || ''}</small>
      <small class="where mono">저장 위치: {binding.table || '아직 없음'} <em class="bs {binding.status}">{BIND_LABEL[binding.status] || binding.status}</em></small>
    {:else if d?.kind === 'draftConcept'}
      <h2>{S.drafts.concepts[d.key].label}</h2>
      <small>초안 (AS) — 정렬 회의 확정 전 · {S.drafts.concepts[d.key].zone === 'mindbom' ? '마인드봄 소유' : '플랫폼 소유'}</small>
    {:else if d?.kind === 'boundary'}
      <h2>상태 사상표</h2><small>마인드스코프 ↔ 마인드봄 — 경계 계약 조항 2 (코드 실측)</small>
    {:else if d?.kind === 'instance'}
      <h2>{d.node.title}</h2><small>인스턴스 · {d.node.concept}</small>
    {:else}
      <h2>새 기관 만들기</h2><small>이 기관이 우리 모델에 들어맞는지 따져 보고, 기관 정의 파일을 뽑는다</small>
    {/if}
    <button class="close" onclick={() => (S.detail = null)}>✕</button>
  </div>

  <div class="body">
    {#if d?.kind === 'concept' && concept}
      <!-- 늘 보이는 것: 무엇이 들어 있나 · 다른 기관에선 뭐라 부르나.
           나머지(근거·관계·문제)는 접어 둔다 — 한 화면에 다 펼치면 읽히지 않는다. -->
      <h4 class="first">어떤 정보를 담나 <em>왼쪽 = 뜻 · 오른쪽 = 실제 저장 칸</em></h4>
      {#each CLASS_ORDER as cls}
        {#if attrsByClass[cls]?.length}
          <div class="grp {cls}">
          <div class="cls-head">{CLASS_LABEL[cls]}<b>{attrsByClass[cls].length}</b></div>
          {#each attrsByClass[cls] as a}
            <div class="attr">
              <div class="a-top">
                <span class="a-onto" class:unnamed={a.onto === '(미분류)'}>{a.onto === '(미분류)' ? a.column : a.onto}</span>
                {#if a.nullable === false}<span class="a-req">필수</span>{/if}
                {#if a.onto !== '(미분류)'}
                  <span class="a-col mono" class:none={isMissingColumn(a.column)} title={a.type || ''}>{a.column}</span>
                {/if}
              </div>
              {#if typeKo(a.type) || a.note}
                <div class="a-meta">
                  {#if typeKo(a.type)}<span class="a-type">{typeKo(a.type)}</span>{/if}
                  {#if a.note}<span class="a-note">{a.note}</span>{/if}
                </div>
              {/if}
            </div>
          {/each}
          </div>
        {/if}
      {/each}
      {#if d.key === 'subject' && prof?.variable?.subject?.length}
        <div class="grp variable">
          <div class="cls-head">{prof.name}가 더 받는 정보 — 설정 파일이 선언<b>{prof.variable.subject.length}</b></div>
          {#each prof.variable.subject as v}<div class="attr"><div class="a-top"><span class="a-onto">{v}</span></div></div>{/each}
        </div>
      {/if}
      {#if d.key === 'subject' && prof?.identifier}
        <div class="note">그 사람임을 확인하는 번호: {prof.identifier.type}
          ({prof.identifier.temporal === 'periodic' ? '주기적으로 새로 발급된다' : '평생 안 바뀐다'})</div>
      {/if}

      <h4>다른 기관에서는</h4>
      {#each Object.values(S.profiles) as p}
        {@const v = p.vocab?.[d.key]}
        <span class="chip" class:gone={v === null}>{p.name}: {v === null ? '없음' : v || concept.label}</span>
      {/each}

      {#if binding.gaps?.length || traces.length}
        <details>
          <summary>아직 안 맞는 부분 <em>{(binding.gaps?.length || 0) + traces.length}</em></summary>
          {#each binding.gaps || [] as g}<div class="gap">{g}</div>{/each}
          {#if traces.length}
            <div class="sub-h">이 개념을 잘못 쓴 화면 {traces.length}곳</div>
            {#each traces.slice(0, 6) as t}
              <div class="trace"><span class="t-tag">{t.type}</span> {t.note}<span class="mono">{t.file}:{t.line}</span></div>
            {/each}
            {#if traces.length > 6}
              <button class="more" onclick={() => { S.view = 'audit' }}>전체 보기 → 화면 점검 탭</button>
            {/if}
          {/if}
        </details>
      {/if}

      {#if attrInfo.states || attrInfo.cardinality?.length}
        <details>
          <summary>상태와 연결</summary>
          {#if attrInfo.states?.values?.length}
            <div class="sub-h">상태가 어떻게 바뀌나</div>
            <div class="states">
              {#each attrInfo.states.values as s, i}
                <span class="st">{s}</span>{#if i < attrInfo.states.values.length - 1}<span class="ar">→</span>{/if}
              {/each}
            </div>
          {/if}
          {#if attrInfo.states?.note}<div class="note">{attrInfo.states.note}</div>{/if}
          {#if attrInfo.cardinality?.length}
            <div class="sub-h">몇 개씩 이어지나</div>
            {#each attrInfo.cardinality as c}
              <div class="card-row"><b>{c.rel}</b>{#if c.evidence}<small>{c.evidence}</small>{/if}</div>
            {/each}
          {/if}
        </details>
      {/if}

      {#if attrInfo.birth?.length}
        <details>
          <summary>이 기록이 처음 만들어지는 곳</summary>
          {#each attrInfo.birth as b}
            {@const m = /^(\S+)\s+(\S+)\s*(?:\((.*)\))?$/.exec(b)}
            <div class="birth">
              {#if m?.[3]}<b>{m[3]}</b>{/if}
              <span class="mono">{m ? `${m[1]} ${m[2]}` : b}</span>
            </div>
          {/each}
        </details>
      {/if}

      <details>
        <summary>왜 이렇게 정했나</summary>
        <p class="desc">{concept.desc}</p>
        {#each concept.decisions || [] as dec}
          <button class="dec" onclick={() => (S.modalDecision = dec)}>{dec} {S.decisions[dec]?.title}</button>
        {/each}
      </details>

    {:else if d?.kind === 'draftConcept'}
      {@const dc = S.drafts.concepts[d.key]}
      {@const da = S.draftAttrs?.[d.key]}
      <div class="gap" style="background:var(--warn-soft)">⚠ 초안 — 결정은 회의 확정 전, 아래 실측은 코드 사실</div>
      <p class="desc">{dc.desc}</p>
      <h4>왜 이렇게 정했나</h4>
      {#each dc.decisions || [] as dec}
        <button class="dec" onclick={() => (S.modalDecision = dec)}>{dec} {S.drafts.decisions[dec]?.title}</button>
      {/each}
      {#if da}
        <h4>속성 — 실측 (온톨로지 ↔ 실제 컬럼)</h4>
        {#each ['core','record','variable','system','record?'] as cls}
          {@const list = (da.attributes || []).filter((a) => a.class === cls)}
          {#if list.length}
            <div class="cls-head {cls}">{cls === 'core' ? '코어' : cls === 'record' ? '역할 기록' : cls === 'variable' ? '가변' : cls === 'system' ? '시스템' : '미등재'}</div>
            {#each list as a}
              <div class="attr">
                <span class="a-onto">{a.onto}</span>
                <span class="a-col mono">{a.column}{a.type && a.type !== '—' ? ` : ${a.type}` : ''}</span>
                {#if a.note}<span class="a-note">{a.note}</span>{/if}
              </div>
            {/each}
          {/if}
        {/each}
        {#if da.states?.values?.length}
          <h4>상태 수명주기 (실측)</h4>
          <div class="states">
            {#each da.states.values as st, i}
              <span class="st">{st}</span>{#if i < da.states.values.length - 1}<span class="ar">→</span>{/if}
            {/each}
          </div>
          <div class="note">{da.states.note}</div>
        {/if}
        {#if da.cardinality?.length}
          <h4>관계</h4>
          {#each da.cardinality as c}<div class="card-row"><b>{c.rel}</b>{#if c.evidence}<small>{c.evidence}</small>{/if}</div>{/each}
        {/if}
        {#if da.birth?.length}
          <h4>이 기록이 처음 만들어지는 곳</h4>
          {#each da.birth as b}<div class="birth mono">{b}</div>{/each}
        {/if}
        {#if da.gaps?.length}
          <h4>아직 안 맞는 부분</h4>
          {#each da.gaps as g}<div class="gap">⚠ {g}</div>{/each}
        {/if}
      {:else}
        <h4>어디에 저장될 예정인가</h4>
        <div class="note mono">{dc.bind}</div>
      {/if}
    {:else if d?.kind === 'boundary'}
      {#if S.boundary}
        <div class="gap" style="background:var(--warn-soft)">문서가 아니라 양쪽 코드를 직접 읽어서 맞춰 본 것입니다</div>
        <h4>매핑 — 마인드봄 8종 → 플랫폼 6종</h4>
        <table class="inst">
          {#each S.boundary.mapping as m}
            <tr><td class="mono" style="width:110px">{m.mindbom}</td>
                <td class="mono" style="width:80px; font-weight:700">{m.platform}</td></tr>
            <tr><td colspan="2" style="font-size:var(--fs-xs); color:var(--sub); padding-bottom:6px">{m.verdict}</td></tr>
          {/each}
        </table>
        <h4>거꾸로 되돌아가는 경우 (문서엔 없던 것)</h4>
        {#each S.boundary.mindbom_states.reverse_transitions as r}<div class="birth mono">{r}</div>{/each}
        <h4>아직 안 맞는 부분</h4>
        {#each S.boundary.gaps as g}<div class="gap">⚠ {g}</div>{/each}
      {/if}
    {:else if d?.kind === 'instance'}
      <table class="inst">
        {#each Object.entries(d.node.data).filter(([, v]) => typeof v !== 'object' || v === null).slice(0, 18) as [k, v]}
          <tr><td>{k}</td><td class="mono">{v === null ? '—' : String(v).slice(0, 56)}</td></tr>
        {/each}
      </table>
      {#if d.node.data.id && d.node.concept === 'subject'}
        <div class="note">✓ client_id 기억됨 — 다른 개념의 client_id 필터에 붙여 쓸 수 있다</div>
      {/if}

    {:else if d?.kind === 'draft' && S.draft}
      <h4>기관 이름</h4>
      <input bind:value={S.draft.name} placeholder="예: 요양원" />
      <h4>이 기관이 일하는 방식 <em>가장 중요한 판정</em></h4>
      <select bind:value={S.draft.loop}>
        <option value="">— 선택 —</option><option>상담용</option><option>검사용</option><option>제3의 루프</option>
      </select>
      <div class="note">"명단 올리고 → 뿌리고 → 집계"면 검사용, "한 명과 깊게"면 상담용.
        둘 다 아니면 파일 추가로는 안 되고 화면을 새로 만들어야 한다.</div>
      <h4>개념을 뭐라고 부르나 <em>체크를 끄면 이 기관엔 없는 것</em></h4>
      {#each Object.entries(S.catalog.concepts) as [k, c]}
        <div class="ed-row">
          <input type="checkbox" checked={S.draft.exists[k] !== false}
                 onchange={(e) => (S.draft.exists[k] = (e.target as HTMLInputElement).checked)} />
          <label style="color:{c.color}">{c.label}</label>
          <input type="text" bind:value={S.draft.vocab[k]} placeholder="이 기관의 말" disabled={S.draft.exists[k] === false} />
        </div>
      {/each}
      <h4>대상자에게 더 받는 정보 <em>쉼표로 구분</em></h4>
      <input bind:value={varText} placeholder="예: 입소일, 요양 등급" />
      <h4>소속 단위가 몇 단계인가 <em>없으면 비움</em></h4>
      <input bind:value={S.draft.hierarchy} placeholder="예: 층 > 생활실" />
      <h4>그 사람임을 무엇으로 확인하나</h4>
      <input bind:value={S.draft.identifier.type} placeholder="예: 입소번호 (평생)" />
      <button class="primary" onclick={applyDraft}>지도·미리보기에 적용해 보기</button>
      <button class="ghost-btn" onclick={judgeDraft}>빠진 것 점검</button>
      <button class="ghost-btn" onclick={exportDraft}>기관 정의 파일로 내보내기</button>
      {#if judge}
        <h4>점검 결과</h4>
        {#each judge as i}
          <div class="gap" class:danger={i.lv === 'danger'} class:info={i.lv === 'info'}>
            {i.lv === 'danger' ? '⛔' : i.lv === 'warn' ? '⚠' : 'ℹ'} {i.msg}
          </div>
        {/each}
        {#if !judge.some((i) => i.lv === 'danger')}
          <div class="gap ok">막는 문제 없음 — 파일 하나 추가로 되는 기관입니다. 내보낸 파일이 그대로 산출물.</div>
        {/if}
      {/if}
    {/if}
  </div>
</aside>

<style>
  .panel { width: 330px; background: #fff; border-left: 1px solid var(--line); overflow-y: auto; flex-shrink: 0; }
  .head { padding: 14px 16px 10px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: #fff; z-index: 2; }
  .head h2 { font-size: 14.5px; }
  .head h2 small { font-weight: 400; color: var(--sub); font-size: 11px; }
  .head > small { display: block; color: var(--sub); font-size: var(--fs-sm); line-height: 1.55; margin-top: 3px; }
  .head .where { font-size: var(--fs-xs); margin-top: 5px; }
  .bs { font-style: normal; font-weight: 700; }
  .bs.bound { color: var(--ok); } .bs.partial { color: var(--warn); } .bs.missing { color: var(--danger); }
  .close { position: absolute; right: 10px; top: 12px; border: none; background: var(--bg); border-radius: 8px; width: 24px; height: 24px; font-size: 12px; color: var(--sub); }
  .body { padding: 12px 16px 40px; font-size: 12px; }
  .desc { font-size: 12px; line-height: 1.65; }
  h4 { font-size: var(--fs-md); color: var(--ink); font-weight: 700; margin: 22px 0 8px; }
  h4.first { margin-top: 4px; }
  h4 em { font-style: normal; font-weight: 400; font-size: var(--fs-xs); color: var(--sub); margin-left: 5px; }
  .dec { display: block; width: 100%; text-align: left; border: none; background: #eef1f6; border-radius: 8px; padding: 5px 10px; font-size: 11px; margin-bottom: 4px; }
  .dec:hover { background: var(--accent-soft); color: var(--accent); }
  /* 분류는 소제목과 여백으로 가른다 — 상자·색 띠는 정보량 대비 시선을 너무 많이 가져간다.
     색은 카드의 3색 막대와 잇는 점 하나로만 남긴다. */
  .grp { margin-bottom: 22px; }
  .grp:last-of-type { margin-bottom: 8px; }
  .cls-head { display: flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 600;
    color: var(--sub); line-height: 1.5; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  .cls-head::before { content: ''; width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; background: #cbd5e1; }
  .grp.core .cls-head::before { background: var(--core); }
  .grp.record .cls-head::before { background: var(--record); }
  .grp.variable .cls-head::before { background: var(--variable); }
  .grp.record\? .cls-head::before { background: #d4a017; }

  /* 접이식 — 근거·관계·문제는 필요할 때만 편다 */
  details { border-top: 1px solid var(--line); margin-top: 4px; }
  summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 7px;
    padding: 12px 0; font-size: var(--fs-md); font-weight: 700; color: var(--ink); }
  summary::-webkit-details-marker { display: none; }
  summary em { font-style: normal; font-size: var(--fs-xs); font-weight: 700; color: var(--warn);
    background: var(--warn-soft); border-radius: 7px; padding: 1px 7px; }
  summary::after { content: ''; width: 6px; height: 6px; margin-left: auto; margin-bottom: 3px;
    border-right: 1.5px solid var(--sub); border-bottom: 1.5px solid var(--sub);
    transform: rotate(45deg); transition: transform .15s ease; }
  details[open] summary::after { transform: rotate(-135deg); margin-bottom: -2px; }
  details > :last-child { margin-bottom: 14px; }
  .sub-h { font-size: var(--fs-xs); color: var(--sub); font-weight: 600; margin: 10px 0 5px; }
  .attr { padding: 8px 0; }
  .attr + .attr { border-top: 1px solid #f2f5f9; }
  .a-top { display: flex; align-items: baseline; gap: 6px; }
  .a-onto { font-weight: 600; font-size: var(--fs-sm); flex-shrink: 0; }
  .a-onto.unnamed { font-family: 'SF Mono', Menlo, monospace; font-weight: 500; color: var(--sub); }
  .a-req { font-size: 10px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border-radius: 5px; padding: 0 5px; flex-shrink: 0; }
  .a-col { margin-left: auto; max-width: 58%; font-size: var(--fs-xs); color: var(--sub); overflow-wrap: anywhere; text-align: right; }
  .a-col.none { color: var(--danger); }
  .a-meta { margin-top: 2px; display: flex; flex-wrap: wrap; gap: 4px 8px; }
  .a-type { font-size: var(--fs-xs); color: #94a3b8; }
  .a-note { font-size: var(--fs-xs); color: var(--sub); line-height: 1.5; overflow-wrap: anywhere; }
  .cls-head b { margin-left: auto; font-size: var(--fs-xs); color: #94a3b8; font-weight: 600; font-variant-numeric: tabular-nums; }
  .states { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .st { border: 1.5px solid #b9c4d6; border-radius: 14px; padding: 1px 10px; font-size: 11px; font-weight: 600; }
  .ar { color: #94a3b8; font-size: var(--fs-xs); }
  .card-row { padding: 6px 0; border-bottom: 1px solid #f5f7fa; }
  .card-row:last-of-type { border-bottom: none; }
  .card-row b { font-size: var(--fs-sm); display: block; font-family: 'SF Mono', Menlo, monospace; }
  .card-row small { color: var(--sub); font-size: var(--fs-xs); line-height: 1.5; }
  .birth { font-size: var(--fs-xs); color: var(--sub); padding: 5px 0; line-height: 1.5; }
  .birth b { display: block; color: var(--ink); font-size: var(--fs-sm); font-weight: 600; }
  .gap { font-size: 11px; background: var(--warn-soft); border-radius: 8px; padding: 6px 9px; margin: 4px 0; }
  .gap.danger { background: var(--danger-soft); }
  .gap.info { background: var(--bg); color: var(--sub); }
  .gap.ok { background: var(--ok-soft); color: var(--ok); }
  .trace { font-size: var(--fs-sm); border-top: 1px solid #f0f3f8; padding: 5px 0; }
  .trace .mono { display: block; font-size: var(--fs-xs); color: var(--sub); margin-top: 2px; }
  .t-tag { font-size: var(--fs-xs); font-weight: 700; border-radius: 5px; padding: 0 5px; background: var(--warn-soft); color: var(--warn); }
  .more { border: none; background: none; color: var(--accent); font-size: 11px; padding: 4px 0; }
  .chip { display: inline-block; font-size: var(--fs-sm); border-radius: 8px; padding: 1px 8px; margin: 1px 2px 1px 0; background: #eef1f6; }
  .chip.gone { background: var(--danger-soft); color: var(--danger); text-decoration: line-through; }
  .note { font-size: var(--fs-sm); color: var(--sub); background: var(--bg); border-radius: 8px; padding: 7px 10px; margin-top: 6px; }
  .inst { width: 100%; border-collapse: collapse; }
  .inst td { padding: 3px 4px; font-size: 11px; border-bottom: 1px solid #f0f3f8; }
  .inst td:first-child { color: var(--sub); width: 96px; }
  input, select { width: 100%; border: 1.5px solid var(--line); border-radius: 8px; padding: 6px 9px; font-size: 12px; font-family: inherit; margin-bottom: 7px; }
  .ed-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
  .ed-row label { flex: 1; font-size: 11.5px; font-weight: 600; }
  .ed-row input[type='text'] { flex: 1.4; margin: 0; }
  .ed-row input[type='checkbox'] { width: auto; margin: 0; }
  .primary { border: none; background: var(--accent); color: #fff; border-radius: 9px; padding: 8px 16px; font-size: 12.5px; font-weight: 700; width: 100%; margin-top: 6px; }
  .ghost-btn { border: 1.5px solid var(--line); background: #fff; border-radius: 9px; padding: 7px 16px; font-size: 12px; width: 100%; margin-top: 6px; }
</style>
