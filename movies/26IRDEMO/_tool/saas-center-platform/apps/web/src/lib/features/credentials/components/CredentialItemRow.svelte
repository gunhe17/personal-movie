<!--
  CredentialItemRow
  credential 한 항목을 한 줄로 표시.
  - 본인 시점: 수정/삭제/검증요청 액션 노출
  - 다른 멤버 조회 시점: readOnly로 액션 숨김
-->
<script lang="ts">
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'

  import type { CredentialItemVM } from '../view-model'

  interface Props {
    item: CredentialItemVM
    readOnly?: boolean
    onEdit?: (item: CredentialItemVM) => void
    onDelete?: (item: CredentialItemVM) => void
    onRequestVerification?: (item: CredentialItemVM) => void
    onAttachmentClick?: (item: CredentialItemVM) => void
  }

  let {
    item,
    readOnly = false,
    onEdit,
    onDelete,
    onRequestVerification,
    onAttachmentClick
  }: Props = $props()

  const menuItems = $derived.by(() => {
    if (readOnly) return []
    const items: {
      label: string
      onClick: () => void
      variant?: 'default' | 'danger'
    }[] = []
    if (item.canRequestVerification) {
      items.push({
        label: '검증 요청',
        onClick: () => onRequestVerification?.(item)
      })
    }
    items.push({ label: '수정', onClick: () => onEdit?.(item) })
    items.push({
      label: '삭제',
      onClick: () => onDelete?.(item),
      variant: 'danger'
    })
    return items
  })
</script>

<div
  class="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-200"
>
  <div class="flex-1 min-w-0">
    <!-- 상단: 제목 + 배지 -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-body-01-normal-semibold text-gray-900 truncate-safe">
        {item.title}
      </span>
      {#if item.expiryHint}
        <span
          class="inline-flex items-center rounded px-1.5 py-0.5 text-label-02-normal-medium {item
            .expiryHint.tone === 'expired'
            ? 'bg-gray-100 text-gray-500'
            : 'bg-orange-50 text-orange-600'}"
        >
          {item.expiryHint.label}
        </span>
      {/if}
    </div>

    <!-- 보조 정보 -->
    <div
      class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-02-normal-regular text-gray-600"
    >
      <span class="truncate-safe">{item.organization}</span>
      {#if item.metaLine}
        <span class="text-gray-300">·</span>
        <span class="truncate-safe">{item.metaLine}</span>
      {/if}
      {#if item.periodLabel}
        <span class="text-gray-300">·</span>
        <span>{item.periodLabel}</span>
      {/if}
    </div>

    <!-- 반려 사유 -->
    {#if item.verification.status === 'rejected' && item.verification.rejectReason}
      <div
        class="mt-2 rounded-md border border-red-100 bg-status-danger-bg px-3 py-2 text-label-02-normal-regular text-red-700"
      >
        반려 사유: {item.verification.rejectReason}
      </div>
    {/if}

    <!-- 첨부 파일 (본인 시점에서만 노출 — 타 구성원 조회 시 다운로드 미지원) -->
    {#if item.attachment && !readOnly}
      <div class="mt-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-label-02-normal-regular text-gray-700 hover:bg-gray-100"
          onclick={() => onAttachmentClick?.(item)}
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="truncate-safe max-w-45">{item.attachment.filename}</span>
          {#if item.attachment.size}
            <span class="text-gray-400">({item.attachment.size})</span>
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <!-- 우측 액션 -->
  {#if !readOnly && menuItems.length > 0}
    <div class="shrink-0 self-center">
      <KebabMenu items={menuItems} />
    </div>
  {/if}
</div>
