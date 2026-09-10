<script lang="ts">
  import NotiRow from './NotiRow.svelte'
  import NotiSection from './NotiSection.svelte'

  type AlertType = 'danger' | 'warning' | 'info'

  type AlertItem = {
    title: string
    description?: string
    time: string
    type?: AlertType
    actions?: { label: string; variant?: 'primary' | 'outline' }[]
  }

  export let urgentAlerts: AlertItem[] = []
  export let todayAlerts: AlertItem[] = []
  export let infoAlerts: AlertItem[] = []
</script>

<div class="flex items-center justify-between px-2 mb-4">
  <div class="flex items-center gap-2 font-semibold text-gray-900">
    관리 알림
  </div>
  <span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
    {urgentAlerts.length + todayAlerts.length + infoAlerts.length}
  </span>
</div>

<!-- 긴급 -->
{#if urgentAlerts.length}
  <NotiSection title="긴급 (즉시 처리)" color="red">
    {#each urgentAlerts as alert}
      <NotiRow {alert} />
    {/each}
  </NotiSection>
{/if}

<!-- 오늘 -->
{#if todayAlerts.length}
  <NotiSection title="일반 (오늘 처리)" color="yellow">
    {#each todayAlerts as alert}
      <NotiRow {alert} />
    {/each}
  </NotiSection>
{/if}

<!-- 정보 -->
{#if infoAlerts.length}
  <NotiSection title="정보">
    {#each infoAlerts as alert}
      <NotiRow {alert} />
    {/each}
  </NotiSection>
{/if}
