<script lang="ts">
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { useQueryClient } from '@tanstack/svelte-query'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import Typography from '@common/components/Typography.svelte'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getCenterVoucherDetail } from '$lib/hooks/actions/centerVoucher.action'
  import { centerId } from '$lib/stores/center.store'
  import { hasPermission } from '$lib/stores/permission.view'

  import { createCenterVoucherService } from '$lib/features/voucher/center-voucher/center-voucher-service'
  import { mapToCenterVoucherVM } from '$lib/features/voucher/center-voucher/view-model'

  import CenterVoucherFormModal from '../components/CenterVoucherFormModal.svelte'
  import CenterVoucherDetailPanel from '../components/CenterVoucherDetailPanel.svelte'

  const queryClient = useQueryClient()
  const service = createCenterVoucherService({ queryClient })

  const canWrite = $derived($hasPermission('write:voucher'))
  const canDelete = $derived($hasPermission('delete:voucher'))

  const voucherId = $derived(page.params.voucherId)

  const detailQuery = $derived(
    queryBuilder(getCenterVoucherDetail, () => ({
      centerId: $centerId,
      centerVoucherId: voucherId
    }))
  )

  const item = $derived(
    detailQuery.data?.id ? mapToCenterVoucherVM(detailQuery.data) : null
  )
  const isLoading = $derived(detailQuery.isLoading)

  function backToList() {
    goto('/settings/vouchers')
  }
</script>

<div in:fade class="flex h-full flex-col bg-gray-50">
  <!-- 브레드크럼 — 상세는 페이지 XL 타이틀을 다시 쓰지 않는다(페이지당 XL 하나) -->
  <div class="mb-4 flex h-11 shrink-0 items-center gap-2">
    <button
      onclick={backToList}
      aria-label="뒤로가기"
      class="rounded-lg p-1 transition-colors hover:bg-gray-100"
    >
      <ArrowBackIcon />
    </button>

    <button
      onclick={backToList}
      class="transition-colors hover:text-body-default"
    >
      <Typography
        variant="body-02-normal-regular"
        tag="span"
        color="text-body-subtle"
      >
        바우처 관리
      </Typography>
    </button>
    {#if item}
      <Typography
        variant="body-02-normal-regular"
        tag="span"
        color="text-gray-300"
      >
        /
      </Typography>
      <Typography
        variant="body-02-normal-medium"
        tag="span"
        color="text-body-default"
      >
        {item.catalogName}
      </Typography>
    {/if}
  </div>

  <!-- 상세 카드 — 콘텐츠 컨테이너(radius 16 · border-gray-200 · shadow-card).
       내부 여백은 상단만 20, 좌·우·하단은 컨테이너 표준 24(디자이너 지정) -->
  <section
    class="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white px-6 pt-5 pb-6 shadow-card"
  >
    {#if item}
      <CenterVoucherDetailPanel
        {item}
        {canWrite}
        {canDelete}
        onEdit={(v) => service.openEditModal(CenterVoucherFormModal, v)}
        onDelete={(v) => service.openDeleteConfirm(v, backToList)}
        onToggleActive={(v) => service.toggleActive(v)}
      />
    {:else if isLoading}
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-400"
        className="block py-10 text-center"
      >
        불러오는 중...
      </Typography>
    {:else}
      <NoDataSection description="바우처를 찾을 수 없어요" />
    {/if}
  </section>
</div>
