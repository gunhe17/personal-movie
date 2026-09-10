<script lang="ts">
  import type { AlertLevel } from '../constants'
  import { ALERT_CONFIG } from '../constants'

  interface Props {
    level: AlertLevel
    message: string
    anchorId?: string
  }

  let { level, message, anchorId }: Props = $props()

  const config = $derived(ALERT_CONFIG[level])
</script>

{#if level !== 'normal'}
  <div
    class="mb-4 flex items-center gap-2.5 rounded-lg border px-4 py-2.5 transition-colors duration-300
      {config.bg} {config.border}"
  >
    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 {config.bg} {config.text}">
      <span class="h-1.5 w-1.5 rounded-full {config.dot}"></span>
      <span class="text-label-01-normal-medium">{config.label}</span>
    </span>
    <span class="text-body-03-normal-regular text-gray-600">{message}</span>
    {#if anchorId}
      <a
        href="#{anchorId}"
        class="ml-auto shrink-0 text-label-01-normal-medium underline underline-offset-2 {config.text}"
      >
        원인 보기 ↓
      </a>
    {/if}
  </div>
{/if}
