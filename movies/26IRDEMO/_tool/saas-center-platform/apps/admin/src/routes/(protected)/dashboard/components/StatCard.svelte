<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$lib/components/Typography.svelte'

  interface Props {
    label: string
    value?: number
    isPending?: boolean
    /** alert=true면 빨간 ping 뱃지 표시 */
    alert?: boolean
    href: string
    colorBg: string
    colorText: string
    icon: 'building' | 'check-circle' | 'clock' | 'chat' | 'memo' | 'user-shield'
  }

  let { label, value, isPending = false, alert = false, href, colorBg, colorText, icon }: Props = $props()
</script>

<button
  class="section-border group relative flex flex-col gap-3 p-4 text-left transition-all hover:shadow-md {alert ? 'border-red-300! bg-red-50/40!' : ''}"
  onclick={() => goto(href)}
>
  <!-- 알림 ping 뱃지 -->
  {#if alert}
    <span class="absolute right-3 top-3 flex h-2 w-2">
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
      <span class="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
    </span>
  {/if}

  <!-- 아이콘 -->
  <div class="flex h-9 w-9 items-center justify-center rounded-xl {colorBg} {colorText}">
    {#if icon === 'building'}
      <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    {:else if icon === 'check-circle'}
      <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    {:else if icon === 'clock'}
      <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    {:else if icon === 'chat'}
      <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    {:else if icon === 'memo'}
      <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    {:else if icon === 'user-shield'}
      <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    {/if}
  </div>

  <!-- 텍스트 -->
  <div>
    <Typography variant="body-03-normal-regular" color="text-gray-500">{label}</Typography>
    {#if isPending}
      <div class="mt-1 h-7 w-14 animate-pulse rounded-md bg-gray-200"></div>
    {:else}
      <p class="mt-0.5 text-2xl font-bold tabular-nums {alert ? 'text-red-600' : 'text-gray-900'}">{value ?? '—'}</p>
    {/if}
  </div>
</button>
