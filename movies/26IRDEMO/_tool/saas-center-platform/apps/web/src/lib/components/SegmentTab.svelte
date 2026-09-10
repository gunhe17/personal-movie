<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  type SegmentItem = {
    label: string
    value: string
  }

  interface Props {
    items?: SegmentItem[]
    selected?: string
    onChange?: (value: string) => void
    class?: string
    className?: string
  }

  let {
    items = [],
    selected = '',
    onChange = () => {},
    class: className = ''
  }: Props = $props()

  const radiusClass = (index: number, length: number) => {
    if (index === 0) return 'rounded-l-xl'
    if (index === length - 1) return 'rounded-r-xl'
    return 'rounded-none'
  }

  const gridColsClass = $derived(
    items.length === 2
      ? 'grid-cols-2'
      : items.length === 3
        ? 'grid-cols-3'
        : items.length === 4
          ? 'grid-cols-4'
          : items.length === 5
            ? 'grid-cols-5'
            : 'grid-cols-4'
  )
</script>

<div class={twMerge('grid rounded-lg', gridColsClass, className)}>
  {#each items as item, index}
    <button
      type="button"
      onclick={() => onChange(item.value)}
      class={twMerge(
        'h-11 flex-center text-sm font-medium transition-colors border border-gray-200 bg-white',
        radiusClass(index, items.length),
        selected === item.value
          ? 'bg-primary-50 border-primary-500 text-primary-500'
          : 'hover:bg-gray-50 text-gray-600'
      )}
    >
      {item.label}
    </button>
  {/each}
</div>
