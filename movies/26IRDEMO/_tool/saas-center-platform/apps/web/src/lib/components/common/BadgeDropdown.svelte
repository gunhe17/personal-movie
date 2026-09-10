<script lang="ts">
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { portal } from '../../utils/positionPortal'
  import Typography from '@common/components/Typography.svelte'
  import { twMerge } from 'tailwind-merge'

  interface Option {
    value: string
    label: string
  }

  interface Props {
    options: Option[]
    value: string
    onChange?: (value: string) => void
    disabled?: boolean
    /** 편집 가능 여부 (기본 true). false면 드롭다운 비활성 */
    editable?: boolean
    /** 외부에서 배지 색상 클래스 직접 주입 (없으면 내장 switch 사용) */
    badgeClass?: string
    /** 칩에 표시할 문구 (있으면 options의 선택값 대신 사용, 드롭다운에는 options만 표시) */
    displayLabel?: string
    /** displayLabel 사용 시 배지 스타일용 값 (예: status) */
    displayValue?: string
  }

  let {
    options,
    value,
    onChange,
    disabled = false,
    editable = true,
    badgeClass,
    displayLabel,
    displayValue
  }: Props = $props()

  const isEditable = $derived(editable && !disabled)

  let isOpen = $state(false)
  let containerRef: HTMLButtonElement | undefined = $state()

  const selectedOption = $derived(options.find((opt) => opt.value === value))
  /** 칩에 보여줄 라벨: displayLabel이 있으면 그대로, 없으면 선택된 옵션 라벨 */
  const chipLabel = $derived(displayLabel ?? selectedOption?.label ?? '')
  /** 배지 스타일 적용에 쓸 값 (displayValue 우선) */
  const badgeValue = $derived(displayValue ?? selectedOption?.value ?? value)

  /** 배지 색상 클래스: 외부 주입(badgeClass) 우선, 없으면 내장 switch */
  const defaultBadgeClass = $derived(() => {
    switch (badgeValue) {
      case 'pending':
        return 'bg-[#eaf4ff] text-[#3498db]'
      case 'in_progress':
        return 'bg-[#fff6e8] text-[#f39c12]'
      case 'completed':
        return 'bg-[#e9faeb] text-[#27ae60]'
      case 'cancelled':
      case 'refused':
        return 'bg-[#ffebeb] text-[#e74c3c]'
      case 'scheduled':
        return 'bg-[#49AAEF1A] text-[#49AAEF]'
      default:
        return 'bg-[#eaf4ff] text-[#3498db]'
    }
  })
  const statusBadgeClass = $derived(badgeClass ?? defaultBadgeClass())
  /** Typography에 전달할 텍스트 색상만 추출 */
  const textColorClass = $derived(
    statusBadgeClass
      .split(' ')
      .filter((c) => c.startsWith('text-'))
      .join(' ')
  )

  function handleToggle() {
    if (!isEditable) return
    isOpen = !isOpen
  }

  function handleSelect(optionValue: string) {
    onChange?.(optionValue)
    isOpen = false
  }
</script>

<button
  type="button"
  bind:this={containerRef}
  onclick={handleToggle}
  disabled={!isEditable}
  class={twMerge(
    'h-8 min-w-20 flex items-center justify-between rounded-md whitespace-nowrap',
    isEditable ? 'px-2 gap-1.5' : 'px-2',
    statusBadgeClass
  )}
>
  <Typography variant="body-03-normal-medium" color={textColorClass}>
    {chipLabel}
  </Typography>
  {#if !disabled}
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 6L8 10L4 6"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
</button>
{#if isOpen}
  <div
    transition:slide={{ duration: 150, easing: quintOut }}
    use:portal={{
      anchor: containerRef,
      isFitWidth: true,
      callback: () => {
        isOpen = false
      }
    }}
    class="dropdown-panel z-50"
  >
    {#each options as option (option.value)}
      <button
        type="button"
        onclick={() => handleSelect(option.value)}
        class="dropdown-item {option.value === value
          ? 'is-selected cursor-default'
          : ''}"
      >
        {option.label}
      </button>
    {/each}
  </div>
{/if}
