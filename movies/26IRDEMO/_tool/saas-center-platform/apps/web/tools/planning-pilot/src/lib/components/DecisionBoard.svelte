<style>
  .decision-board {
    margin: 24px 0;
    padding: 24px;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    background: #fff;
  }
  .heading,
  .add-row,
  .filters,
  .statuses {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .heading {
    justify-content: space-between;
  }
  h2 {
    margin: 0;
  }
  h2 span {
    color: #64748b;
    font-size: 16px;
  }
  .eyebrow,
  .muted,
  .empty {
    color: #64748b;
    font-size: 13px;
  }
  .eyebrow {
    margin: 0 0 6px;
  }
  .warning {
    color: #9a3412;
  }
  .add-row input {
    flex: 1;
    min-width: 180px;
  }
  label {
    display: block;
    font-size: 13px;
  }
  .filters {
    margin-top: 20px;
    justify-content: space-between;
  }
  article {
    padding: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-top: 12px;
  }
  article.blocked {
    border-left: 4px solid #d97706;
  }
  .context {
    white-space: pre-wrap;
    font-size: 14px;
    color: #475569;
  }
  .fields {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 12px;
    margin: 16px 0;
  }
  select {
    max-width: 100%;
  }
  .fields select,
  textarea {
    width: 100%;
  }
  .blocking {
    margin-bottom: 12px;
  }
  .statuses {
    margin-top: 12px;
  }
  .badge {
    background: #f1f5f9;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
  }
  button[aria-pressed='true'] {
    background: #1e293b;
    color: white;
  }
  details {
    margin-top: 12px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .decision-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
  }
  .decision-summary:hover {
    background: transparent;
  }
  .decision-summary .badge {
    flex-shrink: 0;
  }
  .decision-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .decision-copy strong {
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .decision-meta {
    font-size: 11px;
    color: #64748b;
  }
  .decision-content {
    border-top: 1px solid #e7edf4;
    margin-top: 16px;
    padding-top: 12px;
  }
  .decision-content[hidden] {
    display: none;
  }
  @media (max-width: 600px) {
    .decision-board,
    article {
      padding: 16px;
    }
    .fields {
      grid-template-columns: 1fr;
    }
  }
</style>

<script lang="ts">
  import {
    ownerLabels,
    decisionLabels,
    decisionIsPending,
    blockingDecisions
  } from '$lib/types'
  import type { Decision, Plan, SelectionItem } from '$lib/types'
  let {
    plan,
    items,
    decisions = $bindable([]),
    disabled = false
  }: {
    plan: Plan
    items: SelectionItem[]
    decisions?: Decision[]
    disabled?: boolean
  } = $props()
  let expandedId = $state('')
  let question = $state('')
  let owner = $state('all')
  let showClosed = $state(false)
  let error = $state('')
  let blockers = $derived(
    blockingDecisions({ goal: plan.goal, additional: '', items, decisions })
  )
  let pending = $derived(decisions.filter(decisionIsPending))
  let visible = $derived(
    decisions.filter(
      (decision) =>
        (showClosed || decisionIsPending(decision)) &&
        (owner === 'all' || decision.owner === owner)
    )
  )
  function add() {
    if (!question.trim() || decisions.length >= 60) return
    decisions = [
      ...decisions,
      {
        id: 'question-' + crypto.randomUUID(),
        question: question.trim(),
        context: '',
        featureId: '',
        owner: 'together',
        blocking: true,
        status: 'open',
        answer: '',
        origin: ''
      }
    ]
    expandedId = decisions[decisions.length - 1].id
    owner = 'all'
    question = ''
  }
  function setStatus(decision: Decision, status: Decision['status']) {
    if (status === 'resolved' && !decision.answer.trim()) {
      error = '결정한 내용과 이유를 먼저 입력하세요.'
      return
    }
    error = ''
    decision.status = status
  }
</script>

<section class="decision-board" aria-labelledby="decisions-title">
  <div class="heading">
    <div>
      <p class="eyebrow">선택한 동작에서 한 걸음 더</p>
      <h2 id="decisions-title">남은 결정 <span>{pending.length}</span></h2>
    </div>
    <strong class:warning={blockers.length > 0}
      >구현 전 답변 필요 {blockers.length}개</strong
    >
  </div>
  <p class="muted">
    동작을 선택해도 정책 질문은 남을 수 있습니다. 답변이 없어도 기획 정리를
    요청할 수 있습니다.
  </p>
  <form
    onsubmit={(event) => {
      event.preventDefault()
      add()
    }}
  >
    <label for="new-question">함께 결정할 질문 추가</label>
    <div class="add-row">
      <input
        id="new-question"
        bind:value={question}
        maxlength="1000"
        placeholder="예: 변경 요청은 누가 어디에서 승인하나요?"
        {disabled}
      />
      <button disabled={disabled || !question.trim() || decisions.length >= 60}
        >질문 추가</button
      >
    </div>
  </form>
  {#if decisions.length >= 60}<p class="muted">
      질문은 최대 60개입니다. 현재 질문의 답변과 범위를 먼저 정리하세요.
    </p>{/if}
  {#if decisions.length}
    <div class="filters">
      <label
        >담당별 보기 <select bind:value={owner}>
          <option value="all">전체 담당</option>
          {#each Object.entries(ownerLabels) as [value, label]}<option {value}
              >{label}</option
            >{/each}
        </select></label
      >
      <label
        ><input type="checkbox" bind:checked={showClosed} /> 결정·제외한 질문도 보기</label
      >
    </div>
  {:else}
    <p class="empty">
      아직 등록한 질문이 없습니다. 기획 결과의 후속 질문을 가져오거나 직접
      추가하세요.
    </p>
  {/if}
  <p role="status">{error}</p>
  {#each visible as decision (decision.id)}
    <article class:blocked={blockers.some((entry) => entry.id === decision.id)}>
      <button
        type="button"
        class="decision-summary"
        aria-expanded={expandedId === decision.id}
        aria-controls={'decision-' + decision.id}
        onclick={() =>
          (expandedId = expandedId === decision.id ? '' : decision.id)}
      >
        <span class="decision-copy"
          ><strong>{decision.question}</strong><span class="decision-meta"
            >{ownerLabels[decision.owner]} · {plan.features.find(
              (feature) => feature.id === decision.featureId
            )?.title ??
              '전체 기획'}{#if blockers.some((entry) => entry.id === decision.id)}
              · 구현 전 답변 필요{/if}</span
          ></span
        >
        <span class="badge">{decisionLabels[decision.status]}</span><span
          aria-hidden="true">{expandedId === decision.id ? '−' : '+'}</span
        >
      </button>
      <div
        class="decision-content"
        id={'decision-' + decision.id}
        hidden={expandedId !== decision.id}
      >
        {#if decision.context}<p class="context">{decision.context}</p>{/if}
        {#if decision.featureId && !plan.features.some((feature) => feature.id === decision.featureId)}
          <p class="warning">
            기존 관련 항목이 변경되었습니다. 질문은 보존했으니 연결할 항목을
            확인하세요.
          </p>
        {/if}
        <div class="fields">
          <label
            >관련 항목 <select bind:value={decision.featureId} {disabled}>
              <option value="">새 요구 / 전체 기획</option>
              {#if decision.featureId && !plan.features.some((feature) => feature.id === decision.featureId)}
                <option value={decision.featureId}
                  >이전 항목 · {decision.featureId}</option
                >
              {/if}
              {#each plan.features as feature}<option value={feature.id}
                  >{feature.title}</option
                >{/each}
            </select></label
          >
          <label
            >누가 확인할까요? <select bind:value={decision.owner} {disabled}>
              {#each Object.entries(ownerLabels) as [value, label]}<option
                  {value}>{label}</option
                >{/each}
            </select></label
          >
        </div>
        <label class="blocking"
          ><input type="checkbox" bind:checked={decision.blocking} {disabled} />
          이 내용의 구현 전에 답변이 필요해요</label
        >
        {#if items.some((item) => item.id === decision.featureId && ['later', 'exclude'].includes(item.choice))}
          <p class="muted">
            관련 기능이 보류·제외되어 현재 구현 전 질문 수에는 포함하지
            않습니다.
          </p>
        {/if}
        <label
          >답변 · 선택 이유
          <textarea
            rows="2"
            maxlength="4000"
            bind:value={decision.answer}
            {disabled}
            oninput={() => {
              if (decision.status === 'resolved') decision.status = 'open'
            }}
            placeholder="결정한 내용이나 확인할 근거를 적어주세요."
          ></textarea>
        </label>
        <div
          class="statuses"
          role="group"
          aria-label={decision.question + ' 상태'}
        >
          {#each Object.entries(decisionLabels) as [status, label]}
            <button
              type="button"
              aria-pressed={decision.status === status}
              {disabled}
              onclick={() => setStatus(decision, status as Decision['status'])}
              >{label}</button
            >
          {/each}
        </div>
        {#if decision.status === 'later' && decision.blocking}<p class="muted">
            보류해도 구현 전 답변이 필요한 질문은 계속 표시합니다.
          </p>{/if}
        {#if decision.origin}<details>
            <summary>질문 출처</summary>
            <p class="muted">
              {decision.origin.startsWith('compare-')
                ? '구현 비교 기준 기록'
                : '기획 결과 기록'}
              {decision.origin}
            </p>
          </details>{/if}
      </div>
    </article>
  {/each}
  {#if decisions.length && !visible.length}<p class="empty">
      현재 보기 조건에 해당하는 질문이 없습니다.
    </p>{/if}
</section>
