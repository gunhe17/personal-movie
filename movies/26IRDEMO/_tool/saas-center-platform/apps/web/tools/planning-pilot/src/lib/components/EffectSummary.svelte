<style>
  .effect-summary {
    padding: 14px;
    margin-top: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  dl {
    margin: 12px 0 0;
  }
  dt {
    color: #64748b;
    font-size: 12px;
    margin-top: 8px;
  }
  dd {
    margin: 2px 0 0;
    white-space: pre-wrap;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  .pending {
    color: #9a3412;
  }
  .applies {
    color: #64748b;
    font-size: 12px;
    margin: 0 0 6px;
  }
</style>

<script lang="ts">
  import type { ActionEffect, Option } from '$lib/types'
  let {
    effects,
    options = []
  }: { effects: ActionEffect[]; options?: Option[] } = $props()
</script>

{#each effects as effect (effect.id)}
  <article class="effect-summary">
    <p class="applies">
      {!effect.optionId
        ? '모든 동작에 공통'
        : effect.optionId === 'other'
          ? '다른 방식 제안'
          : (options.find((option) => option.id === effect.optionId)?.title ??
            '이전 동작 · 적용 범위 재확인 필요')}
    </p>
    <strong
      >{effect.actor || '행동 주체 미정'} · {effect.action ||
        '행동 미정'}</strong
    >
    <dl>
      <dt>가능한 조건</dt>
      <dd>{effect.condition || '미정'}</dd>
      <dt>대상별 상태 변화</dt>
      <dd>
        {#if effect.transitions.length}<ul>
            {#each effect.transitions as row}<li>
                <b>{row.target || '대상 미정'}</b>: {row.before || '미정'} → {row.after ||
                  '미정'}
              </li>{/each}
          </ul>{:else}미정{/if}
      </dd>
      <dt>영향받는 대상</dt>
      <dd>
        {#if effect.impacts.length}<ul>
            {#each effect.impacts as row}<li>
                <b>{row.target || '대상 미정'}</b>: {row.change || '영향 미정'}
              </li>{/each}
          </ul>{:else}미정{/if}
      </dd>
      <dt>실패하면</dt>
      <dd>{effect.failure || '미정'}</dd>
      <dt>취소·되돌리기</dt>
      <dd>{effect.cancellation || '미정'}</dd>
      {#if effect.unresolved}<dt>남은 질문</dt>
        <dd class="pending">{effect.unresolved}</dd>{/if}
    </dl>
  </article>
{/each}
