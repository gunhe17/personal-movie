<script lang="ts">
  /**
   * 체크박스 — 브라우저 기본 `<input type="checkbox">` 대신 쓴다.
   *
   * 기본 체크박스는 OS·브라우저마다 모양·크기·색이 달라 디자인 시스템 안에서
   * 혼자 튄다. `accent-color`로는 테두리·라운드·크기를 맞출 수 없다.
   *
   * 골격은 `Switch`와 같은 방식이다 — 진짜 input이 아니라 button에
   * `role="checkbox"`를 준다. 접근성은 `aria-checked`가 담당한다.
   */
  import { twMerge } from 'tailwind-merge'
  import Check from '$lib/assets/icons/Check.svelte'

  interface Props {
    checked?: boolean
    disabled?: boolean
    /** 오른쪽에 붙는 설명 — 없으면 상자만 그린다 */
    label?: string
    ariaLabel?: string
    class?: string
    onchange?: (checked: boolean) => void
  }

  let {
    checked = $bindable(false),
    disabled = false,
    label = '',
    ariaLabel = '',
    class: className = '',
    onchange
  }: Props = $props()

  function toggle() {
    if (disabled) return
    checked = !checked
    onchange?.(checked)
  }
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  aria-label={ariaLabel || label}
  {disabled}
  onclick={toggle}
  class={twMerge(
    'inline-flex items-center gap-1.5',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    className
  )}
>
  <span
    class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {checked
      ? 'border-primary-500 bg-primary-500 text-white'
      : 'border-gray-300 bg-white'} {disabled ? '' : 'hover:border-primary-400'}"
  >
    {#if checked}
      <Check size={12} />
    {/if}
  </span>
  {#if label}
    <span class="text-label-02-normal-medium text-gray-600 select-none">
      {label}
    </span>
  {/if}
</button>
