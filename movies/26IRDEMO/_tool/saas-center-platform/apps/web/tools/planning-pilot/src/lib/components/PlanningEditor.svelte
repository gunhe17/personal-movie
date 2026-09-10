<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { AIConnection } from '$lib/ai'
  import { invalidateAll } from '$app/navigation'
  import { restoreDraft } from '$lib/schema'
  import {
    conflicts,
    needsAnswer,
    shortLabels,
    blockingDecisions,
    addFollowUp
  } from '$lib/types'
  import type { FollowUp, Decision } from '$lib/types'
  import type { Plan, Draft, Selection, RecordEntry } from '$lib/types'
  import FeatureDetail from './FeatureDetail.svelte'
  import SelectionSummary from './SelectionSummary.svelte'
  import PlanningResult from './PlanningResult.svelte'
  import DecisionBoard from './DecisionBoard.svelte'
  import FlowMap from './FlowMap.svelte'
  import ReviewWorkspace from './ReviewWorkspace.svelte'
  import '$lib/planning-motion.css'
  import PlanningAudit from './PlanningAudit.svelte'
  import { auditCoverage } from '$lib/audit'
  import ImplementationComparison from './ImplementationComparison.svelte'
  import '$lib/planning-page.css'
  import '$lib/editor-shell.css'
  let {
    data
  }: {
    data: {
      plan: Plan
      revision: string
      thread: string | null
      ai: AIConnection
      records: RecordEntry[]
    }
  } = $props()
  let draft = $state<Draft>({
    goal: '',
    additional: '',
    items: [],
    activeId: ''
  })
  let ready = $state(false)
  let busy = $state(false)
  let uploading = $state(false)
  let message = $state('')
  let recordPath = $state('')
  let selectedRecord = $state('')
  let preview = $state<Selection | null>(null)
  let dialog: HTMLDialogElement
  let detail = $state<FeatureDetail>()
  let loadedRevision = ''
  const views = [
    { id: 'review', label: '기획' },
    { id: 'flow', label: '시나리오' },
    { id: 'audit', label: '영향·누락 점검' },
    { id: 'comparison', label: '구현 비교' }
  ] as const
  type View = (typeof views)[number]['id'] | 'features'
  let view = $state<View>('review')
  let presentation = $state<'document' | 'map'>('document')
  let leftOpen = $state(true)
  let utility = $state<'decisions' | 'results' | 'history' | null>(null)
  const primaryView = $derived(view === 'features' ? 'review' : view)
  function toggleUtility(next: 'decisions' | 'results' | 'history') {
    utility = utility === next ? null : next
  }
  function addRequest(text: string) {
    const next = [draft.additional.trim(), text].filter(Boolean).join('\n\n')
    if (next.length > 8000) {
      message = '추가 의견은 8,000자까지 작성할 수 있어요.'
      return
    }
    draft.additional = next
  }
  let settingsDialog: HTMLDialogElement
  let resultCount = $state(0)
  let resultWaiting = $state(false)
  const normalCount = $derived(
    (data.plan.scenarios ?? []).filter((entry) => entry.kind === 'normal')
      .length
  )
  const exceptionCount = $derived(
    (data.plan.scenarios ?? []).filter((entry) => entry.kind === 'exception')
      .length
  )
  async function navigateTabs(event: KeyboardEvent) {
    const current = views.findIndex((entry) => entry.id === primaryView)
    const index =
      event.key === 'ArrowRight'
        ? (current + 1) % views.length
        : event.key === 'ArrowLeft'
          ? (current + views.length - 1) % views.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? views.length - 1
              : -1
    if (index < 0 || uploading) return
    event.preventDefault()
    view = views[index].id
    await tick()
    document.getElementById('tab-' + view)?.focus()
  }
  function addQuestion(question: string, title: string) {
    if (draft.decisions?.some((entry) => entry.question === question.trim())) {
      message = '이미 남은 결정에 등록된 질문입니다.'
      return
    }
    importQuestion(
      {
        id: 'flow-' + crypto.randomUUID(),
        question: question.trim(),
        context: title + ' 흐름을 검토하며 남긴 질문입니다.',
        featureId: '',
        owner: 'together',
        blocking: true
      },
      ''
    )
  }
  const storageKey = () => 'planning-workspace:v1:' + data.plan.id
  const selection = (): Selection => ({
    goal: draft.goal,
    additional: draft.additional,
    items: draft.items,
    contentReviews: draft.contentReviews,
    decisions: draft.decisions ?? []
  })
  let coverage = $derived(auditCoverage(data.plan, selection()))
  let decisionBlockers = $derived(blockingDecisions(selection()))
  function importQuestion(
    followUp: FollowUp,
    origin: string,
    excluded = false
  ) {
    if (draft.decisions?.some((decision) => decision.id === followUp.id)) return
    if ((draft.decisions?.length ?? 0) >= 60) {
      message = '질문은 최대 60개입니다. 현재 질문을 먼저 정리하세요.'
      return
    }
    const next = addFollowUp(draft.decisions ?? [], followUp, origin)
    draft.decisions = next.map((decision) =>
      decision.id === followUp.id && excluded
        ? { ...decision, status: 'excluded' as Decision['status'] }
        : decision
    )
    message = excluded
      ? '이번 범위에서 제외한 질문으로 기록했습니다.'
      : '남은 결정에 추가했습니다. 답변과 담당을 정한 뒤 임시 저장하세요.'
  }
  let activeIndex = $derived(
    draft.items.findIndex((item) => item.id === draft.activeId)
  )
  let active = $derived(
    data.plan.features.find((feature) => feature.id === draft.activeId)
  )
  let blocked = $derived(conflicts(data.plan, draft))
  let included = $derived(
    draft.items.filter((item) => item.choice === 'include').length
  )
  let groups = $derived([
    ...new Set(data.plan.features.map((feature) => feature.group))
  ])
  let changed = $derived(
    draft.receipt
      ? draft.receipt.snapshot !== JSON.stringify(selection())
      : false
  )
  let canSend = $derived(
    ready &&
      !busy &&
      !uploading &&
      data.ai.available &&
      !!draft.goal.trim() &&
      !blocked.length &&
      !!data.plan.features.length
  )
  onMount(() => {
    leftOpen = !window.matchMedia('(max-width: 900px)').matches
    let saved: unknown
    try {
      saved = JSON.parse(localStorage.getItem(storageKey()) || 'null')
      if (!saved && data.plan.id === 'ai-case-analysis')
        saved = JSON.parse(
          localStorage.getItem(
            'planning-pilot:' +
              data.plan.baseline +
              ':' +
              (data.thread || 'local')
          ) || 'null'
        )
    } catch {
      message =
        '브라우저 초안을 읽지 못했습니다. 저장 기록에서 불러올 수 있습니다.'
    }
    draft = restoreDraft(saved, data.plan)
    loadedRevision = data.revision
    ready = true
  })
  $effect(() => {
    if (!ready) return
    if (loadedRevision !== data.revision) {
      draft = restoreDraft(draft, data.plan)
      loadedRevision = data.revision
      message = '기획 초안이 갱신됐습니다. 변경된 선택지를 확인하세요.'
    }
    try {
      localStorage.setItem(storageKey(), JSON.stringify(draft))
    } catch {
      message = '브라우저 보관에 실패했습니다. 임시 저장을 눌러 보관하세요.'
    }
  })
  async function pick(id: string) {
    if (uploading) return
    draft.activeId = id
    view = 'features'
    await tick()
    detail?.focus()
  }
  function includeDependencies() {
    if (!active) return
    for (const id of active.dependencies) {
      const item = draft.items.find((item) => item.id === id)!
      item.choice = 'include'
      const requirement = active.requirements?.find(
        (requirement) => requirement.featureId === id
      )
      if (requirement) item.behavior = requirement.optionId
    }
  }
  function review() {
    preview = JSON.parse(JSON.stringify(selection()))
    dialog.showModal()
  }
  async function submit(send: boolean) {
    if (busy || uploading) return
    const snapshot: Selection =
      send && preview ? preview : JSON.parse(JSON.stringify(selection()))
    busy = true
    message = send ? '기획 정리를 요청하는 중…' : '기획을 저장하는 중…'
    try {
      const response = await fetch(
        '/api/plans/' + data.plan.id + '/' + (send ? 'send' : 'save'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selection: snapshot, revision: data.revision })
        }
      )
      const result = await response.json()
      if (result.path) recordPath = result.path
      if (!response.ok) throw new Error(result.error)
      if (result.delivered) utility = 'results'
      if (result.delivered)
        draft.receipt = {
          snapshot: JSON.stringify(snapshot),
          at: new Date().toISOString()
        }
      message = result.completed
        ? '기획 정리가 완료됐습니다. 오른쪽 문서에서 결과를 확인하세요.'
        : result.delivered
          ? '기획 정리를 요청했습니다. 완료되면 기획 결과에 자동으로 표시됩니다.'
          : '기획과 선택 내용을 저장했습니다. 기획 보완의 저장 기록에서 다시 열 수 있습니다.'
      await invalidateAll()
    } catch (reason) {
      message = reason instanceof Error ? reason.message : '저장 실패'
    } finally {
      busy = false
      dialog?.close()
    }
  }
  async function generate() {
    if (!ready || busy || uploading || !data.ai.available || !draft.goal.trim())
      return
    busy = true
    message =
      data.ai.mode === 'cli'
        ? data.ai.label +
          '가 기획을 조사하고 있습니다. 완료까지 잠시 기다려 주세요.'
        : '대화에 요청을 전달하고 있습니다.'
    try {
      const response = await fetch('/api/plans/' + data.plan.id + '/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selection: selection(),
          revision: data.revision
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      settingsDialog?.close()
      if (result.completed) await invalidateAll()
      message = result.completed
        ? 'AI 조사를 완료하고 초안을 갱신했습니다. 변경된 기획을 검토해 주세요.'
        : '후보 준비를 요청했습니다. 대화에서 조사가 끝나면 초안 새로고침을 누르세요.'
    } catch (reason) {
      message = reason instanceof Error ? reason.message : '요청 실패'
    } finally {
      busy = false
    }
  }
  async function restore() {
    if (!selectedRecord || busy || uploading) return
    if (
      !window.confirm(
        '현재 초안은 브라우저에 백업하고, 선택한 저장 기록을 불러올까요?'
      )
    )
      return
    busy = true
    try {
      const response = await fetch(
        '/api/plans/' + data.plan.id + '/records/' + selectedRecord
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      localStorage.setItem(storageKey() + ':backup', JSON.stringify(draft))
      draft = restoreDraft(result, data.plan)
      message =
        '저장 기록을 불러왔습니다. 현재 기획에 없는 선택지는 미정으로 표시합니다.'
    } catch (reason) {
      message = reason instanceof Error ? reason.message : '불러오기 실패'
    } finally {
      busy = false
    }
  }
  function restoreBackup() {
    const backup = localStorage.getItem(storageKey() + ':backup')
    if (!backup) {
      message = '이 브라우저에 복원 전 백업이 없습니다.'
      return
    }
    draft = restoreDraft(JSON.parse(backup), data.plan)
    message = '기록을 불러오기 전 초안을 복원했습니다.'
  }
</script>

<svelte:head><title>{data.plan.title} · 기획 워크스페이스</title></svelte:head>
<div class="planning-shell editor-shell" class:left-collapsed={!leftOpen}>
  <header class="editor-project-header">
    <a href="/" class="editor-logo" aria-label="모든 프로젝트">▦</a>
    <h1 title={data.plan.title}>{data.plan.title}</h1>
    <button
      class="editor-icon"
      disabled={!ready || busy || uploading}
      onclick={() => settingsDialog.showModal()}
      aria-label="프로젝트 설정">···</button
    >
  </header>
  <header class="editor-topbar">
    <button
      class="editor-icon"
      onclick={() => (leftOpen = !leftOpen)}
      aria-label={leftOpen ? '요청 패널 접기' : '요청 패널 열기'}
      aria-expanded={leftOpen}
      aria-controls="editor-request-panel">◧</button
    >
    <div class="editor-tabs" role="tablist" aria-label="기획 작업 공간">
      {#each views as entry}<button
          id={'tab-' + entry.id}
          role="tab"
          onkeydown={navigateTabs}
          aria-selected={primaryView === entry.id}
          aria-controls={entry.id === 'review' && view === 'features'
            ? 'panel-features'
            : 'panel-' + entry.id}
          tabindex={primaryView === entry.id ? 0 : -1}
          disabled={uploading}
          onclick={() => (view = entry.id)}><i></i>{entry.label}</button
        >{/each}
    </div>
    <div class="editor-top-actions">
      <span class="editor-save-state"
        >{busy
          ? '처리 중…'
          : changed
            ? '전달 후 변경됨'
            : '브라우저 초안'}</span
      >
      <button
        id="save"
        disabled={!ready || busy || uploading || !draft.goal.trim()}
        onclick={() => submit(false)}>저장</button
      >
      <button id="send" disabled={!canSend} onclick={review}
        >기획 정리 ↗</button
      >
    </div>
  </header>
  <aside
    class="editor-request-panel"
    id="editor-request-panel"
    hidden={!leftOpen}
    aria-label="기획 요청과 작업 맥락"
  >
    <div class="editor-panel-heading">
      <span>기획 파트너</span><span
        class="editor-connection"
        class:connected={data.ai.available}>{data.ai.label}</span
      >
    </div>
    <div class="editor-request-history">
      <div class="editor-context">
        <span class="editor-small-label">이번 기획의 목적</span>
        <p>{draft.goal || data.plan.goal}</p>
        <button
          disabled={!ready || busy || uploading}
          onclick={() => settingsDialog.showModal()}>목적·맥락 편집 ↗</button
        >
      </div>
      <div class="editor-assistant-note">
        <span class="editor-assistant-icon">✦</span>
        <h2>어떤 부분을 더 구체화할까요?</h2>
        <p>
          기획을 읽으며 바꾸고 싶은 흐름이나 놓친 조건을 남겨주세요. 현재 선택과
          함께 연결된 대화로 전달해요.
        </p>
      </div>
      <div class="editor-suggestions">
        <button
          disabled={!ready || busy}
          onclick={() =>
            addRequest(
              '정상 시나리오의 진입부터 진행·제출·완료까지 빠진 단계를 찾아 보완해 주세요.'
            )}>정상 흐름 보완</button
        ><button
          disabled={!ready || busy}
          onclick={() =>
            addRequest(
              '권한·상태·입력·시간·동시 처리·부분 실패·복구·다른 업무 영향·사용자 안내를 기준으로 예외를 조사해 주세요. 미결정 정책은 질문으로 남겨주세요.'
            )}>예외·복구 조건 점검</button
        ><button
          disabled={!ready || busy}
          onclick={() =>
            addRequest(
              '이 기능이 추가되었을 때 기존 동작에서 바뀌는 부분과 유지해야 할 조건을 조사해 주세요.'
            )}>기존 동작 영향 조사</button
        >
      </div>
      <div class="editor-mobile-actions">
        <a href="/">← 프로젝트 목록</a><button
          disabled={!ready || busy || uploading || !draft.goal.trim()}
          onclick={() => submit(false)}>저장</button
        ><button disabled={!canSend} onclick={review}>기획 정리</button>
      </div>
      <div class="editor-context-summary">
        <span class="editor-small-label">현재 기획</span><button
          disabled={uploading}
          onclick={() => (view = 'features')}
          >포함 기능 <strong>{included} / {data.plan.features.length}</strong
          ></button
        ><button disabled={uploading} onclick={() => (view = 'flow')}
          >시나리오 <strong>정상 {normalCount} · 예외 {exceptionCount}</strong
          ></button
        ><button disabled={uploading} onclick={() => (utility = 'decisions')}
          >먼저 확인할 질문 <strong>{decisionBlockers.length}</strong></button
        >
      </div>
      {#if message}<div class="editor-activity" role="status">
          {message}
        </div>{/if}
    </div>
    <form
      class="editor-composer"
      onsubmit={(event) => {
        event.preventDefault()
        void generate()
      }}
    >
      <label for="editor-request">추가 요구사항 · 보완 요청</label><textarea
        id="editor-request"
        rows="5"
        maxlength="8000"
        bind:value={draft.additional}
        disabled={!ready || busy || uploading}
        placeholder="예: 제출에 실패하면 응답을 보존하고, 재시도하는 흐름을 추가해 주세요."
      ></textarea>
      <div>
        <button
          type="button"
          class="editor-refresh"
          disabled={busy || uploading}
          onclick={() => invalidateAll()}
          title="대화에서 초안을 수정한 뒤 새로고침">↻ 초안 새로고침</button
        ><button
          type="submit"
          class="editor-request-send"
          disabled={!ready ||
            !data.ai.available ||
            busy ||
            uploading ||
            !draft.goal.trim()}>{busy ? '요청 중…' : '보완 요청 ↑'}</button
        >
      </div>
      <small
        >{data.ai.available
          ? data.ai.mode === 'cli'
            ? '요청하면 AI가 실행돼요. 완료 후 초안에 반영해요.'
            : '조사가 끝나면 초안 새로고침으로 반영해요.'
          : 'CLI 로그인 후 기획 도구를 재실행하면 AI 요청을 사용할 수 있어요.'}</small
      >
    </form>
  </aside>
  <main class="planning-main editor-main">
    {#if ready}
      {#if primaryView === 'review'}<div
          class="editor-subnav"
          aria-label="기획 보기 방식"
        >
          <button
            class:active={view === 'review' && presentation === 'document'}
            onclick={() => {
              view = 'review'
              presentation = 'document'
            }}
            disabled={uploading}>기획서</button
          ><button
            class:active={view === 'review' && presentation === 'map'}
            onclick={() => {
              view = 'review'
              presentation = 'map'
            }}
            disabled={uploading}>구조도</button
          ><button
            class:active={view === 'features'}
            onclick={() => (view = 'features')}
            disabled={uploading}>기능·동작</button
          >
        </div>{/if}
      <div
        class="tab-panel"
        id="panel-review"
        role="tabpanel"
        aria-labelledby="tab-review"
        hidden={view !== 'review'}
      >
        <ReviewWorkspace
          plan={data.plan}
          selection={selection()}
          bind:presentation
          bind:reviews={draft.contentReviews}
          disabled={busy || uploading}
          onFeature={pick}
          onPrepare={() => settingsDialog.showModal()}
          onQuestion={addQuestion}
        />
      </div>
      <div
        class="tab-panel"
        id="panel-flow"
        role="tabpanel"
        aria-labelledby="tab-flow"
        hidden={view !== 'flow'}
      >
        <div class="audit-notice">
          <span
            >범위·영향 점검: 흐름 미작성 {coverage.missingFlows.length} · 영향 미확인
            {coverage.missingImpacts.length} · 전체 단계 관점 미조사 {coverage.unreviewed}{#if coverage.requirementsMissing}
              · 요구 추적 미작성{/if}</span
          ><button disabled={uploading} onclick={() => (view = 'audit')}
            >누락·미결정 확인 →</button
          >
        </div>
        <FlowMap
          plan={data.plan}
          selection={selection()}
          disabled={busy || uploading}
          connected={data.ai.available}
          onPrepare={generate}
          onQuestion={addQuestion}
          onFeature={pick}
        />
      </div>
      <div
        class="tab-panel"
        id="panel-audit"
        role="tabpanel"
        aria-labelledby="tab-audit"
        hidden={view !== 'audit'}
      >
        <PlanningAudit
          plan={data.plan}
          selection={selection()}
          disabled={busy || uploading}
          onPrepare={() => settingsDialog.showModal()}
          onFeature={pick}
          onQuestion={addQuestion}
        />
      </div>
      <div
        class="tab-panel feature-page"
        id="panel-features"
        role="tabpanel"
        aria-labelledby="tab-review"
        hidden={view !== 'features'}
      >
        <div class="panel-intro">
          <div>
            <h2>필요한 범위부터, 동작까지</h2>
            <p>
              선택한 기능만 펼쳐서 검토합니다. 변경 내용은 흐름 지도에도
              반영됩니다.
            </p>
          </div>
          <button
            disabled={busy || uploading || !data.ai.available}
            onclick={() => settingsDialog.showModal()}>후보 보완 요청 ↗</button
          >
        </div>
        {#if blocked.length}<div class="dependency-banner">
            <strong>선행 관계를 확인하세요</strong
            >{#each blocked as feature}<button onclick={() => pick(feature.id)}
                >{feature.title} →</button
              >{/each}
          </div>{/if}
        {#if data.plan.features.length}
          <div class="workspace">
            <section class="candidate-pane" aria-labelledby="candidates-title">
              <div class="pane-heading">
                <h2 id="candidates-title">
                  검토할 기능 <span class="count"
                    >{data.plan.features.length}</span
                  >
                </h2>
                <span class="muted">범위와 동작 선택</span>
              </div>
              {#each groups as group}<p class="group">{group}</p>
                {#each data.plan.features.filter((feature) => feature.group === group) as feature}
                  {@const item = draft.items.find(
                    (item) => item.id === feature.id
                  )!}
                  <div
                    class:active={draft.activeId === feature.id}
                    class="feature"
                    id={'row-' + feature.id}
                    data-choice={item.choice}
                  >
                    <button
                      class="feature-button"
                      aria-controls="detail"
                      aria-current={draft.activeId === feature.id
                        ? 'true'
                        : 'false'}
                      disabled={uploading}
                      onclick={() => pick(feature.id)}
                      ><span class="feature-title">{feature.title}</span><span
                        class="feature-kind">{feature.kind}</span
                      ><span class="item-progress"
                        >{needsAnswer(item)
                          ? '동작 선택 필요'
                          : item.reviewed
                            ? '참고 내용 확인함'
                            : ''}</span
                      ></button
                    ><span class="status-badge">{shortLabels[item.choice]}</span
                    >
                  </div>
                {/each}{/each}
            </section>
            <section
              class="detail-pane"
              id="detail"
              aria-label="선택한 항목 상세"
            >
              {#if active && activeIndex >= 0}{#key active.id}<FeatureDetail
                    bind:this={detail}
                    plan={data.plan}
                    feature={active}
                    bind:item={draft.items[activeIndex]}
                    blocked={blocked.some(
                      (feature) => feature.id === active!.id
                    )}
                    onDependency={includeDependencies}
                    onBusy={(value) => (uploading = value)}
                    onMessage={(value) => (message = value)}
                    onQuestion={(question) => {
                      if (
                        draft.decisions?.some(
                          (decision) =>
                            decision.featureId === active!.id &&
                            decision.question === question.trim()
                        )
                      ) {
                        message = '이미 남은 결정에 등록된 질문입니다.'
                        return
                      }
                      importQuestion(
                        {
                          id: 'effect-' + crypto.randomUUID(),
                          question: question.trim(),
                          context:
                            active!.title +
                            '의 영향·상태 변화를 정리하며 남긴 질문입니다.',
                          featureId: active!.id,
                          owner: 'together',
                          blocking: true
                        },
                        ''
                      )
                    }}
                  />{/key}{/if}
            </section>
          </div>
        {:else}<div class="panel-empty">
            <h2>아직 검토할 후보가 없습니다</h2>
            <p>목적과 관련 구현을 바탕으로 후보를 준비하세요.</p>
            <button
              class="primary"
              disabled={busy || !data.ai.available || !draft.goal.trim()}
              onclick={generate}>AI에 후보 준비 요청</button
            >
          </div>{/if}
      </div>
      <div
        class="tab-panel"
        id="panel-comparison"
        role="tabpanel"
        aria-labelledby="tab-comparison"
        hidden={view !== 'comparison'}
      >
        <ImplementationComparison
          plan={data.plan}
          selection={selection()}
          revision={data.revision}
          disabled={busy || uploading}
          onBusy={(value) => (uploading = value)}
          onImport={(question, origin) => {
            if (
              draft.decisions?.some(
                (entry) =>
                  entry.origin === origin &&
                  entry.question === question.question
              )
            ) {
              message = '이미 남은 결정에 등록된 질문입니다.'
              return
            }
            importQuestion(question, origin)
          }}
        />
      </div>
    {:else}<div class="panel-empty"><p>기획을 불러오는 중…</p></div>{/if}
  </main>
  <nav class="editor-tools" aria-label="프로젝트 검토 도구">
    <button
      aria-label="남은 결정"
      aria-pressed={utility === 'decisions'}
      onclick={() => toggleUtility('decisions')}
      ><span>☷</span><small>결정</small>{#if decisionBlockers.length}<b
          >{decisionBlockers.length}</b
        >{/if}</button
    >
    <button
      aria-label="기획 문서"
      aria-pressed={utility === 'results'}
      onclick={() => toggleUtility('results')}
      ><span>▤</span><small>문서</small>{#if resultCount || resultWaiting}<b
          >{resultWaiting ? '·' : resultCount}</b
        >{/if}</button
    >
    <button
      aria-label="저장 기록"
      aria-pressed={utility === 'history'}
      onclick={() => toggleUtility('history')}
      ><span>↶</span><small>기록</small></button
    >
    <button
      aria-label="기획 설정"
      disabled={!ready || busy || uploading}
      onclick={() => settingsDialog.showModal()}
      ><span>⚙</span><small>설정</small></button
    >
  </nav>
  <aside
    class="editor-utility-panel"
    hidden={!utility}
    aria-label="프로젝트 보조 패널"
  >
    <div class="editor-utility-heading">
      <h2>
        {utility === 'decisions'
          ? '남은 결정'
          : utility === 'results'
            ? '기획 문서'
            : '저장 기록'}
      </h2>
      <button
        class="editor-icon"
        onclick={() => (utility = null)}
        aria-label="보조 패널 닫기">×</button
      >
    </div>
    <div class="editor-utility-body">
      {#if ready}
        <div
          class="tab-panel decision-page"
          id="panel-decisions"
          role="region"
          aria-label="남은 결정"
          hidden={utility !== 'decisions'}
        >
          <div class="panel-intro">
            <div>
              <h2>다음 작업을 막는 질문부터</h2>
              <p>
                흐름과 기획 결과에서 발견한 질문을 모아 담당과 답변을 정합니다.
              </p>
            </div>
            <button
              onclick={() => {
                view = 'flow'
                utility = null
              }}>흐름으로 돌아가기 ↗</button
            >
          </div>
          <DecisionBoard
            plan={data.plan}
            items={draft.items}
            bind:decisions={draft.decisions}
            disabled={busy || uploading}
          />
        </div>
        <div
          class="tab-panel document-page"
          id="panel-results"
          role="region"
          aria-label="기획 문서"
          hidden={utility !== 'results'}
        >
          <div class="panel-intro">
            <div>
              <h2>선택과 결정을 하나의 기획으로</h2>
              <p>정리된 결과를 읽고, 새로 발견한 질문을 다시 검토합니다.</p>
            </div>
            <button disabled={!canSend} onclick={review}
              >현재 선택으로 정리 →</button
            >
          </div>
          <PlanningResult
            plan={data.plan}
            selection={selection()}
            connected={data.ai.available}
            disabled={busy || uploading}
            onImport={importQuestion}
            onUpdate={(count, waiting) => {
              resultCount = count
              resultWaiting = waiting
            }}
          />
          <details class="selection-preview">
            <summary>현재 선택 내역 확인 · 포함 {included}개</summary
            ><SelectionSummary plan={data.plan} selection={draft} />
          </details>
        </div>

        <section hidden={utility !== 'history'} aria-label="저장 기록 불러오기">
          <p class="editor-muted">
            저장한 기획과 검토 내용을 다시 열 수 있어요.
          </p>
          <label for="editor-record">불러올 기록</label><select
            id="editor-record"
            bind:value={selectedRecord}
            ><option value="">기록 선택</option
            >{#each data.records as record}<option value={record.id}
                >{new Date(record.createdAt).toLocaleString('ko-KR')} · {record.delivery ===
                'completed'
                  ? 'AI 작업 완료'
                  : record.delivery === 'failed'
                    ? 'AI 작업 실패 · 선택 저장됨'
                    : record.delivery === 'queued'
                      ? '전달됨'
                      : record.delivery === 'unconfirmed'
                        ? '전달 확인 필요'
                        : record.delivery === 'pending'
                          ? '요청 준비 중'
                          : '저장됨'}</option
              >{/each}</select
          >
          <div class="editor-history-actions">
            <button
              disabled={!selectedRecord || busy || uploading}
              onclick={restore}>기록 불러오기</button
            ><button disabled={busy || uploading} onclick={restoreBackup}
              >불러오기 전 초안 복원</button
            >
          </div>
          {#if !data.records.length}<p>
              아직 저장 기록이 없어요. 상단의 저장 버튼으로 첫 기록을
              남겨주세요.
            </p>{/if}
        </section>
      {/if}
    </div>
  </aside>
  {#if message}<div class="workspace-toast">
      <p id="result" role="status" aria-live="polite">{message}</p>
      {#if message.includes('남은 결정')}<button
          onclick={() => (utility = 'decisions')}>결정 보기 →</button
        >{/if}<button aria-label="알림 닫기" onclick={() => (message = '')}
        >×</button
      >
    </div>{/if}
</div>
<dialog
  class="planning-dialog settings-dialog"
  bind:this={settingsDialog}
  aria-labelledby="settings-title"
>
  <div class="review-dialog-heading">
    <div>
      <p class="eyebrow">기획의 맥락과 기록</p>
      <h2 id="settings-title">기획 보완</h2>
    </div>
    <button onclick={() => settingsDialog.close()}>닫기</button>
  </div>
  <label for="goal">해결할 문제 · 목적</label><textarea
    id="goal"
    rows="3"
    maxlength="4000"
    bind:value={draft.goal}
  ></textarea>
  <label for="additional">추가 요구사항 · 전체 의견</label><textarea
    id="additional"
    rows="4"
    maxlength="8000"
    bind:value={draft.additional}
    placeholder="바꾸고 싶은 흐름이나 새로 확인한 제약을 적어주세요."
  ></textarea>
  <p class="muted">
    후보 보완 요청은 현재 선택과 의견을 저장해 연결된 대화로 전달합니다. 조사가
    끝나면 초안 새로고침으로 확인하세요.
  </p>
  <details class="settings-fold">
    <summary>기존 구현 · {data.plan.existing.length}개</summary
    >{#each data.plan.existing as entry}<article>
        <strong>{entry.title}</strong>
        <p>{entry.detail}</p>
        <code>{entry.source}</code>
      </article>{/each}
  </details>
  <details class="settings-fold">
    <summary>저장 기록 · {data.records.length}개</summary><label for="record"
      >불러올 기록</label
    ><select id="record" bind:value={selectedRecord}
      ><option value="">기록 선택</option>{#each data.records as record}<option
          value={record.id}
          >{new Date(record.createdAt).toLocaleString('ko-KR')} · {record.delivery ===
          'completed'
            ? 'AI 작업 완료'
            : record.delivery === 'failed'
              ? 'AI 작업 실패 · 선택 저장됨'
              : record.delivery === 'queued'
                ? '전달됨'
                : record.delivery === 'unconfirmed'
                  ? '전달 확인 필요'
                  : '저장됨'}</option
        >{/each}</select
    >
    <div class="settings-buttons">
      <button disabled={!selectedRecord || busy || uploading} onclick={restore}
        >기록 불러오기</button
      ><button disabled={busy || uploading} onclick={restoreBackup}
        >불러오기 전 초안 복원</button
      >
    </div>
  </details>
  <details class="settings-fold">
    <summary>조사 · 연결 정보</summary>
    <p>{data.plan.screen || '대상 화면 미지정'}</p>
    <p>{data.plan.notice}</p>
    <p>
      조사: {data.plan.reviewedAt || '준비 전'} · 기준: {data.plan.baseline ||
        '조사 전'}
    </p>
    <p>기획 ID: {data.plan.id}</p>
    <p>AI: {data.ai.label} · 모델: {data.ai.model || 'CLI 기본 설정'}</p>
    {#if data.thread}<p>연결 대화: {data.thread}</p>{/if}
    <p>다른 AI로 실행: pnpm dev:planning --ai=codex 또는 --ai=claude</p>
    <p>{recordPath}</p>
    <p>
      현재 초안은 브라우저에 보관됩니다. 임시 저장하면 JSON과 Markdown 기록이
      생성됩니다. 기획 선택과 디자인 승인은 별도입니다.
    </p>
  </details>
  {#if message}<p class="settings-status" role="status">{message}</p>{/if}
  <div class="review-dialog-actions">
    <button
      class="primary"
      disabled={!ready ||
        !data.ai.available ||
        busy ||
        uploading ||
        !draft.goal.trim()}
      onclick={generate}>현재 의견으로 후보 보완 요청</button
    >
  </div>
</dialog>
<dialog
  class="planning-dialog"
  id="review-dialog"
  bind:this={dialog}
  aria-labelledby="review-title"
>
  <div class="review-dialog-heading">
    <h2 id="review-title">이 내용으로 기획을 정리할까요?</h2>
    <button id="cancel-review" onclick={() => dialog.close()}
      >돌아가서 수정</button
    >
  </div>
  {#if preview}<p>{preview.goal}</p>
    <p class="muted">
      미정은 열린 질문으로 전달됩니다. 디자인 승인이나 개발 시작 요청이
      아닙니다.
    </p>
    <div id="review-content">
      <SelectionSummary plan={data.plan} selection={preview} />
    </div>
    {#if preview.additional}<p>전체 의견: {preview.additional}</p>{/if}{/if}
  <div class="review-dialog-actions">
    <button
      id="confirm-send"
      class="primary"
      disabled={busy}
      onclick={() => submit(true)}
      >{busy ? '요청 중…' : '기획 정리 요청'}</button
    >
  </div>
</dialog>
