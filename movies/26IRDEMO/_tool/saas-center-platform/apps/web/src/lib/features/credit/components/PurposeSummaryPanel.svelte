<script lang="ts">
  /**
   * 기능별 사용 패널 — 도넛(좌) + 테이블(우) 레이아웃.
   * 카드 래퍼 없이 렌더링하므로 페이지에서 카드로 감싸야 함.
   */
  import type { PurposeUsageItem } from '../view-model'
  import { PURPOSE_COLORS, DEFAULT_PURPOSE_COLOR } from '../constants'

  interface Props {
    items: PurposeUsageItem[]
  }

  let { items }: Props = $props()

  // ── 도넛 상수 ──
  const CX = 90,
    CY = 90,
    R = 66,
    S = 22
  const C = 2 * Math.PI * R

  let hoverIndex = $state<number | null>(null)

  function colorOf(purpose: string): string {
    return (PURPOSE_COLORS[purpose] ?? DEFAULT_PURPOSE_COLOR).hex
  }

  const total = $derived(items.reduce((s, p) => s + p.credits, 0))

  interface Seg {
    offset: number
    dash: number
    color: string
    label: string
    percent: number
    credits: number
    calls: number
    hitPath: string
  }

  const segs = $derived.by((): Seg[] => {
    if (total === 0) return []
    let off = 0
    return items.map((p) => {
      const dash = (p.credits / total) * C
      const color = colorOf(p.purpose)
      const percent = Math.round((p.credits / total) * 100)

      const sa = (off / C) * 2 * Math.PI - Math.PI / 2
      const ea = ((off + dash) / C) * 2 * Math.PI - Math.PI / 2
      const oR = R + S / 2 + 5
      const iR = R - S / 2 - 5
      const large = dash / C > 0.5 ? 1 : 0
      const pt = (r: number, a: number) =>
        [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const
      const [ox1, oy1] = pt(oR, sa),
        [ox2, oy2] = pt(oR, ea)
      const [ix1, iy1] = pt(iR, ea),
        [ix2, iy2] = pt(iR, sa)
      const hitPath = `M${ox1.toFixed(1)},${oy1.toFixed(1)} A${oR},${oR} 0 ${large} 1 ${ox2.toFixed(1)},${oy2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${iR},${iR} 0 ${large} 0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z`

      const seg: Seg = {
        offset: off,
        dash,
        color,
        label: p.label,
        percent,
        credits: p.credits,
        calls: p.calls,
        hitPath
      }
      off += dash
      return seg
    })
  })

  const center = $derived(hoverIndex !== null ? segs[hoverIndex] : segs[0])
  const totalCalls = $derived(items.reduce((s, p) => s + p.calls, 0))
</script>

<div class="flex items-stretch gap-0 flex-1">
  <!-- 도넛 -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative shrink-0 flex flex-col items-center justify-center pr-5"
    style="width:160px"
    onmouseleave={() => (hoverIndex = null)}
  >
    <div class="relative" style="width:140px;height:140px">
      <svg viewBox="0 0 180 180" class="h-full w-full">
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#f3f4f6"
          stroke-width={S}
        />
        {#each segs as seg, i}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={seg.color}
            stroke-width={hoverIndex === i ? S + 5 : S}
            stroke-dasharray="{seg.dash} {C}"
            stroke-dashoffset={-seg.offset}
            transform="rotate(-90 {CX} {CY})"
            style="opacity:{hoverIndex !== null && hoverIndex !== i
              ? 0.3
              : 1};transition:stroke-width 0.15s ease,opacity 0.15s ease"
          />
        {/each}
        {#each segs as seg, i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <path
            d={seg.hitPath}
            fill="transparent"
            style="cursor:pointer"
            onmouseenter={() => (hoverIndex = i)}
          />
        {/each}
      </svg>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span
          class="text-label-01-normal-medium text-gray-700 max-w-[72px] truncate-safe text-center leading-none"
        >
          {center?.label ?? ''}
        </span>
        <span
          class="text-title-01-normal-semibold tabular-nums text-gray-900 leading-none mt-0.5"
        >
          {center?.percent ?? 0}%
        </span>
      </div>
    </div>
  </div>

  <!-- 구분선 -->
  <div class="w-px bg-gray-100 shrink-0 self-stretch"></div>

  <!-- 테이블 -->
  <div class="flex-1 pl-5">
    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-100">
          <th
            class="text-left text-body-03-normal-medium text-gray-400 pb-2 font-normal"
            >기능</th
          >
          <th
            class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
            >크레딧</th
          >
          <th
            class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
            >횟수</th
          >
          <th
            class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
            >비율</th
          >
        </tr>
      </thead>
      <tbody>
        {#each items as p, i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <tr
            class="border-b border-gray-50 last:border-0 transition-opacity"
            style="opacity:{hoverIndex !== null && hoverIndex !== i ? 0.35 : 1}"
            onmouseenter={() => (hoverIndex = i)}
            onmouseleave={() => (hoverIndex = null)}
          >
            <td class="py-3">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-2 w-2 rounded-full shrink-0"
                  style="background:{segs[i]?.color}"
                ></span>
                <span class="text-body-02-normal-medium text-gray-700"
                  >{p.label}</span
                >
              </div>
            </td>
            <td
              class="py-3 text-right text-body-02-normal-medium tabular-nums text-gray-900"
              >{p.credits.toLocaleString()}</td
            >
            <td
              class="py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
              >{p.calls}회</td
            >
            <td
              class="py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
              >{segs[i]?.percent ?? 0}%</td
            >
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t border-gray-100">
          <td class="pt-3 text-body-02-normal-medium text-gray-500">합계</td>
          <td
            class="pt-3 text-right text-body-02-normal-semibold tabular-nums text-gray-900"
            >{total.toLocaleString()}</td
          >
          <td
            class="pt-3 text-right text-body-02-normal-medium tabular-nums text-gray-500"
            >{totalCalls}회</td
          >
          <td
            class="pt-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
            >100%</td
          >
        </tr>
      </tfoot>
    </table>
  </div>
</div>
