<script lang="ts" module>
  /**
   * support_amount (SupportAmount 정규화 dict) 구조 편집기 — SupportAmountDisplay 의 편집판.
   * UI 값은 전부 문자열, 제출 시 formToSupportAmount 로 스키마 변환.
   * 금액 표기: "180000"(단일) | "160000~180000"(범위) | ""(미상).
   */
  import type {
    Amount,
    SupportAmount,
    SupportAmountGrade,
    UnitPeriod
  } from '$lib/features/voucher/support-amount.types'

  export interface SupportAmountGradeForm {
    등급: string
    기준: string
    정부지원금: string
    본인부담금: string
    /** 정부지원 비율 % (전액=100). 비율형 문서용 */
    지원비율: string
  }

  export interface SupportAmountForm {
    월총액: string
    단가금액: string
    단가단위: UnitPeriod
    한도값: string
    한도단위: '원' | '시간' | '회'
    한도기간: '연' | '월'
    정부지원금: string
    본인부담금: string
    가격탄력제: boolean
    등급별: SupportAmountGradeForm[]
    항목: { 라벨: string; 값: string }[]
  }

  /** "180000" | "160000~180000" | "" → Amount. 형식 오류면 undefined. */
  function parseAmountStr(s: string): Amount | undefined {
    const t = s.trim().replace(/[,원\s]/g, '')
    if (!t) return null
    const m = t.match(/^(\d+)?~(\d+)?$/)
    if (m) {
      if (!m[1] && !m[2]) return null
      return { 최소: m[1] ? Number(m[1]) : null, 최대: m[2] ? Number(m[2]) : null }
    }
    return /^\d+$/.test(t) ? Number(t) : undefined
  }

  export function amountToStr(a: Amount | undefined): string {
    if (a == null) return ''
    if (typeof a === 'number') return String(a)
    if (a.최소 == null && a.최대 == null) return ''
    return `${a.최소 ?? ''}~${a.최대 ?? ''}`
  }

  const AMOUNT_HINT = '예: 180000 또는 160000~180000'

  /** 폼 → SupportAmount | null(전부 빈 값). 금액 형식 오류면 error. */
  export function formToSupportAmount(f: SupportAmountForm): {
    value?: SupportAmount | null
    error?: string
  } {
    const top: Record<'월총액' | '정부지원금' | '본인부담금', Amount> = {
      월총액: null,
      정부지원금: null,
      본인부담금: null
    }
    for (const k of ['월총액', '정부지원금', '본인부담금'] as const) {
      const a = parseAmountStr(f[k])
      if (a === undefined)
        return { error: `지원금 ${k} 형식이 잘못되었습니다 (${AMOUNT_HINT})` }
      top[k] = a
    }
    const 단가금액 = parseAmountStr(f.단가금액)
    if (단가금액 === undefined)
      return { error: `지원금 단가 형식이 잘못되었습니다 (${AMOUNT_HINT})` }

    const 한도raw = f.한도값.trim().replace(/[,\s]/g, '')
    let 한도값: number | null = null
    if (한도raw) {
      한도값 = Number(한도raw)
      if (!Number.isFinite(한도값) || 한도값 <= 0)
        return { error: '지원금 한도 값은 양수 숫자여야 합니다' }
    }

    const 등급별: SupportAmountGrade[] = []
    for (const g of f.등급별) {
      if (
        !g.등급.trim() && !g.기준.trim() && !g.정부지원금.trim() &&
        !g.본인부담금.trim() && !g.지원비율.trim()
      )
        continue
      const gov = parseAmountStr(g.정부지원금)
      const copay = parseAmountStr(g.본인부담금)
      if (gov === undefined || copay === undefined)
        return { error: `등급별 금액 형식이 잘못되었습니다 (${AMOUNT_HINT})` }
      const no = g.등급.trim() ? Number(g.등급) : null
      if (no != null && !Number.isInteger(no))
        return { error: '등급 번호는 정수여야 합니다' }
      const ratioRaw = g.지원비율.trim().replace(/%$/, '')
      const ratio = ratioRaw ? Number(ratioRaw) : null
      if (ratio != null && (!Number.isFinite(ratio) || ratio < 0 || ratio > 100))
        return { error: '지원비율은 0~100 사이 %여야 합니다' }
      등급별.push({
        등급: no,
        기준: g.기준.trim() || null,
        정부지원금: gov,
        본인부담금: copay,
        지원비율: ratio
      })
    }

    const 항목: { 라벨: string; 값: string }[] = []
    for (const x of f.항목) {
      if (!x.라벨.trim() && !x.값.trim()) continue
      if (!x.라벨.trim()) return { error: '추가 항목의 라벨을 입력하세요' }
      항목.push({ 라벨: x.라벨.trim(), 값: x.값.trim() })
    }

    const empty =
      top.월총액 == null &&
      top.정부지원금 == null &&
      top.본인부담금 == null &&
      단가금액 == null &&
      한도값 == null &&
      등급별.length === 0 &&
      항목.length === 0 &&
      !f.가격탄력제
    if (empty) return { value: null }

    const out: SupportAmount = { 통화: 'KRW' }
    if (top.월총액 != null) out.월총액 = top.월총액
    if (단가금액 != null) out.단가 = { 금액: 단가금액, 단위: f.단가단위 }
    if (한도값 != null) out.한도 = { 값: 한도값, 단위: f.한도단위, 기간: f.한도기간 }
    // 등급표가 있으면 top-level 정부/본인 대신 등급별이 정본 (스키마 주석과 동일)
    if (등급별.length > 0) {
      out.등급별 = 등급별
    } else {
      if (top.정부지원금 != null) out.정부지원금 = top.정부지원금
      if (top.본인부담금 != null) out.본인부담금 = top.본인부담금
    }
    if (항목.length > 0) out.항목 = 항목
    if (f.가격탄력제) out.가격탄력제 = true
    return { value: out }
  }
</script>

<script lang="ts">
  import Select from '$components/Select.svelte'

  interface Props {
    value: SupportAmountForm
    /** 입력 포커스 시 (PDF 근거 하이라이트 연동) */
    onfocus?: () => void
  }

  let { value = $bindable(), onfocus }: Props = $props()

  const UNIT_OPTIONS = [
    { value: '회', title: '회당' },
    { value: '시간', title: '시간당' },
    { value: '일', title: '일당' }
  ]
  const CAP_UNIT_OPTIONS = [
    { value: '원', title: '원' },
    { value: '시간', title: '시간' },
    { value: '회', title: '회' }
  ]
  const CAP_PERIOD_OPTIONS = [
    { value: '연', title: '연간' },
    { value: '월', title: '월간' }
  ]

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500'
  const labelCls = 'mb-1 block text-xs font-medium text-gray-500'

  function addGrade() {
    value.등급별 = [
      ...value.등급별,
      {
        등급: String(value.등급별.length + 1),
        기준: '',
        정부지원금: '',
        본인부담금: '',
        지원비율: ''
      }
    ]
  }
  function removeGrade(i: number) {
    value.등급별 = value.등급별.filter((_, x) => x !== i)
  }
  function addItem() {
    value.항목 = [...value.항목, { 라벨: '', 값: '' }]
  }
  function removeItem(i: number) {
    value.항목 = value.항목.filter((_, x) => x !== i)
  }
</script>

<div class="space-y-3 rounded-lg border border-gray-200 p-3">
  <div class="grid grid-cols-[1fr_auto] items-end gap-3">
    <div>
      <label class="{labelCls}" for={undefined}>월총액</label>
      <input
        type="text"
        bind:value={value.월총액}
        {onfocus}
        placeholder="예: 200000 또는 180000~250000"
        class={inputCls}
      />
    </div>
    <label class="flex items-center gap-1.5 pb-2.5 text-xs font-medium text-gray-600">
      <input type="checkbox" bind:checked={value.가격탄력제} class="h-3.5 w-3.5" />
      가격탄력제
    </label>
  </div>

  <!-- 단가 (회당/시간당/일당) — 월정액이 아닌 문서용 -->
  <div>
    <label class="{labelCls}" for={undefined}>단가</label>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={value.단가금액}
        {onfocus}
        placeholder="예: 80000 (회당·시간당·일당 금액)"
        class="{inputCls} min-w-0"
      />
      <Select
        class="h-[38px] w-28 shrink-0 rounded-lg bg-white"
        btnClass="px-3"
        selected={value.단가단위}
        options={UNIT_OPTIONS}
        on:change={(e) => (value.단가단위 = e.detail.value)}
      />
    </div>
  </div>

  <!-- 한도 (연/월 금액·시간·회) -->
  <div>
    <label class="{labelCls}" for={undefined}>한도</label>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={value.한도값}
        {onfocus}
        placeholder="예: 1500000 또는 1200"
        class="{inputCls} min-w-0"
      />
      <Select
        class="h-[38px] w-28 shrink-0 rounded-lg bg-white"
        btnClass="px-3"
        selected={value.한도단위}
        options={CAP_UNIT_OPTIONS}
        on:change={(e) => (value.한도단위 = e.detail.value)}
      />
      <Select
        class="h-[38px] w-28 shrink-0 rounded-lg bg-white"
        btnClass="px-3"
        selected={value.한도기간}
        options={CAP_PERIOD_OPTIONS}
        on:change={(e) => (value.한도기간 = e.detail.value)}
      />
    </div>
  </div>

  {#if value.등급별.length === 0}
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="{labelCls}" for={undefined}>정부지원금</label>
        <input
          type="text"
          bind:value={value.정부지원금}
          {onfocus}
          placeholder="예: 180000 또는 160000~180000"
          class={inputCls}
        />
      </div>
      <div>
        <label class="{labelCls}" for={undefined}>본인부담금</label>
        <input
          type="text"
          bind:value={value.본인부담금}
          {onfocus}
          placeholder="예: 20000 또는 20000~40000"
          class={inputCls}
        />
      </div>
    </div>
  {/if}

  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="text-xs font-medium text-gray-500">등급별 ({value.등급별.length})</span>
      <button
        type="button"
        onclick={addGrade}
        class="rounded px-1.5 py-0.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
      >
        + 등급 추가
      </button>
    </div>

    {#if value.등급별.length > 0}
      <div
        class="grid grid-cols-[3rem_1fr_7rem_7rem_4rem_auto] items-center gap-x-2 py-1 text-[10px] font-medium text-gray-400"
      >
        <span>등급</span>
        <span>기준</span>
        <span>정부지원금</span>
        <span>본인부담금</span>
        <span>지원율%</span>
        <span></span>
      </div>
      <div class="space-y-1.5">
        {#each value.등급별 as g, i (i)}
          <div class="grid grid-cols-[3rem_1fr_7rem_7rem_4rem_auto] items-center gap-x-2">
            <input type="text" bind:value={g.등급} {onfocus} class="{inputCls} px-2 text-center" />
            <input
              type="text"
              bind:value={g.기준}
              {onfocus}
              placeholder="예: 1등급(기초생활수급자, 차상위)"
              class={inputCls}
            />
            <input
              type="text"
              bind:value={g.정부지원금}
              {onfocus}
              placeholder="180000"
              class="{inputCls} px-2 text-right tabular-nums"
            />
            <input
              type="text"
              bind:value={g.본인부담금}
              {onfocus}
              placeholder="20000"
              class="{inputCls} px-2 text-right tabular-nums"
            />
            <input
              type="text"
              bind:value={g.지원비율}
              {onfocus}
              placeholder="90"
              class="{inputCls} px-2 text-right tabular-nums"
            />
            <button
              type="button"
              onclick={() => removeGrade(i)}
              aria-label="이 등급 제거"
              class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 자유 추가 항목 — 스키마 밖 정보(식비·면제·이월·가산 등). 반복되면 키로 승격 -->
  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="text-xs font-medium text-gray-500">추가 항목 ({value.항목.length})</span>
      <button
        type="button"
        onclick={addItem}
        class="rounded px-1.5 py-0.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
      >
        + 항목 추가
      </button>
    </div>
    {#if value.항목.length > 0}
      <div class="space-y-1.5">
        {#each value.항목 as x, i (i)}
          <div class="grid grid-cols-[10rem_1fr_auto] items-center gap-x-2">
            <input
              type="text"
              bind:value={x.라벨}
              {onfocus}
              placeholder="예: 회당결제금액"
              class={inputCls}
            />
            <input
              type="text"
              bind:value={x.값}
              {onfocus}
              placeholder="예: 1등급 22,500원/회, 2등급 20,000원/회"
              class={inputCls}
            />
            <button
              type="button"
              onclick={() => removeItem(i)}
              aria-label="이 항목 제거"
              class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
