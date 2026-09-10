<script lang="ts">
  import { S, loadAll, login, setProfile } from './lib/app.svelte'
  import ModelCanvas from './lib/ModelCanvas.svelte'
  import PreviewView from './lib/PreviewView.svelte'
  import MatrixView from './lib/MatrixView.svelte'
  import AuditView from './lib/AuditView.svelte'
  import ConsoleView from './lib/ConsoleView.svelte'
  import DetailPanel from './lib/DetailPanel.svelte'
  import DecisionModal from './lib/DecisionModal.svelte'
  import { fade, fly } from 'svelte/transition'

  let email = $state('manager@test.com')
  let pw = $state('test1234')

  loadAll()

  /* 이 파일 한 장이 기관 하나 — 위 '기관 종류'를 바꾸면 아래 내용이 통째로 갈린다 */
  const profileJson = () => {
    const p = S.profileKey === '__draft__' ? S.draft : S.profiles[S.profileKey]
    return JSON.stringify(p, null, 2)
  }
</script>

<div class="shell">
  <header>
    <h1>온톨로지 탐색기 <small>기관이 달라져도 같은 개념 — 무엇이 있고 어디에 저장되나</small></h1>
    <nav class="views">
      <button class:on={S.view === 'model'} onclick={() => (S.view = 'model')}>개념 지도</button>
      <button class:on={S.view === 'audit'} onclick={() => (S.view = 'audit')}>
        화면 점검 {#if S.audit}<em>{S.audit.summary.total}</em>{/if}
      </button>
      <button class:on={S.view === 'console'} onclick={() => (S.view = 'console')}>실제 데이터</button>
    </nav>
    <div class="auth">
      {#if S.token}
        <span class="badge">{S.who}</span>
        <select bind:value={S.centerId} onchange={() => { const c = S.centers.find(c => c.id === S.centerId); S.centerName = c?.name }}>
          {#each S.centers as c}<option value={c.id}>{c.name}</option>{/each}
        </select>
      {:else}
        <input bind:value={email} placeholder="email" />
        <input bind:value={pw} type="password" class="pw" />
        <button class="login" onclick={() => login(email, pw)}>로그인</button>
      {/if}
    </div>
  </header>

  <main>
    {#if !S.loaded}
      <div class="loading">데이터 로딩…</div>
    {:else}
      <div class="body">
        <div class="center-col">
          {#if S.view === 'model'}
            <div class="pf-bar">
              <span class="lbl">기관 종류</span>
              {#each Object.entries(S.profiles) as [k, p]}
                <button class="pf" class:on={S.profileKey === k} onclick={() => setProfile(k)}>
                  {p.name}<em>{p.loop}</em>
                </button>
              {/each}
              {#if S.draft}
                <button class="pf draft" class:on={S.profileKey === '__draft__'} onclick={() => setProfile('__draft__')}>
                  {S.draft.name || '만드는 중'}<em>임시</em>
                </button>
              {/if}
              <button class="pf draft" onclick={() => (S.detail = { kind: 'draft' })}>＋ 새 기관</button>
              {#if S.transitionMsg}
                <span class="trans" transition:fly={{ y: -8, duration: 200 }}>{S.transitionMsg}</span>
              {/if}
            </div>
            <div class="model-tabs">
              <button class:on={S.modelTab === 'graph'} onclick={() => (S.modelTab = 'graph')}>지도</button>
              <button class:on={S.modelTab === 'preview'} onclick={() => (S.modelTab = 'preview')}>화면 미리보기</button>
              <button class:on={S.modelTab === 'matrix'} onclick={() => (S.modelTab = 'matrix')}>기관별 말 비교</button>
              <button class:on={S.modelTab === 'json'} onclick={() => (S.modelTab = 'json')}>기관 정의</button>
            </div>
            {#if S.modelTab === 'graph'}<ModelCanvas />
            {:else if S.modelTab === 'preview'}<PreviewView />
            {:else if S.modelTab === 'matrix'}<MatrixView />
            {:else}
              <div class="pf-wrap">
                <div class="pf-guide">
                  <b>지금 보는 기관: {S.profiles[S.profileKey]?.name || S.draft?.name || '—'}</b>
                  — 위에서 다른 기관을 고르면 이 파일이 통째로 갈린다.
                  <div class="pf-sub">기관 하나 = 이 파일 한 장. 새 기관을 받으면 코드가 아니라 이 파일이 하나 늘어난다
                  (<span class="mono">ontology/profiles/</span>).</div>
                  <div class="pf-keys">
                    <div><code>vocab</code> 이 기관에서 각 개념을 뭐라고 부르나 — <b>카드 제목이 바뀌는 자리</b>.
                      <code>null</code>이면 다른 말로 번역되는 게 아니라 <b>그 개념이 없다</b></div>
                    <div><code>loop</code> 일하는 방식 — 한 명과 깊게(상담용) / 명단 뿌리고 집계(검사용)</div>
                    <div><code>variable.subject</code> 대상자에게 더 받는 정보 — 카드의 <b>보라 칸</b></div>
                    <div><code>identifier</code> 그 사람임을 무엇으로 확인하나 (평생 번호인지, 해마다 새로 받는지)</div>
                    <div><code>hierarchy</code> 소속 단위가 몇 단계인가 · <code>sections</code> 등록 화면에 넣을 항목</div>
                  </div>
                </div>
                <pre class="pf-json">{profileJson()}</pre>
              </div>
            {/if}
          {:else if S.view === 'audit'}
            <AuditView />
          {:else}
            <ConsoleView />
          {/if}
        </div>
        {#if S.detail}<DetailPanel />{/if}
      </div>
    {/if}
  </main>

  {#if S.modalDecision}<DecisionModal />{/if}
  {#if S.toast}<div class="toast" transition:fade>{S.toast}</div>{/if}
</div>

<style>
  :global(:root) {
    /* 글자 크기는 여기 여섯 단계만 쓴다 — 컴포넌트가 제각각 정하면 화면이 난잡해진다.
       바닥은 11px: 지도는 축소해서 보므로 그보다 작으면 실제로 안 읽힌다. */
    --fs-xs: 11px;   /* 보조 설명·범례 */
    --fs-sm: 12px;   /* 표 본문·칩 */
    --fs-md: 13px;   /* 기본 본문 */
    --fs-lg: 15px;   /* 소제목 */
    --fs-xl: 18px;   /* 카드 제목 */
    --fs-2xl: 22px;  /* 화면 제목·큰 숫자 */
    --ink: #1a2333; --sub: #5b6577; --line: #dfe4ec; --bg: #f6f8fb;
    --accent: #4486ff; --accent-soft: #eaf1ff;
    --ok: #15803d; --ok-soft: #e7f6ec; --warn: #b45309; --warn-soft: #fef3e2;
    --danger: #b91c1c; --danger-soft: #fdeaea;
    --core: #334155; --record: #0e7490; --variable: #7c3aed;
  }
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html, body, #app) { height: 100%; }
  :global(body) {
    font-family: 'Pretendard', 'Apple SD Gothic Neo', -apple-system, 'Noto Sans KR', sans-serif;
    color: var(--ink); background: var(--bg); overflow: hidden;
  }
  :global(button) { font-family: inherit; cursor: pointer; }
  :global(.mono) { font-family: 'SF Mono', Menlo, Consolas, monospace; }

  .shell { height: 100%; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 16px; padding: 10px 18px; background: #fff; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  h1 { font-size: var(--fs-lg); }
  h1 small { font-weight: 400; color: var(--sub); font-size: var(--fs-xs); margin-left: 8px; }
  .views { display: flex; border: 1.5px solid var(--line); border-radius: 10px; overflow: hidden; }
  .views button { border: none; background: #fff; padding: 7px 20px; font-size: var(--fs-md); font-weight: 700; color: var(--sub); }
  .views button.on { background: var(--accent); color: #fff; }
  .views em { font-style: normal; font-size: var(--fs-xs); opacity: .85; }
  .auth { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: var(--fs-sm); }
  .auth input { border: 1.5px solid var(--line); border-radius: 8px; padding: 5px 10px; font-size: var(--fs-sm); width: 150px; font-family: inherit; }
  .auth input.pw { width: 86px; }
  .auth .login { border: none; background: var(--ink); color: #fff; border-radius: 8px; padding: 6px 14px; font-size: var(--fs-sm); }
  .auth select { border: 1.5px solid var(--line); border-radius: 8px; padding: 5px 9px; font-size: var(--fs-sm); max-width: 180px; font-family: inherit; }
  .badge { background: var(--ok-soft); color: var(--ok); border-radius: 9px; padding: 2px 9px; font-weight: 700; }

  main { flex: 1; overflow: hidden; }
  .body { display: flex; height: 100%; overflow: hidden; }
  .center-col { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .loading { padding: 60px; text-align: center; color: var(--sub); font-size: var(--fs-md); }
  .pf-bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 10px 16px 0; background: var(--bg); flex-shrink: 0; }
  .pf-bar .lbl { font-size: var(--fs-sm); font-weight: 700; color: var(--sub); margin-right: 2px; }
  .pf { border: 1.5px solid var(--line); background: #fff; border-radius: 18px; padding: 5px 15px; font-size: var(--fs-md); font-weight: 600; }
  .pf.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .pf.draft { border-style: dashed; }
  .pf em { font-style: normal; font-size: var(--fs-xs); background: #eef1f6; color: var(--sub); border-radius: 7px; padding: 0 6px; margin-left: 5px; }
  .pf.on em { background: #fff; }
  .trans { font-size: var(--fs-xs); color: var(--sub); margin-left: 4px; }
  .model-tabs { display: flex; gap: 2px; padding: 8px 16px 0; background: var(--bg); flex-shrink: 0; }
  .model-tabs button { border: 1px solid var(--line); border-bottom: none; background: #eef1f6; border-radius: 9px 9px 0 0; padding: 7px 18px; font-size: var(--fs-sm); font-weight: 600; color: var(--sub); }
  .model-tabs button.on { background: #fff; color: var(--ink); }
  .pf-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; margin: 0 16px 16px; }
  .pf-guide { background: #fff; border: 1px solid var(--line); border-bottom: none; border-radius: 0 12px 0 0;
    padding: 14px 22px; font-size: var(--fs-sm); line-height: 1.65; color: var(--sub); flex-shrink: 0; }
  .pf-guide b { color: var(--ink); }
  .pf-sub { margin-top: 3px; }
  .pf-keys { margin-top: 8px; display: grid; gap: 4px; }
  .pf-keys code { background: #eef1f6; border-radius: 5px; padding: 1px 6px; margin-right: 4px;
    font-family: 'SF Mono', Menlo, monospace; font-size: var(--fs-xs); color: var(--ink); }
  .pf-json { flex: 1; min-height: 0; overflow: auto; background: #fff; border: 1px solid var(--line); border-radius: 0 0 12px 12px; padding: 16px 22px; font-size: var(--fs-sm); line-height: 1.7; font-family: 'SF Mono', Menlo, monospace; }
  .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; border-radius: 10px; padding: 10px 20px; font-size: var(--fs-md); z-index: 99; max-width: 640px; }
</style>
