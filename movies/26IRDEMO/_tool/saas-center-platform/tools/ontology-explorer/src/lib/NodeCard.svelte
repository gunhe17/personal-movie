<script lang="ts">
  import { S, activeProfile } from './app.svelte'
  import { fly, scale as sc, fade } from 'svelte/transition'

  let { key, concept, exists, flip = false }:
    { key: string; concept: any; exists: boolean; flip?: boolean } = $props()

  const prof = $derived(activeProfile())
  const vocab = $derived(prof?.vocab?.[key] ?? null)
  const title = $derived(vocab || concept.label)
  const binding = $derived(S.bindings?.[key] || {})
  const attrs = $derived(S.attributes?.[key]?.attributes || [])
  const counts = $derived({
    core: attrs.filter((a: any) => a.class === 'core').length,
    record: attrs.filter((a: any) => a.class === 'record' || a.class === 'record?').length,
    variable: key === 'subject' ? (prof?.variable?.subject?.length ?? 0) : attrs.filter((a: any) => a.class === 'variable').length,
  })
  const violations = $derived(S.audit?.violations.filter((v: any) => v.concept === key).length || 0)
  const sub = $derived(
    key === 'subject' && prof?.variable?.subject ? prof.variable.subject.join(' · ')
    : key === 'orgUnit' && prof?.hierarchy ? prof.hierarchy
    : ''
  )

  const GROUPS = [
    { cls: 'core', label: '어디서나 같은' },
    { cls: 'record', label: '기관이 가진' },
    { cls: 'variable', label: '기관마다 다른' },
  ]
  /* hover 목록 — 막대 순서와 같은 순서로 편다. 이름만, 컬럼·타입은 상세 패널 몫. */
  const fieldGroups = $derived(GROUPS.map((g) => {
    let names: string[] =
      g.cls === 'record'
        ? attrs.filter((a: any) => a.class === 'record' || a.class === 'record?').map((a: any) => a.onto)
        : attrs.filter((a: any) => a.class === g.cls).map((a: any) => a.onto)
    if (g.cls === 'variable' && key === 'subject') names = prof?.variable?.subject ?? []
    return { ...g, names: names.filter((n) => n && n !== '(미분류)') }
  }).filter((g) => g.names.length))

  /* 저장 상태는 '문제일 때만' 말한다 — 정상(bound)까지 배지를 달면 7장이 전부 시끄럽다.
     자세한 것(테이블명·컬럼)은 카드를 누르면 오른쪽 패널에 나온다. */
  const WARN = { partial: '일부만 저장됨', missing: '아직 테이블 없음' } as Record<string, string>
</script>

{#if exists}
  <div class="card" class:missing={binding.status === 'missing'}
       style="border-color: {concept.color}"
       in:sc={{ duration: 320, start: 0.7 }} out:sc={{ duration: 320, start: 0.7 }}
       onclick={(e) => { e.stopPropagation(); S.detail = { kind: 'concept', key } }}
       role="button" tabindex="0" onkeydown={() => {}}>
    <div class="title-wrap">
      {#key title}
        <b in:fly={{ y: 12, duration: 280 }} out:fly={{ y: -12, duration: 200 }} style="color:{concept.color}">{title}</b>
      {/key}
    </div>
    {#if vocab && vocab !== concept.label}
      <small class="neutral">공통 이름 · {concept.label}</small>
    {/if}
    {#if concept.plain}<p class="plain">{concept.plain}</p>{/if}
    {#if sub}<small class="sub">{sub}</small>{/if}

    <!-- 정보 세 종류의 비율 (뭐가 얼마나 있는지) -->
    {#if counts.core + counts.record + counts.variable > 0}
      <div class="minibar" title="어디서나 같은 정보 {counts.core} · 기관이 가진 정보 {counts.record} · 기관마다 다른 정보 {counts.variable}">
        {#if counts.core}<span class="seg core" style="flex:{counts.core}"></span>{/if}
        {#if counts.record}<span class="seg record" style="flex:{counts.record}"></span>{/if}
        {#key counts.variable}
          {#if counts.variable}<span class="seg variable" style="flex:{counts.variable}" in:sc={{ duration: 350, start: 0.2 }}></span>{/if}
        {/key}
      </div>
    {/if}

    {#if fieldGroups.length}
      <div class="fields" class:flip>
        {#each fieldGroups as g}
          <div class="frow">
            <span class="fdot {g.cls}"></span>
            <span class="flabel">{g.label}</span>
            <span class="fnames">{g.names.join(' · ')}</span>
          </div>
        {/each}
        {#if binding.table}<div class="ftable">{binding.table} 표에 저장</div>{/if}
      </div>
    {/if}

    {#if WARN[binding.status] || violations}
      <div class="flags">
        {#if WARN[binding.status]}<span class="bind {binding.status}">{WARN[binding.status]}</span>{/if}
        {#if violations}
          <button class="vchip" title="이 개념을 잘못 쓴 화면 {violations}곳 — 화면 점검 탭"
                  onclick={(e) => { e.stopPropagation(); S.view = 'audit'; S.auditFilter = null }}>화면 {violations}곳 ⚠</button>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <!-- 이 기관엔 아예 없는 개념 — 다른 말로 부르는 게 아니라 사라진다 -->
  <button class="ghost" in:fade={{ duration: 400, delay: 250 }}
          onclick={(e) => { e.stopPropagation(); S.modalDecision = 'A3' }}>
    <b>{concept.label}</b>
    <small>이 기관엔 없음</small>
    <small class="why">다른 말로 바꾸는 게 아니라 화면에서 사라진다 — 눌러서 이유 보기</small>
  </button>
{/if}

<style>
  .card { position: relative; border: 2px solid; border-radius: 14px; background: #fff; padding: 13px 16px 12px; text-align: center;
    cursor: pointer; user-select: none; box-shadow: 0 2px 10px rgba(20, 30, 60, 0.08); width: 100%; }
  .card.missing { border-style: dashed; opacity: 0.72; background: #fdfdfd; }
  .title-wrap { position: relative; height: 26px; overflow: hidden; }
  .title-wrap b { position: absolute; left: 0; right: 0; font-size: var(--fs-xl); }
  .neutral { display: block; color: var(--sub); font-size: var(--fs-xs); margin-top: 2px; }
  .plain { color: var(--sub); font-size: var(--fs-sm); line-height: 1.5; margin-top: 6px; }
  .sub { display: block; color: var(--sub); font-size: var(--fs-xs); line-height: 1.5; margin-top: 4px; font-weight: 600; }
  .minibar { display: flex; gap: 3px; height: 7px; margin: 10px 10px 0; }
  .seg { border-radius: 3px; }
  .seg.core { background: var(--core); }
  .seg.record { background: var(--record); }
  .seg.variable { background: var(--variable); outline: 1px dashed var(--variable); outline-offset: 1px; }

  /* 마우스를 올렸을 때만 — 평소엔 막대(비율)만 보이고, 올리면 그 안의 이름이 펼쳐진다.
     display 토글은 전환이 안 걸리므로 opacity·transform으로 부드럽게 낸다.
     들어올 땐 살짝 늦게(지도를 가로지르다 스치는 카드마다 깜빡이지 않게), 나갈 땐 즉시. */
  .fields { position: absolute; left: -2px; right: -2px; top: calc(100% + 6px); z-index: 20;
    background: #fff; border: 1.5px solid var(--line); border-radius: 12px; padding: 9px 12px;
    box-shadow: 0 6px 20px rgba(20, 30, 60, 0.14); text-align: left;
    opacity: 0; visibility: hidden; pointer-events: none;
    transform: translateY(-5px) scale(0.98); transform-origin: top center;
    transition: opacity .16s ease, transform .18s cubic-bezier(.2, .8, .3, 1), visibility .16s; }
  .fields.flip { top: auto; bottom: calc(100% + 6px); transform: translateY(5px) scale(0.98); transform-origin: bottom center; }
  .card:hover .fields, .card:focus-visible .fields {
    opacity: 1; visibility: visible; pointer-events: auto; transform: none;
    transition-delay: .12s; }
  @media (prefers-reduced-motion: reduce) {
    .fields { transition: opacity .01s; transform: none; }
    .fields.flip { transform: none; }
  }
  .frow { display: grid; grid-template-columns: 8px 62px 1fr; gap: 5px; align-items: baseline; margin-bottom: 4px; }
  .fdot { width: 7px; height: 7px; border-radius: 2px; }
  .fdot.core { background: var(--core); }
  .fdot.record { background: var(--record); }
  .fdot.variable { background: var(--variable); outline: 1px dashed var(--variable); outline-offset: 1px; }
  .flabel { font-size: var(--fs-xs); color: var(--sub); }
  .fnames { font-size: var(--fs-xs); line-height: 1.5; color: var(--ink); }
  .ftable { font-size: var(--fs-xs); color: var(--sub); border-top: 1px solid #f0f3f8; margin-top: 6px; padding-top: 5px; }

  .flags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 9px; }
  .bind { font-size: var(--fs-xs); font-weight: 600; border-radius: 7px; padding: 2px 9px; }
  .bind.partial { background: var(--warn-soft); color: var(--warn); }
  .bind.missing { background: var(--danger-soft); color: var(--danger); }
  .vchip { border: none; font-size: var(--fs-xs); font-weight: 600; border-radius: 7px; padding: 2px 9px; background: var(--warn-soft); color: var(--warn); }

  .ghost { width: 100%; border: 2px dashed #c4cdd9; border-radius: 14px; background: transparent; padding: 14px; text-align: center; }
  .ghost b { display: block; font-size: var(--fs-lg); color: #9aa5b5; }
  .ghost small { display: block; font-size: var(--fs-xs); color: #b0bac7; margin-top: 4px; line-height: 1.5; }
  .ghost:hover { border-color: var(--danger); }
  .ghost:hover small { color: var(--danger); }
</style>
