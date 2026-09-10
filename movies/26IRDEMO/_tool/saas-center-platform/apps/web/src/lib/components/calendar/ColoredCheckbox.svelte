<script context="module" lang="ts">
  export function isCheckboxEvent(event: Event): event is Event & {
    currentTarget: EventTarget & HTMLInputElement
  } {
    return !!event.currentTarget
  }
</script>

<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  export let id: string = ''
  export let readonly = false
  export let value: any[] = []
  export let boxClass: string = ''
  export let labelClass: string = ''
  export let checked: boolean = false
  export let checkedClass: string = ''
  export let containerClass: string = ''
  export let isIndeterminate: boolean = false
  export let selectedValue: Set<string> = new Set()

  let inputClass: string
  let isAllSelected: boolean = false
  let indeterminate: boolean = false

  const getCheckboxState = <T extends { id: string }>(
    value: T[],
    selectedValue: Set<string>
  ) => {
    const isAllSelected =
      value.length > 0 && value.every((v) => selectedValue.has(v.id))
    const indeterminate =
      value.some((v) => selectedValue.has(v.id)) && !isAllSelected
    return { isAllSelected, indeterminate }
  }

  const handleSelectAll = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.checked) {
      selectedValue = new Set(value.map((v) => v.id))
    } else {
      selectedValue = new Set()
    }
  }

  $: ({ isAllSelected, indeterminate } = getCheckboxState(value, selectedValue))

  $: inputClass = twMerge(
    'w-5 h-5 rounded-sm appearance-none cursor-pointer bg-white disabled:bg-gray-100',
    'ring-[1.25px] ring-inset ring-gray-300 checked:ring-0 disabled:ring-0 transition duration-300',
    boxClass
  )
</script>

<label
  class={twMerge(
    'flex items-center gap-2',
    'text-gray-700',
    readonly && 'pointer-events-none',
    labelClass
  )}
  for={id}
>
  <div class={twMerge('relative w-5 h-5 flex-center', containerClass)}>
    {#if isIndeterminate}
      <input
        bind:indeterminate
        bind:checked={isAllSelected}
        type="checkbox"
        name=""
        {id}
        style={`background-color: ${isAllSelected ? (checkedClass ? `${checkedClass}` : '#717171') : ''}; `}
        class={inputClass}
        {readonly}
        tabindex={readonly ? -1 : 0}
        on:keyup
        on:keydown
        on:keypress
        on:focus
        on:blur
        on:click={handleSelectAll}
        on:mouseover
        on:mouseenter
        on:mouseleave
        on:paste
        on:change
        {...$$restProps}
      />
    {:else}
      <input
        bind:checked
        type="checkbox"
        name=""
        {id}
        style={`background-color: ${checked ? (checkedClass ? `${checkedClass}` : '#717171') : ''}; `}
        class={inputClass}
        {readonly}
        tabindex={readonly ? -1 : 0}
        on:keyup
        on:keydown
        on:keypress
        on:focus
        on:blur
        on:click
        on:mouseover
        on:mouseenter
        on:mouseleave
        on:paste
        on:change
        {...$$restProps}
      />
    {/if}
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
    >
      <svg
        width="13"
        height="10"
        viewBox="0 0 13 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0.75 5L4.27078 9L11.75 1"
          stroke={checked ? '#FFFFFF' : '#E5E5E5'}
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </div>
  <slot />
</label>
