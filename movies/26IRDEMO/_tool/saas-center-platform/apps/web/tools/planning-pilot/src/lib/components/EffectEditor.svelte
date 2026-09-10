<style>
  .effects {
    margin: 24px 0;
    padding-top: 20px;
    border-top: 1px solid #cbd5e1;
  }
  h4 {
    margin: 0;
    font-size: 15px;
  }
  .heading,
  .toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .heading {
    justify-content: space-between;
  }
  .toolbar {
    margin: 12px 0;
  }
  .muted {
    font-size: 12px;
    color: #64748b;
  }
  .notice {
    background: #f8fafc;
    padding: 10px;
    font-size: 12px;
  }
  .effect-edit {
    padding: 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    margin: 12px 0;
  }
  summary {
    font-weight: 600;
    color: #1e293b;
    overflow-wrap: anywhere;
  }
  label {
    display: block;
    margin: 10px 0;
  }
  input:not([type='checkbox']),
  select {
    width: 100%;
    min-width: 0;
    margin-top: 5px;
    font-size: 12px;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  fieldset {
    min-width: 0;
    margin: 16px 0;
    padding: 10px;
    border: 1px solid #e2e8f0;
  }
  legend {
    font-weight: 600;
    font-size: 12px;
  }
  .state-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    gap: 6px;
    align-items: end;
  }
  .impact-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
    gap: 6px;
    align-items: end;
  }
  button {
    font-size: 12px;
  }
  .remove {
    padding: 8px 5px;
    margin-bottom: 10px;
  }
  .question {
    display: block;
    margin-top: 10px;
    text-align: left;
    overflow-wrap: anywhere;
  }
  @media (max-width: 600px) {
    .pair,
    .state-row,
    .impact-row {
      grid-template-columns: 1fr;
    }
    .state-row,
    .impact-row {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 12px;
    }
  }
</style>

<script lang="ts">
  import type { Feature, SelectionItem, ActionEffect } from '$lib/types'
  import { actionEffects, applicableEffects } from '$lib/types'
  import EffectSummary from './EffectSummary.svelte'
  let {
    feature,
    item = $bindable(),
    onQuestion
  }: {
    feature: Feature
    item: SelectionItem
    onQuestion: (question: string) => void
  } = $props()
  let editing = $state(false)
  let showOther = $state(false)
  let removed = $state<ActionEffect | null>(null)
  let effects = $derived(actionEffects(feature, item))
  let selected = $derived(applicableEffects(feature, item))
  let hidden = $derived(effects.length - selected.length)
  function startEditing() {
    if (item.effects === undefined)
      item.effects = JSON.parse(JSON.stringify(effects))
    editing = true
  }
  function add() {
    if (effects.length >= 12) return
    startEditing()
    item.effects = [
      ...item.effects!,
      {
        id: 'action-' + crypto.randomUUID(),
        optionId: item.behavior === 'undecided' ? '' : item.behavior,
        actor: '',
        action: '',
        condition: '',
        transitions: [{ target: '', before: '', after: '' }],
        impacts: [{ target: '', change: '' }],
        failure: '',
        cancellation: '',
        unresolved: ''
      }
    ]
  }
  function remove(effect: ActionEffect) {
    removed = JSON.parse(JSON.stringify(effect))
    item.effects = item.effects!.filter((entry) => entry.id !== effect.id)
  }
</script>

<section class="effects" aria-labelledby={'effects-' + feature.id}>
  <div class="heading">
    <h4 id={'effects-' + feature.id}>행동의 영향과 상태 변화</h4>
    <span class="muted">현재 동작 {selected.length}개</span>
  </div>
  <p class="muted">
    행동별로 무엇이 바뀌고 무엇이 유지되는지 정리하세요. 모르는 내용은 미정으로
    두고, 해당하지 않으면 이유를 적습니다.
  </p>
  <p class="muted">
    {item.effects === undefined
      ? '후보에 포함된 검토 초안입니다. 편집하면 현재 선택 기록에 별도로 보관합니다.'
      : '현재 선택 기록에 작성한 내용입니다. 후보가 갱신되어도 덮어쓰지 않습니다.'}
  </p>
  {#if item.behavior === 'undecided'}<p class="notice">
      아직 동작을 선택하지 않았습니다. 공통 내용만 표시합니다.
    </p>{/if}
  <div class="toolbar">
    <button type="button" disabled={effects.length >= 12} onclick={add}
      >행동 추가</button
    >
    {#if !editing && effects.length}<button type="button" onclick={startEditing}
        >내용 편집</button
      >{/if}
    {#if editing}<button type="button" onclick={() => (editing = false)}
        >정리해서 보기</button
      >{/if}
    {#if hidden}<label
        ><input type="checkbox" bind:checked={showOther} /> 다른 동작용 {hidden}개도
        보기</label
      >{/if}
  </div>
  {#if !selected.length}<p class="notice">
      선택한 동작의 영향·상태 변화는 아직 정리되지 않았습니다. 영향이 없다고
      확인한 상태는 아닙니다.
    </p>{/if}
  {#if editing && item.effects}
    {#each item.effects as effect, index (effect.id)}
      {#if showOther || !effect.optionId || effect.optionId === item.behavior}
        <details class="effect-edit" open>
          <summary
            >{effect.action || '새 행동'}{effect.optionId &&
            effect.optionId !== item.behavior
              ? ' · 다른 동작용'
              : ''}</summary
          >
          <label
            >적용할 동작
            <select bind:value={effect.optionId}>
              <option value="">모든 동작에 공통</option>
              {#each feature.options as option}<option value={option.id}
                  >{option.title}</option
                >{/each}
              <option value="other">다른 방식 제안</option>
              {#if effect.optionId && effect.optionId !== 'other' && !feature.options.some((option) => option.id === effect.optionId)}
                <option value={effect.optionId}
                  >이전 선택지 · {effect.optionId}</option
                >
              {/if}
            </select>
          </label>
          <div class="pair">
            <label
              >누가 <input
                maxlength="300"
                bind:value={effect.actor}
                placeholder="예: 요청한 사용자"
              /></label
            >
            <label
              >무엇을 하나요? <input
                maxlength="500"
                bind:value={effect.action}
                placeholder="예: 희망 일정 제출"
              /></label
            >
          </div>
          <label
            >가능한 조건 <textarea
              rows="2"
              maxlength="1000"
              bind:value={effect.condition}
              placeholder="권한, 현재 상태, 마감 조건 등"
            ></textarea></label
          >
          <fieldset>
            <legend>대상별 상태 변화</legend>
            <p class="muted">
              예: 변경 요청은 ‘없음 → 승인 대기’, 실제 예약은 ‘기존 일정 → 기존
              일정 유지’
            </p>
            {#each effect.transitions as row, rowIndex}
              <div class="state-row">
                <label
                  >대상 <input
                    maxlength="300"
                    bind:value={row.target}
                    placeholder="변경 요청 / 실제 예약"
                  /></label
                >
                <label
                  >이전 <input
                    maxlength="500"
                    bind:value={row.before}
                    placeholder="이전 상태"
                  /></label
                >
                <label
                  >이후 <input
                    maxlength="500"
                    bind:value={row.after}
                    placeholder="변경 또는 유지 상태"
                  /></label
                >
                <button
                  class="remove"
                  type="button"
                  aria-label={'상태 변화 ' + (rowIndex + 1) + ' 삭제'}
                  onclick={() =>
                    (effect.transitions = effect.transitions.filter(
                      (_, i) => i !== rowIndex
                    ))}>삭제</button
                >
              </div>
            {/each}
            <button
              type="button"
              disabled={effect.transitions.length >= 8}
              onclick={() =>
                (effect.transitions = [
                  ...effect.transitions,
                  { target: '', before: '', after: '' }
                ])}>상태 대상 추가</button
            >
          </fieldset>
          <fieldset>
            <legend>영향받는 사람·화면·업무</legend>
            {#each effect.impacts as row, rowIndex}
              <div class="impact-row">
                <label
                  >대상 <input
                    maxlength="300"
                    bind:value={row.target}
                    placeholder="승인 담당자 / 일정 화면"
                  /></label
                >
                <label
                  >달라지는 점 <textarea
                    rows="2"
                    maxlength="1000"
                    bind:value={row.change}
                    placeholder="처리할 일, 표시, 알림 등"
                  ></textarea></label
                >
                <button
                  class="remove"
                  type="button"
                  aria-label={'영향 대상 ' + (rowIndex + 1) + ' 삭제'}
                  onclick={() =>
                    (effect.impacts = effect.impacts.filter(
                      (_, i) => i !== rowIndex
                    ))}>삭제</button
                >
              </div>
            {/each}
            <button
              type="button"
              disabled={effect.impacts.length >= 8}
              onclick={() =>
                (effect.impacts = [
                  ...effect.impacts,
                  { target: '', change: '' }
                ])}>영향 대상 추가</button
            >
          </fieldset>
          <label
            >실패·중복 요청·동시 변경 시 <textarea
              rows="2"
              maxlength="1000"
              bind:value={effect.failure}
              placeholder="실패 후 유지할 상태와 다시 시도하는 방법"
            ></textarea></label
          >
          <label
            >취소·되돌리기 <textarea
              rows="2"
              maxlength="1000"
              bind:value={effect.cancellation}
              placeholder="누가 언제 취소할 수 있고, 무엇을 복원하나요?"
            ></textarea></label
          >
          <label
            >남은 질문 <textarea
              rows="2"
              maxlength="1000"
              bind:value={effect.unresolved}
              placeholder="정책이나 영향에서 아직 결정하지 못한 질문"
            ></textarea></label
          >
          <div class="toolbar">
            <button
              type="button"
              disabled={!effect.unresolved.trim()}
              onclick={() => onQuestion(effect.unresolved)}
              >남은 결정에 질문 추가</button
            >
            <button
              type="button"
              aria-label={'행동 ' + (index + 1) + ' 삭제'}
              onclick={() => remove(effect)}>이 행동 삭제</button
            >
          </div>
        </details>
      {/if}
    {/each}
  {:else}
    <EffectSummary
      effects={showOther ? effects : selected}
      options={feature.options}
    />
    {#each selected.filter((effect) => effect.unresolved.trim()) as effect}
      <button
        class="question"
        type="button"
        onclick={() => onQuestion(effect.unresolved)}
        >남은 결정에 추가: {effect.unresolved}</button
      >
    {/each}
  {/if}
  {#if removed}<button
      type="button"
      disabled={effects.length >= 12}
      onclick={() => {
        item.effects = [...(item.effects ?? []), removed!]
        removed = null
      }}>마지막으로 삭제한 행동 복원</button
    >{/if}
</section>
