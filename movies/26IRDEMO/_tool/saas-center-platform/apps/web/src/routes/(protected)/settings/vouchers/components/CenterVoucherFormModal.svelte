<script lang="ts">
  import { onMount } from 'svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Select from '$lib/components/Select.svelte'
  import Typography from '@common/components/Typography.svelte'

  import { requireCenterId } from '$lib/stores/center.store'
  import {
    getVoucherCatalogList,
    type CreateCenterVoucherPayload,
    type UpdateCenterVoucherPayload,
    type VoucherCatalogItem
  } from '$lib/hooks/actions/centerVoucher.action'
  import type { CenterVoucherVM } from '$lib/features/voucher/center-voucher/view-model'

  interface Props {
    modalId?: string
    closeModal?: () => void
    mode: 'create' | 'edit'
    initialItem?: CenterVoucherVM
    onConfirm?: (
      data: CreateCenterVoucherPayload | UpdateCenterVoucherPayload
    ) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    mode = 'create',
    initialItem,
    onConfirm
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  const init = initialItem

  // 폼 상태
  let catalogId = $state(init?.catalogId ?? '')
  let unitPrice = $state<number | null>(init?.unitPrice ?? null)
  let defaultTotalSessions = $state<number | null>(
    init?.defaultTotalSessions ?? null
  )
  let isActive = $state(init?.isActive ?? true)
  let memo = $state(init?.memo ?? '')
  let isSubmitting = $state(false)

  // 카탈로그 목록 (create 모드에서만 사용)
  let catalogs = $state<VoucherCatalogItem[]>([])
  let isLoadingCatalogs = $state(false)

  onMount(async () => {
    if (mode !== 'create') return
    isLoadingCatalogs = true
    try {
      const res = await getVoucherCatalogList().request({
        centerId: requireCenterId(),
        page: 1,
        size: 200
      })
      // 이미 취급중인 사업은 제외
      catalogs = res.items.filter((c) => !c.is_taken)
    } catch (error) {
      console.error('[getVoucherCatalogList] failed', error)
    } finally {
      isLoadingCatalogs = false
    }
  })

  const catalogOptions = $derived(
    catalogs.map((c) => ({
      value: c.id,
      title: c.is_expired
        ? `${c.name} (${c.program_year} · ${c.program_organization}) · 종료`
        : `${c.name} (${c.program_year} · ${c.program_organization})`
    }))
  )

  const selectedCatalog = $derived(
    catalogs.find((c) => c.id === catalogId) ?? null
  )

  const isSelectedExpired = $derived(
    mode === 'edit'
      ? init?.isExpired === true
      : selectedCatalog?.is_expired === true
  )

  const canSubmit = $derived(
    mode === 'edit' || (!!catalogId && !isSelectedExpired)
  )

  function parseInteger(value: string): number | null {
    const raw = value.replace(/[^0-9]/g, '')
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  }

  async function handleConfirm() {
    if (!onConfirm || !canSubmit) return
    isSubmitting = true
    try {
      if (mode === 'create') {
        const payload: CreateCenterVoucherPayload = {
          catalog_id: catalogId,
          unit_price: unitPrice,
          default_total_sessions: defaultTotalSessions,
          is_active: isActive,
          memo: memo || null
        }
        await onConfirm(payload)
      } else {
        // 활성/비활성 변경은 우측 상세 패널의 토글 버튼이 담당 — 수정 모달은 손대지 않음
        const payload: UpdateCenterVoucherPayload = {
          unit_price: unitPrice,
          default_total_sessions: defaultTotalSessions,
          memo: memo || null
        }
        await onConfirm(payload)
      }
      closeModal()
    } catch {
      // 에러는 service에서 토스트로 처리
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder
  showFooterBorder
  showCloseButton
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <Typography variant="headline-02-normal-semibold" color="text-gray-900">
      {mode === 'create' ? '취급 바우처 등록' : '취급 바우처 수정'}
    </Typography>
  {/snippet}

  {#snippet body()}
    <div class="flex flex-col gap-5">
      <!-- 카탈로그 선택 (create) / 표시 (edit) -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          바우처 사업
        </Typography>
        {#if mode === 'create'}
          {#if isLoadingCatalogs}
            <div
              class="flex h-12 items-center rounded-lg border border-dashed border-gray-200 px-4"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-400"
              >
                불러오는 중...
              </Typography>
            </div>
          {:else if catalogs.length > 0}
            <Select
              class="w-full rounded-lg"
              placeholder="취급할 사업을 선택하세요"
              selected={catalogId}
              on:change={(e) => (catalogId = e.detail.value)}
              hoverBoxClass="left-0 w-full"
              options={catalogOptions}
            />
            {#if selectedCatalog && (selectedCatalog.support_amount_text || selectedCatalog.usage_start_date || selectedCatalog.usage_end_date)}
              <div class="mt-2 flex flex-wrap items-center gap-2">
                {#if selectedCatalog.usage_start_date || selectedCatalog.usage_end_date}
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs {isSelectedExpired
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-mint-50 text-mint-600'}"
                  >
                    사업 이용 기간 {selectedCatalog.usage_start_date ?? ''} ~ {selectedCatalog.usage_end_date ??
                      ''}
                  </span>
                {/if}
                {#if selectedCatalog.support_amount_text}
                  <span class="text-xs text-gray-500">
                    표준 지원금: {selectedCatalog.support_amount_text}
                  </span>
                {/if}
              </div>
            {/if}
            {#if isSelectedExpired}
              <p class="mt-1 field-help is-error">
                이미 종료된 사업이에요. 신규 등록할 수 없어요.
              </p>
            {/if}
          {:else}
            <div
              class="flex h-12 items-center rounded-lg border border-dashed border-gray-200 px-4"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-400"
              >
                등록 가능한 카탈로그가 없습니다
              </Typography>
            </div>
          {/if}
        {:else}
          <div class="flex h-12 items-center rounded-lg bg-gray-50 px-4">
            <Typography variant="body-02-normal-regular" color="text-gray-700">
              {init?.catalogName ?? '(카탈로그 정보 없음)'}
            </Typography>
          </div>
          {#if isSelectedExpired}
            <p class="mt-2 text-xs text-amber-600">
              이미 종료된 사업이에요. 수정은 가능하지만 신규 발급은 차단돼요.
            </p>
          {/if}
        {/if}
      </div>

      <!-- 단가 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          회기당 단가
          <span class="ml-1 text-xs text-gray-400">(선택, 참고용)</span>
        </Typography>
        <div
          class="flex h-12 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 focus-within:border-border-active"
        >
          <input
            type="text"
            inputmode="numeric"
            placeholder="예: 60,000"
            value={unitPrice != null ? unitPrice.toLocaleString() : ''}
            oninput={(e) =>
              (unitPrice = parseInteger((e.target as HTMLInputElement).value))}
            class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
          />
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            tag="span">원</Typography
          >
        </div>
      </div>

      <!-- 기본 회기 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          기본 총 회기
          <span class="ml-1 text-xs text-gray-400"
            >(선택, 발급 시 자동 채움)</span
          >
        </Typography>
        <div
          class="flex h-12 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 focus-within:border-border-active"
        >
          <input
            type="text"
            inputmode="numeric"
            placeholder="예: 8"
            value={defaultTotalSessions != null
              ? String(defaultTotalSessions)
              : ''}
            oninput={(e) =>
              (defaultTotalSessions = parseInteger(
                (e.target as HTMLInputElement).value
              ))}
            class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
          />
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            tag="span">회</Typography
          >
        </div>
      </div>

      <!-- 메모 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          메모 <span class="text-body-03-normal-regular text-body-subtle"
            >(선택)</span
          >
        </Typography>
        <textarea
          bind:value={memo}
          placeholder="메모를 입력해주세요"
          rows={2}
          class="w-full rounded-lg border border-gray-200 text-body-03-reading-regular focus:border-border-active focus:outline-none resize-none px-3 py-3.5"
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="flex-center h-11 px-6 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      disabled={isSubmitting}
    >
      <Typography variant="body-01-normal-medium" color="text-gray-700"
        >취소</Typography
      >
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!canSubmit || isSubmitting}
      class="flex-center h-11 px-6 rounded-lg transition-colors {canSubmit &&
      !isSubmitting
        ? 'bg-primary-500 hover:bg-primary-600'
        : 'cursor-not-allowed bg-action-primary-disabled'}"
    >
      <Typography variant="body-01-normal-medium" color="text-white">
        {isSubmitting ? '처리 중...' : mode === 'create' ? '등록' : '저장'}
      </Typography>
    </button>
  {/snippet}
</BaseModal>
