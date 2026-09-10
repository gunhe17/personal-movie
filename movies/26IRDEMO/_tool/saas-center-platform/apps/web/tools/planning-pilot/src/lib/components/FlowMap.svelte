<style>
  .flow-workspace.comparison-map {
    grid-template-columns: 1fr;
  }
  .comparison-legend {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    padding: 0 24px 14px;
    font-size: 11px;
    color: #64748b;
  }
  .comparison-status {
    border-radius: 5px;
    padding: 2px 5px;
    background: #e9eef5;
    color: #53637b;
    font-size: 10px;
  }
  .comparison-status.match {
    background: #e3f3ec;
    color: #28684c;
  }
  .comparison-status.different {
    background: #ffead8;
    color: #94501b;
  }
  .comparison-status.missing {
    background: #ffe6e8;
    color: #95323d;
  }
  .node-comparison {
    position: absolute;
    bottom: -10px;
    left: 12px;
    border: 1px solid white;
  }
  .flow-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 18px;
    align-items: start;
  }
  .map-panel,
  .flow-inspector {
    border: 1px solid #dfe5ec;
    border-radius: 14px;
    background: #fff;
    overflow: hidden;
  }
  .map-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 24px 16px;
  }
  .map-eyebrow,
  .inspector-kicker {
    font-size: 10px;
    letter-spacing: 1.6px;
    font-weight: 700;
    color: #58709b;
  }
  .map-toolbar h2 {
    font-size: 17px;
    margin: 4px 0 0;
  }
  .map-subbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 0 24px 16px;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 11px;
    color: #66758b;
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .legend i {
    display: inline-block;
    width: 18px;
    border-top: 2px solid #7e91b2;
  }
  .legend .branch-line {
    border-top: 2px dashed #c78b4a;
  }
  .question-legend {
    color: #9b6a32;
  }
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .zoom-controls button {
    padding: 5px 9px;
    font-size: 11px;
  }
  .zoom-controls > span {
    font-size: 10px;
    color: #7b899d;
    min-width: 30px;
    text-align: right;
  }
  .map-viewport {
    overflow: auto;
    min-height: 390px;
    background-color: #f8fafc;
    background-image: radial-gradient(#dce3ed 0.8px, transparent 0.8px);
    background-size: 18px 18px;
    border-top: 1px solid #edf0f5;
    border-bottom: 1px solid #edf0f5;
    padding: 12px;
    display: flex;
    align-items: flex-start;
  }
  .scaled-canvas {
    position: relative;
    flex-shrink: 0;
    margin: auto;
  }
  .flow-canvas {
    position: absolute;
    transform-origin: top left;
  }
  .flow-canvas svg {
    position: absolute;
    inset: 0;
    overflow: visible;
    pointer-events: none;
  }
  .flow-node {
    position: absolute;
    padding: 13px 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    text-align: left;
    background: #fff;
    border: 1px solid #cfd8e5;
    border-radius: 10px;
    box-shadow: 0 3px 7px #1b345008;
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
  }
  .flow-node:hover {
    background: #fff;
    box-shadow: 0 4px 12px #1b345018;
    border-color: #6e87b2;
  }
  .flow-node.selected {
    background: #eef3ff;
    border: 2px solid #4568aa;
    padding: 12px 13px;
    box-shadow: 0 0 0 4px #4568aa13;
  }
  .flow-node strong {
    font-size: 14px;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .node-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    margin-bottom: 7px;
    font-size: 10px;
    color: #78869b;
  }
  .node-meta > span:last-child {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .node-meta .scope-note {
    color: #956324;
    font-weight: 600;
  }
  .node-number {
    font-weight: 750;
    color: #56729d;
  }
  .exception-node {
    background: #fffaf4;
    border-color: #ead5b9;
  }
  .exception-node:hover {
    background: #fff6e9;
    border-color: #c68a45;
  }
  .exception-node strong {
    font-size: 12px;
    color: #77512d;
  }
  .exception-node.selected {
    background: #fff1dc;
    border-color: #b77a37;
    box-shadow: 0 0 0 4px #b77a3712;
  }
  .question-dot {
    display: inline-grid;
    place-items: center;
    background: #f5e4c7;
    color: #8f5f28;
    border-radius: 50%;
    width: 17px;
    height: 17px;
    font-weight: 700;
  }
  .map-bottom {
    padding: 12px 22px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    color: #7d899a;
  }
  .outcome-strip {
    display: flex;
    gap: 14px;
    padding: 20px 24px;
    background: #f7fbf9;
    border-top: 1px solid #e7efea;
  }
  .outcome-icon {
    font-size: 24px;
    color: #679482;
  }
  .outcome-strip strong {
    font-size: 12px;
    color: #507260;
  }
  .outcome-strip p {
    font-size: 13px;
    color: #496254;
    margin: 4px 0 0;
  }
  .flow-inspector {
    position: sticky;
    top: 16px;
    max-height: calc(100dvh - 240px);
    min-height: 510px;
    display: flex;
    flex-direction: column;
  }
  .inspector-heading {
    padding: 22px 22px 16px;
    border-bottom: 1px solid #edf0f5;
  }
  .inspector-heading h3 {
    font-size: 19px;
    margin: 8px 0;
    letter-spacing: -0.4px;
    line-height: 1.4;
  }
  .inspector-heading p {
    font-size: 12px;
    color: #7b899c;
    line-height: 1.6;
  }
  .exception-label {
    color: #a8753a;
  }
  .inspector-body {
    padding: 18px 22px;
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .inspector-body h4 {
    font-size: 12px;
    margin: 0 0 8px;
  }
  .step-description {
    font-size: 13px;
    color: #526176;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  .expected-box {
    padding: 14px;
    background: #f1f5fb;
    border-radius: 8px;
    margin: 16px 0;
  }
  .expected-box p {
    font-size: 13px;
    color: #465c80;
    line-height: 1.7;
  }
  .state-section {
    margin: 18px 0;
  }
  .state-card {
    border: 1px solid #e6ebf1;
    border-radius: 7px;
    padding: 10px;
    margin: 7px 0;
  }
  .state-card > strong {
    font-size: 11px;
    color: #728095;
  }
  .state-card > div {
    display: flex;
    gap: 7px;
    align-items: center;
    font-size: 12px;
    margin-top: 6px;
  }
  .state-card > div > span {
    flex: 1;
    min-width: 0;
  }
  .state-card b {
    color: #9aa8ba;
  }
  .state-card > div > span:last-child {
    color: #3c5f91;
    font-weight: 600;
  }
  .inspector-fold {
    border-top: 1px solid #edf0f5;
    padding: 12px 0;
    font-size: 12px;
    color: #627188;
  }
  .inspector-fold summary {
    font-size: 11px;
    color: #708198;
  }
  .inspector-fold p,
  .inspector-fold ul {
    margin-top: 10px;
    line-height: 1.7;
  }
  .issue-fold summary {
    color: #a47137;
  }
  .inspector-actions {
    display: flex;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid #edf0f5;
    background: #fbfcfe;
  }
  .inspector-actions button {
    flex: 1;
    font-size: 11px;
    padding: 9px;
  }
  .inspector-branches {
    margin: 18px 0;
  }
  .inspector-branches button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    text-align: left;
    background: #fffaf3;
    border-color: #eedeca;
    margin-top: 6px;
    font-size: 12px;
    padding: 10px;
    color: #946733;
  }
  .open-question {
    border-left: 3px solid #d9b079;
    background: #fffaf2;
    padding: 12px;
    margin: 18px 0;
  }
  .open-question > span {
    font-size: 10px;
    color: #a7763e;
    font-weight: 700;
  }
  .open-question p {
    font-size: 12px;
    line-height: 1.7;
    margin: 6px 0 10px;
  }
  .open-question button {
    font-size: 11px;
    padding: 6px 9px;
    border-color: #e4ceac;
    background: #fff;
  }
  .branch-context {
    font-size: 11px;
    color: #9c6c33;
    padding-bottom: 14px;
    border-bottom: 1px solid #efdfc8;
  }
  .branch-context p {
    font-size: 10px;
    color: #a58a68;
    margin-top: 4px;
  }
  .exception-steps {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 5px;
    margin: 14px 0;
  }
  .exception-steps button {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    width: 100%;
    padding: 9px;
  }
  .exception-steps button span {
    font-size: 10px;
    color: #b0895b;
  }
  .exception-steps button.current {
    border-color: #d2ad7c;
    background: #fff7ea;
  }
  .detail-label {
    font-size: 10px;
    color: #9b7b56;
  }
  .exception-outcome {
    padding: 12px 0;
    font-size: 12px;
    line-height: 1.7;
  }
  .exception-outcome h4:not(:first-child) {
    margin-top: 14px;
  }
  .inspector-empty {
    padding: 28px;
  }
  .inspector-empty h3 {
    font-size: 20px;
    line-height: 1.5;
  }
  .inspector-empty p {
    font-size: 13px;
    color: #7c8899;
    margin: 12px 0 22px;
  }
  .feature-overview {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    width: 100%;
    padding: 14px;
  }
  .feature-overview button {
    min-height: 140px;
    text-align: left;
    padding: 20px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .feature-overview span {
    font-size: 10px;
    color: #8b97a7;
  }
  .feature-overview strong {
    font-size: 14px;
    line-height: 1.6;
  }
  .feature-overview small {
    font-size: 11px;
    color: #58709b;
  }
  .map-empty {
    grid-column: 1/-1;
    padding: 40px 20px;
    color: #7e8ca0;
  }
  .map-empty h3 {
    font-size: 20px;
    color: #415573;
  }
  .standalone {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 14px 22px;
    align-items: center;
    font-size: 11px;
    color: #9a723f;
  }
  .standalone button {
    font-size: 11px;
    padding: 7px 10px;
  }
  .path-select {
    font-size: 10px;
    color: #7c8b9e;
    max-width: 250px;
  }
  .path-select select {
    display: block;
    width: 100%;
    font-size: 12px;
    padding: 7px;
    margin-top: 4px;
  }
  .back-to-map {
    display: none;
  }
  @media (max-width: 900px) {
    .back-to-map {
      display: inline-block;
    }
  }
  @media (max-width: 1150px) {
    .flow-workspace {
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 12px;
    }
    .map-toolbar,
    .inspector-heading {
      padding: 18px;
    }
    .map-subbar {
      padding: 0 18px 14px;
    }
    .inspector-body {
      padding: 16px 18px;
    }
    .legend {
      gap: 8px;
    }
  }
  @media (max-width: 900px) {
    .flow-workspace {
      grid-template-columns: 1fr;
    }
    .flow-inspector {
      position: static;
      max-height: none;
      min-height: 0;
    }
    .map-viewport {
      min-height: 300px;
    }
    .inspector-body {
      max-height: none;
    }
    .feature-overview {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .inspector-heading {
      padding: 20px;
    }
    .map-bottom {
      flex-wrap: wrap;
    }
  }
  @media (max-width: 500px) {
    .map-toolbar {
      align-items: flex-start;
      flex-direction: column;
    }
    .legend {
      font-size: 10px;
    }
    .feature-overview {
      grid-template-columns: 1fr;
    }
    .map-subbar {
      gap: 10px;
    }
    .map-viewport {
      padding: 6px;
    }
    .outcome-strip {
      padding: 16px;
    }
  }
</style>

<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Plan, Selection, Scenario, ScenarioStep } from '$lib/types'
  import { stepEffect, scenarioIssues } from '$lib/scenarios'
  import {
    aggregateStatus,
    comparisonLabels,
    type ComparisonCheck
  } from '$lib/comparison'
  import { flowMap } from '$lib/flow-map'
  let {
    plan,
    selection,
    disabled,
    connected,
    onPrepare,
    onQuestion,
    onFeature,
    comparison
  }: {
    plan: Plan
    selection: Selection
    disabled: boolean
    connected: boolean
    onPrepare: () => void
    onQuestion: (question: string, title: string) => void
    onFeature: (id: string) => void
    comparison?: {
      checks: ComparisonCheck[]
      scenarioId: string
      stepId: string
      onSelect: (scenarioId: string, stepId: string) => void
    }
  } = $props()
  const mapId = $props.id()
  let normalId = $state('')
  let selectedStepId = $state('')
  let exceptionId = $state('')
  let exceptionStep = $state(0)
  let inspector = $state<HTMLElement>()
  let viewport: HTMLDivElement
  let availableWidth = $state(900)
  let zoom = $state<number | null>(null)
  let scenarios = $derived(plan.scenarios ?? [])
  let normals = $derived(scenarios.filter((entry) => entry.kind === 'normal'))
  let normal = $derived(
    normals.find(
      (entry) =>
        entry.id ===
        (comparison
          ? (scenarios.find((scenario) => scenario.id === comparison.scenarioId)
              ?.branch?.scenarioId ?? comparison.scenarioId)
          : normalId)
    ) ?? normals[0]
  )
  let vertical = $derived(availableWidth < 640)
  let layout = $derived(normal ? flowMap(normal, scenarios, vertical) : null)
  let scale = $derived(
    zoom ??
      (layout
        ? Math.min(1, Math.max(0.6, (availableWidth - 24) / layout.width))
        : 1)
  )
  let exception = $derived(
    scenarios.find(
      (entry) =>
        entry.id === (comparison?.scenarioId ?? exceptionId) &&
        entry.kind === 'exception'
    )
  )
  let step = $derived(
    exception
      ? (exception.steps.find((entry) => entry.id === comparison?.stepId) ??
          exception.steps[Math.min(exceptionStep, exception.steps.length - 1)])
      : (normal?.steps.find(
          (entry) => entry.id === (comparison?.stepId ?? selectedStepId)
        ) ?? normal?.steps[0])
  )
  let activeScenario = $derived(exception ?? normal)
  let effect = $derived(step ? stepEffect(plan, selection, step) : undefined)
  let openQuestions = $derived([
    ...new Set(
      [activeScenario?.unresolved, effect?.unresolved].filter(
        (question): question is string => !!question?.trim()
      )
    )
  ])
  let issues = $derived(
    activeScenario ? scenarioIssues(plan, selection, activeScenario) : []
  )
  let branchPoint = $derived(
    exception?.branch
      ? normal?.steps.find((entry) => entry.id === exception.branch!.stepId)
      : undefined
  )
  let branchOptions = $derived(
    normal && step && !exception
      ? scenarios.filter(
          (entry) =>
            entry.branch?.scenarioId === normal.id &&
            entry.branch.stepId === step.id
        )
      : []
  )
  let standalone = $derived(
    scenarios.filter((entry) => entry.kind === 'exception' && !entry.branch)
  )
  async function revealInspector() {
    if (comparison) return
    await tick()
    if (window.matchMedia('(max-width: 900px)').matches) {
      inspector?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth'
      })
    }
  }
  function chooseStep(id: string) {
    selectedStepId = id
    if (normal) comparison?.onSelect(normal.id, id)
    exceptionId = ''
    exceptionStep = 0
    void revealInspector()
  }
  function chooseException(entry: Scenario) {
    exceptionId = entry.id
    comparison?.onSelect(entry.id, entry.steps[0].id)
    exceptionStep = 0
    void revealInspector()
  }
  function returnToNormal() {
    if (exception?.branch) selectedStepId = exception.branch.stepId
    exceptionId = ''
    exceptionStep = 0
  }
  function scopeLabel(step: ScenarioStep) {
    if (!step.featureId) return ''
    const item = selection.items.find((entry) => entry.id === step.featureId)
    if (!item) return '연결 확인'
    if (item.choice === 'exclude') return '이번 범위 제외'
    if (item.choice === 'later') return '보류한 기능'
    if (item.choice !== 'include') return '범위 미정'
    if (step.effectId && !stepEffect(plan, selection, step))
      return '동작 확인 필요'
    return ''
  }
  function highlighted(id: string) {
    if (exception)
      return (
        id === 'exception-' + exception.id ||
        id === 'step-' + exception.branch?.stepId
      )
    return id === 'step-' + step?.id
  }
  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) availableWidth = entry.contentRect.width
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  })
</script>

<div class="flow-workspace" class:comparison-map={!!comparison}>
  <section class="map-panel" aria-label="전체 흐름 지도">
    <div class="map-toolbar">
      <div>
        <span class="map-eyebrow">OVERVIEW</span>
        <h2>{normal ? '정상 흐름과 예외 분기' : '기획할 기능 한눈에 보기'}</h2>
      </div>
      {#if normals.length > 1}<label class="path-select"
          >정상 경로<select
            value={normal?.id}
            onchange={(event) => {
              normalId = event.currentTarget.value
              exceptionId = ''
              selectedStepId = ''
              zoom = null
              const next = normals.find(
                (entry) => entry.id === event.currentTarget.value
              )
              if (next) comparison?.onSelect(next.id, next.steps[0].id)
            }}
            >{#each normals as entry}<option value={entry.id}
                >{entry.title}</option
              >{/each}</select
          ></label
        >{/if}
    </div>
    {#if comparison}<div class="comparison-legend">
        {#each Object.entries(comparisonLabels) as [status, label]}<span
            class={'comparison-status ' + status}>{label}</span
          >{/each}<span>화면·동작을 모두 확인해야 일치</span>
      </div>{/if}
    <div class="map-subbar">
      <div class="legend">
        <span><i class="normal-line"></i>정상 경로</span><span
          ><i class="branch-line"></i>예외 분기</span
        ><span class="question-legend">? 미결정 있음</span>
      </div>
      {#if layout}<div class="zoom-controls">
          <button
            type="button"
            aria-label="흐름 지도 축소"
            onclick={() => (zoom = Math.max(0.5, scale - 0.1))}>−</button
          ><button type="button" onclick={() => (zoom = null)}
            >화면에 맞춤</button
          ><button
            type="button"
            aria-label="흐름 지도 확대"
            onclick={() => (zoom = Math.min(1.5, scale + 0.1))}>+</button
          ><span>{Math.round(scale * 100)}%</span>
        </div>{/if}
    </div>
    <div
      class="map-viewport"
      bind:this={viewport}
      role="region"
      aria-label="흐름 지도. 단계나 예외를 선택하면 상세 내용을 볼 수 있습니다."
    >
      {#if layout && normal}
        <div
          class="scaled-canvas"
          style:width={layout.width * scale + 'px'}
          style:height={layout.height * scale + 'px'}
        >
          <div
            class="flow-canvas"
            style:width={layout.width + 'px'}
            style:height={layout.height + 'px'}
            style:transform={'scale(' + scale + ')'}
          >
            <svg width={layout.width} height={layout.height} aria-hidden="true">
              <defs
                ><marker
                  id={mapId + '-normal-arrow'}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                  ><path d="M 0 0 L 10 5 L 0 10 z" fill="#7e91b2" /></marker
                ><marker
                  id={mapId + '-branch-arrow'}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                  ><path d="M 0 0 L 10 5 L 0 10 z" fill="#c78b4a" /></marker
                ></defs
              >
              {#each layout.edges as edge}<path
                  d={edge.path}
                  fill="none"
                  stroke={edge.kind === 'normal' ? '#7e91b2' : '#c78b4a'}
                  stroke-width={highlighted(edge.to) ? 2.5 : 1.5}
                  stroke-dasharray={edge.kind === 'exception'
                    ? '4 4'
                    : undefined}
                  marker-end={edge.kind === 'normal'
                    ? 'url(#' + mapId + '-normal-arrow)'
                    : 'url(#' + mapId + '-branch-arrow)'}
                />{/each}
            </svg>
            {#each layout.nodes as node (node.id)}
              {@const resultStatus = comparison
                ? aggregateStatus(
                    comparison.checks.filter((check) =>
                      node.kind === 'step'
                        ? check.scenarioId === normal.id &&
                          check.stepId === node.step!.id
                        : check.scenarioId === node.scenario!.id
                    )
                  )
                : undefined}
              <button
                type="button"
                class="flow-node"
                class:exception-node={node.kind === 'exception'}
                class:selected={highlighted(node.id)}
                style:left={node.x + 'px'}
                style:top={node.y + 'px'}
                style:width={node.width + 'px'}
                style:height={node.height + 'px'}
                aria-pressed={highlighted(node.id)}
                aria-label={node.kind === 'step'
                  ? '정상 단계 ' + (node.column + 1) + ': ' + node.step!.title
                  : '예외: ' + node.scenario!.title}
                onclick={() =>
                  node.kind === 'step'
                    ? chooseStep(node.step!.id)
                    : chooseException(node.scenario!)}
              >
                {#if resultStatus}<span
                    class={'node-comparison comparison-status ' + resultStatus}
                    >{comparisonLabels[resultStatus]}</span
                  >{/if}
                {#if node.kind === 'step'}<span class="node-meta"
                    ><span class="node-number"
                      >{String(node.column + 1).padStart(2, '0')}</span
                    ><span class:scope-note={!!scopeLabel(node.step!)}
                      >{scopeLabel(node.step!) ||
                        node.step!.actor ||
                        '담당 미정'}</span
                    ></span
                  ><strong>{node.step!.title}</strong>
                {:else}<span class="node-meta"
                    ><span>↳ 예외</span>{#if node.scenario!.unresolved}<span
                        class="question-dot">?</span
                      >{/if}</span
                  ><strong>{node.scenario!.title}</strong>{/if}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="feature-overview">
          {#each plan.features as feature, index}
            {@const item = selection.items.find(
              (item) => item.id === feature.id
            )}
            <button
              type="button"
              {disabled}
              onclick={() => onFeature(feature.id)}
              ><span
                >{String(index + 1).padStart(2, '0')} · {feature.group}</span
              ><strong>{feature.title}</strong><small
                >{item?.choice === 'include'
                  ? '이번에 포함'
                  : item?.choice === 'exclude'
                    ? '제외'
                    : item?.choice === 'later'
                      ? '보류'
                      : '범위 미정'}</small
              ></button
            >
          {/each}
          {#if !plan.features.length}<div class="map-empty">
              <h3>문제에서 첫 흐름을 만들어 보세요</h3>
              <p>
                관련 구현을 조사하고 필요한 기능과 정상·예외 경로를 준비합니다.
              </p>
            </div>{/if}
        </div>
      {/if}
    </div>
    {#if standalone.length}<div class="standalone">
        <span>별도 진입 예외</span>{#each standalone as entry}<button
            type="button"
            aria-pressed={exception?.id === entry.id}
            onclick={() => chooseException(entry)}>{entry.title}</button
          >{/each}
      </div>{/if}
    <div class="map-bottom">
      <span
        >{normal
          ? normal.title
          : '아직 실행 순서가 연결되지 않은 기능 목록입니다.'}</span
      ><span>기획 초안 · 실제 실행 아님</span>
    </div>
    {#if normal}<div class="outcome-strip">
        <span class="outcome-icon">◎</span>
        <div>
          <strong>정상 경로가 끝나면</strong>
          <p>{normal.outcome || '최종 결과 미정'}</p>
        </div>
      </div>{/if}
  </section>
  {#if !comparison}<aside
      bind:this={inspector}
      class="flow-inspector"
      aria-label="선택한 흐름 상세"
    >
      {#if step && activeScenario}
        {#key activeScenario.id + '/' + step.id}
          <div class="inspector-heading">
            <span class="inspector-kicker" class:exception-label={!!exception}
              >{exception ? 'EXCEPTION · 예외 경로' : 'STEP · 정상 단계'}</span
            >
            <h3>{exception ? exception.title : step.title}</h3>
            <p>{exception ? exception.trigger : step.actor || '담당 미정'}</p>
          </div>
        {/key}
        <div class="inspector-body">
          {#if exception}
            <div class="branch-context">
              <strong
                >{branchPoint
                  ? '“' + branchPoint.title + '” 처리 중 분기'
                  : '별도 진입 상황'}</strong
              >
              <p>정상 처리의 성공 상태를 적용하지 않습니다.</p>
            </div>
            <ol class="exception-steps">
              {#each exception.steps as entry, index}<li>
                  <button
                    type="button"
                    class:current={exceptionStep === index}
                    aria-current={exceptionStep === index ? 'step' : undefined}
                    onclick={() => (exceptionStep = index)}
                    ><span>{index + 1}</span>{entry.title}</button
                  >
                </li>{/each}
            </ol>
            <p class="detail-label">{step.actor || '담당 미정'}의 처리</p>
            <h4>{step.title}</h4>
          {/if}
          <p class="step-description">
            {step.description || '처리 내용 미정'}
          </p>
          {#if issues.length}<details class="inspector-fold issue-fold">
              <summary>현재 선택과 확인할 점 {issues.length}개</summary>
              <ul>
                {#each issues as issue}<li>{issue}</li>{/each}
              </ul>
            </details>{/if}
          <section class="expected-box">
            <h4>확인할 결과</h4>
            <p>{step.expected || '기대 결과 미정'}</p>
          </section>
          {#if effect}
            <section class="state-section">
              <h4>상태 변화</h4>
              {#each effect.transitions as row}<div class="state-card">
                  <strong>{row.target || '대상 미정'}</strong>
                  <div>
                    <span>{row.before || '미정'}</span><b>→</b><span
                      >{row.after || '미정'}</span
                    >
                  </div>
                </div>{/each}
            </section>
            <details class="inspector-fold">
              <summary>조건과 영향 대상</summary>
              <p>{effect.condition || '조건 미정'}</p>
              <ul>
                {#each effect.impacts as row}<li>
                    <strong>{row.target}</strong>
                    {row.change}
                  </li>{/each}
              </ul>
            </details>
          {/if}
          {#if branchOptions.length}<section class="inspector-branches">
              <h4>이 단계의 예외 {branchOptions.length}개</h4>
              {#each branchOptions as entry}<button
                  type="button"
                  onclick={() => chooseException(entry)}
                  >↳ {entry.title}<span>→</span></button
                >{/each}
            </section>{/if}
          {#if exception}<section class="exception-outcome">
              <h4>최종 결과</h4>
              <p>{exception.outcome || '미정'}</p>
              <h4>복구 · 다음 행동</h4>
              <p>{exception.recovery || '미정'}</p>
            </section>{/if}
          {#each openQuestions as question}<section class="open-question">
              <span>결정이 필요한 질문</span>
              <p>{question}</p>
              <button
                type="button"
                {disabled}
                onclick={() => onQuestion(question, activeScenario.title)}
                >남은 결정에 추가 +</button
              >
            </section>{/each}
          <details class="inspector-fold">
            <summary>이 경로의 시작 조건</summary>
            <p>{activeScenario.precondition || '미정'}</p>
          </details>
        </div>
        <div class="inspector-actions">
          <button
            type="button"
            class="back-to-map"
            onclick={() => viewport.scrollIntoView({ block: 'start' })}
            >↑ 흐름 지도</button
          >
          {#if exception}<button type="button" onclick={returnToNormal}
              >← 정상 경로</button
            >{/if}{#if step.featureId}<button
              type="button"
              {disabled}
              onclick={() => onFeature(step.featureId)}>관련 기능 편집 →</button
            >{/if}
        </div>
      {:else}<div class="inspector-empty">
          <span class="inspector-kicker">NEXT STEP</span>
          <h3>흐름을 연결할 차례입니다</h3>
          <p>
            정상 경로와 예외가 준비되면 이곳에서 단계별 상태와 처리 방법을 볼 수
            있습니다.
          </p>
          <button
            type="button"
            class="primary"
            disabled={disabled || !connected || !selection.goal.trim()}
            onclick={onPrepare}>흐름 포함해 후보 준비</button
          >
        </div>{/if}
    </aside>{/if}
</div>
