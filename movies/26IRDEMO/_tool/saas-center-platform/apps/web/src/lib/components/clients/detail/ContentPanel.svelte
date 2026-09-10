<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import TabBar from '$lib/components/TabBar.svelte'
  import Typography from '@common/components/Typography.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import DocumentsTab from './DocumentsTab.svelte'
  import VoucherDetailPanel from './VoucherDetailPanel.svelte'
  import VoucherGridCard from './VoucherGridCard.svelte'
  import ClientCaseHistoryTab from '$lib/features/clients/detail/components/ClientCaseHistoryTab.svelte'
  import {
    DETAIL_TABS,
    HIDDEN_DETAIL_TABS,
    type DetailTab
  } from '$lib/features/clients/detail'
  import type { ClientVoucherCardVM } from '$lib/features/clients/detail/voucher'
  import type { ClientDocumentItem } from '$lib/types/client'

  interface Props {
    activeTab: DetailTab
    clientId: string
    // 문서관리 props
    documents: ClientDocumentItem[]
    onDocumentUpload: () => void
    onDocumentPreview: (doc: ClientDocumentItem) => void
    onDocumentDownload: (doc: ClientDocumentItem) => void
    onDocumentDelete: (doc: ClientDocumentItem) => void
    // 바우처 props
    vouchers: ClientVoucherCardVM[]
    selectedVoucher: ClientVoucherCardVM | null
    hasVouchers: boolean
    onVoucherSelect: (id: string) => void
    onVoucherClear: () => void
    onVoucherCreate: () => void
  }

  let {
    activeTab = $bindable(),
    clientId,
    documents,
    onDocumentUpload,
    onDocumentPreview,
    onDocumentDownload,
    onDocumentDelete,
    vouchers,
    selectedVoucher,
    hasVouchers,
    onVoucherSelect,
    onVoucherClear,
    onVoucherCreate
  }: Props = $props()

  // 사전기록지는 좌측 카드 버튼으로 진입 → 탭바에서는 숨김
  const visibleTabs = $derived(
    DETAIL_TABS.filter((t) => !HIDDEN_DETAIL_TABS.includes(t.value))
  )
</script>

<section
  class="rounded-2xl border flex flex-col bg-white border-gray-200 overflow-hidden p-6 pt-3 xl:min-h-0"
>
  <TabBar tabs={visibleTabs} bind:activeTab tabClass="xl:w-[140px] xl:px-0" />

  <!-- 탭 바디 — 좌우·하단은 카드 패딩(p-6)이 담당, 탭바↔콘텐츠 간격만 20 -->
  <div class="flex-1 overflow-y-auto overscroll-contain pt-5">
    {#if activeTab === 'history'}
      <ClientCaseHistoryTab {clientId} />
    {:else if activeTab === 'documents'}
      <div in:fade class="h-full">
        <DocumentsTab
          {documents}
          onUploadClick={onDocumentUpload}
          onPreviewClick={onDocumentPreview}
          onDownloadClick={onDocumentDownload}
          onDeleteClick={onDocumentDelete}
        />
      </div>
    {:else if activeTab === 'vouchers'}
      <div in:fade class="h-full">
        {#if selectedVoucher}
          <!-- 상세 (목록에서 카드 선택 시): 오른쪽에서 밀려 들어옴 -->
          <div in:fly={{ x: 24, duration: 220 }}>
            <VoucherDetailPanel
              voucher={selectedVoucher}
              onBack={onVoucherClear}
            />
          </div>
        {:else if hasVouchers}
          <!-- @container — 케어보드 도크가 열리면 컨테이너가 360 줄어드는데,
               뷰포트 기준(xl:)은 그걸 모른 채 2열을 고집해 카드 폭이 반토막 난다.
               열 전환을 컨테이너 폭으로 판정해 좁아지면 스스로 1열이 된다. -->
          <div in:fly={{ x: -24, duration: 220 }} class="@container">
            <!-- 카운트 + 액션 행 — 문서 탭·회기 상세와 동일 규격 -->
            <div class="flex items-center justify-between pb-3">
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                총 {vouchers.length}개의 바우처가 있어요
              </Typography>
              <button
                type="button"
                onclick={onVoucherCreate}
                class="inline-flex h-10 min-w-[110px] items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 text-gray-600 transition-colors hover:bg-gray-200"
              >
                <PlusIcon20 />
                <Typography
                  variant="body-02-normal-medium"
                  color="text-gray-600"
                  tag="span"
                >
                  바우처 연결
                </Typography>
              </button>
            </div>
            <!-- 바우처 카드 그리드 — 2열 기준을 640으로 낮춘다.
                 케어보드가 열리면 이 컨테이너가 694~750으로 줄어 960 기준에서는
                 1열로 떨어지고, 카드 하나가 가로로 길게 늘어난다 -->
            <div class="@[640px]:grid-cols-2 grid grid-cols-1 gap-3">
              {#each vouchers as voucher (voucher.id)}
                <VoucherGridCard {voucher} onSelect={onVoucherSelect} />
              {/each}
            </div>
          </div>
        {:else}
          <NoDataSection description="발급된 바우처가 없어요">
            {#snippet actions()}
              <button
                onclick={onVoucherCreate}
                class="h-12 w-40 rounded-lg bg-gray-100 text-body-01-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                바우처 연결하기
              </button>
            {/snippet}
          </NoDataSection>
        {/if}
      </div>
    {/if}
  </div>
</section>
