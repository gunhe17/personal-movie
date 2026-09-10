<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'

  interface Props {
    value: number
    textColor?: string
    duration?: number // ms
  }

  let { value, textColor = 'text-gray-900', duration = 1000 }: Props = $props()

  let displayValue = $state(0)
  let startTime: number | null = null
  let rafId: number

  const animate = (time: number) => {
    if (startTime === null) startTime = time

    const elapsed = time - startTime
    const progress = Math.min(elapsed / duration, 1)

    displayValue = Math.floor(progress * value)

    if (progress < 1) {
      rafId = requestAnimationFrame(animate)
    }
  }

  onMount(() => {
    rafId = requestAnimationFrame(animate)
  })

  onDestroy(() => {
    if (browser) cancelAnimationFrame(rafId)
  })
</script>

<Typography variant="headline-01" color={textColor}>
  {displayValue.toLocaleString()}
</Typography>
