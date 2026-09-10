<script lang="ts">
  // 계보 = 이 요청이 실제로 만진 테이블. 정적 분석이 아니라 실행 실측 —
  // 파라미터가 바뀌면 그래프도 바뀐다(owner_scope 유무로 케이스 테이블이 켜졌다 꺼진다).
  let { trace, url }: { trace: any; url: string } = $props()

  const CORE = 'clients sessions counseling_sessions'.split(' ')
  const tables = $derived((trace?.tables ?? []) as string[])
  const H = $derived(Math.max(300, 70 + tables.length * 58))
  const Y = (i: number) => 46 + i * 58
  const MID = $derived(H / 2)
</script>

<div class="wrap">
  <svg width="1040" height={H}>
    {#each tables as t, i}
      <path d="M 470 {MID} C 560 {MID}, 580 {Y(i) + 16}, 640 {Y(i) + 16}"
            fill="none" stroke="#c4cdd9" stroke-width="1.4" />
    {/each}
    <line x1="196" y1={MID} x2="248" y2={MID} stroke="#c4cdd9" stroke-width="1.4" />
    <line x1="416" y1={MID} x2="470" y2={MID} stroke="#c4cdd9" stroke-width="1.4" />
  </svg>

  <div class="node req" style="top:{MID - 26}px">
    <b>요청</b><small class="mono">{url.split('?')[0].replace('/api/v1/ontology', '…')}</small>
  </div>

  <div class="node axis" style="top:{MID - 30}px">
    <small>{trace?.axis ?? 'center_type'}</small>
    <b>{trace?.coordinate ?? '?'}</b>
    <small class="op mono">{trace?.operation ?? ''}</small>
  </div>

  {#each tables as t, i}
    <div class="node table" class:core={CORE.includes(t)} style="top:{Y(i)}px">{t}</div>
  {/each}

  <p class="foot">
    가운데가 <b>연산 노드</b> — 이 테이블들이 <i>함께</i> 하나의 응답을 만든다는 뜻이다.
    좌표({trace?.coordinate})가 바뀌면 오른쪽 묶음도 바뀐다.
  </p>
</div>

<style>
  .wrap { position: relative; padding: 8px 0 0 12px; }
  svg { display: block; }
  .node { position: absolute; background: #fff; border: 1.5px solid var(--line); border-radius: 11px; padding: 7px 13px; font-size: 12px; }
  .node b { display: block; font-size: 13px; }
  .node small { display: block; color: var(--sub); font-size: 10px; }
  .req { left: 12px; width: 184px; }
  .axis { left: 260px; width: 156px; border-color: #7fb8c9; background: #f2fafc; text-align: center; }
  .axis b { color: #0e7490; font-size: 14px; }
  .axis .op { margin-top: 3px; font-size: 9px; word-break: break-all; }
  .table { left: 652px; font-family: 'SF Mono', Menlo, monospace; font-size: 11.5px; }
  .table.core { border-color: #2456c4; color: #2456c4; font-weight: 700; }
  .foot { margin: 14px 0 0 4px; font-size: 11.5px; color: var(--sub); max-width: 700px; }
  .mono { font-family: 'SF Mono', Menlo, monospace; }
</style>
