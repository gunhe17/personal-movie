<!--
  영상 촬영용 목 에이전트 — 스크립트 편집기.

  화면에 뜨는 채팅 UI는 없다. 여기서 스크립트를 걸고 촬영을 시작하면,
  이후에는 어느 화면에서든 단축키로 다음 턴을 넘긴다(촬영 프레임에 조작 흔적 없음).
-->
<script lang="ts">
  import { mockAgent, ADVANCE_KEY } from '$lib/features/agent-mock/store.svelte'
  import { PRESETS } from '$lib/features/agent-mock/presets'
  import type { MockScript } from '$lib/features/agent-mock/store.svelte'

  let draft = $state(JSON.stringify(PRESETS[0].script, null, 2))
  let error = $state('')

  function parse(): MockScript | null {
    try {
      const v = JSON.parse(draft) as MockScript
      if (!v || !Array.isArray(v.turns)) throw new Error('turns 배열이 필요해요')
      error = ''
      return v
    } catch (e) {
      error = (e as Error).message
      return null
    }
  }

  function loadPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key)
    if (p) {
      draft = JSON.stringify(p.script, null, 2)
      error = ''
    }
  }

  function start() {
    const script = parse()
    if (script) mockAgent.start(script)
  }
</script>

<div class="mx-auto flex max-w-[880px] flex-col gap-6 pb-8">
  <div class="flex h-11 items-center">
    <h1 class="text-headline-01-normal-semibold text-body-strong">촬영용 목 에이전트</h1>
  </div>

  <section class="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-white p-6">
    <p class="text-body-02-reading-regular text-body-default">
      화면에 뜨는 채팅창은 없어요. 스크립트를 걸고 촬영을 시작한 뒤, 어느 화면에서든
      <strong class="text-body-strong">{ADVANCE_KEY}</strong> 키를 누르면 다음 턴이 실행돼요.
      실제 화면 채우기 도구가 그대로 돌아가니 촬영본에 찍히는 동작은 진짜예요.
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-body-02-normal-medium text-title-subtitle">프리셋</span>
      {#each PRESETS as p (p.key)}
        <button
          type="button"
          class="rounded-lg border border-border-default bg-white px-4 py-2
                 text-body-03-normal-medium text-title-subtitle hover:border-primary-400"
          onclick={() => loadPreset(p.key)}>{p.label}</button
        >
      {/each}
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-body-02-normal-medium text-title-subtitle">스크립트 (JSON)</span>
      <textarea
        bind:value={draft}
        rows="22"
        spellcheck="false"
        class="w-full resize-y rounded-lg border border-border-default bg-white p-4
               font-mono text-body-03-normal-regular text-body-default focus:outline-primary-500"
      ></textarea>
      {#if error}
        <p class="text-body-03-normal-regular text-status-danger">JSON 오류 — {error}</p>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg bg-primary-500 px-5 py-3 text-body-02-normal-medium text-white"
        onclick={start}>촬영 시작</button
      >
      {#if mockAgent.active}
        <button
          type="button"
          class="rounded-lg border border-border-default bg-white px-5 py-3
                 text-body-02-normal-medium text-title-subtitle disabled:text-gray-400"
          onclick={() => mockAgent.advance()}
          disabled={mockAgent.busy || mockAgent.finished}>다음 턴 ({ADVANCE_KEY})</button
        >
        <button
          type="button"
          class="rounded-lg border border-border-default bg-white px-5 py-3
                 text-body-02-normal-medium text-title-subtitle"
          onclick={() => mockAgent.reset()}>처음으로</button
        >
        <button
          type="button"
          class="rounded-lg border border-border-default bg-white px-5 py-3
                 text-body-02-normal-medium text-title-subtitle"
          onclick={() => mockAgent.stop()}>촬영 종료</button
        >
      {/if}
    </div>

    {#if mockAgent.active}
      <div class="flex flex-col gap-2 rounded-xl bg-bg-base p-4">
        <span class="text-body-02-normal-medium text-title-subtitle">
          진행 {mockAgent.cursor}/{mockAgent.script.turns.length}
        </span>
        {#if mockAgent.nextTurn}
          <span class="text-body-02-reading-regular text-body-default">
            다음 — {mockAgent.nextTurn.label}
          </span>
        {:else}
          <span class="text-body-02-reading-regular text-body-default">스크립트가 끝났어요.</span>
        {/if}
        {#if mockAgent.lastError}
          <span class="text-body-03-normal-regular text-status-danger">
            도구 실패 — {mockAgent.lastError}
          </span>
        {/if}
      </div>
    {/if}
  </section>

  <section class="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-white p-6">
    <h2 class="text-headline-02-normal-semibold text-body-strong">스크립트 형식</h2>
    <dl class="flex flex-col gap-3 text-body-02-reading-regular text-body-default">
      <div>
        <dt class="text-body-02-normal-medium text-title-subtitle">turns[].label</dt>
        <dd>이 턴이 무엇인지 적어두는 메모예요. 촬영 화면에는 나오지 않아요.</dd>
      </div>
      <div>
        <dt class="text-body-02-normal-medium text-title-subtitle">turns[].leadMs</dt>
        <dd>키를 누른 뒤 화면이 반응하기까지의 간격이에요. 기본 300이에요.</dd>
      </div>
      <div>
        <dt class="text-body-02-normal-medium text-title-subtitle">turns[].tools[]</dt>
        <dd>
          실행할 화면 도구예요. <code>page.navigate</code>로 이동하고
          <code>page.set_fields</code>로 폼을 채워요. <code>args</code>가 곧 prefill 인자라,
          채울 값은 전부 여기서 정해요.
        </dd>
      </div>
      <div>
        <dt class="text-body-02-normal-medium text-title-subtitle">tools[].delayMs</dt>
        <dd>도구를 쏘기 전 대기예요. 화면 전환과 입력 사이에 호흡을 줘요. 기본 400이에요.</dd>
      </div>
    </dl>
    <p class="text-body-03-normal-regular text-title-subtitle">
      내담자·검사자·장소는 <code>&#123;"name": "박지우"&#125;</code> 처럼 이름만 넣어도 화면에
      얹혀요. 검사자를 대표로 세우려면 <code>id</code>를 함께 넣어요. 시간은
      <code>start_time</code>과 <code>end_time</code>을 항상 같이 넣어요.
    </p>
  </section>
</div>
