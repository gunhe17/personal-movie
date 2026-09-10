<style>
  .follow-up-list {
    padding: 12px 16px;
    border: 1px solid #e0e7ef;
    border-radius: 9px;
    background: white;
    margin-bottom: 14px;
    font-size: 12px;
  }
  .follow-up-list button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    border-top: 1px solid #edf1f6;
    border-radius: 0;
    text-align: left;
    margin-top: 10px;
    padding: 10px 0;
  }
  .follow-up-list button span {
    color: #8a5c2c;
    flex-shrink: 0;
  }
  .follow-up-list button strong {
    flex: 1;
    overflow-wrap: anywhere;
  }
  .follow-up-list button small {
    color: #62738a;
  }
  .comparison-page {
    color: #33465f;
  }
  .comparison-heading,
  .actions,
  .record-bar,
  .baseline,
  .totals,
  .step-buttons,
  .bottom-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .comparison-heading {
    justify-content: space-between;
    margin-bottom: 18px;
  }
  h2 {
    font-size: 19px;
  }
  h3 {
    font-size: 18px;
    margin: 8px 0 12px;
  }
  .comparison-heading p,
  .setup p {
    font-size: 13px;
    color: #62738a;
  }
  button,
  select,
  input,
  textarea {
    font-size: 12px;
  }
  .setup,
  .expected,
  .observed {
    background: white;
    border: 1px solid #dfe6ef;
    border-radius: 12px;
    padding: 24px;
    min-width: 0;
  }
  .setup {
    margin: 16px 0;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  label {
    display: block;
    font-size: 12px;
    color: #526880;
    margin: 12px 0;
  }
  label input:not([type='checkbox']),
  label textarea,
  label select {
    display: block;
    width: 100%;
    margin-top: 6px;
  }
  .setup-grid,
  .side-by-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }
  .notice {
    padding: 12px 16px;
    background: #edf3fc;
    border-radius: 8px;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .stale,
  .expected .notice {
    background: #fff5e4;
    color: #895c26;
  }
  .record-bar {
    font-size: 12px;
    justify-content: space-between;
  }
  .record-bar label {
    flex: 1;
    max-width: 600px;
    min-width: 0;
  }
  .baseline {
    padding: 12px 16px;
    background: white;
    border: 1px solid #e0e7ef;
    border-radius: 9px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .baseline a {
    color: #385fa4;
  }
  .totals {
    margin: 18px 0;
    font-size: 12px;
  }
  .totals > span {
    padding: 8px 12px;
    background: #e8edf4;
    border-radius: 8px;
  }
  .totals strong {
    margin-left: 10px;
    font-size: 19px;
  }
  .totals .match {
    background: #e3f3ec;
    color: #28684c;
  }
  .totals .different {
    background: #ffead8;
    color: #94501b;
  }
  .totals .missing {
    background: #ffe6e8;
    color: #95323d;
  }
  .totals small {
    color: #62738a;
  }
  .comparison-map > summary {
    font-size: 13px;
    font-weight: 600;
    padding: 10px 0;
  }
  .step-selector {
    margin: 20px 0;
  }
  .step-selector select {
    max-width: 600px;
  }
  .step-buttons button {
    text-align: left;
  }
  .step-buttons button.active {
    border-color: #426394;
    background: #edf3fc;
    color: #304f7c;
  }
  .step-buttons span {
    display: block;
    font-size: 10px;
    color: #62738a;
  }
  .expected {
    align-self: start;
  }
  dt {
    font-size: 12px;
    font-weight: 650;
    margin: 20px 0 6px;
  }
  dd {
    margin: 0;
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .branch {
    padding: 10px;
    background: #fff6e8;
    font-size: 12px;
  }
  .status-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin: 12px 0;
  }
  .status-buttons > span {
    font-size: 12px;
    font-weight: 600;
    margin-right: 4px;
  }
  .status-buttons button {
    padding: 6px 8px;
  }
  .status-buttons button[aria-pressed='true'] {
    background: #426394;
    border-color: #426394;
    color: white;
  }
  .evidence {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .evidence figure {
    margin: 0;
    min-width: 0;
  }
  .evidence img {
    width: 100%;
    height: 170px;
    object-fit: contain;
    background: #f5f7fa;
    border: 1px solid #dfe6ef;
    border-radius: 6px;
  }
  .evidence input {
    width: 100%;
  }
  .evidence button {
    margin-top: 5px;
  }
  .capture-label {
    font-size: 11px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e4eaf2;
  }
  .follow-up {
    border-top: 1px solid #e4eaf2;
    margin-top: 20px;
    padding-top: 6px;
  }
  .resolved {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bottom-actions {
    margin-top: 18px;
    justify-content: flex-end;
    font-size: 12px;
  }
  @media (max-width: 800px) {
    .setup-grid,
    .side-by-side {
      grid-template-columns: 1fr;
    }
    .setup,
    .expected,
    .observed {
      padding: 18px;
    }
    .comparison-heading {
      align-items: flex-start;
    }
    .record-bar {
      align-items: flex-start;
    }
    .record-bar label {
      width: 100%;
      flex-basis: 100%;
    }
    .totals {
      gap: 6px;
    }
    .totals small {
      flex-basis: 100%;
    }
  }
</style>

<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Plan, Selection, FollowUp } from '$lib/types'
  import {
    comparisonLabels,
    aggregateStatus,
    comparisonStale,
    parseChecks,
    parseImplementation,
    type ComparisonCheck,
    type ComparisonRecord,
    type ComparisonEntry,
    type Implementation,
    type ComparisonStatus
  } from '$lib/comparison'
  import { scenarioPath, stepEffect, scenarioIssues } from '$lib/scenarios'
  import FlowMap from './FlowMap.svelte'
  import EffectSummary from './EffectSummary.svelte'
  let {
    plan,
    selection,
    revision,
    disabled = false,
    onImport,
    onBusy
  }: {
    plan: Plan
    selection: Selection
    revision: string
    disabled?: boolean
    onImport: (question: FollowUp, origin: string) => void
    onBusy: (busy: boolean) => void
  } = $props()
  let record = $state<ComparisonRecord | null>(null)
  let checks = $state<ComparisonCheck[]>([])
  let entries = $state<ComparisonEntry[]>([])
  let chosenRecord = $state('')
  let scenarioId = $state(''),
    stepId = $state('')
  let busy = $state(false),
    mounted = $state(false),
    loading = $state(true)
  let message = $state(''),
    warnings = $state<string[]>([])
  let implementation = $state<Implementation>({
    url: '',
    version: '',
    environment: '',
    role: ''
  })
  let setupOpen = $state(false)
  let detailStart = $state<HTMLDivElement>()
  let mapStart = $state<HTMLDetailsElement>()
  const endpoint = () => '/api/plans/' + plan.id + '/comparisons'
  const cacheKey = (id: string) =>
    'planning-comparison:v1:' + plan.id + ':' + id
  const pointerKey = () => 'planning-comparison:last:' + plan.id
  let stale = $derived(
    record ? comparisonStale(record, plan, selection, revision) : false
  )
  let dirty = $derived(
    record ? JSON.stringify(checks) !== JSON.stringify(record.checks) : false
  )
  let scenario = $derived(
    record?.baseline.plan.scenarios?.find((entry) => entry.id === scenarioId) ??
      record?.baseline.plan.scenarios?.[0]
  )
  let step = $derived(
    scenario?.steps.find((entry) => entry.id === stepId) ?? scenario?.steps[0]
  )
  let check = $derived(
    checks.find(
      (entry) => entry.scenarioId === scenario?.id && entry.stepId === step?.id
    )
  )
  let linkedEffect = $derived(
    record && step
      ? stepEffect(record.baseline.plan, record.baseline.selection, step)
      : undefined
  )
  let issues = $derived(
    record && scenario
      ? scenarioIssues(
          record.baseline.plan,
          record.baseline.selection,
          scenario
        )
      : []
  )
  let path = $derived(
    record && scenario
      ? scenarioPath(record.baseline.plan.scenarios ?? [], scenario)
      : null
  )
  let totals = $derived(
    Object.fromEntries(
      Object.keys(comparisonLabels).map((status) => [
        status,
        checks.filter((check) => aggregateStatus([check]) === status).length
      ])
    )
  )
  function select(scenario: string, step: string) {
    scenarioId = scenario
    stepId = step
  }
  async function inspect(scenario: string, step: string) {
    select(scenario, step)
    await tick()
    detailStart?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth'
    })
  }
  function backToMap() {
    if (mapStart) {
      mapStart.open = true
      mapStart.scrollIntoView({ block: 'start' })
    }
  }
  async function request(url: string, value?: unknown) {
    const response = await fetch(
      url,
      value === undefined
        ? { cache: 'no-store' }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
          }
    )
    const result = await response.json()
    if (!response.ok)
      throw new Error(result.error || '비교 요청을 처리하지 못했습니다.')
    return result
  }
  async function refresh() {
    const value = await request(endpoint())
    entries = value.entries
    warnings = value.warnings
  }
  function apply(next: ComparisonRecord, restore: boolean) {
    let draft = structuredClone(next.checks)
    if (restore) {
      try {
        const saved = localStorage.getItem(cacheKey(next.id))
        if (saved) {
          const raw = JSON.parse(saved)
          const restored = parseChecks(raw, next.baseline.plan, true)
          draft = restored.map((check, index) => ({
            ...check,
            checkedAt:
              typeof raw[index]?.checkedAt === 'string'
                ? raw[index].checkedAt
                : ''
          }))
        }
      } catch {
        message =
          '브라우저 비교 초안을 읽지 못했습니다. 저장된 비교를 표시합니다.'
      }
    }
    record = next
    checks = draft
    chosenRecord = next.id
    implementation = structuredClone(next.implementation)
    scenarioId = next.baseline.plan.scenarios?.[0]?.id ?? ''
    stepId = next.baseline.plan.scenarios?.[0]?.steps[0]?.id ?? ''
  }
  async function load(id: string) {
    if (!id || busy) return
    busy = true
    try {
      apply(await request(endpoint() + '?id=' + encodeURIComponent(id)), true)
    } catch (error) {
      message = error instanceof Error ? error.message : '비교 조회 실패'
      chosenRecord = record?.id ?? ''
    } finally {
      busy = false
    }
  }
  onMount(() => {
    mounted = true
    void (async () => {
      try {
        await refresh()
        const id = localStorage.getItem(pointerKey())
        await load(
          entries.find((entry) => entry.id === id)?.id ?? entries[0]?.id ?? ''
        )
      } catch (error) {
        message =
          error instanceof Error
            ? error.message
            : '비교 기록을 불러오지 못했습니다.'
      } finally {
        loading = false
      }
    })()
  })
  $effect(() => {
    if (!mounted || !record) return
    try {
      localStorage.setItem(cacheKey(record.id), JSON.stringify(checks))
      localStorage.setItem(pointerKey(), record.id)
    } catch {
      message =
        '브라우저 비교 보관에 실패했습니다. 비교 기록 저장을 눌러주세요.'
    }
  })
  async function start() {
    if (busy || disabled) return
    busy = true
    onBusy(true)
    message = ''
    try {
      const target = parseImplementation(implementation)
      const next = await request(endpoint(), {
        action: 'start',
        selection,
        revision,
        implementation: target
      })
      apply(next, false)
      setupOpen = false
      message =
        '현재 기획과 구현 기준을 고정했습니다. 각 단계를 실행하고 관찰 결과를 기록하세요.'
      await refresh()
    } catch (error) {
      message = error instanceof Error ? error.message : '비교 시작 실패'
    } finally {
      busy = false
      onBusy(false)
    }
  }
  async function save() {
    if (!record || busy || disabled) return
    busy = true
    onBusy(true)
    message = ''
    try {
      parseChecks(checks, record.baseline.plan)
      const next = await request(endpoint(), {
        action: 'save',
        id: record.id,
        checks
      })
      const activeScenario = scenarioId,
        activeStep = stepId
      apply(next, false)
      select(activeScenario, activeStep)
      message = '새 비교 기록으로 저장했습니다. 이전 기록도 그대로 보관됩니다.'
      await refresh()
    } catch (error) {
      message = error instanceof Error ? error.message : '비교 저장 실패'
    } finally {
      busy = false
      onBusy(false)
    }
  }
  function mark(axis: 'appearance' | 'behavior', status: ComparisonStatus) {
    if (!check) return
    if (
      status !== 'unchecked' &&
      (axis === 'appearance'
        ? !check.appearanceNote.trim()
        : !check.behaviorNote.trim() || !check.stepsTaken.trim())
    ) {
      message =
        axis === 'appearance'
          ? '화면에서 관찰한 근거를 먼저 적어주세요.'
          : '직접 실행한 절차와 관찰 결과를 먼저 적어주세요.'
      return
    }
    check[axis] = status
    check.checkedAt = ''
    message = ''
  }
  async function upload(event: Event) {
    const input = event.currentTarget as HTMLInputElement,
      file = input.files?.[0]
    input.value = ''
    if (!file || !check || busy || disabled) return
    if (
      !['image/png', 'image/jpeg'].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      message = '4MB 이하 PNG/JPG 캡처를 선택하세요.'
      return
    }
    if (check.evidence.length >= 3) return
    const target = check
    busy = true
    onBusy(true)
    try {
      const response = await fetch('/api/plans/' + plan.id + '/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
      })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error)
      target.evidence.push({ id: value.id, caption: '' })
      target.appearance = 'unchecked'
      target.checkedAt = ''
      message = '실제 화면 캡처를 연결했습니다. 화면 판정을 확인하세요.'
    } catch (error) {
      message = error instanceof Error ? error.message : '캡처 첨부 실패'
    } finally {
      busy = false
      onBusy(false)
    }
  }
  function importQuestion() {
    if (
      !check ||
      !record ||
      !step ||
      !scenario ||
      !check.followUpNote.trim() ||
      dirty
    )
      return
    onImport(
      {
        id: 'comparison-' + crypto.randomUUID(),
        question: check.followUpNote.trim(),
        context:
          scenario.title +
          ' / ' +
          step.title +
          '\n구현: ' +
          record.implementation.version +
          '\n관찰: ' +
          (check.behaviorNote || check.appearanceNote).slice(0, 2000) +
          '\n비교 기록: ' +
          record.id,
        featureId: plan.features.some(
          (feature) => feature.id === step.featureId
        )
          ? step.featureId
          : '',
        owner: 'together',
        blocking: true
      },
      record.runId
    )
    message =
      '남은 결정에 추가를 요청했습니다. 기획 초안을 임시 저장하면 함께 보관됩니다.'
  }
</script>

<div class="comparison-page">
  <div class="comparison-heading">
    <div>
      <h2>기획과 구현, 단계별로 비교하기</h2>
      <p>
        실제 화면과 실행 결과를 기록합니다. 확인하지 않은 동작은 ‘확인 전’으로
        남깁니다.
      </p>
    </div>
    <div class="actions">
      <button
        disabled={busy || disabled || !plan.scenarios?.length}
        onclick={() => (setupOpen = !setupOpen)}>새 기준으로 비교</button
      >{#if record}<button
          class="primary"
          disabled={busy || disabled || !dirty}
          onclick={save}>{busy ? '처리 중…' : '비교 기록 저장'}</button
        >{/if}
    </div>
  </div>
  {#if message}<p class="notice" role="status">{message}</p>{/if}
  {#each warnings as warning}<p class="notice">{warning}</p>{/each}
  {#if loading}<p>비교 기록을 불러오는 중…</p>{/if}
  {#if !plan.scenarios?.length}<p class="notice">
      현재 기획에 시나리오가 없습니다. ‘기획 보완’에서 정상·예외 흐름을 먼저
      준비하세요.
    </p>{/if}
  {#if setupOpen || (!record && !loading)}
    <form
      class="setup"
      onsubmit={(event) => {
        event.preventDefault()
        start()
      }}
    >
      <h3>어느 구현을 확인하나요?</h3>
      <p>
        시작할 때 현재 선택과 시나리오를 고정합니다. 구현 버전이 바뀌면 새
        비교를 시작하세요.
      </p>
      <fieldset disabled={busy || disabled}>
        <div class="setup-grid">
          <label
            >실제 화면 주소 <input
              type="url"
              maxlength="2000"
              placeholder="http://localhost:3503/schedule"
              bind:value={implementation.url}
            /></label
          >
          <label
            >구현 버전 · 빌드 기준 <input
              required
              maxlength="300"
              placeholder="예: 9월 8일 개발본 / 커밋 ID"
              bind:value={implementation.version}
            /></label
          >
          <label
            >확인 환경 · 데이터 조건 <input
              required
              maxlength="500"
              placeholder="예: 개발 서버, 승인 대기 예약 1건"
              bind:value={implementation.environment}
            /></label
          >
          <label
            >확인 역할 <input
              required
              maxlength="300"
              placeholder="예: 상담사 / 관리자 / 요청한 사용자"
              bind:value={implementation.role}
            /></label
          >
        </div>
        <button class="primary" disabled={!plan.scenarios?.length}
          >현재 기획으로 비교 시작</button
        >
      </fieldset>
    </form>
  {/if}
  {#if record}
    <div class="record-bar">
      <label
        >비교 기록<select
          disabled={busy || disabled}
          value={chosenRecord}
          onchange={(event) => load(event.currentTarget.value)}
          >{#each entries as entry}<option value={entry.id}
              >{new Date(entry.createdAt).toLocaleString('ko-KR')} · {entry
                .implementation.version}</option
            >{/each}</select
        ></label
      >
      <span
        >{dirty
          ? '비교 초안 변경됨 · 브라우저 보관 중'
          : '저장된 비교 기록'}</span
      >
      <button
        disabled={busy}
        onclick={() => refresh().catch((error) => (message = String(error)))}
        >목록 갱신</button
      >
    </div>
    <div class="baseline">
      <strong>{record.implementation.version}</strong><span
        >{record.implementation.environment} · {record.implementation
          .role}</span
      >{#if record.implementation.url}<a
          href={record.implementation.url}
          target="_blank"
          rel="noopener noreferrer">실제 화면 열기 ↗</a
        >{/if}<span>기획 기준 {record.baseline.revision.slice(0, 8)}</span>
    </div>
    {#if stale}<p class="notice stale">
        현재 기획·선택이 비교 기준과 달라졌습니다. 아래 결과는 저장 당시 기획
        기준입니다. 최신 기준 검증은 새 비교로 시작하세요.
      </p>{/if}
    <div class="totals">
      {#each Object.entries(comparisonLabels) as [status, label]}<span
          class={status}>{label}<strong>{totals[status]}</strong></span
        >{/each}<small
        >기준 단계 {checks.length}개 · 화면과 동작을 모두 확인해야 일치</small
      >
    </div>
    {#if checks.some((entry) => entry.followUp !== 'none')}<details
        class="follow-up-list"
      >
        <summary
          >후속 처리 · 미완료 {checks.filter(
            (entry) => entry.followUp !== 'none' && !entry.resolved
          ).length}개</summary
        >
        {#each checks.filter((entry) => entry.followUp !== 'none') as entry}<button
            type="button"
            onclick={() => inspect(entry.scenarioId, entry.stepId)}
            ><span
              >{entry.resolved
                ? '처리 완료'
                : entry.followUp === 'fix'
                  ? '구현 수정'
                  : '기획 질문'}</span
            ><strong>{entry.followUpNote || '내용 작성 필요'}</strong><small
              >{record.baseline.plan.scenarios?.find(
                (scenario) => scenario.id === entry.scenarioId
              )?.title} →</small
            ></button
          >{/each}
      </details>{/if}
    <details class="comparison-map" bind:this={mapStart} open>
      <summary>흐름별 확인 현황</summary>
      <FlowMap
        plan={record.baseline.plan}
        selection={record.baseline.selection}
        {disabled}
        connected={false}
        onPrepare={() => {}}
        onQuestion={() => {}}
        onFeature={() => {}}
        comparison={{
          checks,
          scenarioId: scenario?.id ?? '',
          stepId: step?.id ?? '',
          onSelect: inspect
        }}
      />
    </details>
    {#if scenario && step && check}
      <div class="step-selector" bind:this={detailStart}>
        <button type="button" onclick={backToMap}>↑ 흐름별 확인 현황</button>
        <label
          >검토할 경로<select
            value={scenario.id}
            onchange={(event) => {
              const next = record!.baseline.plan.scenarios!.find(
                (entry) => entry.id === event.currentTarget.value
              )!
              select(next.id, next.steps[0].id)
            }}
            >{#each record.baseline.plan.scenarios ?? [] as entry}<option
                value={entry.id}
                >{entry.kind === 'exception' ? '예외' : '정상'} · {entry.title}</option
              >{/each}</select
          ></label
        >
        <div class="step-buttons">
          {#each scenario.steps as entry, index}<button
              class:active={step.id === entry.id}
              onclick={() => select(scenario!.id, entry.id)}
              >{index + 1}. {entry.title}
              <span
                >{comparisonLabels[
                  aggregateStatus(
                    checks.filter(
                      (check) =>
                        check.scenarioId === scenario!.id &&
                        check.stepId === entry.id
                    )
                  )
                ]}</span
              ></button
            >{/each}
        </div>
      </div>
      <div class="side-by-side">
        <section class="expected">
          <span class="eyebrow">기획 기준</span>
          <h3>{step.title}</h3>
          <p class="muted">{step.actor || '담당 미정'}</p>
          {#if path?.fork}<p class="branch">
              {path.prefix.map((step) => step.title).join(' → ')}{path.prefix
                .length
                ? ' → '
                : ''}<strong>{path.fork.title} 처리 중 분기</strong>
            </p>{/if}
          <dl>
            <dt>시작 조건</dt>
            <dd>{scenario.precondition || '미정'}</dd>
            <dt>진입·분기 조건</dt>
            <dd>{scenario.trigger || '미정'}</dd>
            <dt>처리</dt>
            <dd>{step.description || '미정'}</dd>
            <dt>기대 결과</dt>
            <dd>{step.expected || '미정'}</dd>
          </dl>
          {#if record.baseline.selection.items.find((item) => item.id === step!.featureId)?.attachments.length}<div
              class="evidence"
            >
              {#each record.baseline.selection.items.find((item) => item.id === step!.featureId)?.attachments ?? [] as image}<figure
                >
                  <figcaption>
                    {image.kind === 'proposal'
                      ? '기획 당시 제안 화면'
                      : '기획 당시 참고 화면'}
                  </figcaption>
                  <a
                    href={'/api/plans/' + plan.id + '/attachments/' + image.id}
                    target="_blank"
                    rel="noopener noreferrer"
                    ><img
                      src={'/api/plans/' + plan.id + '/attachments/' + image.id}
                      alt={image.caption || '기획 당시 참고 이미지'}
                    /></a
                  >
                  <p class="muted">{image.caption}</p>
                </figure>{/each}
            </div>{/if}
          {#if record.baseline.plan.audit?.cases.some((c) => c.scenarioId === scenario!.id && c.stepId === step!.id)}<details
            >
              <summary>이 단계의 상세 예외·검증 기준</summary>
              <p class="muted">
                저장 당시의 점검 사례입니다. 단계 판정은 개별 사례의 검증 완료를
                의미하지 않습니다.
              </p>
              {#each record.baseline.plan.audit.cases.filter((c) => c.scenarioId === scenario!.id && c.stepId === step!.id) as entry}<h4
                >
                  {entry.title}
                </h4>
                <dl>
                  <dt>발생 조건</dt>
                  <dd>{entry.condition}</dd>
                  <dt>처리 후 상태</dt>
                  <dd>{entry.expected || '정책 미정'}</dd>
                  <dt>복구</dt>
                  <dd>{entry.recovery || '정책 미정'}</dd>
                  <dt>확인할 방법</dt>
                  <dd>{entry.verification || '미작성'}</dd>
                </dl>
                {#if entry.question}<p class="notice">
                    {entry.question}
                  </p>{/if}{/each}
            </details>{/if}
          {#if linkedEffect}<EffectSummary
              effects={[linkedEffect]}
              options={record.baseline.plan.features.find(
                (feature) => feature.id === step!.featureId
              )?.options ?? []}
            />{/if}
          <dl>
            <dt>경로가 끝난 결과</dt>
            <dd>{scenario.outcome || '미정'}</dd>
            {#if scenario.kind === 'exception'}<dt>복구 · 다음 행동</dt>
              <dd>{scenario.recovery || '미정'}</dd>{/if}
          </dl>
          {#if issues.length}<div class="notice">
              <strong>기준 기획에서 확인할 점</strong>{#each issues as issue}<p>
                  {issue}
                </p>{/each}
            </div>{/if}
        </section>
        <section class="observed">
          <span class="eyebrow">실제 구현 · 관찰 기록</span>
          <h3>무엇이 같고, 달랐나요?</h3>
          <fieldset disabled={busy || disabled}>
            <label
              >화면에서 관찰한 내용<textarea
                rows="3"
                maxlength="4000"
                bind:value={check.appearanceNote}
                oninput={() => {
                  check!.appearance = 'unchecked'
                  check!.checkedAt = ''
                }}
                placeholder="문구, 버튼, 정보 배치가 기획과 어떻게 같거나 다른가요?"
              ></textarea></label
            >
            <div
              class="status-buttons"
              role="group"
              aria-label="화면 비교 판정"
            >
              <span>화면</span
              >{#each Object.entries(comparisonLabels) as [value, label]}<button
                  type="button"
                  aria-pressed={check.appearance === value}
                  onclick={() => mark('appearance', value as ComparisonStatus)}
                  >{label}</button
                >{/each}
            </div>
            <div class="evidence">
              {#each check.evidence as image, index}<figure>
                  <a
                    href={'/api/plans/' + plan.id + '/attachments/' + image.id}
                    target="_blank"
                    rel="noopener noreferrer"
                    ><img
                      src={'/api/plans/' + plan.id + '/attachments/' + image.id}
                      alt={image.caption || '실제 구현 화면 캡처'}
                    /></a
                  ><input
                    aria-label="실제 화면 캡처 설명"
                    maxlength="1000"
                    bind:value={image.caption}
                    oninput={() => (check!.appearance = 'unchecked')}
                    placeholder="화면에서 확인할 위치"
                  /><button
                    type="button"
                    onclick={() => {
                      check!.evidence.splice(index, 1)
                      check!.appearance = 'unchecked'
                      check!.checkedAt = ''
                    }}>연결 해제</button
                  >
                </figure>{/each}
            </div>
            <label class="capture-label"
              >실제 화면 캡처 추가 · PNG/JPG, 각 4MB, 최대 3개<input
                type="file"
                accept="image/png,image/jpeg"
                disabled={check.evidence.length >= 3 || busy || disabled}
                onchange={upload}
              /></label
            >
            <label
              >직접 실행한 절차 · 예외 재현 조건<textarea
                rows="3"
                maxlength="4000"
                bind:value={check.stepsTaken}
                oninput={() => {
                  check!.behavior = 'unchecked'
                  check!.checkedAt = ''
                }}
                placeholder="어느 상태에서 무엇을 눌렀는지, 실패나 충돌을 어떻게 재현했는지 적어주세요."
              ></textarea></label
            >
            <label
              >실제 동작 · 상태 변화 · 다음 행동<textarea
                rows="3"
                maxlength="4000"
                bind:value={check.behaviorNote}
                oninput={() => {
                  check!.behavior = 'unchecked'
                  check!.checkedAt = ''
                }}
                placeholder="실제 전후 상태와 이동한 화면, 오류 후 복구 동작을 기록하세요."
              ></textarea></label
            >
            <div
              class="status-buttons"
              role="group"
              aria-label="동작 비교 판정"
            >
              <span>동작</span
              >{#each Object.entries(comparisonLabels) as [value, label]}<button
                  type="button"
                  aria-pressed={check.behavior === value}
                  onclick={() => mark('behavior', value as ComparisonStatus)}
                  >{label}</button
                >{/each}
            </div>
            <p class="muted">
              캡처 첨부로 동작을 확인 처리하지 않습니다. 실행하지 못한 예외는
              확인 전으로 남겨주세요.
            </p>
            <div class="follow-up">
              <label
                >이 차이를 어떻게 처리하나요?<select
                  bind:value={check.followUp}
                  onchange={() => (check!.resolved = false)}
                  ><option value="none">후속 처리 없음</option><option
                    value="fix">구현 수정 작업</option
                  ><option value="question">기획에 질문 남기기</option></select
                ></label
              >{#if check.followUp !== 'none'}<label
                  >{check.followUp === 'fix'
                    ? '수정할 내용 · 완료 조건'
                    : '함께 결정할 질문'}<textarea
                    rows="2"
                    maxlength="1000"
                    bind:value={check.followUpNote}
                    oninput={() => (check!.resolved = false)}
                  ></textarea></label
                ><label class="resolved"
                  ><input type="checkbox" bind:checked={check.resolved} /> 후속 처리
                  완료 · 비교 판정은 별도</label
                >{#if check.followUp === 'question'}<button
                    type="button"
                    disabled={!check.followUpNote.trim() || dirty}
                    onclick={importQuestion}
                    >{dirty
                      ? '비교 저장 후 결정에 추가'
                      : '남은 결정에 추가'}</button
                  >{/if}{/if}
            </div>
            {#if check.checkedAt}<p class="muted">
                기록 시각 {new Date(check.checkedAt).toLocaleString('ko-KR')}
              </p>{/if}
          </fieldset>
        </section>
      </div>
      <div class="bottom-actions">
        <span
          >{dirty
            ? '비교 내용을 저장해 기록으로 보관하세요.'
            : '현재 비교가 저장되어 있습니다.'}</span
        ><button
          class="primary"
          disabled={busy || disabled || !dirty}
          onclick={save}>비교 기록 저장</button
        >
      </div>
    {/if}
  {/if}
</div>
