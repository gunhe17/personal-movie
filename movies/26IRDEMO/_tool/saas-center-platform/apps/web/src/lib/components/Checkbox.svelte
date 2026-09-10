<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  interface Props {
    id: string
    readonly?: boolean
    boxClass?: string
    labelClass?: string
    checked?: boolean
    disabled?: boolean
    checkedClass?: string
    containerClass?: string
    onchange?: (checked: boolean) => void
    onclick?: (e: MouseEvent) => void
  }

  let {
    id,
    readonly = false,
    boxClass = '',
    labelClass = '',
    checked = $bindable(false),
    disabled = false,
    checkedClass = '',
    containerClass = '',
    onchange,
    onclick
  }: Props = $props()

  let inputClass = $derived(
    twMerge(
      'w-5 h-5 rounded-sm appearance-none cursor-pointer bg-white disabled:bg-gray-100 disabled:cursor-not-allowed',
      'ring-[1.5px] ring-inset ring-gray-200 checked:ring-0 disabled:ring-0 duration-300',
      boxClass
    )
  )

  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement
    checked = target.checked
    onchange?.(checked)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<label
  class={twMerge(
    'flex items-center gap-2',
    'text-gray-700',
    readonly && 'pointer-events-none',
    labelClass
  )}
  for={id}
  onclick={(e) => {
    e.stopPropagation()
    onclick?.(e)
  }}
>
  <div class={twMerge('flex-center relative h-5 w-5', containerClass)}>
    <input
      {checked}
      type="checkbox"
      name=""
      {id}
      {disabled}
      style={`background-color: ${checked ? (checkedClass ? `${checkedClass}1A` : '#4c87f6') : ''}; `}
      class={inputClass}
      {readonly}
      tabindex={readonly ? -1 : 0}
      onchange={handleChange}
    />
    <div
      class={twMerge(
        'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
      )}
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
          stroke={checked ? (checkedClass ? checkedClass : '#FFFFFF') : ''}
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </div>
</label>
