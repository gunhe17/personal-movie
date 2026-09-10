<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  interface Option {
    label: string
    value: string
  }

  interface Props {
    options: [Option, Option]
    value: string
    onchange?: (value: string) => void
    fullWidth?: boolean
  }

  let {
    options,
    value = $bindable(),
    onchange,
    fullWidth = false
  }: Props = $props()

  function handleSelect(selectedValue: string) {
    value = selectedValue
    onchange?.(selectedValue)
  }
</script>

<div class="flex h-12 {fullWidth ? 'w-full' : 'w-fit'}">
  {#each options as option, index}
    <button
      type="button"
      onclick={() => handleSelect(option.value)}
      class="flex h-full {fullWidth
        ? 'flex-1'
        : 'w-30'} items-center justify-center border transition-colors duration-200
				{index === 0 ? 'rounded-l-xl' : 'rounded-r-xl'}
				{value === option.value
        ? 'border-primary-400 bg-primary-50'
        : 'border-gray-200 bg-white'}"
    >
      <Typography
        variant="body-01-medium"
        color={value === option.value ? 'text-primary-500' : 'text-gray-400'}
      >
        {option.label}
      </Typography>
    </button>
  {/each}
</div>
