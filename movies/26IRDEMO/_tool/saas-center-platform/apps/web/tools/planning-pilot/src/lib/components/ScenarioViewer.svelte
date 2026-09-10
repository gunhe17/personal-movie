<style>
  .scenario-viewer {
    margin: 24px 0;
    padding: 24px;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .viewer-heading,
  .scenario-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .viewer-layout {
    display: grid;
    grid-template-columns: minmax(190px, 0.7fr) minmax(0, 2fr);
    gap: 24px;
    margin-top: 20px;
  }
  h2,
  h3,
  h4,
  h5 {
    margin: 0;
  }
  h3 {
    font-size: 16px;
    letter-spacing: 0;
  }
  h4 {
    font-size: 17px;
  }
  h5 {
    font-size: 13px;
    margin: 12px 0 6px;
  }
  .scenario-list h3 {
    font-size: 12px;
    color: var(--muted);
    margin: 4px 0 10px;
  }
  .scenario-list h3:not(:first-child) {
    margin-top: 20px;
  }
  .scenario-list button {
    display: block;
    width: 100%;
    text-align: left;
    margin-bottom: 8px;
    padding: 12px;
  }
  button span {
    display: block;
  }
  .scenario-list button span {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
  }
  .scenario-list button[aria-pressed='true'] {
    background: var(--soft);
    border-color: var(--accent);
  }
  .scenario-list button.exception[aria-pressed='true'] {
    background: #fff7ed;
    border-color: #b45309;
  }
  .scenario-content {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .scenario-heading {
    justify-content: flex-start;
    margin-bottom: 12px;
  }
  .kind {
    background: var(--soft);
    border-radius: 16px;
    padding: 4px 10px;
    font-size: 11px;
  }
  .kind.exception {
    color: #9a3412;
    background: #fff7ed;
  }
  .path {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    margin: 20px 0;
    list-style: none;
  }
  .path li {
    display: flex;
    flex-direction: column;
    justify-content: end;
    flex: 1 1 120px;
  }
  .path button {
    height: 100%;
    text-align: left;
    padding: 10px;
    font-size: 12px;
    background: var(--background);
  }
  .path button.active {
    border-color: var(--accent);
    background: var(--soft);
    box-shadow: inset 0 -3px var(--accent);
  }
  .path button.past {
    border-color: #94a3b8;
  }
  .step-number {
    color: var(--muted);
    font-size: 11px;
    margin-bottom: 4px;
  }
  .path small,
  .fork-label {
    font-size: 10px;
    color: #9a3412;
  }
  .fork-label {
    margin-bottom: 6px;
  }
  .step-detail {
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .step-detail > p,
  .expected p,
  .remaining p,
  .outcome p {
    white-space: pre-wrap;
  }
  .expected {
    margin-top: 16px;
    padding: 12px;
    border-radius: 6px;
    background: var(--soft);
    font-size: 13px;
  }
  .state-impact {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .state-impact ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .state-impact li {
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    font-size: 12px;
  }
  .state-impact span {
    display: block;
    white-space: pre-wrap;
    color: var(--muted);
  }
  .branches {
    margin-top: 18px;
    border-top: 1px solid var(--line);
  }
  .branches button {
    display: block;
    width: 100%;
    text-align: left;
    border-color: #fed7aa;
    margin: 8px 0;
    background: #fff7ed;
    color: #9a3412;
    font-size: 12px;
  }
  .branches span {
    margin-top: 4px;
    color: #7c5131;
  }
  .branch-note,
  .issues {
    padding: 12px;
    margin-top: 12px;
    background: #fff7ed;
    color: #9a3412;
    border-radius: 6px;
    font-size: 12px;
  }
  .walk-controls {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 12px 0;
  }
  .outcome {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }
  .remaining {
    margin: 16px 0;
    font-size: 13px;
  }
  .remaining button,
  .question {
    font-size: 12px;
  }
  .question {
    margin-top: 12px;
    text-align: left;
  }
  .revise {
    border-top: 1px solid var(--line);
    padding-top: 12px;
    margin-top: 20px;
    font-size: 12px;
  }
  .revise p {
    margin: 10px 0;
  }
  .empty {
    margin-top: 16px;
    padding: 20px;
    background: var(--background);
    border-radius: 8px;
  }
  .empty p {
    margin: 8px 0 16px;
  }
  @media (max-width: 800px) {
    .scenario-viewer {
      padding: 16px;
    }
    .viewer-layout {
      grid-template-columns: 1fr;
    }
    .scenario-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .scenario-list h3 {
      grid-column: 1 / -1;
    }
    .scenario-list button {
      margin: 0;
    }
  }
  @media (max-width: 500px) {
    .state-impact {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .step-detail {
      padding: 14px;
    }
    .path li {
      flex-basis: 42%;
    }
  }
</style>

<script lang="ts">
  import type { Plan, Selection, Scenario } from '$lib/types'
  import { scenarioPath, scenarioIssues, stepEffect } from '$lib/scenarios'
  let {
    plan,
    selection,
    disabled = false,
    connected,
    onPrepare,
    onQuestion
  }: {
    plan: Plan
    selection: Selection
    disabled?: boolean
    connected: boolean
    onPrepare: () => void
    onQuestion: (question: string, title: string) => void
  } = $props()
  let selectedId = $state('')
  let cursor = $state(0)
  let scenarios = $derived(plan.scenarios ?? [])
  let scenario = $derived(
    scenarios.find((entry) => entry.id === selectedId) ??
      scenarios.find((entry) => entry.kind === 'normal') ??
      scenarios[0]
  )
  let path = $derived(
    scenario
      ? scenarioPath(scenarios, scenario)
      : { prefix: [], fork: null, steps: [] }
  )
  let steps = $derived([...path.prefix, ...path.steps])
  let activeIndex = $derived(Math.min(cursor, Math.max(0, steps.length - 1)))
  let step = $derived(steps[activeIndex])
  let effect = $derived(step ? stepEffect(plan, selection, step) : undefined)
  let issues = $derived(
    scenario ? scenarioIssues(plan, selection, scenario) : []
  )
  let branches = $derived(
    scenario?.kind === 'normal' && step
      ? scenarios.filter(
          (entry) =>
            entry.branch?.scenarioId === scenario.id &&
            entry.branch.stepId === step.id
        )
      : []
  )
  function pick(entry: Scenario) {
    selectedId = entry.id
    cursor = scenarioPath(scenarios, entry).prefix.length
  }
  function backToNormal() {
    const source = scenarios.find(
      (entry) => entry.id === scenario?.branch?.scenarioId
    )
    if (!source || !scenario?.branch) return
    cursor = Math.max(
      0,
      source.steps.findIndex((entry) => entry.id === scenario.branch!.stepId)
    )
    selectedId = source.id
  }
</script>

<section class="scenario-viewer" aria-labelledby="scenario-title">
  <div class="viewer-heading">
    <div>
      <p class="eyebrow">기능이 추가된 뒤의 사용자 경험</p>
      <h2 id="scenario-title">시나리오 따라보기</h2>
    </div>
    <span class="muted"
      >정상 {scenarios.filter((entry) => entry.kind === 'normal').length} · 예외
      {scenarios.filter((entry) => entry.kind === 'exception').length}</span
    >
  </div>
  <p class="muted">
    기획 초안을 단계별로 읽는 보기입니다. 실제 기능 실행이나 테스트 결과는
    아닙니다.
  </p>
  {#if !scenario}
    <div class="empty">
      <strong>아직 연결된 시나리오가 없습니다.</strong>
      <p>
        행동의 나열만으로 정상 순서를 추측하지 않습니다. 현재 선택과 의견으로
        정상 경로와 필요한 예외 경로를 준비하세요.
      </p>
      <button
        type="button"
        disabled={disabled || !connected || !selection.goal.trim()}
        onclick={onPrepare}>시나리오 포함해 후보 보완 요청</button
      >
    </div>
  {:else}
    <div class="viewer-layout">
      <nav class="scenario-list" aria-label="시나리오 선택">
        {#each ['normal', 'exception'] as kind}
          <h3>{kind === 'normal' ? '정상 시나리오' : '예외 · 엣지케이스'}</h3>
          {#each scenarios.filter((entry) => entry.kind === kind) as entry}
            <button
              type="button"
              class:exception={kind === 'exception'}
              aria-pressed={scenario.id === entry.id}
              onclick={() => pick(entry)}
            >
              <strong>{entry.title}</strong>
              {#if entry.trigger}<span>{entry.trigger}</span>{/if}
            </button>
          {/each}
        {/each}
      </nav>
      <div class="scenario-content">
        <div class="scenario-heading">
          <span class="kind" class:exception={scenario.kind === 'exception'}
            >{scenario.kind === 'normal' ? '정상 경로' : '예외 경로'}</span
          >
          <h3>{scenario.title}</h3>
        </div>
        <p><strong>시작 조건</strong> {scenario.precondition || '미정'}</p>
        {#if issues.length}<details class="issues" open>
            <summary>현재 선택과 확인할 점 {issues.length}개</summary>
            <ul>
              {#each issues as issue}<li>{issue}</li>{/each}
            </ul>
          </details>{/if}
        {#if scenario.kind === 'exception'}
          <div class="branch-note">
            <strong
              >{path.fork
                ? '“' + path.fork.title + '” 단계에서 분기'
                : '별도 예외 상황'}</strong
            >
            <p>{scenario.trigger || '발생 조건 미정'}</p>
            {#if path.fork}<p class="muted">
                분기 지점의 정상 처리 결과를 적용하지 않고 아래 예외 경로로
                이어집니다.
              </p>{/if}
          </div>
        {/if}
        <ol class="path" aria-label="시나리오 단계">
          {#each steps as entry, index}
            <li>
              {#if scenario.kind === 'exception' && index === path.prefix.length}<span
                  class="fork-label">↳ 예외 처리 시작</span
                >{/if}
              <button
                type="button"
                class:active={index === activeIndex}
                class:past={index < activeIndex}
                aria-current={index === activeIndex ? 'step' : undefined}
                onclick={() => (cursor = index)}
              >
                <span class="step-number">{index + 1}</span><span
                  >{entry.title}</span
                >
                {#if index < path.prefix.length}<small>공통 경로</small>{/if}
              </button>
            </li>
          {/each}
        </ol>
        {#if step}
          <article class="step-detail">
            <p class="eyebrow" role="status">
              {activeIndex + 1} / {steps.length} 단계 · {step.actor ||
                '담당 미정'}
            </p>
            <h4>{step.title}</h4>
            <p>{step.description || '처리 내용 미정'}</p>
            <div class="expected">
              <strong>이 단계에서 확인할 결과</strong>
              <p>{step.expected || '기대 결과 미정'}</p>
            </div>
            {#if effect}
              <p class="muted">
                <strong>연결 행동의 조건</strong>
                {effect.condition || '미정'}
              </p>
              <div class="state-impact">
                <div>
                  <h5>대상별 상태 변화</h5>
                  {#if effect.transitions.length}<ul>
                      {#each effect.transitions as row}<li>
                          <strong>{row.target || '대상 미정'}</strong><span
                            >{row.before || '미정'} → {row.after ||
                              '미정'}</span
                          >
                        </li>{/each}
                    </ul>{:else}<p>미정</p>{/if}
                </div>
                <div>
                  <h5>영향받는 대상</h5>
                  {#if effect.impacts.length}<ul>
                      {#each effect.impacts as row}<li>
                          <strong>{row.target || '대상 미정'}</strong><span
                            >{row.change || '영향 미정'}</span
                          >
                        </li>{/each}
                    </ul>{:else}<p>미정</p>{/if}
                </div>
              </div>
              {#if effect.unresolved}<button
                  type="button"
                  class="question"
                  {disabled}
                  onclick={() => onQuestion(effect.unresolved, scenario.title)}
                  >남은 결정에 추가: {effect.unresolved}</button
                >{/if}
            {:else if step.effectId}<p class="issues">
                연결된 행동이 현재 선택에 적용되지 않아 상태 변화는 표시하지
                않습니다.
              </p>{/if}
            {#if branches.length}
              <div class="branches">
                <h5>이 단계에서 이런 일이 생기면?</h5>
                {#each branches as branch}<button
                    type="button"
                    onclick={() => pick(branch)}
                    ><strong>↳ {branch.title}</strong><span
                      >{branch.trigger}</span
                    ></button
                  >{/each}
              </div>
            {/if}
          </article>
          <div class="walk-controls">
            <button
              type="button"
              disabled={activeIndex === 0}
              onclick={() => (cursor = activeIndex - 1)}>← 이전 단계</button
            >
            <button
              type="button"
              class="primary"
              disabled={activeIndex === steps.length - 1}
              onclick={() => (cursor = activeIndex + 1)}>다음 단계 →</button
            >
          </div>
          {#if activeIndex === steps.length - 1}
            <div class="outcome">
              <h4>이 경로의 최종 결과</h4>
              <p>{scenario.outcome || '미정'}</p>
              <h5>이후 행동 · 복구</h5>
              <p>{scenario.recovery || '미정'}</p>
            </div>
          {/if}
        {/if}
        {#if scenario.unresolved}<div class="remaining">
            <strong>이 시나리오에서 남은 질문</strong>
            <p>{scenario.unresolved}</p>
            <button
              type="button"
              {disabled}
              onclick={() => onQuestion(scenario.unresolved, scenario.title)}
              >남은 결정에 추가</button
            >
          </div>{/if}
        {#if scenario.branch && path.fork}<button
            type="button"
            onclick={backToNormal}>정상 경로의 분기 지점으로 돌아가기</button
          >{/if}
        <details class="revise">
          <summary>시나리오 보완하기</summary>
          <p>
            남은 결정에 답변하거나 전체 의견에 수정할 흐름을 적은 뒤 후보 보완을
            요청하세요. 결과가 준비되면 초안 새로고침으로 확인합니다.
          </p>
          <button
            type="button"
            disabled={disabled || !connected || !selection.goal.trim()}
            onclick={onPrepare}>시나리오 포함해 후보 보완 요청</button
          >
        </details>
      </div>
    </div>
  {/if}
</section>
