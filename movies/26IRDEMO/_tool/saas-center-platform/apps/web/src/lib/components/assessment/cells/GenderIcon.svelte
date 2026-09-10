<script lang="ts">
  import type { Gender } from '$lib/types/assessmentStatus'

  interface Props {
    gender: Gender
    size?: number
  }

  let { gender, size = 20 }: Props = $props()
</script>

{#if gender === 'female'}
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="7" r="4" stroke="#FF6B9D" stroke-width="1.5" />
    <path
      d="M10 11V17M8 14H12"
      stroke="#FF6B9D"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>
{:else}
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="8" cy="12" r="4" stroke="#4A9EFF" stroke-width="1.5" />
    <path
      d="M11 9L15 5M15 5H12M15 5V8"
      stroke="#4A9EFF"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/if}
