<style>
  .audit-page {
    color: #33465f;
  }
  .heading,
  .counts {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .heading h2 {
    font-size: 19px;
  }
  .heading p,
  .muted,
  small {
    color: #64748b;
    font-size: 12px;
  }
  .counts {
    justify-content: flex-start;
    margin: 18px 0;
  }
  .counts span {
    background: #fff5e6;
    border: 1px solid #eddbbc;
    border-radius: 9px;
    padding: 10px 14px;
    font-size: 12px;
  }
  .counts strong {
    font-size: 20px;
    margin-left: 8px;
  }
  .panel {
    border: 1px solid #dfe6ef;
    border-radius: 12px;
    background: white;
    padding: 22px;
    margin: 16px 0;
  }
  .panel > summary {
    font-size: 15px;
    font-weight: 650;
  }
  .panel article {
    padding: 16px 0;
    border-bottom: 1px solid #edf1f6;
  }
  .panel h3 {
    font-size: 15px;
    margin: 8px 0;
  }
  .panel h3 span {
    font-size: 11px;
    color: #936024;
    margin-left: 8px;
  }
  .panel p {
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .panel article.issue {
    border-left: 3px solid #cb9444;
    padding-left: 12px;
  }
  .notice {
    background: #fff5e6;
    padding: 12px 16px;
    border-radius: 8px;
    color: #825b2c;
    font-size: 13px;
  }
  .notice button {
    margin: 4px;
    font-size: 12px;
  }
  .before-after {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .before-after > div {
    background: #f5f8fc;
    padding: 12px;
    border-radius: 8px;
    font-size: 12px;
  }
  select {
    max-width: 100%;
    font-size: 12px;
  }
  .matrix {
    overflow: auto;
    margin: 16px 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    min-width: 950px;
    font-size: 11px;
  }
  caption {
    text-align: left;
    padding: 8px 0;
    color: #64748b;
  }
  th,
  td {
    border: 1px solid #e1e7ef;
    padding: 8px;
    text-align: left;
  }
  th {
    background: #f5f8fc;
    min-width: 86px;
  }
  th:first-child {
    min-width: 170px;
  }
  td button {
    font-size: 11px;
    padding: 6px;
    white-space: nowrap;
  }
  button.unknown {
    color: #53667c;
    background: #eef2f7;
  }
  button.cases {
    background: #e8efff;
    color: #3b5e99;
  }
  button.policy {
    background: #fff0d8;
    color: #8a5b21;
  }
  button.na {
    background: #eef5f1;
    color: #496c59;
  }
  button.selected {
    outline: 2px solid #476794;
    outline-offset: 1px;
  }
  .case {
    border-top: 1px solid #e1e7ef;
    padding: 16px 0;
  }
  .case summary {
    font-size: 14px;
  }
  .case summary span {
    font-size: 11px;
    padding: 3px 6px;
    border-radius: 4px;
    background: #eff3f8;
  }
  .case .high {
    background: #ffe9dc;
    color: #964c21;
  }
  dt {
    font-size: 12px;
    font-weight: 650;
    margin-top: 12px;
  }
  dd {
    font-size: 13px;
    margin: 5px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-left: 10px;
  }
  @media (max-width: 800px) {
    .panel {
      padding: 16px;
    }
    .before-after {
      grid-template-columns: 1fr;
    }
    .counts {
      gap: 6px;
    }
    .counts span {
      padding: 8px;
    }
  }
</style>

<script lang="ts">
  import type { Plan, Selection } from '$lib/types'
  import {
    auditAxes,
    auditStatuses,
    auditRows,
    auditCoverage,
    incompleteCase,
    type AuditAxis
  } from '$lib/audit'
  import { scenarioIssues } from '$lib/scenarios'
  let {
    plan,
    selection,
    disabled,
    onPrepare,
    onFeature,
    onQuestion
  }: {
    plan: Plan
    selection: Selection
    disabled: boolean
    onPrepare: () => void
    onFeature: (id: string) => void
    onQuestion: (question: string, context: string) => void
  } = $props()
  let scenarioId = $state(''),
    stepId = $state(''),
    axis = $state<AuditAxis | ''>('')
  let onlyOpen = $state(false)
  let coverage = $derived(auditCoverage(plan, selection))
  let scenario = $derived(
    plan.scenarios?.find((s) => s.id === scenarioId) ?? plan.scenarios?.[0]
  )
  let rows = $derived(
    auditRows(plan).filter((row) => row.scenario.id === scenario?.id)
  )
  let cases = $derived(
    (plan.audit?.cases ?? []).filter(
      (c) =>
        c.scenarioId === scenario?.id &&
        (!stepId || c.stepId === stepId) &&
        (!axis || c.axes.includes(axis)) &&
        (!onlyOpen || c.question || incompleteCase(c).length)
    )
  )
  function pick(step: string, dimension: AuditAxis) {
    stepId = step
    axis = dimension
  }
</script>

<section class="audit-page">
  <div class="heading">
    <div>
      <h2>범위부터 기존 영향, 예외까지</h2>
      <p>
        미기록은 미조사입니다. 사례 발견은 실제 검증이나 모든 경우의 검토 완료를
        뜻하지 않습니다.
      </p>
    </div>
    <button {disabled} onclick={onPrepare}>점검 보완 요청</button>
  </div>
  <div class="counts">
    <span>흐름 미작성 <strong>{coverage.missingFlows.length}</strong></span
    ><span
      >요구 연결 누락 <strong>{coverage.missingRequirements.length}</strong
      ></span
    ><span>영향 미확인 <strong>{coverage.missingImpacts.length}</strong></span
    ><span>전체 단계 관점 미조사 <strong>{coverage.unreviewed}</strong></span
    ><span>정책 미정 <strong>{coverage.policy}</strong></span>
  </div>
  {#if coverage.requirementsMissing}<p class="notice">
      요구사항 추적표가 없습니다. 기능이 흐름에 등장해도 목적과 사용자 메모를
      모두 반영했는지는 확인되지 않았습니다.
    </p>{/if}
  {#if coverage.missingFlows.length}<p class="notice">
      정상 흐름이 없는 기능: {#each coverage.missingFlows as feature}<button
          {disabled}
          onclick={() => onFeature(feature.id)}>{feature.title} →</button
        >{/each}
    </p>{/if}
  <details class="panel" open>
    <summary>요구사항 → 기능 → 정상 흐름</summary>
    <p class="muted">
      제외·보류한 기능은 범위 누락 집계에서 뺍니다. 연결은 형식 점검이며 내용의
      충분성은 검토해야 합니다.
    </p>
    {#each plan.audit?.requirements ?? [] as req}<article
        class:issue={coverage.missingRequirements.some((r) => r.id === req.id)}
      >
        <h3>{req.text}</h3>
        <p>
          {req.featureIds
            .map((id) => plan.features.find((f) => f.id === id)?.title)
            .join(' · ') || '기능 미연결'}
        </p>
        <p>
          → {req.scenarioIds
            .map((id) => plan.scenarios?.find((s) => s.id === id)?.title)
            .join(' / ') || '정상 흐름 미연결'}
        </p>
        <small>근거: {req.source}</small>
      </article>{/each}
  </details>
  <details class="panel">
    <summary>기존 동작 영향 · 무엇이 바뀌고 유지되는가</summary>
    {#each plan.features as feature}{@const impact = plan.audit?.impacts.find(
        (row) => row.featureId === feature.id
      )}
      <article>
        <h3>
          {feature.title}
          <span
            >{!impact || impact.status === 'unknown'
              ? '영향 미확인'
              : impact.status === 'na'
                ? '영향 없음 · 근거 확인'
                : '영향 정리됨 · 실행 미검증'}</span
          >
        </h3>
        <div class="before-after">
          <div>
            <strong>기존 동작</strong>
            <p>{impact?.before || '미조사'}</p>
          </div>
          <div>
            <strong>변경 후</strong>
            <p>{impact?.after || '미정'}</p>
          </div>
        </div>
        {#if impact}<p>
            <strong>유지할 조건</strong>
            {impact.invariants.join(' / ') || '미정'}
          </p>
          {#each impact.targets as target}<p>
              <strong>{target.target}</strong> — {target.change}<br /><small
                >근거: {target.source}</small
              >
            </p>{/each}<small>조사 근거: {impact.source || '미조사'}</small
          >{#if impact.reason}<p class="notice">{impact.reason}</p>{/if}{/if}
      </article>{/each}
  </details>
  <section class="panel">
    <div class="heading">
      <h3>단계별 관점 점검</h3>
      <label
        >검토할 경로<select
          value={scenario?.id ?? ''}
          onchange={(e) => {
            scenarioId = e.currentTarget.value
            stepId = ''
            axis = ''
          }}
          >{#each plan.scenarios ?? [] as entry}<option value={entry.id}
              >{entry.kind === 'normal' ? '정상' : '예외'} · {entry.title}</option
            >{/each}</select
        ></label
      >
    </div>
    {#if scenario}{@const issues = scenarioIssues(
        plan,
        selection,
        scenario
      )}{#if issues.length}<p class="notice">
          현재 선택 기준 재검토 필요: {issues.join(' / ')}
        </p>{/if}
      <div class="matrix">
        <table>
          <caption
            >모든 단계의 9개 관점 · 칸을 선택하면 연결 사례와 점검 이유를
            봅니다.</caption
          ><thead
            ><tr
              ><th>단계</th>{#each Object.values(auditAxes) as label}<th
                  >{label}</th
                >{/each}</tr
            ></thead
          ><tbody
            >{#each scenario.steps as step}<tr
                ><th>{step.title}</th
                >{#each Object.keys(auditAxes) as dimension}{@const row =
                    rows.find(
                      (row) => row.step.id === step.id && row.axis === dimension
                    )!}<td
                    ><button
                      class={row.status}
                      class:selected={stepId === step.id && axis === dimension}
                      aria-pressed={stepId === step.id && axis === dimension}
                      onclick={() => pick(step.id, dimension as AuditAxis)}
                      >{auditStatuses[row.status]}</button
                    ></td
                  >{/each}</tr
              >{/each}</tbody
          >
        </table>
      </div>
      {#if stepId && axis}{@const selected = rows.find(
          (row) => row.step.id === stepId && row.axis === axis
        )}
        <p class="notice">
          <strong
            >{scenario.steps.find((step) => step.id === stepId)?.title} / {auditAxes[
              axis
            ]}</strong
          ><br />{selected?.check?.reason ||
            '아직 점검 근거가 작성되지 않았습니다.'}
        </p>{/if}
    {:else}<p class="notice">
        시나리오가 없어 단계별 예외를 점검할 수 없습니다. 정상 흐름을 먼저
        준비하세요.
      </p>{/if}
  </section>
  <section class="panel">
    <div class="heading">
      <h3>상세 예외 사례 · {cases.length}개</h3>
      <div>
        <button
          onclick={() => {
            stepId = ''
            axis = ''
          }}>경로 전체 사례</button
        ><label class="inline"
          ><input type="checkbox" bind:checked={onlyOpen} /> 미결정·처리 미작성만</label
        >
      </div>
    </div>
    <p class="muted">
      지도에는 대표 흐름을, 이 목록에는 세부 조건과 복구·검증 기준을 보관합니다.
    </p>
    {#each cases as entry}<details class="case">
        <summary
          ><span class={entry.priority}
            >{entry.priority === 'high'
              ? '높음'
              : entry.priority === 'medium'
                ? '중간'
                : '낮음'}</span
          >
          {entry.title}
          {#if entry.question || incompleteCase(entry).length}<small
              >· 결정/보완 필요</small
            >{/if}</summary
        >
        <p class="muted">
          {entry.axes.map((axis) => auditAxes[axis]).join(' · ')} / {entry.rationale}
        </p>
        <dl>
          <dt>발생 조건</dt>
          <dd>{entry.condition}</dd>
          <dt>지켜야 할 조건</dt>
          <dd>{entry.invariant || '미정'}</dd>
          <dt>처리 후 상태</dt>
          <dd>{entry.expected || '미정'}</dd>
          <dt>사용자 안내</dt>
          <dd>{entry.feedback || '미정'}</dd>
          <dt>복구 · 다음 행동</dt>
          <dd>{entry.recovery || '미정'}</dd>
          <dt>재현 · 검증 방법 (실행 미검증)</dt>
          <dd>{entry.verification || '미정'}</dd>
          <dt>근거</dt>
          <dd>{entry.source}</dd>
        </dl>
        {#if entry.question}<p class="notice">{entry.question}</p>
          <button
            {disabled}
            onclick={() => onQuestion(entry.question, entry.title)}
            >남은 결정에 추가</button
          >{/if}
      </details>{/each}
    {#if !cases.length}<p>
        이 조건에 연결된 상세 사례가 없습니다. 해당 없음으로 확인된 상태인지 위
        점검 기록을 확인하세요.
      </p>{/if}
  </section>
</section>
