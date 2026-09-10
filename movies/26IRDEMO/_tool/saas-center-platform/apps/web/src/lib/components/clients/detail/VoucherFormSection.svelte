<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import { modalStore, modalUtils } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { formatUtcToKst } from '$lib/utils/date'
  import {
    getFormTemplates,
    getVoucherFormInstances,
    postLinkVoucherFormInstance,
    deleteVoucherFormInstance,
    type ClientFormInstanceItem
  } from '$lib/hooks/actions/form.action'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import TemplateSearchModal from './TemplateSearchModal.svelte'

  interface Props {
    clientVoucherId: string
  }

  let { clientVoucherId }: Props = $props()

  const queryClient = useQueryClient()

  // ── 쿼리 ──
  const instancesQuery = $derived(
    queryBuilder(
      getVoucherFormInstances,
      () => ({ centerId: $centerId, clientVoucherId }),
      { enabled: browser && !!$centerId && !!clientVoucherId }
    )
  )

  const templatesQuery = $derived(
    queryBuilder(getFormTemplates, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )

  const items = $derived(instancesQuery.data?.items ?? [])
  const templateNames = $derived(
    new Map((templatesQuery.data?.items ?? []).map((t) => [t.id, t.name]))
  )

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['getVoucherFormInstances'],
      exact: false
    })
    // 내담자 매핑에도 같이 걸리므로 문서관리 탭 쪽 목록도 갱신
    queryClient.invalidateQueries({
      queryKey: ['getClientFormInstances'],
      exact: false
    })
  }

  function openTemplateSearchModal() {
    // 검색형 서식 선택 모달 — 선택 즉시 발급+연결, 실패 시 throw로 모달 유지
    modalStore.open({
      component: TemplateSearchModal,
      props: {
        onSelect: async (template: { id: string; name: string }) => {
          try {
            await postLinkVoucherFormInstance().request({
              centerId: requireCenterId(),
              clientVoucherId,
              templateId: template.id
            })
            snackbarStore.success(`"${template.name}" 문서가 연결되었어요`)
            invalidate()
          } catch (err) {
            console.error('[postLinkVoucherFormInstance] failed', err)
            snackbarStore.error('문서 연결에 실패했어요')
            throw err
          }
        }
      },
      options: { size: 'md' }
    })
  }

  async function handleUnlink(item: ClientFormInstanceItem) {
    const name = templateNames.get(item.instance.template_id) ?? '문서'
    const confirmed = await modalUtils.confirm(
      '연결을 해제할까요?',
      `"${name}" 문서의 바우처 연결만 해제돼요. 작성본은 내담자 문서에 남아요.`,
      { type: 'warning', confirmText: '해제', cancelText: '취소' }
    )
    if (!confirmed) return

    try {
      await deleteVoucherFormInstance().request({
        centerId: requireCenterId(),
        clientVoucherId,
        mappingId: item.mapping_id
      })
      snackbarStore.success('연결이 해제되었어요')
      invalidate()
    } catch (err) {
      console.error('[deleteVoucherFormInstance] failed', err)
      snackbarStore.error('연결 해제에 실패했어요')
    }
  }

  const fmtDate = (iso: string) => formatUtcToKst(iso, 'YYYY-MM-DD')

  const STATUS_BADGE: Record<string, { label: string; class: string }> = {
    draft: { label: '작성중', class: 'bg-amber-50 text-amber-600' },
    submitted: { label: '제출됨', class: 'bg-emerald-50 text-emerald-600' }
  }
</script>

<section>
  <div class="mb-3 flex items-center justify-between gap-2">
    <Typography variant="body-01-medium" color="text-gray-800">
      문서 관리
    </Typography>
    <button
      type="button"
      onclick={openTemplateSearchModal}
      class="flex items-center gap-2 rounded-lg px-2 py-1 text-action-primary transition-colors hover:bg-gray-50"
    >
      <PlusIcon20 />
      <Typography variant="body-02-regular" color="text-gray-500">
        추가
      </Typography>
    </button>
  </div>

  {#if instancesQuery.isLoading}
    <div class="rounded-lg bg-gray-50 p-4">
      <Typography variant="body-02-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if items.length === 0}
    <div class="rounded-lg bg-gray-50 p-6 text-center">
      <Typography variant="body-02-regular" color="text-gray-500">
        연결된 문서가 없어요
      </Typography>
    </div>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each items as item (item.mapping_id)}
        {@const badge =
          STATUS_BADGE[item.instance.status] ?? STATUS_BADGE.draft}
        <li
          class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <Typography
                variant="body-01-normal-semibold"
                color="text-gray-900"
                className="truncate-safe"
              >
                {templateNames.get(item.instance.template_id) ?? '문서'}
              </Typography>
              <span
                class="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium {badge.class}"
              >
                {badge.label}
              </span>
            </div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mt-1 block"
            >
              {fmtDate(item.created_at)} 연결
              {#if item.instance.submitted_at}
                · {fmtDate(item.instance.submitted_at)} 제출
              {/if}
            </Typography>
          </div>
          <Tooltip text="연결 해제">
            <button
              type="button"
              onclick={() => handleUnlink(item)}
              aria-label="연결 해제"
              class="flex-center shrink-0 rounded-lg p-1.5 transition-colors hover:bg-status-danger-bg"
            >
              <TrashIcon />
            </button>
          </Tooltip>
        </li>
      {/each}
    </ul>
  {/if}
</section>
