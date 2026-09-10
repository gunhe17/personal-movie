<script lang="ts">
  import { condLabel } from '$lib/features/voucher/record-derive'
  // 추출 정규화 record(§1~§10)를 사업 메타 필드와 동일한 FieldRow 그리드로 편집한다 —
  // 구조 고정(행·배열 추가/삭제 없음), 값만 편집. 입력은 record 중첩 필드에 직접 바인딩
  // (Svelte 5 deep proxy) → 확정 시 편집본이 그대로 저장. 출처칩은 PDF 하이라이트.
  //
  // 계층 표현: 다값 축(리스트·테이블·항목쌍)은 옅은 인디고 패널 박스에 담고 번호 배지·구분선
  // 으로 묶어 "이 값들이 이 축에 속한다"를 드러낸다. 스칼라 축도 같은 패널로 전 필드 통일.
  import FieldRow from './FieldRow.svelte'

  let {
    record,
    onSource
  }: {
    record: any
    onSource?: (page: string | null, query: string | null) => void
  } = $props()

  // ref = 값 노드의 근거 앵커({page, quote, quote_pdf}) — firstPage/firstQuote 가 그
  // 안으로 내려가 페이지·인용을 집는다(META 제외). 나머지는 리프 앵커 필드라 건너뛴다.
  const META = new Set(['page', 'quote', 'quote_pdf', 'match', 'items'])

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
  // quote_pdf(스냅 결과) 우선, 없으면 원문 quote 로 내려간다.
  // 옛 주석의 "폴백 없이 정직하게"는 quote_pdf 가 늘 정확하다는 전제였는데, 자간이 벌어져
  // 인쇄된 표 헤더("소 득 기 준")를 이미지에서 그대로 옮기면 백엔드 스냅이 공백을 못 지워
  // match=none 이 된다(소득기준·연령기준 실측). 뷰어의 norm 은 공백·가운뎃점·NFKC 를 전부
  // 흡수하므로 원문 quote 로도 맞는다 — 못 맞으면 뷰어의 최장토큰 폴백이 받는다.
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

  // 다값 축의 각 행이 자기 항목 ref 로 이동 — 축 단위 FieldRow onfocusin 을 stopPropagation
  // 으로 덮어쓴다(지원기간/재판정/결제·리스트 항목별로 개별 PDF 위치 점프).
  function navRow(node: any, e: Event) {
    e.stopPropagation()
    onSource?.(firstPage(node), firstQuote(node))
  }

  const R = $derived((record ?? {}) as any)

  // 스칼라 축용 — 그룹 박스와 같은 옅은 인디고 패널(전 필드 통일)
  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-primary-50/30 px-3 py-3 text-base outline-none focus:border-primary-500'
  const numInp =
    'w-28 rounded-lg border border-gray-200 bg-primary-50/30 px-3 py-3 text-right text-base tabular-nums outline-none focus:border-primary-500'

  // 다값 축용 — 옅은 인디고 패널이 그룹 경계, 내부 입력은 무테
  const groupBox =
    'divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-primary-50/30'
  const bareInp =
    'w-full border-0 bg-transparent p-0 text-base text-gray-800 outline-none focus:ring-0'
  const bareNum =
    'w-24 border-0 bg-transparent p-0 text-right text-base font-semibold tabular-nums text-gray-900 outline-none focus:ring-0'
  // 행 삭제(×) / 행 추가 — 리스트·테이블·항목쌍 공용
  const rmBtn =
    'shrink-0 self-center rounded p-1 text-lg leading-none text-gray-300 hover:bg-red-50 hover:text-red-500'
  const addBtn =
    'flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50'
</script>

{#snippet cellText(obj: any, key: string, rows = 1)}
  {#if obj}
    <textarea
      {rows}
      bind:value={obj[key]}
      class="{inputCls} field-sizing-content resize-none"
    ></textarea>
  {/if}
{/snippet}

{#snippet numBadge(n: number)}
  <span
    class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700"
  >
    {n}
  </span>
{/snippet}

<!-- 번호 배지 리스트 박스 — {내용} 항목형 배열. 행 삭제(×)·추가 지원 -->
{#snippet itemRows(arr: any[], key: string)}
  <div class={groupBox}>
    {#each arr ?? [] as it, i (it)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="flex items-start gap-2.5 px-3.5 py-3 focus-within:bg-primary-100/50 {it.ref
          ? ''
          : 'bg-amber-50/70'}"
        onfocusin={(e) => navRow(it, e)}
      >
        {@render numBadge(i + 1)}
        <textarea
          rows={1}
          bind:value={it[key]}
          class="{bareInp} field-sizing-content resize-none"
        ></textarea>
        <button type="button" class={rmBtn} title="이 항목 삭제" onclick={() => arr.splice(i, 1)}>
          ×
        </button>
      </div>
    {/each}
    <button type="button" class={addBtn} onclick={() => arr.push({ [key]: '' })}>＋ 추가</button>
  </div>
{/snippet}

{#snippet axisRow(label: string, node: any, body: import('svelte').Snippet)}
  <FieldRow
    {label}
    source={onSource ? firstPage(node) : null}
    onSource={() => onSource?.(firstPage(node), firstQuote(node))}
  >
    {@render body()}
  </FieldRow>
{/snippet}

<div class="space-y-10">
  {#if R.목적}
    {#snippet b()}{@render cellText(R.목적, '내용', 2)}{/snippet}
    {@render axisRow('목적', R.목적, b)}
  {/if}

  {#if R.법적근거?.length}
    {#snippet b()}{@render itemRows(R.법적근거, '내용')}{/snippet}
    {@render axisRow('법적 근거', R.법적근거, b)}
  {/if}

  {#if R.지역?.추진지역?.length}
    {#snippet b()}
      <!-- 읽기전용 칩이라 포커스할 input 이 없다 — 패널 자체를 tabindex+hover 로 만들어
           다른 필드처럼 근거 이동(포커스는 FieldRow focusin, hover 는 여기서 직접). -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-primary-50/30 p-3 outline-none transition-colors hover:border-primary-300 hover:bg-primary-50/60 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        tabindex="0"
        onmouseenter={() => onSource?.(firstPage(R.지역), firstQuote(R.지역))}
      >
        {#each R.지역.추진지역 as pair, i (i)}
          <span class="rounded bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-700">
            {pair.시군구 ?? pair.시도}
          </span>
        {/each}
      </div>
    {/snippet}
    {@render axisRow('추진지역', R.지역, b)}
  {/if}

  {#if R.소득기준}
    {#snippet b()}
      <div class="flex items-center gap-2 text-base">
        {#if R.소득기준.없음}
          <span class="text-gray-500">소득기준 없음</span>
        {:else}
          <span class="text-[15px] text-gray-500">중위소득 최대</span>
          <input type="number" bind:value={R.소득기준.최대} class={numInp} />
          <span class="text-gray-600">%</span>
        {/if}
      </div>
    {/snippet}
    {@render axisRow('소득기준', R.소득기준, b)}
  {/if}

  {#if R.연령기준}
    {#snippet b()}
      <div class="flex items-center gap-2 text-base">
        {#if R.연령기준.없음}
          <span class="text-gray-500">연령기준 없음</span>
        {:else}
          <span class="text-[15px] text-gray-500">만</span>
          <input type="number" bind:value={R.연령기준.최소} class={numInp} />
          <span class="text-gray-400">~</span>
          <input type="number" bind:value={R.연령기준.최대} class={numInp} />
          <span class="text-gray-600">세</span>
        {/if}
      </div>
    {/snippet}
    {@render axisRow('연령기준', R.연령기준, b)}
  {/if}

  {#if R.욕구기준?.지표?.length}
    {#snippet b()}{@render itemRows(R.욕구기준.지표, '내용')}{/snippet}
    {@render axisRow('욕구기준', R.욕구기준, b)}
  {/if}

  {#if R.우선순위?.length}
    {#snippet b()}{@render itemRows(R.우선순위, '내용')}{/snippet}
    {@render axisRow('우선순위', R.우선순위, b)}
  {/if}

  {#if R.제외?.length}
    {#snippet b()}{@render itemRows(R.제외, '내용')}{/snippet}
    {@render axisRow('제외', R.제외, b)}
  {/if}

  {#if R.중복금지?.불가?.length}
    {#snippet b()}
      <div class={groupBox}>
        {#each R.중복금지.불가 as _, i (i)}
          <div class="flex items-center gap-2.5 px-3.5 py-3 focus-within:bg-primary-100/50">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700"
            >
              {i + 1}
            </span>
            <input type="text" bind:value={R.중복금지.불가[i]} class={bareInp} />
            <button
              type="button"
              class={rmBtn}
              title="삭제"
              onclick={() => R.중복금지.불가.splice(i, 1)}
            >
              ×
            </button>
          </div>
        {/each}
        <button type="button" class={addBtn} onclick={() => R.중복금지.불가.push('')}>＋ 추가</button>
      </div>
    {/snippet}
    {@render axisRow('중복제한', R.중복금지, b)}
  {/if}

  {#if R.서비스}
    {#snippet b()}
      <div class="space-y-3">
        {#each R.서비스 as g (g)}
          <div>
            <div class="mb-1.5 text-sm font-semibold text-primary-600">{g.유형명 ?? '서비스'}</div>
            {@render itemRows((g.내용 ??= []), '설명')}
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axisRow('서비스', R.서비스, b)}
  {/if}

  {#if R.집단규모?.length}
    {#snippet b()}
      <div class={groupBox}>
        {#each R.집단규모 as row, i (row)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-stretch focus-within:bg-primary-100/50 {row.ref
              ? ''
              : 'bg-amber-50/70'}"
            onfocusin={(e) => navRow(row, e)}
          >
            <span
              class="flex w-44 shrink-0 items-center border-r border-primary-100 bg-primary-50/70 px-3.5 py-3 text-sm font-semibold text-primary-700"
            >
              {condLabel(row) || '전체'}
            </span>
            <input type="text" bind:value={row.값} class="{bareInp} px-3.5 py-3" />
            <button
              type="button"
              class="{rmBtn} pr-2"
              title="삭제"
              onclick={() => R.집단규모.splice(i, 1)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axisRow('집단규모', R.집단규모, b)}
  {/if}

  {#if R.절차?.length}
    {#snippet b()}{@render itemRows(R.절차, '내용')}{/snippet}
    {@render axisRow('제공 절차', R.절차, b)}
  {/if}

  {#if R.금액}
    {#snippet b()}
      {#each R.금액 as g (g)}
        <div class="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
          <input type="text" bind:value={g.명칭} placeholder="명칭" class="{bareInp} w-auto font-semibold text-primary-600" />
          {#if g.주기}<span class="text-gray-500">{g.주기}</span>{/if}
          {#if g.적용대상}<span class="text-gray-400">· {g.적용대상}</span>{/if}
        </div>
        <div class="mb-3 overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-base">
            <thead class="border-b border-gray-200 bg-primary-50 text-[13px] font-semibold text-primary-700">
              <tr>
                <th class="px-3.5 py-3 text-left">구분</th>
                <th class="px-3.5 py-3 text-right">정부지원</th>
                <th class="px-3.5 py-3 text-right">본인부담</th>
                <th class="px-3.5 py-3 text-right">지원율%</th>
                <th class="w-9"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              {#each (g.금액 ??= []) as row, i (row)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <tr
                  class="focus-within:bg-primary-50/60 {row.ref ? '' : 'bg-amber-50/70'}"
                  onfocusin={(e) => navRow(row, e)}
                >
                  <td class="px-3.5 py-3.5">
                    <input type="text" bind:value={() => row.조건?.구분 ?? '', (v) => (row.조건 = { ...(row.조건 ?? {}), 구분: v })} placeholder={condLabel(row) || '구분'} class="{bareInp} min-w-40 font-medium" />
                    {#if row.금액 != null}
                      <span class="mt-0.5 block text-[13px] text-gray-400">총 {row.금액}원</span>
                    {/if}
                  </td>
                  <td class="px-3.5 py-3.5 text-right">
                    <input type="number" bind:value={row.정부지원금} class={bareNum} />
                  </td>
                  <td class="px-3.5 py-3.5 text-right">
                    <input type="number" bind:value={row.본인부담금} class={bareNum} />
                  </td>
                  <td class="px-3.5 py-3.5 text-right">
                    <input type="number" bind:value={row.정부지원비율} class="{bareNum} w-14" />
                  </td>
                  <td class="px-1 text-center">
                    <button
                      type="button"
                      class={rmBtn}
                      title="이 행 삭제"
                      onclick={() => g.금액.splice(i, 1)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          <button
            type="button"
            class={addBtn}
            onclick={() =>
              g.금액.push({ 조건: { 구분: '' }, 정부지원금: null, 본인부담금: null, 정부지원비율: null })}
          >
            ＋ 행 추가
          </button>
        </div>
      {/each}
    {/snippet}
    {@render axisRow('금액', R.금액, b)}
  {/if}

  {#if R.제공인력?.자격경로?.length || R.제공인력?.결격?.length}
    {#snippet b()}
      <div class="space-y-3">
        {#if R.제공인력.자격경로?.length}
          <div>
            <div class="mb-1.5 text-sm font-semibold text-primary-600">자격</div>
            {@render itemRows(R.제공인력.자격경로, '내용')}
          </div>
        {/if}
        {#if R.제공인력.결격?.length}
          <div>
            <div class="mb-1.5 text-sm font-semibold text-primary-600">결격</div>
            {@render itemRows(R.제공인력.결격, '내용')}
          </div>
        {/if}
      </div>
    {/snippet}
    {@render axisRow('제공인력', R.제공인력, b)}
  {/if}

  {#if R.운영규칙?.length}
    {#snippet b()}
      <!-- 종류는 open(지원기간·재판정·결제시기·등록유형…) — 라벨을 값에서 읽는다 -->
      <div class={groupBox}>
        {#each R.운영규칙 as row, i (row)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-stretch focus-within:bg-primary-100/50 {row.ref
              ? ''
              : 'bg-amber-50/70'}"
            onfocusin={(e) => navRow(row, e)}
          >
            <input
              type="text"
              bind:value={row.종류}
              placeholder="종류"
              class="w-32 shrink-0 border-0 border-r border-primary-100 bg-primary-50/70 px-3.5 py-3 text-sm font-semibold text-primary-700 outline-none focus:ring-0"
            />
            <input type="text" bind:value={row.내용} class="{bareInp} px-3.5 py-3" />
            <button
              type="button"
              class="{rmBtn} pr-2"
              title="삭제"
              onclick={() => R.운영규칙.splice(i, 1)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    {/snippet}
    {@render axisRow('운영규칙', R.운영규칙, b)}
  {/if}

  {#each [['처리·통지', R.처리통지], ['이의신청', R.이의신청], ['환수', R.환수]] as [label, node] (label)}
    {#if node}
      {#snippet b()}{@render cellText(node, '내용', 2)}{/snippet}
      {@render axisRow(label, node, b)}
    {/if}
  {/each}

  {#if R.신고의무?.length}
    {#snippet b()}{@render itemRows(R.신고의무, '내용')}{/snippet}
    {@render axisRow('신고 의무', R.신고의무, b)}
  {/if}

  {#if R.중지상실?.length}
    {#snippet b()}{@render itemRows(R.중지상실, '사유')}{/snippet}
    {@render axisRow('중지·상실', R.중지상실, b)}
  {/if}

  {#if R.항목?.length}
    {#snippet b()}
      <div class={groupBox}>
        {#each R.항목 as it, i (it)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-stretch focus-within:bg-primary-100/50 {it.ref
              ? ''
              : 'bg-amber-50/70'}"
            onfocusin={(e) => navRow(it, e)}
          >
            <input
              type="text"
              bind:value={it.라벨}
              placeholder="라벨"
              class="w-44 shrink-0 border-0 border-r px-3.5 py-3 text-base font-semibold text-primary-800 outline-none focus:ring-0 {it.ref
                ? 'border-primary-100 bg-primary-50/70'
                : 'border-amber-200 bg-amber-100/70'}"
            />
            <input
              type="text"
              bind:value={it.값}
              placeholder="값"
              class="{bareInp} px-3.5 py-3"
            />
            <button
              type="button"
              class="{rmBtn} pr-2"
              title="삭제"
              onclick={() => R.항목.splice(i, 1)}
            >
              ×
            </button>
          </div>
        {/each}
        <button type="button" class={addBtn} onclick={() => R.항목.push({ 라벨: '', 값: '' })}>
          ＋ 항목 추가
        </button>
      </div>
    {/snippet}
    {@render axisRow('기타 항목', R.항목, b)}
  {/if}
</div>
