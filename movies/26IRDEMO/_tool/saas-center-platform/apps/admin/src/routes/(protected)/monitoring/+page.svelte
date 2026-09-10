<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { fade } from 'svelte/transition'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  interface Dashboard {
    id: string
    label: string
    uid: string
    /** Grafana URL 쿼리 파라미터 (namespace 필터 등) */
    params?: string
  }

  const dashboards: Dashboard[] = [
    {
      id: 'cluster',
      label: '서비스 현황',
      uid: 'mindscope-cluster-overview'
    },
    {
      id: 'logs',
      label: '로그',
      uid: '3574375a-be79-454a-99ad-1ad1878001dc'
    }
  ]

  let activeDashboard = $state<string>(dashboards[0].id)
  let iframeLoading = $state(true)
  let iframeError = $state(false)

  // Grafana URL 조합 (kiosk 모드 + 테마)
  const grafanaUrl = $derived(() => {
    const base = data.grafanaUrl
    const dashboard = dashboards.find((d) => d.id === activeDashboard)
    if (!dashboard) return base

    const path = dashboard.uid ? `/d/${dashboard.uid}` : ''
    const extra = dashboard.params ? `&${dashboard.params}` : ''
    return `${base}${path}?kiosk&theme=light${extra}`
  })

  function onIframeLoad() {
    iframeLoading = false
    iframeError = false
  }

  function onIframeError() {
    iframeLoading = false
    iframeError = true
  }

  function openGrafanaDirect() {
    window.open(data.grafanaUrl, '_blank')
  }
</script>

<div in:fade class="flex h-[calc(100vh-2rem)] flex-col p-6">
  <PageHeader
    title="성능 모니터링"
    description="시스템 성능 및 인프라 상태를 실시간으로 모니터링합니다"
  >
    {#snippet actions()}
      <button
        onclick={openGrafanaDirect}
        class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        Grafana 열기
      </button>
    {/snippet}
  </PageHeader>

  <!-- 대시보드 탭 -->
  <div class="mb-4 flex items-center border-b border-gray-200">
    {#each dashboards as dashboard}
      <button
        onclick={() => {
          activeDashboard = dashboard.id
          iframeLoading = true
          iframeError = false
        }}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors
          {activeDashboard === dashboard.id
          ? 'text-primary-700'
          : 'text-gray-500 hover:text-gray-700'}"
      >
        {dashboard.label}
        {#if activeDashboard === dashboard.id}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full"></div>
        {/if}
      </button>
    {/each}
  </div>

  <!-- iframe 컨테이너 -->
  <div class="relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
    {#if iframeLoading}
      <div class="absolute inset-0 z-10 flex items-center justify-center bg-white">
        <div class="flex flex-col items-center gap-3">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600"></div>
          <p class="text-sm text-gray-500">대시보드를 불러오는 중...</p>
        </div>
      </div>
    {/if}

    {#if iframeError}
      <div class="absolute inset-0 z-10 flex items-center justify-center bg-white">
        <div class="flex flex-col items-center gap-4">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <svg class="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <div class="text-center">
            <p class="text-lg font-semibold text-gray-800">연결할 수 없습니다</p>
            <p class="mt-1 text-sm text-gray-500">
              Grafana 서버에 접근할 수 없습니다. 모니터링 스택이 배포되었는지 확인해주세요.
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              onclick={() => {
                iframeError = false
                iframeLoading = true
              }}
              class="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              다시 시도
            </button>
            <button
              onclick={openGrafanaDirect}
              class="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              직접 접속
            </button>
          </div>
        </div>
      </div>
    {/if}

    <iframe
      src={grafanaUrl()}
      title="Grafana Dashboard"
      class="h-full w-full border-0"
      onload={onIframeLoad}
      onerror={onIframeError}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    ></iframe>
  </div>
</div>
