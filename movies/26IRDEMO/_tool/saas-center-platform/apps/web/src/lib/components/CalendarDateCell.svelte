<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    date: Date
    selectedDate: Date
    disabled?: boolean
  }

  let { date, selectedDate = $bindable(), disabled = false }: Props = $props()

  const isSameDate = (date1: Date | null, date2: Date): boolean => {
    if (!date1) return false
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    )
  }

  let isToday = $derived(isSameDate(date, new Date()))
  let isSelected = $derived(selectedDate && isSameDate(date, selectedDate))
</script>

<button
  {disabled}
  onclick={() => (selectedDate = date)}
  class="flex h-13 flex-col items-center justify-start gap-1"
>
  <div
    class="flex h-9 w-9 items-center justify-center rounded-full {isSelected
      ? 'bg-primary-500'
      : !disabled && 'hover:bg-gray-100'}"
  >
    <Typography
      variant="body-01-medium"
      color={disabled
        ? 'text-gray-200'
        : isSelected
          ? 'text-white'
          : date?.getDay() === 0
            ? 'text-status-danger'
            : date.getDay() === 6
              ? 'text-primary-500'
              : 'text-gray-800'}
    >
      {date?.getDate()}
    </Typography>
  </div>
  {#if isToday}
    <Typography
      variant="body-03-medium"
      color={isSelected ? 'text-primary-500' : 'text-gray-500'}
    >
      오늘
    </Typography>
  {/if}
</button>
