<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Select from '$components/Select.svelte'
  import type { FAQDetailResponse, FAQCategory } from '$hooks/actions/faq.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    faq?: FAQDetailResponse | null
    onSubmit?: (data: {
      category: FAQCategory
      question: string
      answer: string
      is_published: boolean
    }) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    faq = null,
    onSubmit = async () => {}
  }: Props = $props()

  const isEdit = $derived(!!faq)

  const CATEGORY_OPTIONS = [
    { value: 'getting_started', title: '시작하기' },
    { value: 'general', title: '일반' },
    { value: 'technical', title: '기술' },
    { value: 'feature', title: '기능' }
  ]

  const PUBLISH_OPTIONS = [
    { value: 'true', title: '게시' },
    { value: 'false', title: '숨김' }
  ]

  // ─── 폼 상태 ───
  // svelte-ignore state_referenced_locally
  let category = $state<FAQCategory>(faq?.category ?? 'general')
  // svelte-ignore state_referenced_locally
  let question = $state(faq?.question ?? '')
  // svelte-ignore state_referenced_locally
  let answer = $state(faq?.answer ?? '')
  // svelte-ignore state_referenced_locally
  let isPublished = $state(faq?.is_published ?? false)
  let isSubmitting = $state(false)

  async function handleSubmit() {
    if (!question.trim() || !answer.trim()) return
    isSubmitting = true
    try {
      await onSubmit({
        category,
        question: question.trim(),
        answer: answer.trim(),
        is_published: isPublished
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
      {isEdit ? 'FAQ 수정' : 'FAQ 등록'}
    </Typography>
  {/snippet}

  {#snippet body()}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-4">
      <!-- 카테고리 + 게시 여부 -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            카테고리 <span class="text-red-500">*</span>
          </label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={category}
            on:change={(e) => (category = e.detail.value as FAQCategory)}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">게시 여부</label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={isPublished ? 'true' : 'false'}
            on:change={(e) => (isPublished = e.detail.value === 'true')}
            options={PUBLISH_OPTIONS}
          />
        </div>
      </div>

      <!-- 질문 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          질문 <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          bind:value={question}
          placeholder="질문을 입력하세요"
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <!-- 답변 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          답변 <span class="text-red-500">*</span>
        </label>
        <textarea
          bind:value={answer}
          placeholder="답변을 입력하세요"
          rows="7"
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button color="light" content="취소" onclick={closeModal} />
    <Button
      color="primary"
      content={isSubmitting ? '저장 중...' : isEdit ? '수정' : '등록'}
      onclick={handleSubmit}
      disabled={isSubmitting || !question.trim() || !answer.trim()}
    />
  {/snippet}
</BaseModal>
