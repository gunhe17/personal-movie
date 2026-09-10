<script lang="ts">
  import { S } from './app.svelte'
  const TYPES = [
    ['total', '전체', '#1a2333', '전체'],
    ['vocab_hardcode', '"내담자"를 코드에 직접 박음', '#b45309', '말이 코드에 박힘'],
    ['role_branch', 'role 값으로 화면을 가름', '#6d3fc0', 'role로 화면 가름'],
    ['noun_exposure', '내부 용어가 화면에 노출', '#b91c1c', '내부 용어 노출'],
    ['guardian_as_row', '보호자를 대상자와 같은 줄에', '#b0387a', '보호자 같은 줄'],
  ] as const
  const rows = $derived(S.audit.violations.filter((v: any) => !S.auditFilter || v.type === S.auditFilter))
  const TYPE_LABEL = Object.fromEntries(TYPES.map(([k, , , short]) => [k, short])) as Record<string, string>
</script>

<div class="wrap">
  <p class="intro">모델대로 안 만들어진 화면 코드를 실제로 세어 본 목록이다.
    여기 있는 곳들을 고쳐야 기관을 바꿨을 때 화면이 따라 바뀐다 — <b>고칠 곳이 몇 군데인지가 곧 이 숫자</b>.
    <br>다시 세려면 <span class="mono">pnpm audit</span></p>
  <div class="cards">
    {#each TYPES as [k, label, color]}
      <button class="card" class:on={S.auditFilter === (k === 'total' ? null : k)}
              onclick={() => (S.auditFilter = k === 'total' ? null : k)}>
        <b style="color:{color}">{S.audit.summary[k] || 0}</b><small>{label}</small>
      </button>
    {/each}
  </div>
  <table>
    <thead><tr><th style="width:150px">무엇이 문제인가</th><th style="width:90px">개념</th><th>어느 파일</th><th>코드</th><th>비고</th></tr></thead>
    <tbody>
      {#each rows as v}
        {@const c = S.catalog.concepts[v.concept]}
        <tr>
          <td><span class="tag t-{v.type}">{TYPE_LABEL[v.type] || v.type}</span></td>
          <td style="color:{c?.color}; font-weight:600">{c?.label || v.concept}</td>
          <td class="mono">{v.file}:{v.line}</td>
          <td class="mono code">{(v.code || '').slice(0, 58)}</td>
          <td class="note-c">{v.note || ''}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap { flex: 1; overflow: auto; padding: 20px 24px; }
  .intro { font-size: var(--fs-md); color: var(--sub); margin-bottom: 16px; line-height: 1.7; max-width: 900px; }
  .intro .mono { font-size: var(--fs-sm); background: #eef1f6; border-radius: 6px; padding: 1px 7px; }
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; max-width: 900px; }
  .card { background: #fff; border: 1.5px solid var(--line); border-radius: 12px; padding: 12px 16px; text-align: left; }
  .card.on { border-color: var(--accent); }
  .card b { font-size: var(--fs-2xl); display: block; }
  .card small { font-size: var(--fs-xs); color: var(--sub); line-height: 1.4; display: block; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
  th { background: #f0f3f8; text-align: left; padding: 9px 12px; font-size: var(--fs-sm); color: var(--sub); }
  td { padding: 8px 12px; border-top: 1px solid #f0f3f8; vertical-align: top; }
  td.mono { font-size: var(--fs-xs); }
  td.code { color: var(--sub); }
  .note-c { font-size: var(--fs-xs); color: var(--sub); line-height: 1.5; }
  .tag { font-size: var(--fs-xs); font-weight: 600; border-radius: 7px; padding: 2px 8px; display: inline-block; line-height: 1.45; }
  .t-vocab_hardcode { background: var(--warn-soft); color: var(--warn); }
  .t-role_branch { background: #f1ecfb; color: #6d3fc0; }
  .t-noun_exposure { background: var(--danger-soft); color: var(--danger); }
  .t-guardian_as_row { background: #fdeef6; color: #b0387a; }
</style>
