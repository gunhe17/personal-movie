<style>
  .result-panel {
    margin: 20px 0;
    padding: 24px;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    background: white;
  }
  .follow-ups {
    border-top: 1px solid #e2e8f0;
    margin-top: 16px;
    padding-top: 8px;
  }
  .follow-up {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    max-width: none;
    line-height: 1.6;
  }
  .follow-up h4 {
    margin: 0;
  }
  .follow-up-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .imported {
    color: #047857;
    font-size: 13px;
  }
  .result-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .eyebrow {
    color: #64748b;
    font-size: 12px;
    margin: 0 0 6px;
  }
  h2 {
    margin: 0;
  }
  select {
    display: block;
    margin: 8px 0 16px;
    max-width: 100%;
  }
  .stale {
    background: #fff7ed;
    color: #9a3412;
    padding: 12px;
    border-radius: 6px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    padding: 12px 0;
  }
  article {
    max-width: 880px;
    margin: auto;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }
  article :global(h2),
  article :global(h3),
  article :global(h4) {
    margin-top: 28px;
    line-height: 1.45;
  }
  article p {
    white-space: pre-wrap;
  }
  li {
    margin-bottom: 8px;
  }
  code {
    font-size: 0.88em;
    background: #f1f5f9;
    padding: 2px 4px;
    border-radius: 3px;
  }
  @media (max-width: 600px) {
    .result-panel {
      padding: 16px;
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { ownerLabels } from '$lib/types'
  import type { Plan, Selection, FollowUp } from '$lib/types'
  import type { PlanningStore } from '$lib/server/store'

  let {
    plan,
    selection,
    connected,
    disabled = false,
    onImport,
    onUpdate
  }: {
    plan: Plan
    selection: Selection
    connected: boolean
    disabled?: boolean
    onImport: (question: FollowUp, origin: string, excluded?: boolean) => void
    onUpdate?: (count: number, waiting: boolean) => void
  } = $props()
  type Results = Awaited<ReturnType<PlanningStore['results']>>
  let resultData = $state<Results>({ results: [], waitingFor: null })
  let selectedId = $state('')
  let open = $state(true)
  let error = $state('')
  let loading = $state(true)
  let requesting = $state(false)
  let requestMessage = $state('')
  let refresh: () => Promise<void> = async () => {}
  let result = $derived(
    resultData.results.find((entry) => entry.recordId === selectedId) ??
      resultData.results[0]
  )
  function fingerprint(value: Selection) {
    return JSON.stringify({
      goal: value.goal,
      additional: value.additional,
      items: value.items
        .map((item) => ({
          id: item.id,
          choice: item.choice,
          behavior: item.behavior,
          note: item.note,
          effects: item.effects ?? null,
          attachments: item.attachments.map(({ id, kind, caption }) => ({
            id,
            kind,
            caption
          }))
        }))
        .sort((first, second) => first.id.localeCompare(second.id))
    })
  }
  let sourceStale = $derived(
    result &&
      (fingerprint(result.selection) !== fingerprint(selection) ||
        JSON.stringify(result.features) !== JSON.stringify(plan.features) ||
        JSON.stringify(result.scenarios ?? []) !==
          JSON.stringify(plan.scenarios ?? []) ||
        JSON.stringify(result.audit ?? null) !==
          JSON.stringify(plan.audit ?? null) ||
        result.baseline !== plan.baseline)
  )
  let stale = $derived(
    sourceStale ||
      (result &&
        JSON.stringify(result.selection.contentReviews ?? []) !==
          JSON.stringify(selection.contentReviews ?? [])) ||
      (result &&
        JSON.stringify(result.selection.decisions ?? []) !==
          JSON.stringify(selection.decisions ?? []))
  )
  async function requestQuestions() {
    if (!result || requesting) return
    requesting = true
    try {
      const response = await fetch(
        '/api/plans/' + plan.id + '/review-questions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: result.recordId })
        }
      )
      const value = await response.json()
      if (!response.ok) throw new Error(value.error)
      requestMessage =
        '후속 질문 정리를 요청했습니다. 대화에서 처리가 끝나면 자동으로 표시됩니다.'
    } catch (reason) {
      requestMessage =
        reason instanceof Error ? reason.message : '질문 정리 요청 실패'
    } finally {
      requesting = false
    }
  }
  let blocks = $derived(
    (result?.content ?? '').split(/\n\s*\n/).filter(Boolean)
  )
  onMount(() => {
    let stopped = false
    let controller: AbortController | undefined
    let running = false
    refresh = async () => {
      if (running) return
      running = true
      controller = new AbortController()
      try {
        const response = await fetch('/api/plans/' + plan.id + '/results', {
          signal: controller.signal,
          cache: 'no-store'
        })
        if (!response.ok) throw new Error('기획 결과를 불러오지 못했습니다.')
        const next: Results = await response.json()
        if (stopped) return
        if (next.results[0]?.recordId !== resultData.results[0]?.recordId) {
          selectedId = next.results[0]?.recordId ?? ''
          open = !next.results[0]?.followUps?.length
        }
        resultData = next
        onUpdate?.(next.results.length, !!next.waitingFor)
        error = ''
      } catch (reason) {
        if (!stopped)
          error = reason instanceof Error ? reason.message : '결과 조회 실패'
      } finally {
        if (!stopped) loading = false
        running = false
      }
    }
    void refresh()
    const timer = setInterval(() => {
      if (!document.hidden) void refresh()
    }, 5000)
    return () => {
      stopped = true
      controller?.abort()
      clearInterval(timer)
    }
  })
</script>

{#snippet inline(value: string)}
  {#each value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g) as part}
    {#if part.startsWith('`') && part.endsWith('`')}<code
        >{part.slice(1, -1)}</code
      >
    {:else if part.startsWith('**') && part.endsWith('**')}<strong
        >{part.slice(2, -2)}</strong
      >
    {:else}{part}{/if}
  {/each}
{/snippet}

<section class="result-panel" aria-labelledby="result-heading">
  <div class="result-heading">
    <div>
      <p class="eyebrow">선택 → 기획 정리 → 결과</p>
      <h2 id="result-heading">기획 결과</h2>
    </div>
    <button type="button" onclick={() => refresh()}>결과 새로고침</button>
  </div>
  <p role="status">
    {error ||
      (loading
        ? '결과 확인 중…'
        : resultData.waitingFor
          ? '새 요청의 결과를 기다리고 있습니다. 완료되면 자동으로 표시합니다.'
          : result
            ? '기획 정리 결과가 도착했습니다. 디자인 승인은 별도입니다.'
            : '선택 내용으로 기획 정리를 요청하면 이곳에 결과가 표시됩니다.')}
  </p>
  {#if result}
    <label for="planning-result-version">결과 기준 선택 기록</label>
    <select id="planning-result-version" bind:value={selectedId}>
      {#each resultData.results as entry}<option value={entry.recordId}
          >{new Date(entry.createdAt).toLocaleString('ko-KR')} · {entry.recordId.slice(
            -8
          )}</option
        >{/each}
    </select>
    {#if stale}<p class="stale">
        현재 선택·답변 또는 후보와 다른 기준의 결과입니다. 최신 선택으로 다시
        기획 정리를 요청하세요.
      </p>{/if}
    <section class="follow-ups" aria-labelledby="follow-ups-heading">
      <h3 id="follow-ups-heading">결과에서 발견한 후속 질문</h3>
      <p class="eyebrow">
        필요한 질문을 남은 결정에 가져와 답변하세요. 담당과 선행 여부는 AI의
        제안이며 변경할 수 있습니다.
      </p>
      {#if result.followUpError}<p class="stale">{result.followUpError}</p>{/if}
      {#if result.followUps === null}
        <p>
          이 결과에는 별도로 정리된 질문이 아직 없습니다. 질문 정리를 요청하거나
          아래 남은 결정에 직접 추가할 수 있습니다.
        </p>
        <button
          type="button"
          disabled={disabled || requesting || !connected}
          onclick={requestQuestions}
        >
          {requesting ? '요청 중…' : '이 결과에서 질문 정리 요청'}
        </button>
        {#if !connected}<p class="eyebrow">
            AI 요청에는 기획 대화 연결이 필요합니다. 직접 질문을 추가하고 저장할
            수 있습니다.
          </p>{/if}
      {:else if !result.followUps.length}
        <p>
          이 결과에서 추가로 제안된 질문은 없습니다. 기획·디자인 승인 여부와는
          별개입니다.
        </p>
      {:else}
        {#if sourceStale}<p class="stale">
            범위·동작 또는 후보가 달라져 이 결과의 질문 가져오기를 잠시
            막았습니다. 최신 선택으로 기획 정리를 요청하세요.
          </p>{/if}
        {#each result.followUps as followUp (followUp.id)}
          {@const imported = (selection.decisions ?? []).some(
            (decision) => decision.id === followUp.id
          )}
          <article class="follow-up">
            <h4>{followUp.question}</h4>
            {#if imported}<p class="imported">
                남은 결정에 반영됨 · 기존 답변 유지
              </p>
            {:else}
              <p>{followUp.context}</p>
              <p class="eyebrow">
                {ownerLabels[followUp.owner]} · {followUp.blocking
                  ? '구현 전 답변 필요'
                  : '이후 구체화 가능'} · {plan.features.find(
                  (feature) => feature.id === followUp.featureId
                )?.title ?? '새 요구 / 전체 기획'}
              </p>
              <div class="follow-up-actions">
                <button
                  type="button"
                  disabled={disabled ||
                    sourceStale ||
                    (selection.decisions?.length ?? 0) >= 60}
                  onclick={() => onImport(followUp, result!.recordId)}
                  >남은 결정에 추가</button
                >
                <button
                  type="button"
                  disabled={disabled ||
                    sourceStale ||
                    (selection.decisions?.length ?? 0) >= 60}
                  onclick={() => onImport(followUp, result!.recordId, true)}
                  >이번 범위에서 제외</button
                >
              </div>{/if}
          </article>
        {/each}
      {/if}
      <p role="status">{requestMessage}</p>
    </section>
    <details bind:open>
      <summary>기획 결과 읽기</summary>
      <article aria-label="기획 결과 문서">
        {#each blocks as block}
          {#if /^#{1,6} /.test(block)}
            <svelte:element
              this={'h' +
                Math.min((block.match(/^#+/)?.[0].length ?? 1) + 1, 6)}
              >{@render inline(block.replace(/^#+\s/, ''))}</svelte:element
            >
          {:else if block.split('\n').every((line) => /^- /.test(line))}
            <ul>
              {#each block.split('\n') as line}<li>
                  {@render inline(line.slice(2))}
                </li>{/each}
            </ul>
          {:else if block.split('\n').every((line) => /^\d+\. /.test(line))}
            <ol>
              {#each block.split('\n') as line}<li>
                  {@render inline(line.replace(/^\d+\. /, ''))}
                </li>{/each}
            </ol>
          {:else}<p>{@render inline(block)}</p>{/if}
        {/each}
      </article>
    </details>
  {/if}
</section>
