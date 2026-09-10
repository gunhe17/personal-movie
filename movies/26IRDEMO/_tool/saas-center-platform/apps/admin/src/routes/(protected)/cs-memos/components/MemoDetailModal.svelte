<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import type {
    CSMemoDetailResponse,
    MemoType
  } from '$hooks/actions/cs-memo.action'
  import { formatDate } from '$root/src/lib/utils/format'

  interface Props {
    modalId?: string
    closeModal?: () => void
    memo: CSMemoDetailResponse
    onEdit?: () => void
    onDelete?: () => void
    canModify?: boolean
  }

  let {
    modalId = '',
    closeModal = () => {},
    memo,
    onEdit = () => {},
    onDelete = () => {},
    canModify = true
  }: Props = $props()

  const MEMO_TYPE_LABELS: Record<
    MemoType,
    { label: string; bg: string; text: string }
  > = {
    inquiry: { label: '문의', bg: 'bg-blue-50', text: 'text-blue-700' },
    complaint: { label: '불만', bg: 'bg-red-50', text: 'text-red-700' },
    request: { label: '요청', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    other: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  const typeConfig = $derived(MEMO_TYPE_LABELS[memo.memo_type])
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  bodyClass="p-6"
  footerClass="py-4 px-6"
  headerClass="px-6 py-4"
>
  {#snippet header()}
    <div class="flex items-center gap-3">
      <Typography variant="headline-02-semibold" color="text-gray-800">
        메모 상세
      </Typography>
      <span
        class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {typeConfig.bg} {typeConfig.text}"
      >
        {typeConfig.label}
      </span>
    </div>
  {/snippet}

  {#snippet body()}
    <dl class="space-y-4">
      <div>
        <dt class="text-sm font-medium text-gray-500 mb-1">제목</dt>
        <dd class="text-sm text-gray-900">{memo.title}</dd>
      </div>

      {#if memo.center_name}
        <div>
          <dt class="text-sm font-medium text-gray-500 mb-1">관련 센터</dt>
          <dd class="text-sm text-gray-900">{memo.center_name}</dd>
        </div>
      {/if}

      <div>
        <dt class="text-sm font-medium text-gray-500 mb-1">내용</dt>
        <dd class="text-sm text-gray-900 whitespace-pre-wrap">
          {memo.content}
        </dd>
      </div>

      <div class="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <dt class="text-sm font-medium text-gray-500 mb-1">작성자</dt>
          <dd class="text-sm text-gray-900">{memo.created_by_name || '-'}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-gray-500 mb-1">작성일</dt>
          <dd class="text-sm text-gray-900">
            {formatDate(memo.created_at, 'YYYY-MM-DD HH:mm')}
          </dd>
        </div>
      </div>
    </dl>
  {/snippet}

  {#snippet footer()}
    {#if canModify}
      <Button color="light-red" content="삭제" onclick={onDelete} />
      <Button color="primary" content="수정" onclick={onEdit} />
    {:else}
      <Button color="light" content="닫기" onclick={closeModal} />
    {/if}
  {/snippet}
</BaseModal>
