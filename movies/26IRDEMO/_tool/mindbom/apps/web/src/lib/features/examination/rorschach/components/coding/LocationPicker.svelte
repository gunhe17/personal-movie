<script lang="ts">
  /**
   * 위치 부호 입력 — **반응당 하나** (§14-6, §14-7).
   *
   * 화면은 세 칸(범주 / 번호 / 공백)이지만 저장은 `DS6` 한 덩어리다.
   * 서버 `parse_location`이 그걸 다시 `('D', true)`로 쪼개고, 구조요약은
   * 범주만 세며, 번호는 `area_code`가 정본으로 보관한다.
   *
   * **왜 자유 입력이 아닌가** (Q8 해소). `SD6`·`D6S`·`S` 단독 같은 잘못된
   * 형태가 애초에 만들어지지 않는다. 서버 정규식이 막긴 하지만, 막히고 나서
   * 임상가가 왜 안 되는지 알 방법이 없다. 그리고 **S는 붙는 것이지 단독
   * 부호가 아니라는** 개념이 UI에 그대로 드러난다.
   *
   * 골격·색은 CodingPanel의 다른 칸을 그대로 따른다 (선택됨이면
   * primary-400/50/700, 아니면 gray-200 테두리 + hover:gray-300).
   */
  import Checkbox from '$lib/components/ui/Checkbox.svelte'
  import { LOCATION_PATTERN } from '../../constants'

  interface Props {
    /** 현재 부호 — 'W' / 'D6' / 'DS6' / 'Dd99'. null이면 미정 */
    value: string | null
    /**
     * 'Loc' 라벨을 그릴지. 표 안에 놓일 때는 행 라벨이 이미 '위치'라
     * 중복이고, 360px 팝오버에서는 그 24px이 줄바꿈을 만든다.
     */
    showLabel?: boolean
    readonly?: boolean
    onChange: (code: string | null) => void
  }

  let { value, readonly = false, showLabel = true, onChange }: Props = $props()

  const BASES = ['W', 'D', 'Dd'] as const
  type Base = (typeof BASES)[number]

  /**
   * 저장된 문자열을 세 칸으로 되돌린다.
   *
   * 규칙은 계약이 갖는다(`LOCATION_PATTERN` → 서버 `coding_codes.LOCATION_RE`).
   * 예전엔 여기 정규식을 손으로 적었다 — 어긋나면 서버가 받아준 값을 화면이
   * 못 읽어 칸이 비어 보인다.
   */
  const LOCATION_RE = new RegExp(LOCATION_PATTERN)

  let parsed = $derived.by(() => {
    const m = LOCATION_RE.exec((value ?? '').trim())
    if (!m) return { base: null as Base | null, space: false, num: '' }
    return { base: m[1] as Base, space: m[2] != null, num: m[3] ?? '' }
  })

  /** 세 칸 → 한 덩어리. 범주가 없으면 부호 자체가 없는 것이다. */
  function emit(base: Base | null, space: boolean, num: string) {
    if (!base) return onChange(null)
    // W는 전체를 뜻하므로 번호를 갖지 않는다 — 붙이면 서버가 거부한다.
    const digits = base === 'W' ? '' : num.replace(/\D/g, '')
    onChange(`${base}${space ? 'S' : ''}${digits}`)
  }
</script>

<div class="flex items-center gap-3 flex-wrap">
  <div class="flex items-center gap-1.5">
    {#if showLabel}
      <span
        class="text-caption-01-normal-regular tracking-wide text-gray-400 uppercase"
      >
        Loc
      </span>
    {/if}

    <!-- 범주 — 다시 누르면 해제(미정으로 되돌림) -->
    <div class="flex items-center gap-0.5">
      {#each BASES as base (base)}
        {@const active = parsed.base === base}
        <button
          type="button"
          disabled={readonly}
          onclick={() => emit(active ? null : base, parsed.space, parsed.num)}
          class="h-7 min-w-9 rounded border px-2 text-center text-label-02-normal-medium {active
            ? 'border-primary-400 bg-primary-50 font-medium text-primary-700'
            : 'border-gray-200 text-gray-400 hover:border-gray-300'} disabled:cursor-default disabled:opacity-60"
        >
          {base}
        </button>
      {/each}
    </div>

    <!-- 번호 — W는 전체라 번호가 없다 -->
    <input
      type="text"
      inputmode="numeric"
      maxlength="2"
      value={parsed.num}
      disabled={readonly || parsed.base === null || parsed.base === 'W'}
      placeholder="-"
      oninput={(e) => emit(parsed.base, parsed.space, e.currentTarget.value)}
      class="h-7 w-12 rounded border px-2 text-center text-label-02-normal-medium {parsed.num
        ? 'border-primary-400 bg-primary-50 font-medium text-primary-700'
        : 'border-gray-200 text-gray-500 hover:border-gray-300'} focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none disabled:cursor-default disabled:opacity-60"
    />
  </div>

  <!-- 공백(S)은 붙는 것이다 — 'WS', 'DS6'처럼 -->
  <Checkbox
    checked={parsed.space}
    disabled={readonly || parsed.base === null}
    label="공백 S"
    onchange={(v) => emit(parsed.base, v, parsed.num)}
  />
</div>
