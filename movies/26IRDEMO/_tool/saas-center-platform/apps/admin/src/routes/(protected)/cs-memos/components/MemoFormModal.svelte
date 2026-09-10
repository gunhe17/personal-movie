<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Select from '$components/Select.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getCenterList,
    type CenterSummary
  } from '$hooks/actions/center.action'
  import type {
    MemoType,
    CSMemoDetailResponse
  } from '$hooks/actions/cs-memo.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    memo?: CSMemoDetailResponse | null
    onSubmit?: (data: {
      title: string
      content: string
      memo_type: MemoType
      center_id: string | null
    }) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    memo = null,
    onSubmit = async () => {}
  }: Props = $props()

  const isEdit = $derived(!!memo)

  // ─── 폼 상태 ───
  // svelte-ignore state_referenced_locally
  let title = $state(memo?.title ?? '')
  // svelte-ignore state_referenced_locally
  let content = $state(memo?.content ?? '')
  // svelte-ignore state_referenced_locally
  let memoType = $state<MemoType>(memo?.memo_type ?? 'inquiry')
  // svelte-ignore state_referenced_locally
  let centerId = $state<string>(memo?.center_id ?? '')
  let isSubmitting = $state(false)

  // ─── 센터 목록 ───
  const centersQuery = $derived(
    queryBuilder<any, any>(getCenterList, () => ({ size: 100 }))
  )
  const centerOptions = $derived([
    { value: '', title: '센터 선택 (선택사항)' },
    ...(centersQuery.data?.items ?? []).map((c: CenterSummary) => ({
      value: c.id,
      title: c.name
    }))
  ])

  // ─── 메모 유형 옵션 ───
  const MEMO_TYPE_OPTIONS = [
    { value: 'inquiry', title: '문의' },
    { value: 'complaint', title: '불만' },
    { value: 'request', title: '요청' },
    { value: 'other', title: '기타' }
  ]

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return
    isSubmitting = true
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        memo_type: memoType,
        center_id: centerId || null
      })
      closeModal()
    } finally {
      isSubmitting = false
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
    <Typography variant="headline-02-semibold" color="text-gray-800">
      {isEdit ? '메모 수정' : '새 메모 작성'}
    </Typography>
  {/snippet}

  {#snippet body()}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-4">
      <!-- 제목 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          제목 <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          bind:value={title}
          placeholder="메모 제목을 입력하세요"
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <!-- 유형 + 센터 -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            유형 <span class="text-red-500">*</span>
          </label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={memoType}
            on:change={(e) => (memoType = e.detail.value as MemoType)}
            options={MEMO_TYPE_OPTIONS}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            관련 센터
          </label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={centerId}
            on:change={(e) => (centerId = e.detail.value)}
            options={centerOptions}
          />
        </div>
      </div>

      <!-- 내용 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          내용 <span class="text-red-500">*</span>
        </label>
        <textarea
          bind:value={content}
          placeholder="통화 내용을 기록하세요"
          rows="6"
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button color="light" content="취소" onclick={closeModal} />
    <Button
      color="primary"
      content={isSubmitting ? '저장 중...' : isEdit ? '수정' : '저장'}
      onclick={handleSubmit}
      disabled={isSubmitting || !title.trim() || !content.trim()}
    />
  {/snippet}
</BaseModal>
