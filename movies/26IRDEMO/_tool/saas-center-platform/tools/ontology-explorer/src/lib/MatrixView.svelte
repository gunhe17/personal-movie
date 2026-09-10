<script lang="ts">
  import { S } from './app.svelte'
</script>

<div class="wrap">
  <table>
    <thead><tr><th>공통 개념</th>
      {#each Object.values(S.profiles) as p}<th>{p.name} <em>{p.loop}</em></th>{/each}
    </tr></thead>
    <tbody>
      {#each Object.entries(S.catalog.concepts) as [k, c]}
        <tr><td style="color:{c.color}; font-weight:700">{c.label}</td>
          {#each Object.values(S.profiles) as p}
            {@const v = p.vocab?.[k]}
            <td>{#if v === null}<span class="gone">이 기관엔 없음</span>{:else}{v || c.label}{/if}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="foot">가로 한 줄이 같은 개념이다 — 기관만 바꾸면 제품이 그 기관의 말로 바뀐다.
    "이 기관엔 없음"은 다른 말로 번역하는 게 아니라 그 기능 자체가 화면에서 사라진다는 뜻.</p>
</div>

<style>
  .wrap { flex: 1; overflow: auto; padding: 22px; background: var(--bg); }
  table { max-width: 880px; margin: 0 auto; width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); font-size: var(--fs-md); }
  th { text-align: left; padding: 10px 14px; background: #f0f3f8; font-size: var(--fs-sm); color: var(--sub); }
  th em { font-style: normal; font-size: var(--fs-xs); background: #eef1f6; border-radius: 7px; padding: 0 6px; }
  td { padding: 9px 14px; border-top: 1px solid #f0f3f8; }
  .gone { color: var(--danger); }
  .foot { max-width: 880px; margin: 12px auto 0; font-size: var(--fs-sm); color: var(--sub); line-height: 1.7; }
</style>
