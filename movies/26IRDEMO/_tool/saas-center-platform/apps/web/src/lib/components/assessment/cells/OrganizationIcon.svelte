<script lang="ts">
  import type { OrganizationType } from '$lib/types/assessmentStatus'

  interface Props {
    type: OrganizationType
    size?: number
  }

  let { type, size = 20 }: Props = $props()
</script>

{#if type === 'school'}
  <!-- 학교 아이콘 -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    class="text-primary-400"
  >
    <path
      d="M10 2L2 7L10 12L18 7L10 2Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
    <path
      d="M4 9V14L10 18L16 14V9"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
{:else}
  <!-- 기관/개인 아이콘 -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    class="text-primary-400"
  >
    <rect
      x="3"
      y="4"
      width="14"
      height="14"
      rx="2"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <path
      d="M7 8H13M7 12H13"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>
{/if}
