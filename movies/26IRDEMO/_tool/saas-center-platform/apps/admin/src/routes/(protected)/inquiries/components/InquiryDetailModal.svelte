<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import type {
    InquiryDetailResponse,
    InquiryType
  } from '$hooks/actions/inquiry.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    inquiry: InquiryDetailResponse
    onSave?: (answer: string) => Promise<void>
    onDelete?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    inquiry,
    onSave = async () => {},
    onDelete = () => {}
  }: Props = $props()

  const INQUIRY_TYPE_CONFIG: Record<
    InquiryType,
    { label: string; bg: string; text: string }
  > = {
    general: { label: '일반 문의', bg: 'bg-blue-50', text: 'text-blue-700' },
    technical: {
      label: '기술 문의',
      bg: 'bg-purple-50',
      text: 'text-purple-700'
    },
    feature_request: {
      label: '기능 요청',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700'
    },
    other: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  const STATUS_CONFIG: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    pending: { label: '대기', bg: 'bg-gray-100', text: 'text-gray-600' },
    in_progress: { label: '처리 중', bg: 'bg-blue-50', text: 'text-blue-700' },
    resolved: { label: '답변 완료', bg: 'bg-green-50', text: 'text-green-700' }
  }

  const typeConfig = $derived(INQUIRY_TYPE_CONFIG[inquiry.inquiry_type])
  const statusConfig = $derived(STATUS_CONFIG[inquiry.status])

  // ─── 답변 작성 상태 ───
  // svelte-ignore state_referenced_locally
  let answerText = $state(inquiry.answer ?? '')
  let isSaving = $state(false)

  async function handleSave() {
    if (!answerText.trim()) return
    isSaving = true
    try {
      await onSave(answerText.trim())
      closeModal()
    } finally {
      isSaving = false
    }
  }
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
        문의 상세
      </Typography>
      <span
        class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {typeConfig.bg} {typeConfig.text}"
      >
        {typeConfig.label}
      </span>
      <span
        class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {statusConfig.bg} {statusConfig.text}"
      >
        {statusConfig.label}
      </span>
    </div>
  {/snippet}

  {#snippet body()}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-5">
      <!-- 문의 정보 -->
      <dl class="space-y-3">
        <div>
          <dt class="text-sm font-medium text-gray-500 mb-1">제목</dt>
          <dd class="text-sm text-gray-900 font-medium">{inquiry.subject}</dd>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-sm font-medium text-gray-500 mb-1">문의자</dt>
            <dd class="text-sm text-gray-900">{inquiry.sender_name || '-'}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500 mb-1">이메일</dt>
            <dd class="text-sm text-gray-900">{inquiry.sender_email}</dd>
          </div>
        </div>

        {#if inquiry.center_name}
          <div>
            <dt class="text-sm font-medium text-gray-500 mb-1">관련 센터</dt>
            <dd class="text-sm text-gray-900">{inquiry.center_name}</dd>
          </div>
        {/if}

        <div>
          <dt class="text-sm font-medium text-gray-500 mb-1">문의 내용</dt>
          <dd
            class="text-sm text-gray-900 whitespace-pre-wrap rounded-lg bg-gray-50 p-3"
          >
            {inquiry.content}
          </dd>
        </div>

        <div>
          <dt class="text-sm font-medium text-gray-500 mb-1">접수일</dt>
          <dd class="text-sm text-gray-900">
            {formatDate(inquiry.created_at, 'YYYY-MM-DD HH:mm')}
          </dd>
        </div>
      </dl>

      <!-- 답변 작성 -->
      <div class="border-t border-gray-100 pt-4">
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          답변 {#if inquiry.answered_at}
            <span class="text-xs text-gray-400 font-normal ml-1">
              (최종 답변: {formatDate(inquiry.answered_at, 'YYYY-MM-DD HH:mm')})
            </span>
          {/if}
        </label>
        <textarea
          bind:value={answerText}
          placeholder="답변을 입력하세요"
          rows="5"
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button color="light-red" content="삭제" onclick={onDelete} />
    <div class="flex-1"></div>
    <Button color="light" content="닫기" onclick={closeModal} />
    <Button
      color="primary"
      content={isSaving ? '저장 중...' : '저장'}
      onclick={handleSave}
      disabled={isSaving || !answerText.trim()}
    />
  {/snippet}
</BaseModal>
