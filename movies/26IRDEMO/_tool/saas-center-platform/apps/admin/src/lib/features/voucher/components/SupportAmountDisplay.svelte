<script lang="ts">
  /**
   * support_amount (정규화 dict) 읽기 전용 표시.
   *
   * 들여쓰기 sub-row 레이아웃.
   * 각 sub-row = [라벨 w-36 + 들여쓰기(pl-N)] + [값]. border-t 로 행 구분.
   *
   *   월총액         180,000 ~ 250,000원
   *   정부지원금     ...                  (등급 없을 때만)
   *   본인부담금     ...                  (등급 없을 때만)
   *   등급별 (5)
   *       1등급  기준...  정부 162,000원  본인 18,000~88,000원
   *       2등급  …
   *   가격탄력제     가격탄력제 뱃지
   */
  import type { Snippet } from 'svelte'
  import type {
    Amount,
    SupportAmount
  } from '$lib/features/voucher/support-amount.types'

  interface Props {
    value: SupportAmount
  }

  let { value }: Props = $props()

  /** number → "162,000원", {최소,최대} → "18,000 ~ 88,000원", null → "-" */
  function fmt(amount: Amount | undefined): string {
    if (amount === null || amount === undefined) return '-'
    if (typeof amount === 'number') return `${amount.toLocaleString('ko-KR')}원`
    const lo = amount.최소
    const hi = amount.최대
    if (lo == null && hi == null) return '-'
    if (lo != null && hi != null) {
      if (lo === hi) return `${lo.toLocaleString('ko-KR')}원`
      return `${lo.toLocaleString('ko-KR')} ~ ${hi.toLocaleString('ko-KR')}원`
    }
    const one = (lo ?? hi) as number
    return `${one.toLocaleString('ko-KR')}원`
  }

  function hasAmount(a: Amount | undefined): boolean {
    if (a === null || a === undefined) return false
    if (typeof a === 'number') return true
    return a.최소 != null || a.최대 != null
  }

  const grades = $derived(value.등급별 ?? [])
  const hasGrades = $derived(grades.length > 0)
  const currencyLabel = $derived(
    value.통화 && value.통화 !== 'KRW' ? value.통화 : null
  )
</script>

<!-- subRow — [라벨 w-36 + 들여쓰기] + [값] 패턴 -->
{#snippet subRow(label: string, indentClass: string, content: Snippet)}
  <div class="flex min-h-12 items-stretch border-t border-gray-100">
    <span
      class="w-36 shrink-0 self-center pr-4 {indentClass} text-xs font-medium text-gray-500"
    >
      {label}
    </span>
    <div class="flex flex-1 items-center gap-2 py-2 pr-6 text-sm text-gray-900">
      {@render content()}
    </div>
  </div>
{/snippet}

<div class="flex w-full min-w-0 flex-col">
  <!-- 월총액 (L1: pl-12) -->
  {#snippet monthlyTotal()}
    {#if hasAmount(value.월총액)}
      <span class="font-semibold">{fmt(value.월총액)}</span>
    {:else}
      <span class="text-gray-400">-</span>
    {/if}
    {#if currencyLabel}
      <span class="text-xs text-gray-400">({currencyLabel})</span>
    {/if}
  {/snippet}
  {@render subRow('월총액', 'pl-12', monthlyTotal)}

  <!-- 단가 (회당/시간당/일당) — 있을 때만 -->
  {#if value.단가 && hasAmount(value.단가.금액)}
    {#snippet unitPrice()}
      <span class="font-semibold">{fmt(value.단가!.금액)}</span>
      <span class="text-xs text-gray-400">/ {value.단가!.단위}</span>
    {/snippet}
    {@render subRow('단가', 'pl-12', unitPrice)}
  {/if}

  <!-- 한도 (연/월 금액·시간·회) — 있을 때만 -->
  {#if value.한도 && value.한도.값 != null}
    {#snippet capRow()}
      <span class="font-semibold">
        {value.한도!.기간} {value.한도!.값.toLocaleString('ko-KR')}{value.한도!.단위}
      </span>
    {/snippet}
    {@render subRow('한도', 'pl-12', capRow)}
  {/if}

  <!-- 등급이 없을 때만 top-level 정부/본인 표시 -->
  {#if !hasGrades}
    {#snippet govAmount()}
      <span>{fmt(value.정부지원금)}</span>
    {/snippet}
    {@render subRow('정부지원금', 'pl-12', govAmount)}

    {#snippet selfAmount()}
      <span>{fmt(value.본인부담금)}</span>
    {/snippet}
    {@render subRow('본인부담금', 'pl-12', selfAmount)}
  {/if}

  <!-- 등급별 — 정렬된 컬럼(grid)으로 정부/본인 금액 가지런히 (L2: pl-20) -->
  {#if hasGrades}
    {#snippet gradeHeader()}
      <span class="text-xs text-gray-400">{grades.length}개 등급</span>
    {/snippet}
    {@render subRow(`등급별 (${grades.length})`, 'pl-12', gradeHeader)}

    <div class="border-t border-gray-100 py-2 pl-20 pr-6">
      <!-- 컬럼 헤더 — 기준 최대폭 제한 + 마지막 1fr 여백 컬럼으로 금액을 좌측으로 당김 -->
      <div
        class="grid grid-cols-[3rem_minmax(8rem,20rem)_7.5rem_9.5rem_4rem_1fr] items-center gap-x-4 py-1 text-[10px] font-medium text-gray-400"
      >
        <span>등급</span>
        <span>기준</span>
        <span class="text-right">정부지원금</span>
        <span class="text-right">본인부담금</span>
        <span class="text-right">지원율</span>
        <span></span>
      </div>
      {#each grades as g, i (i)}
        <div
          class="grid grid-cols-[3rem_minmax(8rem,20rem)_7.5rem_9.5rem_4rem_1fr] items-center gap-x-4 py-1.5 text-sm"
        >
          <span class="font-medium text-gray-600">
            {g.등급 != null ? `${g.등급}등급` : '—'}
          </span>
          <span class="min-w-0 truncate text-gray-600" title={g.기준 ?? ''}>
            {g.기준 ?? '-'}
          </span>
          <span class="text-right tabular-nums text-gray-900">
            {fmt(g.정부지원금)}
          </span>
          <span class="text-right tabular-nums text-gray-900">
            {fmt(g.본인부담금)}
          </span>
          <span class="text-right tabular-nums text-gray-600">
            {g.지원비율 != null ? `${g.지원비율}%` : '-'}
          </span>
          <span></span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- 자유 추가 항목 (식비·면제·이월·가산 등) -->
  {#each value.항목 ?? [] as item, i (i)}
    {#snippet itemRow()}
      <span class="whitespace-pre-wrap">{item.값 || '-'}</span>
    {/snippet}
    {@render subRow(item.라벨, 'pl-12', itemRow)}
  {/each}

  <!-- 가격탄력제 (L1) -->
  {#snippet elastic()}
    {#if value.가격탄력제}
      <span
        class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
      >
        적용
      </span>
      <span class="text-xs text-gray-400">금액이 상황에 따라 변동</span>
    {:else}
      <span class="text-gray-400">미적용</span>
    {/if}
  {/snippet}
  {@render subRow('가격탄력제', 'pl-12', elastic)}
</div>
