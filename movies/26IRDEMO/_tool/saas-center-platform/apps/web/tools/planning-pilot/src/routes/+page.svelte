<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation'
  import { parsePlan } from '$lib/schema'
  import type { Plan } from '$lib/types'
  import type { PageData } from './$types'
  import '$lib/editor-shell.css'
  import '$lib/planning-motion.css'
  let { data }: { data: PageData } = $props()
  let search = $state('')
  let title = $state('')
  let screen = $state('')
  let goal = $state('')
  let planId = $state('')
  let message = $state('')
  let busy = $state(false)
  let imported = $state<Plan | null>(null)
  let dialog: HTMLDialogElement
  let filtered = $derived(
    data.plans.filter((plan) =>
      (plan.title + ' ' + plan.screen)
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  )
  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 512000) {
      message = '기획 파일은 500KB 이하로 가져오세요.'
      return
    }
    try {
      imported = parsePlan(JSON.parse(await file.text()))
      dialog.showModal()
    } catch (reason) {
      message =
        reason instanceof Error ? reason.message : '파일을 읽지 못했습니다.'
    }
  }
  async function create() {
    busy = true
    message = ''
    try {
      const plan = imported ?? {
        id: planId.trim() || 'plan-' + crypto.randomUUID().slice(0, 8),
        title,
        screen,
        goal,
        reviewedAt: '',
        baseline: '',
        notice:
          '기획 목적을 입력한 상태입니다. 후보 준비 요청 후 조사된 초안을 확인하세요.',
        existing: [],
        features: []
      }
      parsePlan(plan)
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      dialog.close()
      await goto('/plans/' + result.id)
    } catch (reason) {
      message = reason instanceof Error ? reason.message : '기획 생성 실패'
    } finally {
      busy = false
    }
  }
</script>

<svelte:head><title>기획 워크스페이스</title></svelte:head>
<div class="project-home">
  <aside class="project-sidebar" aria-label="프로젝트 탐색">
    <a href="/" class="project-workspace"
      ><span>▦</span>
      <div>
        <strong>기획 워크스페이스</strong><small
          >함께 만드는 제품의 다음 단계</small
        >
      </div></a
    >
    <nav>
      <a href="/" aria-current="page"
        ><span>▣</span> 모든 프로젝트 <b>{data.plans.length}</b></a
      ><button
        onclick={() => {
          imported = null
          message = ''
          dialog.showModal()
        }}><span>＋</span> 새 프로젝트</button
      ><label class="project-import" for="import-plan"
        ><span>↥</span> 기획 파일 가져오기</label
      ><input
        id="import-plan"
        class="sr-only"
        type="file"
        accept=".json,application/json"
        onchange={importFile}
      />
    </nav>
    <div class="project-sidebar-note">
      <span class="editor-small-label">기획을 확인하는 네 가지 관점</span>
      <p>기획과 범위</p>
      <p>정상·예외 시나리오</p>
      <p>기존 동작 영향과 누락</p>
      <p>실제 구현과의 차이</p>
    </div>
    <div class="project-sidebar-bottom">
      <span class="editor-connection" class:connected={data.ai.available}
        >{data.ai.label}</span
      >
      <p>프로젝트와 저장 기록은 이 컴퓨터에서 관리해요.</p>
    </div>
  </aside>
  <main class="project-main">
    <div class="project-heading">
      <div>
        <p>워크스페이스</p>
        <h1>모든 프로젝트</h1>
      </div>
      <button
        class="project-create"
        onclick={() => {
          imported = null
          message = ''
          dialog.showModal()
        }}>＋ 새 프로젝트</button
      >
    </div>
    <div class="project-toolbar">
      <label for="search" class="sr-only">프로젝트 검색</label><input
        id="search"
        type="search"
        bind:value={search}
        placeholder="프로젝트 이름이나 대상 화면 검색"
      /><span>{filtered.length}개 프로젝트</span><button
        onclick={() => invalidateAll()}
        aria-label="프로젝트 목록 새로고침">↻</button
      >
    </div>
    {#if data.warnings.length}<div class="pending-text" role="alert">
        {#each data.warnings as warning}<p>{warning}</p>{/each}
      </div>{/if}
    {#if message}<p role="status">{message}</p>{/if}
    <div class="project-grid">
      {#each filtered as plan, index}<a
          class="project-card"
          href={'/plans/' + plan.id}
          style:animation-delay={`${Math.min(index * 40, 240)}ms`}
        >
          <div class="project-preview" data-tone={index % 3}>
            <div class="preview-tree" aria-hidden="true">
              <i></i><span></span><span></span><span></span>
            </div>
            <span class="project-preview-status"
              >{plan.features.length
                ? '검토 항목 ' + plan.features.length + '개'
                : '초안 준비'}</span
            >
          </div>
          <div class="project-card-body">
            <h2>{plan.title}</h2>
            <p>{plan.goal}</p>
            <div>
              <span>{plan.scenarios?.length ?? 0}개 시나리오</span><span
                >프로젝트 열기 ↗</span
              >
            </div>
          </div>
        </a>{/each}
    </div>
    {#if !filtered.length}<div class="project-empty">
        <span>◇</span>
        <h2>
          {search ? '검색한 프로젝트가 없어요.' : '첫 기획을 시작해 보세요.'}
        </h2>
        <p>
          {search
            ? '다른 이름이나 대상 화면으로 검색해 주세요.'
            : '해결하려는 문제를 적으면 요구사항부터 흐름과 예외까지 함께 정리할 수 있어요.'}
        </p>
        {#if !search}<button
            onclick={() => {
              imported = null
              dialog.showModal()
            }}>＋ 새 프로젝트</button
          >{/if}
      </div>{/if}
  </main>
</div>
<dialog class="project-dialog" bind:this={dialog} aria-labelledby="new-title">
  <div class="review-dialog-heading">
    <h2 id="new-title">
      {imported ? '조사된 기획 가져오기' : '새 기획 시작하기'}
    </h2>
    <button onclick={() => dialog.close()}>닫기</button>
  </div>
  {#if imported}<p>{imported.title} · 검토 항목 {imported.features.length}개</p>
    <p>{imported.goal}</p>
    <p class="muted">ID: {imported.id} · 기존 기획은 덮어쓰지 않습니다.</p>
  {:else}<form
      id="create-plan"
      onsubmit={(event) => {
        event.preventDefault()
        create()
      }}
    >
      <label for="title">기획 이름</label><input
        id="title"
        required
        maxlength="200"
        bind:value={title}
        placeholder="예: 예약 변경 흐름"
      /><label for="screen">대상 화면 · 코드 경로</label><input
        id="screen"
        maxlength="1000"
        bind:value={screen}
        placeholder="예: /schedule 또는 관련 파일 경로"
      /><label for="goal">해결할 문제</label><textarea
        id="goal"
        required
        maxlength="4000"
        bind:value={goal}
        placeholder="누가, 어떤 상황에서 무엇을 할 수 있어야 하나요?"
      ></textarea>
      <details>
        <summary>기획 ID 직접 지정</summary><label for="plan-id" class="sr-only"
          >기획 ID</label
        ><input
          id="plan-id"
          maxlength="80"
          bind:value={planId}
          placeholder="영문 소문자·숫자·하이픈, 비우면 자동 생성"
        />
      </details>
    </form>{/if}
  {#if message}<p role="alert">{message}</p>{/if}
  <div class="review-dialog-actions">
    {#if imported}<button class="primary" disabled={busy} onclick={create}
        >가져오기</button
      >{:else}<button class="primary" form="create-plan" disabled={busy}
        >기획 만들기</button
      >{/if}
  </div>
</dialog>
