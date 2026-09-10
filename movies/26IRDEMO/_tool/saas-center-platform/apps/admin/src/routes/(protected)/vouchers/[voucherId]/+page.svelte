<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Input from '$components/Input.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getVoucherDetail,
    type AdminVoucherDetailResponse
  } from '$hooks/actions/voucher.action'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { formatDate } from '$utils/format'
  import { modalStore } from '$stores/modal'
  import LinkModal from '$lib/features/voucher/components/LinkModal.svelte'
  import { createVoucherDetailService } from '$lib/features/voucher/voucher-detail-service'
  import SupportAmountDisplay from '$lib/features/voucher/components/SupportAmountDisplay.svelte'
  import VoucherRecordReview from '$lib/features/voucher/components/VoucherRecordReview.svelte'
  import VoucherRecordEditor from '$lib/features/voucher/components/VoucherRecordEditor.svelte'
  import FieldRow from '$lib/features/voucher/components/FieldRow.svelte'
  import { deriveOldFields, pruneEmptyRows } from '$lib/features/voucher/record-derive'
  import { showErrorMessage } from '$utils/errorHandler'
  import { fade } from 'svelte/transition'

  const voucherId = $derived(page.params.voucherId!)
  const service = createVoucherDetailService({ queryClient: useQueryClient() })

  const detailQuery = $derived(
    queryBuilder<any, any>(getVoucherDetail, () => ({ voucherId }))
  )
  const voucher = $derived<AdminVoucherDetailResponse | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)

  // ─── 수정 폼 상태 ───
  let isEditing = $state(false)
  let formName = $state('')
  let formProgramName = $state('')
  let formProgramOrganization = $state('')
  let formProgramYear = $state<string>('')
  let formUsageStart = $state('')
  let formUsageEnd = $state('')
  let formApplicationMethod = $state('')
  let formApplicationStart = $state('')
  let formApplicationEnd = $state('')
  let formSupportAmount = $state('')
  let formSupportScope = $state('')
  let formSupportTarget = $state('')
  let formContact = $state('')
  // 정규화 record 편집본(구조 고정, 값만) — record 가 정본. 없으면(레거시) 파생 필드 폴백 편집
  let formRecord = $state<any>(null)
  let isSaving = $state(false)

  const yearNumber = $derived(Number(formProgramYear))
  const canSave = $derived(
    formName.trim().length > 0 &&
      formProgramName.trim().length > 0 &&
      formProgramOrganization.trim().length > 0 &&
      Number.isFinite(yearNumber) &&
      yearNumber >= 1900 &&
      yearNumber <= 2999
  )

  function startEditing() {
    if (!voucher) return
    formName = voucher.name
    formProgramName = voucher.program_name
    formProgramOrganization = voucher.program_organization
    formProgramYear = String(voucher.program_year)
    formUsageStart = voucher.usage_start_date ?? ''
    formUsageEnd = voucher.usage_end_date ?? ''
    formApplicationMethod = voucher.application_method ?? ''
    formApplicationStart = voucher.application_start_date ?? ''
    formApplicationEnd = voucher.application_end_date ?? ''
    // support_amount는 자유 schema dict — JSON 텍스트로 편집
    formSupportAmount = voucher.support_amount
      ? JSON.stringify(voucher.support_amount, null, 2)
      : ''
    formSupportScope = voucher.support_scope ?? ''
    formSupportTarget = voucher.support_target ?? ''
    formContact = voucher.contact ?? ''
    formRecord = voucher.record ? structuredClone(voucher.record) : null
    isEditing = true
  }

  async function handleSave() {
    if (!canSave || isSaving) return

    const payload: Record<string, unknown> = {
      name: formName.trim(),
      program_name: formProgramName.trim(),
      program_organization: formProgramOrganization.trim(),
      program_year: yearNumber,
      usage_start_date: formUsageStart || null,
      usage_end_date: formUsageEnd || null,
      application_method: formApplicationMethod.trim() || null,
      application_start_date: formApplicationStart || null,
      application_end_date: formApplicationEnd || null,
      contact: formContact.trim() || null
    }

    if (formRecord) {
      // 빈 행·항목 정리 후 저장(정본) + 구 필드(support_*) 재파생(confirm 과 동일)
      const rec = pruneEmptyRows($state.snapshot(formRecord))
      const derived = deriveOldFields(rec)
      payload.record = rec
      payload.support_amount = derived.support_amount
      payload.support_scope = derived.support_scope
      payload.support_target = derived.support_target
    } else {
      // record 없는 레거시 — 파생 필드 직접 편집(지원금 JSON)
      let parsedSupportAmount: Record<string, unknown> | null = null
      const trimmedAmount = formSupportAmount.trim()
      if (trimmedAmount) {
        try {
          const parsed = JSON.parse(trimmedAmount)
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            showErrorMessage('지원금은 JSON 객체 형식이어야 합니다')
            return
          }
          parsedSupportAmount = parsed
        } catch {
          showErrorMessage('지원금 JSON 형식이 잘못되었습니다')
          return
        }
      }
      payload.support_amount = parsedSupportAmount
      payload.support_scope = formSupportScope.trim() || null
      payload.support_target = formSupportTarget.trim() || null
    }

    isSaving = true
    const ok = await service.save(voucherId, payload)
    isSaving = false
    if (ok) isEditing = false
  }

  function openLinkModal() {
    if (!voucher) return
    const excludeIds = voucher.documents.map((d) => d.id)
    modalStore.open({
      component: LinkModal,
      props: {
        mode: 'fromVoucher',
        excludeIds,
        onConfirm: async (payload: {
          id: string
          page_range: [number, number] | null
        }) => {
          await service.linkDocument(voucherId, {
            global_document_id: payload.id,
            page_range: payload.page_range
          })
        }
      },
      options: { size: 'md' }
    })
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
  const DATE_FORMAT = 'YYYY-MM-DD HH:mm'

  /** 기간 표시 — 양쪽 다 없으면 '미정', 한쪽만 있으면 해당 값만. */
  function formatPeriod(
    start: string | null | undefined,
    end: string | null | undefined
  ): string {
    if (!start && !end) return '미정'
    if (start && end) return `${start} ~ ${end}`
    return start ? `${start} ~` : `~ ${end}`
  }
</script>

<div in:fade class="p-6">
  <div class="mb-6">
    <button
      onclick={() => goto('/vouchers')}
      class="mb-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
    >
      ← 바우처 목록
    </button>

    {#if isLoading}
      <Typography variant="headline-01-normal-bold" tag="h1">불러오는 중...</Typography>
    {:else if voucher}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Typography variant="headline-01-normal-bold" tag="h1">
            {voucher.name}
          </Typography>
          {#if voucher.deleted_at}
            <span
              class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500"
              >삭제됨</span
            >
          {:else}
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              활성
            </span>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          {#if !isEditing && !voucher.deleted_at}
            <button
              onclick={() => service.remove(voucherId)}
              class="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <TrashIcon size={18} />
              삭제하기
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if voucher}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-4">
      <div class="section-border p-6">
        <div class="mb-4 flex items-center justify-between">
          <Typography variant="title-01-normal-semibold" tag="h2">정보</Typography>
          {#if isEditing}
            <Button
              color="primary"
              size="md"
              content="수정하기"
              disabled={isSaving || !canSave}
              onclick={handleSave}
            />
          {:else if !voucher.deleted_at}
            <button
              onclick={startEditing}
              class="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              title="수정"
            >
              <EditIcon size={20} />
            </button>
          {/if}
        </div>

        {#if isEditing}
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="사업/서비스명" required bind:value={formName} maxlength={255} />
              <Input label="사업 이름" required bind:value={formProgramName} maxlength={255} />
              <Input
                label="사업 기관"
                required
                bind:value={formProgramOrganization}
                maxlength={255}
              />
              <Input
                label="사업 연도"
                required
                type="number"
                bind:value={formProgramYear}
                min={1900}
                max={2999}
              />
              <Input label="이용 시작일" type="date" bind:value={formUsageStart} />
              <Input label="이용 종료일" type="date" bind:value={formUsageEnd} />
              <Input label="신청 시작일" type="date" bind:value={formApplicationStart} />
              <Input label="신청 종료일" type="date" bind:value={formApplicationEnd} />
            </div>
            <div>
              <label class={labelClass}>신청 방법</label>
              <textarea
                rows="2"
                bind:value={formApplicationMethod}
                class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              ></textarea>
            </div>
            <div>
              <label class={labelClass}>문의처</label>
              <textarea
                rows="2"
                bind:value={formContact}
                class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              ></textarea>
            </div>

            {#if formRecord}
              <!-- 지원·대상·서비스 등 실질 정보 = 정규화 record 를 구조 그대로 값 편집 -->
              <div>
                <div class="mb-2 flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-700">추출 정규화 정보</span>
                  <span class="text-xs text-gray-400">값을 수정하면 저장 시 반영됩니다</span>
                </div>
                <VoucherRecordEditor record={formRecord} />
              </div>
            {:else}
              <!-- record 없는 레거시 바우처 — 파생 필드 직접 편집 -->
              <div>
                <label class={labelClass}>
                  지원금
                  <span class="ml-1 text-xs font-normal text-gray-400">JSON 객체 형식</span>
                </label>
                <textarea
                  rows="6"
                  placeholder={`{\n  "통화": "KRW",\n  "월총액": { "최소": 180000, "최대": 250000 },\n  "등급별": []\n}`}
                  bind:value={formSupportAmount}
                  class="w-full resize-y rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-xs outline-none focus:border-primary-500"
                ></textarea>
              </div>
              <div>
                <label class={labelClass}>지원 범위</label>
                <textarea
                  rows="2"
                  bind:value={formSupportScope}
                  class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                ></textarea>
              </div>
              <div>
                <label class={labelClass}>지원 대상</label>
                <textarea
                  rows="2"
                  bind:value={formSupportTarget}
                  class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                ></textarea>
              </div>
            {/if}
          </div>
        {:else}
          {#snippet metaRow(label: string, value: string | null | undefined)}
            <FieldRow {label}>
              {#if value}
                <p class="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">{value}</p>
              {:else}
                <span class="text-[15px] text-gray-400">-</span>
              {/if}
            </FieldRow>
          {/snippet}

          <div class="space-y-6">
            {@render metaRow('사업/서비스명', voucher.name)}
            {@render metaRow('사업 이름', voucher.program_name)}
            {@render metaRow('기관', voucher.program_organization)}
            {@render metaRow('연도', `${voucher.program_year}년`)}
            {@render metaRow(
              '이용 기간',
              formatPeriod(voucher.usage_start_date, voucher.usage_end_date)
            )}
            {@render metaRow(
              '신청 기간',
              formatPeriod(voucher.application_start_date, voucher.application_end_date)
            )}
            {@render metaRow('신청 방법', voucher.application_method)}
            {@render metaRow('문의처', voucher.contact)}

            <!-- 지원·대상·서비스 등 실질 정보 = 정규화 record 를 같은 스타일로 -->
            {#if voucher.record}
              <VoucherRecordReview record={voucher.record} />
            {:else}
              <!-- record 없는 레거시 바우처 — 파생 필드로 폴백 -->
              {@render metaRow('지원 범위', voucher.support_scope)}
              {@render metaRow('지원 대상', voucher.support_target)}
              <FieldRow label="지원금">
                {#if voucher.support_amount}
                  <SupportAmountDisplay value={voucher.support_amount as any} />
                {:else}
                  <span class="text-[15px] text-gray-400">-</span>
                {/if}
              </FieldRow>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 연결된 자료 -->
      <div class="section-border p-6">
        <div class="mb-4 flex items-center justify-between">
          <Typography variant="title-01-normal-semibold" tag="h2">
            연결된 자료 · {voucher.documents.length}건
          </Typography>
          {#if !voucher.deleted_at}
            <Button
              size="sm"
              color="light"
              content="+ 자료 연결"
              onclick={openLinkModal}
            />
          {/if}
        </div>

        {#if voucher.documents.length === 0}
          <div class="py-10 text-center text-sm text-gray-400">
            연결된 자료가 없습니다
          </div>
        {:else}
          <div class="overflow-hidden rounded-lg border border-gray-100">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th class="px-4 py-2 text-left font-medium">자료명</th>
                  <th class="px-4 py-2 text-left font-medium">형식</th>
                  <th class="px-4 py-2 text-left font-medium">페이지</th>
                  <th class="px-4 py-2 text-right font-medium">동작</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each voucher.documents as doc (doc.id)}
                  <tr class:bg-gray-50={doc.deleted_at}>
                    <td class="px-4 py-2.5">
                      <span class="text-gray-900">
                        {doc.name}
                        {#if doc.deleted_at}
                          <span class="ml-1 text-xs text-gray-400">(삭제됨)</span>
                        {/if}
                      </span>
                    </td>
                    <td class="px-4 py-2.5">
                      {#if doc.file_type}
                        <span
                          class="inline-flex rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium uppercase text-gray-600"
                        >
                          {doc.file_type}
                        </span>
                      {:else}
                        <span class="text-gray-400">-</span>
                      {/if}
                    </td>
                    <td class="px-4 py-2.5 text-gray-500">
                      {#if doc.page_range}
                        p.{doc.page_range[0]} - {doc.page_range[1]}
                      {:else}
                        -
                      {/if}
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      {#if !voucher.deleted_at}
                        <button
                          onclick={() => service.unlinkDocument(voucherId, doc.id, doc.name)}
                          class="text-xs text-gray-500 hover:text-red-600"
                        >
                          해제
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <!-- 메타 정보 -->
      <div class="section-border p-6">
        <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4">
          메타 정보
        </Typography>
        <dl class="space-y-3">
          <div class="flex">
            <dt class="w-24 shrink-0 text-sm text-gray-500">작성일</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(voucher.created_at, DATE_FORMAT)}
            </dd>
          </div>
          <div class="flex">
            <dt class="w-24 shrink-0 text-sm text-gray-500">수정일</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(voucher.updated_at, DATE_FORMAT)}
            </dd>
          </div>
          {#if voucher.deleted_at}
            <div class="flex">
              <dt class="w-24 shrink-0 text-sm text-gray-500">삭제일</dt>
              <dd class="text-sm text-gray-900">
                {formatDate(voucher.deleted_at, DATE_FORMAT)}
              </dd>
            </div>
          {/if}
        </dl>
      </div>
    </div>
  {/if}
</div>
