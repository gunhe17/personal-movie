<script lang="ts">
  import { S, activeProfile } from './app.svelte'
  import { fly, slide } from 'svelte/transition'
  const prof = $derived(activeProfile())
  const Sname = $derived(prof?.vocab?.subject || '대상자')
  const G = $derived(prof?.vocab?.guardianRel)
  const gEx = $derived(prof?.exists?.guardianRel !== false)
  const uEx = $derived(prof?.exists?.orgUnit === true)
  const varFields = $derived(prof?.variable?.subject || [])
</script>

<div class="wrap">
  <div class="banner"><b>가짜 화면입니다</b> — 위에서 기관을 바꾸면 화면이 어떻게 달라져야 하는지 보여주는 그림.
    실제 제품 화면이 이것과 같아지면 끝난 것이고, 지금은 {S.audit.summary.total}곳이 다릅니다 (화면 점검 탭).</div>
  <div class="cols">
    <div class="reg">
      {#key Sname}<h3 in:fly={{ y: 8, duration: 250 }}>{Sname} 등록</h3>{/key}
      <div class="hint">어느 기관에서나 똑같이 받는 것 <button class="dchip" onclick={() => (S.modalDecision = 'A2')}>왜?</button></div>
      {#each ['이름', '생년월일', '성별', '전화'] as f}
        <div class="field"><label>{f}</label><div class="input">입력</div></div>
      {/each}
      {#if varFields.length}
        <div class="sec" transition:slide>이 기관에서만 받는 것 <button class="dchip" onclick={() => (S.modalDecision = 'A3')}>왜?</button></div>
        {#each varFields as f (f)}
          <div class="field" transition:slide><label>{f}</label><div class="input">입력</div></div>
        {/each}
      {/if}
      {#if gEx && G}
        <div class="sec" transition:slide>{G} 정보 (선택)</div>
        <div class="field" transition:slide><label>{G} 이름</label><div class="input">입력</div></div>
      {/if}
      {#if prof?.sections?.sibling}
        <div class="sec" transition:slide>형제 함께 등록</div>
      {/if}
      <div class="submit">등록</div>
    </div>
    <div class="list">
      {#key Sname}<h3 in:fly={{ y: 8, duration: 250 }}>{Sname} 관리</h3>{/key}
      <div class="tabs2">
        <span class="tab on">전체</span>
        {#if gEx && G}<span class="tab" transition:slide>{G}</span>{/if}
      </div>
      {#if !gEx}
        <div class="gone-note" transition:slide>← 이 기관엔 보호자 탭이 <b>아예 없다</b> (다른 말로 바뀌는 게 아니라)
          <button class="dchip" onclick={() => (S.modalDecision = 'A3')}>왜?</button></div>
      {/if}
      <table>
        <thead><tr>
          <th>이름</th>{#if varFields[0]}<th>{varFields[0]}</th>{/if}
          {#if gEx && G}<th>{G}</th>{/if}{#if uEx}<th>{prof.vocab.orgUnit}</th>{/if}<th>상태</th>
        </tr></thead>
        <tbody>
          {#each [['김OO', '활성'], ['이OO', '활성'], ['박OO', '종결']] as r}
            <tr><td><b>{r[0]}</b></td>{#if varFields[0]}<td>…</td>{/if}
              {#if gEx && G}<td>최OO ☎</td>{/if}{#if uEx}<td>…</td>{/if}<td>{r[1]}</td></tr>
          {/each}
        </tbody>
      </table>
      {#if gEx && G}
        <div class="d4-note">목록의 한 줄은 {Sname} 한 명 — {G}는 그 줄에 딸린 정보로 붙는다
          <button class="dchip" onclick={() => (S.modalDecision = 'D4')}>왜?</button></div>
      {/if}
    </div>
  </div>
</div>

<style>
  .wrap { flex: 1; overflow: auto; padding: 22px; background: var(--bg); }
  .banner { max-width: 920px; margin: 0 auto 18px; background: var(--warn-soft); border-radius: 10px; padding: 11px 16px; font-size: var(--fs-sm); line-height: 1.65; }
  .cols { max-width: 920px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1.25fr; gap: 18px; align-items: start; }
  .reg { background: #fff; border: 1.5px solid var(--line); border-radius: 14px; padding: 18px 20px; }
  h3 { font-size: var(--fs-lg); margin-bottom: 12px; }
  .hint { font-size: var(--fs-xs); color: var(--sub); margin-bottom: 10px; }
  .field { margin-bottom: 9px; }
  .field label { display: block; font-size: var(--fs-xs); color: var(--sub); margin-bottom: 3px; }
  .input { border: 1.5px solid var(--line); border-radius: 8px; padding: 8px 12px; font-size: var(--fs-sm); color: #b9c4d6; background: #fff; }
  .sec { font-size: var(--fs-md); font-weight: 700; margin: 16px 0 9px; padding-top: 12px; border-top: 1px dashed var(--line); }
  .submit { display: inline-block; background: var(--accent); color: #fff; border-radius: 9px; padding: 8px 24px; font-size: var(--fs-md); font-weight: 700; margin-top: 14px; }
  .tabs2 { display: flex; gap: 6px; margin-bottom: 12px; }
  .tab { border: 1.5px solid var(--line); color: var(--sub); border-radius: 16px; padding: 4px 15px; font-size: var(--fs-sm); font-weight: 600; }
  .tab.on { border-color: var(--accent); color: var(--accent); }
  .gone-note { font-size: var(--fs-xs); color: var(--danger); margin: -4px 0 10px; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  th { text-align: left; font-size: var(--fs-xs); color: var(--sub); padding: 8px 12px; background: #f0f3f8; }
  td { font-size: var(--fs-sm); padding: 8px 12px; border-top: 1px solid #f0f3f8; }
  .d4-note { font-size: var(--fs-xs); color: var(--sub); margin-top: 10px; line-height: 1.55; }
  .dchip { border: none; font-size: var(--fs-xs); font-weight: 600; border-radius: 6px; padding: 1px 8px; background: #eef1f6; color: var(--sub); margin-left: 4px; }
  .dchip:hover { background: var(--accent-soft); color: var(--accent); }
</style>
