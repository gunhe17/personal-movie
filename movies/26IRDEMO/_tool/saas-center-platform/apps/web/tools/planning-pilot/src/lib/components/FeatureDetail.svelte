<style>
  .decision-context {
    border-left: 3px solid #94a3b8;
    padding: 4px 16px;
    margin: 16px 0 24px;
    background: #f8fafc;
  }
  .decision-context p {
    line-height: 1.7;
    font-size: 14px;
  }
</style>

<script lang="ts">
  import type { Plan, Feature, SelectionItem, Scope } from '$lib/types'
  import { scopeLabels } from '$lib/types'
  import Wireframe from './Wireframe.svelte'
  import Attachments from './Attachments.svelte'
  import EffectEditor from './EffectEditor.svelte'
  let {
    plan,
    feature,
    item = $bindable(),
    blocked,
    onDependency,
    onBusy,
    onMessage,
    onQuestion
  }: {
    plan: Plan
    feature: Feature
    item: SelectionItem
    blocked: boolean
    onDependency: () => void
    onBusy: (value: boolean) => void
    onMessage: (value: string) => void
    onQuestion: (question: string) => void
  } = $props()
  let heading: HTMLHeadingElement
  export function focus() {
    heading?.focus()
  }
</script>

<span class="kind">{feature.kind}</span>
<h3 id="detail-heading" tabindex="-1" bind:this={heading}>{feature.title}</h3>
<div class="decision-context">
  <p><strong>왜 결정하나요?</strong> {feature.why}</p>
  <p><strong>이번에 정할 것</strong> {feature.question}</p>
  {#if feature.current.length}<p>
      <strong>조사한 현재 흐름</strong>
      {feature.current.join(' → ')}
    </p>{/if}
  <p class="muted">검토 제안: {feature.recommendation}</p>
</div>
<p class="section-label">이번 작업에 포함할까요?</p>
<div class="choice-group" role="group" aria-label="이번 작업 범위">
  {#each Object.entries(scopeLabels) as [choice, label]}<button
      aria-pressed={item.choice === choice}
      onclick={() => (item.choice = choice as Scope)}>{label}</button
    >{/each}
</div>
{#if blocked}<div class="dependency" id="dependency">
    <p>함께 필요한 기능과 동작을 포함해야 합니다.</p>
    <button onclick={onDependency}>선행 기능과 필요한 동작 함께 포함</button>
  </div>{/if}
<Attachments planId={plan.id} {feature} bind:item {onBusy} {onMessage} />
<fieldset class="behavior-options">
  <legend>어떻게 동작하면 좋을까요?</legend>
  {#each feature.options as option}
    <label class="behavior-option"
      ><input
        type="radio"
        name="behavior"
        value={option.id}
        bind:group={item.behavior}
      /><span
        ><strong>{option.title}</strong><span class="option-description"
          >{option.description}</span
        >{#if option.panels?.length}<Wireframe
            panels={option.panels}
            layout={option.layout}
          />{/if}</span
      ></label
    >
  {/each}
  <label class="behavior-option"
    ><input
      type="radio"
      name="behavior"
      value="other"
      bind:group={item.behavior}
    /><span
      ><strong>다른 방식 제안</strong><span class="option-description"
        >아래 의견이나 이미지로 원하는 방식을 알려주세요.</span
      ></span
    ></label
  >
  <label class="behavior-option"
    ><input
      type="radio"
      name="behavior"
      value="undecided"
      bind:group={item.behavior}
    /><span
      ><strong>아직 결정하지 않음</strong><span class="option-description"
        >열린 질문으로 남겨두고 함께 논의합니다.</span
      ></span
    ></label
  >
</fieldset>
<p class="muted">
  동작 비교용 구조 예시입니다. 최종 디자인은 별도로 검토합니다.
</p>
<EffectEditor {feature} bind:item {onQuestion} />
<label for={'note-' + feature.id}>의견 · 다른 방식 제안</label><textarea
  id={'note-' + feature.id}
  rows="3"
  maxlength="4000"
  bind:value={item.note}
  placeholder="선택 이유나 함께 결정할 내용을 적어주세요."
></textarea>
<label class="reviewed-label"
  ><input type="checkbox" bind:checked={item.reviewed} /><span
    >이 항목의 참고 내용을 확인했어요</span
  ></label
>
<p class="muted">참고 내용 확인과 기능 선택은 디자인 승인이 아닙니다.</p>
<details class="reference-details">
  <summary>현재 구현과 제안의 근거</summary>
  <p>완료 조건 제안: {feature.acceptance}</p>
  <code>{feature.source}</code>
</details>
