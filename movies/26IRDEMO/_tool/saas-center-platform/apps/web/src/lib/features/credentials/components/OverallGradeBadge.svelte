<!--
  OverallGradeBadge
  종합 인증 등급 배지 (마이페이지 상단/멤버 카드)

  사용:
    <OverallGradeBadge {credentials} />
-->
<script lang="ts">
  import type { Credential } from '$lib/hooks/actions/credential.action'
  import { computeOverallGrade } from '../view-model'

  interface Props {
    credentials: Credential[]
    /** 라벨 숨기고 점만 표시 */
    iconOnly?: boolean
  }

  let { credentials, iconOnly = false }: Props = $props()

  const vm = $derived(computeOverallGrade(credentials))
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset {vm
    .tone.bg} {vm.tone.text} {vm.tone.ring}"
  aria-label={`인증 등급: ${vm.label}`}
>
  {#if vm.grade === 'verified'}
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.41 0z"
        clip-rule="evenodd"
      />
    </svg>
  {:else}
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
  {/if}
  {#if !iconOnly}{vm.label}{/if}
</span>
