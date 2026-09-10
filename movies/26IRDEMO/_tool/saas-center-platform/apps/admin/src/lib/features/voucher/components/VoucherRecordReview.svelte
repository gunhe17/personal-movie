<script lang="ts">
  import { condLabel } from '$lib/features/voucher/record-derive'
  // 추출 정규화 record(§1~§10)를 정본 구조 그대로 보여주는 읽기전용 뷰 — VoucherRecordEditor
  // 와 같은 시각 문법(그룹 박스·인디고·번호 배지·구조화 리스트), 입력 대신 텍스트. onSource 가
  // 있을 때만 축 출처칩 노출(없으면 죽은 칩 방지). findings 는 소견 배너.
  import FieldRow from './FieldRow.svelte'

  let {
    record,
    findings = [],
    onSource
  }: {
    record: Record<string, unknown> | null
    findings?: { 유형: string; 축: string; 요약: string }[]
    onSource?: (page: string | null, query: string | null) => void
  } = $props()

  const META = new Set(['page', 'quote', 'quote_pdf', 'match', 'items', 'ref'])

  function firstPage(node: any): string | null {
    if (node == null || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (const x of node) {
        const p = firstPage(x)
        if (p) return p
      }
      return null
    }
    if (typeof node.page === 'string') return node.page
    for (const [k, v] of Object.entries(node)) {
      if (META.has(k)) continue
      const p = firstPage(v)
      if (p) return p
    }
    return null
  }
  function firstQuote(node: any): string | null {
    if (node == null || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (const x of node) {
        const q = firstQuote(x)
        if (q) return q
      }
      return null
    }
    const q = node.quote_pdf || node.quote
    if (typeof q === 'string' && q) return q
    for (const [k, v] of Object.entries(node)) {
      if (META.has(k)) continue
      const r = firstQuote(v)
      if (r) return r
    }
    return null
  }

  const R = $derived((record ?? {}) as any)
  const won = (n: unknown) =>
    typeof n === 'number' ? n.toLocaleString('ko-KR') : n == null ? '-' : String(n)
  const txt = (node: any): string =>
    node && typeof node === 'object' ? (node.내용 ?? node.value ?? '') : (node ?? '')

  const box = 'divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-primary-50/30'
  const val = 'text-[15px] leading-relaxed text-gray-800'
</script>

{#if findings.length}
  <div class="mb-4 rounded-lg bg-amber-50 px-3 py-2">
    <div class="text-xs font-semibold text-amber-700">검증 소견 {findings.length}건</div>
    <ul class="mt-1 space-y-0.5">
      {#each findings as fd, i (i)}
        <li class="text-xs text-amber-600">[{fd.유형}] {fd.축} — {fd.요약}</li>
      {/each}
    </ul>
  </div>
{/if}

{#snippet badge(n: number)}
  <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
    {n}
  </span>
{/snippet}

{#snippet listBox(arr: any[], key: string)}
  <div class={box}>
    {#each arr ?? [] as it, i (i)}
      <div class="flex items-start gap-2.5 px-3.5 py-3">
        {@render badge(i + 1)}
        <span class={val}>{txt(it[key] !== undefined ? { 내용: it[key] } : it)}</span>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet axis(label: string, node: any, body: import('svelte').Snippet)}
  <FieldRow {label} source={onSource ? firstPage(node) : null} onSource={() => onSource?.(firstPage(node), firstQuote(node))}>
    {@render body()}
  </FieldRow>
{/snippet}

<div class="space-y-6">
  {#if R.목적}
    {#snippet b()}<p class={val}>{R.목적.내용}</p>{/snippet}
    {@render axis('목적', R.목적, b)}
  {/if}

  {#if R.법적근거?.length}
    {#snippet b()}
      <div class={box}>
        {#each R.법적근거 as it, i (i)}
          <div class="flex items-start gap-2.5 px-3.5 py-3">
            {@render badge(i + 1)}
            <span class={val}>{#if it.조문}<span class="font-semibold text-primary-700">{it.조문}</span> {/if}{it.내용}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axis('법적 근거', R.법적근거, b)}
  {/if}

  {#if R.지역?.추진지역?.length}
    {#snippet b()}
      <div class="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-primary-50/30 p-3">
        {#each R.지역.추진지역 as pair, i (i)}
          <span class="rounded bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-700">
            {pair.시군구 ?? pair.시도}
          </span>
        {/each}
      </div>
    {/snippet}
    {@render axis('추진지역', R.지역, b)}
  {/if}

  {#if R.소득기준}
    {#snippet b()}
      <p class={val}>{R.소득기준.없음 ? '소득기준 없음' : `중위소득 최대 ${R.소득기준.최대}%`}</p>
    {/snippet}
    {@render axis('소득기준', R.소득기준, b)}
  {/if}

  {#if R.연령기준}
    {#snippet b()}
      <p class={val}>
        {#if R.연령기준.없음}연령기준 없음
        {:else}만 {R.연령기준.최소 ?? ''}{R.연령기준.최소 != null && R.연령기준.최대 != null ? '~' : ''}{R.연령기준.최대 ?? ''}세{/if}
      </p>
    {/snippet}
    {@render axis('연령기준', R.연령기준, b)}
  {/if}

  {#if R.욕구기준?.지표?.length}
    {#snippet b()}{@render listBox(R.욕구기준.지표, '내용')}{/snippet}
    {@render axis('욕구기준', R.욕구기준, b)}
  {/if}

  {#if R.우선순위?.length}
    {#snippet b()}{@render listBox(R.우선순위, '내용')}{/snippet}
    {@render axis('우선순위', R.우선순위, b)}
  {/if}

  {#if R.제외?.length}
    {#snippet b()}{@render listBox(R.제외, '내용')}{/snippet}
    {@render axis('제외', R.제외, b)}
  {/if}

  {#if R.중복금지?.불가?.length}
    {#snippet b()}
      <div class={box}>
        {#each R.중복금지.불가 as v, i (i)}
          <div class="flex items-center gap-2.5 px-3.5 py-3">
            {@render badge(i + 1)}
            <span class={val}>{v}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axis('중복제한', R.중복금지, b)}
  {/if}

  {#if R.서비스}
    {#snippet b()}
      <div class="space-y-3">
        {#each R.서비스 as g, gi (gi)}
          {#if g.내용?.length}
            <div>
              <div class="mb-1.5 text-sm font-semibold text-primary-600">{g.유형명 ?? '서비스'}</div>
              {@render listBox(g.내용, '설명')}
            </div>
          {/if}
        {/each}
      </div>
    {/snippet}
    {@render axis('서비스', R.서비스, b)}
  {/if}

  {#if R.집단규모?.length}
    {#snippet b()}
      <div class={box}>
        {#each R.집단규모 as row, i (i)}
          <div class="flex items-stretch">
            <span class="flex w-44 shrink-0 items-center border-r border-primary-100 bg-primary-50/70 px-3.5 py-3 text-sm font-semibold text-primary-700">
              {condLabel(row) || '전체'}
            </span>
            <span class="{val} px-3.5 py-3">{row.값}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axis('집단규모', R.집단규모, b)}
  {/if}

  {#if R.절차?.length}
    {#snippet b()}{@render listBox(R.절차, '내용')}{/snippet}
    {@render axis('제공 절차', R.절차, b)}
  {/if}

  {#if R.신청}
    {#snippet b()}
      <div class="space-y-2">
        {#each [['신청권자', R.신청.신청권자], ['경로', R.신청.경로]] as [label, arr] (label)}
          {#if arr?.length}
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-sm font-semibold text-primary-600">{label}</span>
              {#each arr as v, i (i)}
                <span class="rounded bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-700">{v}</span>
              {/each}
            </div>
          {/if}
        {/each}
        {#if R.신청.서류?.length}
          <div class={box}>
            {#each R.신청.서류 as d, i (i)}
              <div class="flex items-start gap-2.5 px-3.5 py-3">
                {@render badge(i + 1)}
                <span class={val}>{d.이름}{#if d.서식번호}<span class="text-gray-500"> 〈{d.서식번호}〉</span>{/if}{#if d.조건}<span class="text-gray-400"> · {d.조건}</span>{/if}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/snippet}
    {@render axis('신청', R.신청, b)}
  {/if}

  {#if R.금액}
    {#snippet b()}
      {#each R.금액 as g, gi (gi)}
        <p class="mb-1.5 text-sm">
          <span class="font-semibold text-primary-600">{g.명칭 ?? '금액'}</span>
          {#if g.주기}<span class="text-gray-500"> {g.주기}</span>{/if}
          {#if g.적용대상}<span class="text-gray-400"> · {g.적용대상}</span>{/if}
        </p>
        <div class="mb-3 overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-[15px]">
            <thead class="border-b border-gray-200 bg-primary-50 text-[13px] font-semibold text-primary-700">
              <tr>
                <th class="px-3.5 py-3 text-left">구분</th>
                <th class="px-3.5 py-3 text-right">정부지원</th>
                <th class="px-3.5 py-3 text-right">본인부담</th>
                <th class="px-3.5 py-3 text-right">지원율%</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              {#each g.금액 ?? [] as row, i (i)}
                <tr>
                  <td class="px-3.5 py-3 text-gray-800">
                    {condLabel(row) || '-'}
                    {#if row.금액 != null}<span class="mt-0.5 block text-[13px] text-gray-400">총 {won(row.금액)}원</span>{/if}
                  </td>
                  <td class="px-3.5 py-3 text-right font-semibold tabular-nums text-gray-900">{won(row.정부지원금)}</td>
                  <td class="px-3.5 py-3 text-right font-semibold tabular-nums text-gray-900">{won(row.본인부담금)}</td>
                  <td class="px-3.5 py-3 text-right tabular-nums text-gray-500">{row.정부지원비율 != null ? `${row.정부지원비율}%` : '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    {/snippet}
    {@render axis('금액', R.금액, b)}
  {/if}

  {#if R.제공인력?.자격경로?.length || R.제공인력?.결격?.length}
    {#snippet b()}
      <div class="space-y-3">
        {#if R.제공인력.자격경로?.length}
          <div>
            <div class="mb-1.5 text-sm font-semibold text-primary-600">자격</div>
            {@render listBox(R.제공인력.자격경로, '내용')}
          </div>
        {/if}
        {#if R.제공인력.결격?.length}
          <div>
            <div class="mb-1.5 text-sm font-semibold text-primary-600">결격</div>
            {@render listBox(R.제공인력.결격, '내용')}
          </div>
        {/if}
      </div>
    {/snippet}
    {@render axis('제공인력', R.제공인력, b)}
  {/if}

  {#if R.운영규칙?.length}
    {#snippet b()}
      <div class={box}>
        {#each R.운영규칙 as row, i (i)}
          <div class="flex items-stretch">
            <span class="flex w-32 shrink-0 items-center border-r border-primary-100 bg-primary-50/70 px-3.5 py-3 text-sm font-semibold text-primary-700">
              {row.종류}
            </span>
            <span class="{val} px-3.5 py-3">{row.내용}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axis('운영규칙', R.운영규칙, b)}
  {/if}

  {#each [['처리·통지', R.처리통지], ['이의신청', R.이의신청], ['환수', R.환수]] as [label, node] (label)}
    {#if node}
      {#snippet b()}<p class={val}>{node.내용}</p>{/snippet}
      {@render axis(label, node, b)}
    {/if}
  {/each}

  {#if R.신고의무?.length}
    {#snippet b()}{@render listBox(R.신고의무, '내용')}{/snippet}
    {@render axis('신고 의무', R.신고의무, b)}
  {/if}

  {#if R.중지상실?.length}
    {#snippet b()}
      <div class={box}>
        {#each R.중지상실 as it, i (i)}
          <div class="flex items-start gap-2.5 px-3.5 py-3">
            {@render badge(i + 1)}
            <span class={val}>{it.사유}{#if it.시점}<span class="text-gray-500"> · {it.시점}</span>{/if}{#if it.조치}<span class="text-gray-400"> · {it.조치}</span>{/if}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axis('중지·상실', R.중지상실, b)}
  {/if}

  {#if R.항목?.length}
    {#snippet b()}
      <div class={box}>
        {#each R.항목 as it, i (i)}
          <div class="flex items-stretch">
            <span class="w-44 shrink-0 border-r border-primary-100 bg-primary-50/70 px-3.5 py-3 text-[15px] font-semibold text-primary-800">
              {it.라벨}
            </span>
            <span class="{val} px-3.5 py-3">{it.값}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axis('기타 항목', R.항목, b)}
  {/if}
</div>
