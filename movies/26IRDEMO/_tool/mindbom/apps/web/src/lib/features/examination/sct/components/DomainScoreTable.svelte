<script lang="ts">
  import type { SCTDomainScore } from '../types'
  import { DOMAIN_COLORS } from '../constants'
  import ScoreSelectorPopover from './ScoreSelectorPopover.svelte'

  interface Props {
    scores: SCTDomainScore[]
    /**
     * 점수 수정 저장. 넘기지 않으면 읽기 전용으로 동작한다
     * (확정 이후처럼 더 이상 손대면 안 되는 화면).
     * ResponseReviewTable과 같은 규약이다.
     */
    onScoreChange?: (stemId: number, newScore: number) => void
  }

  let { scores, onScoreChange }: Props = $props()

  let editable = $derived(Boolean(onScoreChange))
  let editingStem = $state<number | null>(null)
  let anchorEl = $state<HTMLElement | null>(null)

  function pickScore(stemId: number, newScore: number) {
    onScoreChange?.(stemId, newScore)
    editingStem = null
  }

  function toggleEditing(stemId: number, el: HTMLElement) {
    if (editingStem === stemId) {
      editingStem = null
    } else {
      editingStem = stemId
      anchorEl = el
    }
  }
</script>

<div class="space-y-6">
  {#each scores as score (score.domain)}
    {@const colors = DOMAIN_COLORS[score.domain]}
    <div class="overflow-hidden rounded-xl border border-gray-200">
      <div class="flex items-center justify-between border-b border-gray-100 {colors.bg} px-5 py-3">
        <div class="flex items-center gap-2">
          <span class="rounded-md {colors.bg} {colors.text} px-2 py-0.5 text-xs font-semibold">
            {score.domain}
          </span>
          <span class="text-sm font-medium text-gray-900">{score.domainLabel}</span>
        </div>
        <div class="text-sm font-semibold text-gray-900">
          {score.totalScore} / {score.maxScore}
        </div>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr class="border-b border-gray-100">
            <th class="w-16 py-2 pl-5 pr-2 text-left text-xs font-medium text-gray-500">번호</th>
            <th class="py-2 text-left text-xs font-medium text-gray-500">문항 / 응답</th>
            <th class="w-24 py-2 pr-5 text-center text-xs font-medium text-gray-500">점수</th>
          </tr>
        </thead>
        <tbody>
          {#each score.items as item (item.stemId)}
            <tr class="border-b border-gray-50">
              <td class="py-3 pl-5 pr-2 align-top text-gray-500">{item.stemId}</td>
              <td class="py-3 pr-4 align-top text-gray-700">
                <span>{item.stem}</span>
                <span
                  class="mx-1 inline-block min-w-[80px] border-b border-gray-400 px-1 text-center align-baseline text-gray-900"
                >
                  {#if item.answer}
                    {item.answer}
                  {:else}
                    <span class="text-gray-300">(미응답)</span>
                  {/if}
                </span>
                {#if item.reason}
                  <div class="mt-1 text-xs text-gray-400">왜냐하면: {item.reason}</div>
                {/if}
              </td>
              <td class="py-3 pr-5 text-center">
                {#if editable}
                  <button
                    type="button"
                    onclick={(e) => toggleEditing(item.stemId, e.currentTarget)}
                    class="h-8 w-12 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                    aria-haspopup="listbox"
                    aria-expanded={editingStem === item.stemId}
                    title="클릭하여 점수 수정"
                  >
                    {item.score}
                  </button>
                {:else}
                  <!-- 읽기 전용 — 누를 수 없다는 게 보여야 한다(눌러도 반응 없으면 고장으로 읽힌다) -->
                  <span
                    class="inline-flex h-8 w-12 items-center justify-center text-sm font-semibold text-gray-700"
                  >
                    {item.score}
                  </span>
                {/if}
                {#if editingStem === item.stemId && anchorEl}
                  <ScoreSelectorPopover
                    anchor={anchorEl}
                    currentScore={item.score}
                    onSelect={(s) => pickScore(item.stemId, s)}
                    onClose={() => (editingStem = null)}
                  />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
</div>
