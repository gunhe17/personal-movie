<script lang="ts">
  import ProgramInfoPanel from './ProgramInfoPanel.svelte'
  import Tooltip from '../common/Tooltip.svelte'
  import type {
    CaseClient,
    CounselingCaseBaseDetail,
    CounselingSession
  } from '$lib/types/counseling'

  type PackageBillingEntry = {
    state: 'none' | 'pending' | 'completed'
    billableId?: string
    disabled: boolean
  }

  interface Props {
    closePanel: () => void
    panelId?: string
    counselingDetail: CounselingCaseBaseDetail
    counselingClients: CaseClient[]
    isSecretMode: boolean
    counselingSessions: CounselingSession[]
    selectedSessionId: string | null
    onSessionSelect?: (sessionId: string) => void
    packageBillingMap?: Record<string, PackageBillingEntry>
    canWriteBilling?: boolean
    canReadBilling?: boolean
    onPackageBilling?: (clientId: string) => void
    onOpenAnalysis?: () => void
  }

  let {
    closePanel,
    counselingDetail,
    counselingClients,
    isSecretMode,
    counselingSessions,
    selectedSessionId,
    onSessionSelect,
    packageBillingMap,
    canWriteBilling,
    canReadBilling,
    onPackageBilling,
    onOpenAnalysis
  }: Props = $props()
</script>

<div class="flex h-full flex-col">
  <!-- 헤더 -->
  <div
    class="flex items-center justify-between px-5 py-4 border-b border-gray-200"
  >
    <span class="text-lg font-semibold">상담 정보</span>
    <Tooltip text="닫기">
      <button
        onclick={closePanel}
        class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="패널 닫기"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 5L5 15M5 5l10 10"
            stroke="#6B7280"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </Tooltip>
  </div>

  <!-- 콘텐츠 -->
  <div class="flex-1 overflow-y-auto [&>*]:!w-full [&>*]:!shrink">
    <ProgramInfoPanel
      {counselingDetail}
      {counselingClients}
      {isSecretMode}
      {counselingSessions}
      {selectedSessionId}
      {onSessionSelect}
      {packageBillingMap}
      {canWriteBilling}
      {canReadBilling}
      {onPackageBilling}
      {onOpenAnalysis}
      embedded
    />
  </div>
</div>
