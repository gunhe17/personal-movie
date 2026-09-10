<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Checkbox from '$components/Checkbox.svelte'
  import Select from '$components/Select.svelte'
  import Input from '$components/Input.svelte'
  import RichEditor from '$components/RichEditor.svelte'
  import FileAttachment from '$components/FileAttachment.svelte'
  import { mutationBuilder } from '$hooks/queries/builder'
  import {
    postCreateNotice,
    type NoticeCategory,
    type AttachmentItem
  } from '$hooks/actions/notice.action'
  import { fade } from 'svelte/transition'

  // ─── 셀렉트 옵션 ───
  const CATEGORY_OPTIONS = [
    { value: 'maintenance', title: '점검 안내' },
    { value: 'update', title: '업데이트' },
    { value: 'announcement', title: '일반 공지' }
  ]

  // ─── 폼 상태 ───
  let category = $state<NoticeCategory>('announcement')
  let title = $state('')
  let content = $state('')
  let is_pinned = $state(false)
  let attachments = $state<AttachmentItem[]>([])

  // ─── 뮤테이션 ───
  const createMutation = mutationBuilder(postCreateNotice)

  const isSubmitting = $derived(createMutation.isPending)
  const canSubmit = $derived(title.trim().length > 0 && content.trim().length > 0)

  // ─── 등록 ───
  function handleCreate() {
    if (!canSubmit) return

    createMutation.mutate(
      {
        title: title.trim(),
        content: content.trim(),
        category,
        is_published: false,
        is_pinned,
        attachments: attachments.length > 0 ? attachments : undefined
      },
      {
        onSuccess: (data: any) => {
          goto(`/notices/${data.id}`)
        }
      }
    )
  }

  // ─── 스타일 ───
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
</script>

<div in:fade class="p-6">
  <!-- 뒤로가기 + 헤더 -->
  <div class="mb-6">
    <button
      onclick={() => goto('/notices')}
      class="mb-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
    >
      ← 공지사항 목록
    </button>
    <Typography variant="headline-01-normal-bold" tag="h1">공지사항 작성</Typography>
  </div>

  <!-- svelte-ignore a11y_label_has_associated_control -->
  <div class="space-y-4">
    <!-- 공지 내용 -->
    <div class="section-border p-6">
      <div class="mb-4 flex items-center justify-between">
        <Typography variant="title-01-normal-semibold" tag="h2">공지 내용</Typography>
        <Button
          color="primary"
          size="md"
          content="등록하기"
          disabled={isSubmitting || !canSubmit}
          onclick={handleCreate}
        />
      </div>

      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class={labelClass}>
              유형 <span class="text-red-500">*</span>
            </label>
            <Select
              class="h-11 w-full bg-white rounded-lg"
              selected={category}
              on:change={(e) => (category = e.detail.value)}
              options={CATEGORY_OPTIONS}
            />
          </div>
        </div>

        <Input
          label="제목"
          required
          bind:value={title}
          placeholder="공지 제목을 입력하세요"
          maxlength={200}
        />

        <RichEditor
          label="내용"
          required
          bind:value={content}
          placeholder="공지 내용을 입력하세요"
          hasLinkOption
          hasImageOption
        />

        <FileAttachment bind:attachments />

        <div class="flex items-center gap-3">
          <Checkbox id="is_pinned" bind:checked={is_pinned} />
          <label for="is_pinned" class="text-sm text-gray-700 cursor-pointer">
            상단에 고정
          </label>
        </div>
      </div>
    </div>

  </div>
</div>
