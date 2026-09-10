<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { twMerge } from 'tailwind-merge'

  export let today: Date
  export let day: number
  export let year: number
  export let month: number
  export let selectedDate: Date | null
  export let isOtherMonth: boolean = false
  export let selectDate:
    | ((event: MouseEvent, day: number) => void)
    | undefined = undefined

  $: dateToCheck = new Date(year, month, day + 1)
  $: isToday = dateToCheck.toDateString() === today.toDateString()
</script>

<button
  on:click={(event) => selectDate && selectDate(event, day + 1)}
  on:contextmenu|preventDefault={(event) =>
    selectDate && selectDate(event, day + 1)}
  class="flex-center min-w-10 min-h-10"
>
  <div
    class={twMerge(
      'flex-center w-8 h-8 rounded-full',
      selectedDate &&
        selectedDate.getDate() === day + 1 &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year
        ? 'bg-primary text-white transition'
        : ''
    )}
  >
    <div class="relative text-center">
      <Typography
        variant="body-02-medium"
        className="group-hover:scale-110 duration-200"
        color={isOtherMonth ? 'text-gray-400' : ''}
      >
        {day + 1}
      </Typography>
      {#if isToday}
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <div
          class="absolute w-1 h-1 rounded-full bg-primary left-1/2 -translate-x-1/2"
        />
      {/if}
    </div>
  </div>
</button>
