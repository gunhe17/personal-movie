<script lang="ts">
  import Typography, {
    type TypographyVariant
  } from '@common/components/Typography.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'

  type SelectableOption = string | { value: string; label: string }

  interface Props {
    label: string
    required?: boolean
    labelVariant?: TypographyVariant
    /** 라벨↔콘텐츠 간격 — 폼 라벨 규격은 mb-2(8) */
    labelClass?: string
    options: SelectableOption[]
    selected: string | string[]
    multiple?: boolean
    onSelect: (value: string) => void
    addButtonLabel?: string
    onAdd?: () => void
    showLabel?: boolean
    /** 유효성 검증 에러 상태 (빨간 border 표시) */
    hasError?: boolean
  }

  let {
    label,
    required = false,
    labelVariant = 'body-02-normal-medium' as TypographyVariant,
    labelClass = 'mb-3',
    options,
    selected,
    multiple = false,
    onSelect,
    addButtonLabel,
    onAdd,
    showLabel = true,
    hasError = false
  }: Props = $props()

  function getOptionValue(option: SelectableOption): string {
    return typeof option === 'string' ? option : option.value
  }

  function getOptionLabel(option: SelectableOption): string {
    return typeof option === 'string' ? option : option.label
  }

  function isSelected(option: SelectableOption): boolean {
    const value = getOptionValue(option)
    if (multiple && Array.isArray(selected)) {
      return selected.includes(value)
    }
    return selected === value
  }
</script>

<div>
  {#if showLabel}
    <Typography
      variant={labelVariant}
      color="text-body-default"
      className={labelClass}
    >
      {label}
      {#if required}
        <span class="field-required">*</span>
      {/if}
    </Typography>
  {/if}
  <!-- 칩 규격 정본 = MemberChip(담당자 칩) — 높이 48 · radius 12 · 좌우 20 ·
       radius 8(한 줄 칩) · 레이블 Body_02/Normal-Regular(15) · text-body-default(전 상태 공통).
       장소와 담당자는 같은 폼의 같은 "고르는 칩"이라 한쪽만 바꾸지 않는다. -->
  <div class="flex flex-wrap gap-2">
    {#each options as option}
      <button
        type="button"
        onclick={() => onSelect(getOptionValue(option))}
        class="rounded-lg border h-12 min-w-20 px-5 text-body-02-normal-regular text-body-default transition-colors {isSelected(
          option
        )
          ? 'border-border-active bg-brand-subtle'
          : 'border-border-default bg-white hover:bg-gray-50'}"
      >
        {getOptionLabel(option)}
      </button>
    {/each}
    {#if addButtonLabel && onAdd}
      <button
        type="button"
        onclick={onAdd}
        class="flex h-12 items-center gap-2 rounded-lg border border-dashed border-border-strong px-5 text-body-02-normal-regular text-action-primary transition-colors hover:bg-gray-100"
      >
        <PlusIcon20 />
        {addButtonLabel}
      </button>
    {/if}
  </div>
</div>
