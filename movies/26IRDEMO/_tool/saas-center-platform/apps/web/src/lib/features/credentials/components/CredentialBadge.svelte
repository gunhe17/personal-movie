<!--
  CredentialBadge
  항목 단위의 검증 상태 배지 (점 + 라벨)

  사용:
    <CredentialBadge status="verified" />
    <CredentialBadge status="rejected" rejectReason="..." />
-->
<script lang="ts">
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import { VERIFICATION_BADGE_TONE, VERIFICATION_LABELS } from '../constants'
  import type { VerificationStatus } from '$lib/hooks/actions/credential.action'

  interface Props {
    status: VerificationStatus
    rejectReason?: string | null
    /** 점만 표시할지 (라벨 숨김) */
    iconOnly?: boolean
  }

  let { status, rejectReason = null, iconOnly = false }: Props = $props()

  const tone = $derived(VERIFICATION_BADGE_TONE[status])
  const label = $derived(VERIFICATION_LABELS[status])
  const showTooltip = $derived(status === 'rejected' && !!rejectReason)
</script>

{#if showTooltip}
  <Tooltip text={`반려 사유: ${rejectReason}`}>
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {tone.bg} {tone.text}"
    >
      <span class="h-1.5 w-1.5 rounded-full {tone.dot}"></span>
      {#if !iconOnly}{label}{/if}
    </span>
  </Tooltip>
{:else}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {tone.bg} {tone.text}"
  >
    <span class="h-1.5 w-1.5 rounded-full {tone.dot}"></span>
    {#if !iconOnly}{label}{/if}
  </span>
{/if}
