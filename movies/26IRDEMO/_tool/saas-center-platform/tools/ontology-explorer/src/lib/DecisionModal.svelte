<script lang="ts">
  import { S } from './app.svelte'
  import { fade, scale } from 'svelte/transition'
  const dec = $derived(S.decisions?.[S.modalDecision || ''] ?? S.drafts?.decisions?.[S.modalDecision || ''])
</script>

{#if dec}
  <div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => (S.modalDecision = null)} role="presentation">
    <div class="box" transition:scale={{ duration: 180, start: 0.94 }} onclick={(e) => e.stopPropagation()} role="dialog">
      <span class="did">{S.modalDecision}</span>
      <h3>{dec.title}</h3>
      <p>{dec.summary}</p>
      {#if (S.modalDecision || '').startsWith('AS')}<p style="font-size:11px;color:var(--warn)">⚠ 초안 결정 — 정렬 회의 확정 전</p>{/if}
      <a href="/온톨로지-모델-결정장부.html" onclick={(e) => { e.preventDefault(); window.open('http://localhost:3503' + '/온톨로지-모델-결정장부.html', '_blank') }}>결정 장부 전문 (docs/ontology/) ↗</a>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(20,30,60,.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
  .box { background: #fff; border-radius: 16px; padding: 22px 26px; max-width: 480px; box-shadow: 0 10px 40px rgba(20,30,60,.25); }
  .did { font-size: 11px; font-weight: 700; color: var(--accent); }
  h3 { font-size: 15px; margin: 4px 0 8px; }
  p { font-size: 13px; line-height: 1.7; margin-bottom: 14px; }
  a { font-size: 11.5px; color: var(--accent); }
</style>
