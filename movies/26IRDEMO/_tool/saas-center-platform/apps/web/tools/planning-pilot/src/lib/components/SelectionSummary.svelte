<script lang="ts">
  import { applicableEffects } from '$lib/types'
  import EffectSummary from './EffectSummary.svelte'
  import {
    scopeLabels,
    behaviorLabel,
    needsAnswer,
    decisionLabels,
    ownerLabels,
    blockingDecisions
  } from '$lib/types'
  import type { Plan, Selection, Scope } from '$lib/types'
  let { plan, selection }: { plan: Plan; selection: Selection } = $props()
</script>

{#if selection.decisions?.length}
  <section class="review-section">
    <h4>
      후속 결정 · 구현 전 답변 필요 {blockingDecisions(selection).length}개
    </h4>
    {#each selection.decisions as decision}
      <div class="review-item">
        <strong>{decision.question}</strong>
        <p>
          {decisionLabels[decision.status]} · {ownerLabels[decision.owner]} · {decision.blocking
            ? '구현 전 답변 필요'
            : '이후 구체화 가능'}
        </p>
        {#if decision.answer}<p>답변: {decision.answer}</p>{/if}
      </div>
    {/each}
  </section>
{/if}

{#each Object.entries(scopeLabels) as [choice, label]}
  {@const items = selection.items.filter(
    (item) => item.choice === (choice as Scope)
  )}
  {#if items.length}<section class="review-section">
      <h4>{label} · {items.length}</h4>
      {#each items as item}
        {@const feature = plan.features.find(
          (feature) => feature.id === item.id
        )}
        {#if feature}<div class="review-item">
            <strong>{feature.title}</strong>
            <p>동작: {behaviorLabel(feature, item)}</p>
            {#if item.note.trim()}<p>의견: {item.note}</p>{/if}
            {#if applicableEffects(feature, item).length}
              <details>
                <summary
                  >영향·상태 변화 {applicableEffects(feature, item)
                    .length}개</summary
                >
                <EffectSummary
                  effects={applicableEffects(feature, item)}
                  options={feature.options}
                />
              </details>
            {:else if item.choice === 'include'}<p class="pending-text">
                영향·상태 변화 미정리
              </p>{/if}
            {#if needsAnswer(item)}<p class="pending-text">
                남은 결정: {feature.question}
              </p>{/if}
            <p class="muted">
              {item.reviewed ? '참고 내용 확인함' : '참고 내용 확인 전'} · 첨부 {item
                .attachments.length}개 · 디자인 승인 별도
            </p>
          </div>{/if}
      {/each}
    </section>{/if}
{/each}
