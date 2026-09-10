<script lang="ts">
  interface Props {
    column: string
    value: string | number | string[] | undefined
    bgColor?: string
    cols?: string
    rowColStart?: string
    isHighlighted?: boolean
    type?: 'big' | 'small' | 'none'
  }

  let {
    column,
    value,
    bgColor = '#F9FAFB',
    cols = 'grid-cols-[74px_auto]',
    rowColStart = '',
    isHighlighted = false,
    type = 'big',
  }: Props = $props()

  let heightClass = $derived(type === 'big' ? 'h-8' : type === 'small' ? 'h-7' : '')

  function fmtNumber(v: number): string {
    return Number(v.toFixed(2)).toString()
  }
</script>

<!--
  뿌리에 `border-r`를 두지 않는다 — 바깥 `ParentSection`이 이미 오른쪽 선을
  그려서 1px 간격으로 두 줄이 된다. 칸 사이 세로선은 아래 라벨 칸이 그린다.
-->
<div class="grid border-b border-gray-100 last:border-b-0 {cols} {rowColStart} {heightClass}">
  <!-- 컬럼 라벨 -->
  <div class="flex items-center gap-1 border-r border-gray-100 px-2" style="background: {bgColor};">
    <span class="text-xs text-gray-500">{column}</span>
  </div>

  <!-- 값 -->
  <div class="flex items-center px-2 {isHighlighted ? 'bg-blue-50' : 'bg-white'}">
    {#if Array.isArray(value)}
      <div class="flex w-full justify-between">
        {#each Array.from({ length: 10 }) as _, i}
          <span class="text-xs w-8 text-center {isHighlighted ? 'text-blue-700' : 'text-gray-500'}">
            {value[i] ?? ''}
          </span>
        {/each}
      </div>
    {:else if typeof value === 'number'}
      <span class="text-xs {isHighlighted ? 'text-blue-700' : 'text-gray-500'}">{fmtNumber(value)}</span>
    {:else}
      <span class="text-xs {isHighlighted ? 'text-blue-700' : 'text-gray-500'}">{value ?? ''}</span>
    {/if}
  </div>
</div>
