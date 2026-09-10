<script lang="ts">
  import { browser } from '$app/environment'
  import { untrack } from 'svelte'
  import { slide } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'

  import Typography from '@common/components/Typography.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Select from '$lib/components/Select.svelte'
  import DateSelect from '$lib/components/searchInput/DateSelect.svelte'
  import { centerId as centerId$ } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCenterVoucherList,
    type CenterVoucherResponse
  } from '$lib/hooks/actions/centerVoucher.action'
  import { dateToString } from '$lib/utils/date'
  import type { SelectOptionType } from '$lib/types/common'
  import {
    emptyVoucherForm,
    type VoucherFormData,
    type VoucherFormErrors
  } from '$lib/features/clients/detail/voucher'

  interface Props {
    modalId?: string
    closeModal?: () => void
    mode: 'create' | 'edit'
    initial?: VoucherFormData
    onSubmit: (data: VoucherFormData) => Promise<void> | void
  }

  let {
    modalId = '',
    closeModal = () => {},
    mode,
    initial,
    onSubmit
  }: Props = $props()

  // 초기 폼은 모달 오픈 시 한 번만 캡처. 이후 props.initial이 바뀌어도 갱신 안 함.
  let form = $state<VoucherFormData>(
    untrack(() => (initial ? { ...initial } : emptyVoucherForm()))
  )
  let errors = $state<VoucherFormErrors>({})
  let submitting = $state(false)

  const title = $derived(mode === 'create' ? '바우처 연결하기' : '바우처 수정')
  const submitLabel = $derived(mode === 'create' ? '연결' : '수정')

  // 필수값 충족 여부 — 클릭 가능 여부에만 영향, 세부 검증은 validate()에서
  const canSubmit = $derived(
    !!form.centerVoucherId &&
      (mode === 'create'
        ? form.totalSessions.trim().length > 0
        : form.remainingSessions.trim().length > 0)
  )

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

  const selectedCv = $derived<CenterVoucherResponse | null>(
    form.centerVoucherId
      ? (centerVoucherList.find((c) => c.id === form.centerVoucherId) ?? null)
      : null
  )

  function toDateOrNull(value: string): Date | null {
    if (!value) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  function formatSignedAmount(raw: string): string {
    if (!raw) return ''
    const sign = raw.startsWith('-') ? '-' : ''
    const digits = raw.replace(/\D/g, '')
    if (!digits) return sign
    return sign + Number(digits).toLocaleString()
  }

  // 유효기간이 카탈로그 기본값으로 프리필된 상태 — 개인별 결정통지 기간과 다를 수 있어 안내
  let isPeriodFromCatalog = $state(false)

  function handleVoucherSelect(value: string) {
    const cv = centerVoucherList.find((c) => c.id === value)
    const patch: Partial<VoucherFormData> = { centerVoucherId: value || null }

    // 빈 필드만 자동 채움 (사용자 수정 가능)
    if (cv) {
      if (!form.totalSessions && cv.default_total_sessions) {
        patch.totalSessions = String(cv.default_total_sessions)
      }
      if (!form.validFrom && cv.catalog?.usage_start_date) {
        patch.validFrom = cv.catalog.usage_start_date
        isPeriodFromCatalog = true
      }
      if (!form.validUntil && cv.catalog?.usage_end_date) {
        patch.validUntil = cv.catalog.usage_end_date
        isPeriodFromCatalog = true
      }
    }
    form = { ...form, ...patch }
  }

  function validate(): boolean {
    const next: VoucherFormErrors = {}
    if (!form.centerVoucherId) next.centerVoucher = '바우처 사업을 선택해주세요'

    const total = Number(form.totalSessions)
    const sessionLabel = mode === 'edit' ? '총 회기' : '잔여 회기'
    const amountLabel = mode === 'edit' ? '총 금액' : '잔여 금액'
    if (!form.totalSessions.trim() || !Number.isFinite(total) || total < 1) {
      next.totalSessions = `${sessionLabel}는 1 이상으로 입력해주세요`
    }

    if (form.totalAmount.trim()) {
      const amt = Number(form.totalAmount)
      if (!Number.isFinite(amt) || amt < 0) {
        next.totalAmount = `${amountLabel}은 0 이상으로 입력해주세요`
      }
    }

    if (mode === 'edit' && form.remainingSessions.trim()) {
      const r = Number(form.remainingSessions)
      if (!Number.isFinite(r) || r < 0) {
        next.remainingSessions = '잔여 회기는 0 이상으로 입력해주세요'
      } else if (Number.isFinite(total) && r > total) {
        next.remainingSessions = '잔여 회기는 총 회기를 초과할 수 없어요'
      }
    }

    if (form.validFrom && form.validUntil) {
      if (new Date(form.validFrom) > new Date(form.validUntil)) {
        next.validRange = '시작일이 종료일보다 이후일 수 없어요'
      }
    }

    errors = next
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (submitting) return
    if (!validate()) return
    submitting = true
    try {
      await onSubmit(form)
      closeModal()
    } finally {
      submitting = false
    }
  }
</script>

<BaseModal {modalId} {closeModal} {title} bodyClass="p-5 pb-7">
  {#snippet body()}
    <div class="space-y-5">
      <!-- 사업 선택 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          바우처 사업 <span class="field-required">*</span>
        </Typography>
        {#if mode === 'edit'}
          <!-- 수정 모드에서는 사업 변경 불가 (잠금) -->
          <div
            class="flex h-12 items-center rounded-lg border border-gray-200 bg-gray-50 px-4"
          >
            <Typography variant="body-02-regular" color="text-gray-700">
              {selectedCv
                ? (selectedCv.catalog?.name ?? '이름 없음') +
                  (selectedCv.catalog
                    ? ` (${selectedCv.catalog.program_year} · ${selectedCv.catalog.program_organization})`
                    : '')
                : '-'}
            </Typography>
          </div>
        {:else if isLoading}
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
              errors.centerVoucher ? 'border border-status-danger' : ''
            )}
            placeholder="바우처 사업을 선택해주세요"
            options={voucherOptions}
            selected={form.centerVoucherId ?? ''}
            hoverBoxClass="left-0"
            dropdownExactWidth
            on:change={(e) =>
              handleVoucherSelect(
                typeof e.detail === 'string'
                  ? e.detail
                  : (e.detail?.value ?? '')
              )}
          />
          {#if errors.centerVoucher}
            <p class="mt-1 field-help is-error">
              {errors.centerVoucher}
            </p>
          {/if}
        {/if}
      </div>

      <!-- 참고 정보 -->
      {#if selectedCv && (selectedCv.catalog?.support_amount_text || selectedCv.unit_price != null)}
        <div
          class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
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

      <!-- 회기 — 우측 '잔여 회기(보정)'은 edit 모드에만 있다.
           create 모드에서 2열로 두면 입력이 절반 폭으로 남는다 -->
      <div
        class="grid grid-cols-1 gap-3 {mode === 'edit' ? 'sm:grid-cols-2' : ''}"
      >
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            {mode === 'edit' ? '총 회기' : '잔여 회기'}
            <span class="field-required">*</span>
          </Typography>
          <div
            class={twMerge(
              'flex h-12 items-center gap-2 rounded-lg border bg-white px-4',
              errors.totalSessions
                ? 'border-status-danger focus-within:border-status-danger'
                : 'border-gray-200 focus-within:border-border-active'
            )}
          >
            <input
              type="text"
              inputmode="numeric"
              maxlength="4"
              value={form.totalSessions}
              placeholder="예: 12"
              class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
              oninput={(e) => {
                const next = (e.target as HTMLInputElement).value.replace(
                  /\D/g,
                  ''
                )
                form = { ...form, totalSessions: next }
              }}
            />
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              tag="span">회</Typography
            >
          </div>
          {#if errors.totalSessions}
            <p class="mt-1 field-help is-error">
              {errors.totalSessions}
            </p>
          {/if}
        </div>

        {#if mode === 'edit'}
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2"
            >
              잔여 회기
              <span class="text-body-03-normal-regular text-gray-400"
                >(보정)</span
              >
            </Typography>
            <div
              class={twMerge(
                'flex h-12 items-center gap-2 rounded-lg border bg-white px-4',
                errors.remainingSessions
                  ? 'border-status-danger focus-within:border-status-danger'
                  : 'border-gray-200 focus-within:border-border-active'
              )}
            >
              <input
                type="text"
                inputmode="numeric"
                maxlength="4"
                value={form.remainingSessions}
                placeholder="예: 12"
                class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
                oninput={(e) => {
                  const next = (e.target as HTMLInputElement).value.replace(
                    /\D/g,
                    ''
                  )
                  form = { ...form, remainingSessions: next }
                }}
              />
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                tag="span">회</Typography
              >
            </div>
            {#if errors.remainingSessions}
              <p class="mt-1 field-help is-error">
                {errors.remainingSessions}
              </p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 금액 — 회기와 동일하게 edit 모드에서만 2열 -->
      <div
        class="grid grid-cols-1 gap-3 {mode === 'edit' ? 'sm:grid-cols-2' : ''}"
      >
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            {mode === 'edit' ? '총 금액' : '잔여 금액'}
            <span class="text-body-03-normal-regular text-body-subtle"
              >(선택)</span
            >
          </Typography>
          <div
            class={twMerge(
              'flex h-12 items-center gap-2 rounded-lg border bg-white px-4',
              errors.totalAmount
                ? 'border-status-danger focus-within:border-status-danger'
                : 'border-gray-200 focus-within:border-border-active'
            )}
          >
            <input
              type="text"
              inputmode="numeric"
              maxlength="11"
              value={form.totalAmount
                ? Number(form.totalAmount).toLocaleString()
                : ''}
              placeholder="예: 300,000"
              class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
              oninput={(e) => {
                const next = (e.target as HTMLInputElement).value.replace(
                  /\D/g,
                  ''
                )
                form = { ...form, totalAmount: next }
              }}
            />
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              tag="span">원</Typography
            >
          </div>
          {#if errors.totalAmount}
            <p class="mt-1 field-help is-error">{errors.totalAmount}</p>
          {/if}
        </div>

        {#if mode === 'edit'}
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2"
            >
              잔여 금액
              <span class="text-body-03-normal-regular text-gray-400"
                >(보정)</span
              >
            </Typography>
            <div
              class={twMerge(
                'flex h-12 items-center gap-2 rounded-lg border bg-white px-4',
                errors.remainingAmount
                  ? 'border-status-danger focus-within:border-status-danger'
                  : 'border-gray-200 focus-within:border-border-active'
              )}
            >
              <input
                type="text"
                inputmode="numeric"
                maxlength="12"
                value={form.remainingAmount
                  ? formatSignedAmount(form.remainingAmount)
                  : ''}
                placeholder="예: 300,000"
                class="text-body-01-normal-regular placeholder:text-placeholder h-full flex-1 bg-transparent text-right focus:outline-none"
                oninput={(e) => {
                  const raw = (e.target as HTMLInputElement).value
                  // 음수 허용: 맨 앞 '-'만 통과
                  const sign = raw.startsWith('-') ? '-' : ''
                  const digits = raw.replace(/\D/g, '')
                  form = { ...form, remainingAmount: sign + digits }
                }}
              />
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                tag="span">원</Typography
              >
            </div>
            {#if errors.remainingAmount}
              <p class="mt-1 field-help is-error">
                {errors.remainingAmount}
              </p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 유효기간 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          유효기간
        </Typography>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateSelect
            selectedDate={toDateOrNull(form.validFrom)}
            className="h-12"
            onChangeDate={(date) => {
              form = {
                ...form,
                validFrom: date ? dateToString(date, 'YYYY-MM-DD') : ''
              }
              isPeriodFromCatalog = false
            }}
          />
          <DateSelect
            selectedDate={toDateOrNull(form.validUntil)}
            className="h-12"
            onChangeDate={(date) => {
              form = {
                ...form,
                validUntil: date ? dateToString(date, 'YYYY-MM-DD') : ''
              }
              isPeriodFromCatalog = false
            }}
          />
        </div>
        {#if isPeriodFromCatalog}
          <p
            class="text-body-03-normal-regular mt-1.5 text-amber-700"
            transition:slide={{ duration: 150 }}
          >
            카탈로그 기본 기간이에요 — 실제 발급 기간을 확인해주세요
          </p>
        {/if}
        {#if errors.validRange}
          <p class="mt-1 field-help is-error">{errors.validRange}</p>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="flex-center h-11 px-6 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      disabled={submitting}
    >
      <Typography variant="body-01-normal-medium" color="text-gray-700"
        >취소</Typography
      >
    </button>
    <button
      type="button"
      onclick={handleSubmit}
      disabled={!canSubmit || submitting}
      class="flex-center h-11 px-6 rounded-lg transition-colors {canSubmit &&
      !submitting
        ? 'bg-primary-500 hover:bg-primary-600'
        : 'cursor-not-allowed bg-action-primary-disabled'}"
    >
      <Typography variant="body-01-normal-medium" color="text-white">
        {submitting ? '처리 중...' : submitLabel}
      </Typography>
    </button>
  {/snippet}
</BaseModal>
