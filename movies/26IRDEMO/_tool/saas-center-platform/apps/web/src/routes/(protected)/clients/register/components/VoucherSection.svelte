<script lang="ts">
  import { browser } from '$app/environment'
  import { slide } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'

  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import DateSelect from '$lib/components/searchInput/DateSelect.svelte'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import { centerId as centerId$ } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCenterVoucherList,
    type CenterVoucherResponse
  } from '$lib/hooks/actions/centerVoucher.action'
  import { dateToString } from '$lib/utils/date'
  import type { SelectOptionType } from '$lib/types/common'
  import type { VoucherRow } from '$lib/features/clients/register/voucher-types'

  interface Props {
    rows: VoucherRow[]
    onAdd: () => void
    onRemove: (id: string) => void
    onUpdate: (id: string, patch: Partial<VoucherRow>) => void
    errors?: Record<
      string,
      {
        centerVoucher?: string
        totalSessions?: string
        totalAmount?: string
        validRange?: string
      }
    >
  }

  let { rows, onAdd, onRemove, onUpdate, errors = {} }: Props = $props()

  // 센터 취급 바우처 (활성)
  const centerVouchersQuery = $derived(
    queryBuilder(
      getCenterVoucherList,
      () => ({ centerId: $centerId$, is_active: true, page: 1, size: 200 }),
      { enabled: browser && !!$centerId$ }
    )
  )
  const centerVoucherList = $derived(
    (centerVouchersQuery.data?.items as CenterVoucherResponse[]) ?? []
  )
  const isLoading = $derived(centerVouchersQuery.isLoading)

  const voucherOptions: SelectOptionType[] = $derived(
    centerVoucherList.map((cv) => ({
      value: cv.id,
      title:
        (cv.catalog?.name ?? '이름 없음') +
        (cv.catalog
          ? ` (${cv.catalog.program_year} · ${cv.catalog.program_organization})`
          : '')
    }))
  )

  function findVoucher(id: string | null): CenterVoucherResponse | null {
    if (!id) return null
    return centerVoucherList.find((c) => c.id === id) ?? null
  }

  function toDateOrNull(value: string): Date | null {
    if (!value) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  function handleVoucherSelect(rowId: string, value: string) {
    const row = rows.find((r) => r.id === rowId)
    const cv = centerVoucherList.find((c) => c.id === value)
    const patch: Partial<VoucherRow> = { centerVoucherId: value || null }

    // 비어있는 필드는 카탈로그/취급 정보로 자동 채움 (사용자 수정 가능)
    if (cv) {
      if (!row?.totalSessions && cv.default_total_sessions) {
        patch.totalSessions = String(cv.default_total_sessions)
      }
      if (!row?.validFrom && cv.catalog?.usage_start_date) {
        patch.validFrom = cv.catalog.usage_start_date
      }
      if (!row?.validUntil && cv.catalog?.usage_end_date) {
        patch.validUntil = cv.catalog.usage_end_date
      }
    }
    onUpdate(rowId, patch)
  }
</script>

<section>
  <Typography
    variant="body-02-normal-regular"
    color="text-gray-500"
    className="mb-4"
  >
    내담자가 보유한 바우처를 등록해주세요. 사업별로 사용 가능한 회기 수와 잔여
    금액, 유효기간을 입력해요.
  </Typography>

  <div class="space-y-4">
    {#each rows as row, idx (row.id)}
      {@const selectedCv = findVoucher(row.centerVoucherId)}
      {@const rowErrors = errors[row.id] ?? {}}
      <div class="relative rounded-xl bg-gray-50 p-5 pb-6">
        <!-- 사업 선택 -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            바우처 사업 <span class="field-required">*</span>
          </Typography>
          {#if isLoading}
            <div
              class="flex h-12 items-center rounded-lg border border-gray-200 bg-white px-4"
            >
              <Typography variant="body-02-regular" color="text-gray-400">
                불러오는 중...
              </Typography>
            </div>
          {:else if centerVoucherList.length === 0}
            <div class="rounded-lg border border-gray-200 bg-white p-4">
              <Typography variant="body-02-regular" color="text-gray-600">
                취급 중인 바우처가 없어요. 설정 → 바우처에서 먼저 등록해주세요.
              </Typography>
            </div>
          {:else}
            <Select
              class={twMerge(
                'h-12 w-full bg-white',
                rowErrors.centerVoucher ? 'border border-status-danger' : ''
              )}
              placeholder="바우처 사업을 선택해주세요"
              options={voucherOptions}
              selected={row.centerVoucherId ?? ''}
              hoverBoxClass="left-0 w-full"
              on:change={(e) =>
                handleVoucherSelect(
                  row.id,
                  typeof e.detail === 'string'
                    ? e.detail
                    : (e.detail?.value ?? '')
                )}
            />
            {#if rowErrors.centerVoucher}
              <p class="mt-1 field-help is-error">
                {rowErrors.centerVoucher}
              </p>
            {/if}
          {/if}
        </div>

        <!-- 참고 정보 -->
        {#if selectedCv && (selectedCv.catalog?.support_amount_text || selectedCv.unit_price != null)}
          <div
            class="mt-2 rounded-lg border border-gray-200 bg-white px-4 py-3"
            transition:slide={{ duration: 150 }}
          >
            <Typography
              variant="body-03-medium"
              color="text-gray-500"
              className="mb-1.5"
            >
              참고 정보
            </Typography>
            <ul class="space-y-1">
              {#if selectedCv.catalog?.support_amount_text}
                <li class="flex gap-2">
                  <span
                    class="text-body-02-normal-regular text-gray-500 shrink-0"
                  >
                    표준 지원금
                  </span>
                  <span class="text-body-02-normal-regular text-gray-700">
                    {selectedCv.catalog.support_amount_text}
                  </span>
                </li>
              {/if}
              {#if selectedCv.unit_price != null}
                <li class="flex gap-2">
                  <span
                    class="text-body-02-normal-regular text-gray-500 shrink-0"
                  >
                    센터 적용 단가
                  </span>
                  <span class="text-body-02-normal-regular text-gray-700">
                    ₩{selectedCv.unit_price.toLocaleString()} / 회
                  </span>
                </li>
              {/if}
            </ul>
          </div>
        {/if}

        <!-- 잔여 회기 + 잔여 금액 -->
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2"
            >
              잔여 회기 <span class="field-required">*</span>
            </Typography>
            <div
              class={twMerge(
                'flex h-12 items-center gap-2 rounded-lg border bg-white px-4',
                rowErrors.totalSessions
                  ? 'border-status-danger focus-within:border-status-danger'
                  : 'border-gray-200 focus-within:border-border-active'
              )}
            >
              <input
                type="text"
                inputmode="numeric"
                maxlength="4"
                value={row.totalSessions}
                placeholder="예: 12"
                class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
                oninput={(e) => {
                  const next = (e.target as HTMLInputElement).value.replace(
                    /\D/g,
                    ''
                  )
                  onUpdate(row.id, { totalSessions: next })
                }}
              />
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                tag="span">회</Typography
              >
            </div>
            {#if rowErrors.totalSessions}
              <p class="mt-1 field-help is-error">
                {rowErrors.totalSessions}
              </p>
            {/if}
          </div>
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2"
            >
              잔여 금액
            </Typography>
            <div
              class={twMerge(
                'flex h-12 items-center gap-2 rounded-lg border bg-white px-4',
                rowErrors.totalAmount
                  ? 'border-status-danger focus-within:border-status-danger'
                  : 'border-gray-200 focus-within:border-border-active'
              )}
            >
              <input
                type="text"
                inputmode="numeric"
                maxlength="11"
                value={row.totalAmount
                  ? Number(row.totalAmount).toLocaleString()
                  : ''}
                placeholder="예: 300,000"
                class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
                oninput={(e) => {
                  const next = (e.target as HTMLInputElement).value.replace(
                    /\D/g,
                    ''
                  )
                  onUpdate(row.id, { totalAmount: next })
                }}
              />
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                tag="span">원</Typography
              >
            </div>
            {#if rowErrors.totalAmount}
              <p class="mt-1 field-help is-error">
                {rowErrors.totalAmount}
              </p>
            {/if}
          </div>
        </div>

        <!-- 유효기간 -->
        <div class="mt-2">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            유효기간
          </Typography>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateSelect
              selectedDate={toDateOrNull(row.validFrom)}
              className="h-12"
              onChangeDate={(date) =>
                onUpdate(row.id, {
                  validFrom: date ? dateToString(date, 'YYYY-MM-DD') : ''
                })}
            />
            <DateSelect
              selectedDate={toDateOrNull(row.validUntil)}
              className="h-12"
              onChangeDate={(date) =>
                onUpdate(row.id, {
                  validUntil: date ? dateToString(date, 'YYYY-MM-DD') : ''
                })}
            />
          </div>
          {#if rowErrors.validRange}
            <p class="mt-1 field-help is-error">
              {rowErrors.validRange}
            </p>
          {/if}
        </div>

        <!-- 삭제: "바우처 추가"로 늘린 행에만, 카드 하단 우측 -->
        {#if idx > 0}
          <div class="mt-4 flex justify-end">
            <button
              type="button"
              class="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              onclick={() => onRemove(row.id)}
            >
              <TrashIcon24 size={24} color="#7D848F" />
              <Typography variant="body-02-normal-medium" color="text-gray-500">
                삭제
              </Typography>
            </button>
          </div>
        {/if}
      </div>
    {/each}

    <div class="flex justify-center">
      <button
        type="button"
        onclick={onAdd}
        class="flex items-center gap-2 text-primary-500 hover:text-primary-600"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" fill="#D7E5FD" />
          <path
            d="M7 12L17 12"
            stroke="#4C87F6"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M12 7L12 17"
            stroke="#4C87F6"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <Typography variant="body-02-normal-regular" color="text-primary-500">
          바우처 추가
        </Typography>
      </button>
    </div>
  </div>
</section>
