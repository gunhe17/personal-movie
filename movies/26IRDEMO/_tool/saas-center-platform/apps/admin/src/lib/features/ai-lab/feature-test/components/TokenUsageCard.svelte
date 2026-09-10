<script lang="ts">
  import { DEFAULT_TOKENS_PER_CREDIT } from '../constants'
  import type { CreditVerification } from '../view-model'

  let {
    items = [] as Array<{ purpose: string | null; model: string | null; calls: number; input_tokens: number; output_tokens: number }>,
    totalInputTokens = 0,
    totalOutputTokens = 0,
    tokensPerCredit = DEFAULT_TOKENS_PER_CREDIT,
    creditVerification = null as CreditVerification | null,
  }: {
    items?: Array<{ purpose: string | null; model: string | null; calls: number; input_tokens: number; output_tokens: number }>
    totalInputTokens?: number
    totalOutputTokens?: number
    tokensPerCredit?: number
    creditVerification?: CreditVerification | null
  } = $props()

  const tpc = $derived(creditVerification?.before?.tokensPerCredit ?? (tokensPerCredit > 0 ? tokensPerCredit : DEFAULT_TOKENS_PER_CREDIT))
  const totalTokens = $derived(totalInputTokens + totalOutputTokens)
  const estimatedCredits = $derived(totalTokens > 0 ? Math.max(1, Math.ceil(totalTokens / tpc)) : 0)

  function fmt(n: number): string { return n.toLocaleString() }

  function purposeLabel(p: string | null): string {
    const map: Record<string, string> = {
      transcribe: '전사 (STT)', refine: '정제', summarize: '요약',
      generate_note: '상담일지', agent_chat: '에이전트', case_analysis: '사례 분석',
    }
    return p ? (map[p] ?? p) : '-'
  }
</script>

<div class="section-border">
  <div class="flex items-center justify-between border-b border-gray-50 px-4 py-3">
    <div class="flex items-center gap-2">
      <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/></svg>
      <span class="text-label-01-normal-medium text-gray-500">토큰 사용량</span>
    </div>
    {#if estimatedCredits > 0}
      <span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-label-01-normal-medium text-blue-600">{estimatedCredits} 크레딧</span>
    {/if}
  </div>

  <div class="grid grid-cols-3 gap-px bg-gray-50 px-4 py-3">
    <div class="text-center">
      <p class="text-label-01-normal-regular text-gray-400">입력</p>
      <p class="mt-0.5 tabular-nums text-body-03-normal-medium text-gray-700">{fmt(totalInputTokens)}</p>
    </div>
    <div class="text-center">
      <p class="text-label-01-normal-regular text-gray-400">출력</p>
      <p class="mt-0.5 tabular-nums text-body-03-normal-medium text-gray-700">{fmt(totalOutputTokens)}</p>
    </div>
    <div class="text-center">
      <p class="text-label-01-normal-regular text-gray-400">합계</p>
      <p class="mt-0.5 tabular-nums text-body-03-normal-medium text-gray-900">{fmt(totalTokens)}</p>
    </div>
  </div>

  {#if items.length > 0}
    <div class="border-t border-gray-50 px-4 py-2">
      <table class="w-full text-label-01-normal-regular">
        <thead><tr class="text-gray-400"><th class="py-1.5 text-left">용도</th><th class="py-1.5 text-left">모델</th><th class="py-1.5 text-right">호출</th><th class="py-1.5 text-right">입력</th><th class="py-1.5 text-right">출력</th></tr></thead>
        <tbody class="text-gray-600">
          {#each items as row}
            <tr class="border-t border-gray-50">
              <td class="py-1.5">{purposeLabel(row.purpose)}</td>
              <td class="py-1.5"><span class="rounded bg-gray-100 px-1.5 py-0.5 text-label-01-normal-regular text-gray-500">{row.model ?? '-'}</span></td>
              <td class="py-1.5 text-right tabular-nums">{row.calls}</td>
              <td class="py-1.5 text-right tabular-nums">{fmt(row.input_tokens)}</td>
              <td class="py-1.5 text-right tabular-nums">{fmt(row.output_tokens)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if creditVerification}
    <div class="border-t border-gray-50 px-4 py-2.5">
      <div class="flex items-center gap-2 text-label-01-normal-regular">
        <span class="text-gray-400">크레딧:</span>
        <span class="tabular-nums text-gray-600">{creditVerification.before.used} → {creditVerification.after.used} <span class="text-gray-400">(+{creditVerification.actualCredits})</span></span>
        <span class="text-gray-300">|</span>
        <span class="text-gray-500">예상 {creditVerification.expectedCredits} <span class="text-gray-400">({fmt(creditVerification.totalTokens)} 토큰 / {fmt(tpc)})</span></span>
        {#if creditVerification.isMatch}
          <span class="text-emerald-600">&#10003; 일치</span>
        {:else}
          <span class="text-red-500">&#10007; 불일치 (차이 {Math.abs(creditVerification.actualCredits - creditVerification.expectedCredits)})</span>
        {/if}
      </div>
    </div>
  {/if}
</div>
