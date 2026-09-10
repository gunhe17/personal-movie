<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Checkbox from '$components/Checkbox.svelte'
  import Select from '$components/Select.svelte'
  import Input from '$components/Input.svelte'
  import RichEditor from '$components/RichEditor.svelte'
  import FileAttachment from '$components/FileAttachment.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getNoticeDetail,
    type NoticeDetailResponse,
    type NoticeCategory,
    type AttachmentItem
  } from '$hooks/actions/notice.action'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { formatDate } from '$utils/format'
  import {
    CATEGORY_OPTIONS,
    CATEGORY_LABELS
  } from '$lib/features/notices/constants'
  import { createNoticeDetailService } from '$lib/features/notices/notice-detail-service'
  import NoticeReadStatus from './components/NoticeReadStatus.svelte'
  import { fade } from 'svelte/transition'

  // ─── 파라미터 ───
  const noticeId = $derived(page.params.noticeId)

  // ─── 서비스 ───
  const service = createNoticeDetailService({ queryClient: useQueryClient() })

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder<any, any>(getNoticeDetail, () => ({ noticeId }))
  )
  const notice = $derived<NoticeDetailResponse | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)

  // ─── 수정 폼 상태 ───
  let isEditing = $state(false)
  let formTitle = $state('')
  let formContent = $state('')
  let formCategory = $state<NoticeCategory>('announcement')
  let formIsPinned = $state(false)
  let formAttachments = $state<AttachmentItem[]>([])
  let isSaving = $state(false)

  const canSave = $derived(
    formTitle.trim().length > 0 && formContent.trim().length > 0
  )

  function startEditing() {
    if (!notice) return
    formTitle = notice.title
    formContent = notice.content
    formCategory = notice.category
    formIsPinned = notice.is_pinned
    formAttachments = notice.attachments ? [...notice.attachments] : []
    isEditing = true
  }

  async function handleSave() {
    if (!canSave || isSaving) return
    isSaving = true
    const ok = await service.save(noticeId!, {
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      is_pinned: formIsPinned,
      attachments: formAttachments
    })
    isSaving = false
    if (ok) isEditing = false
  }

  // ─── 스타일 ───
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
  const DATE_FORMAT = 'YYYY-MM-DD HH:mm'
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

    {#if isLoading}
      <Typography variant="headline-01-normal-bold" tag="h1"
        >불러오는 중...</Typography
      >
    {:else if notice}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Typography variant="headline-01-normal-bold" tag="h1"
            >공지사항 상세</Typography
          >
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            class:bg-green-50={notice.is_published}
            class:text-green-700={notice.is_published}
            class:bg-gray-100={!notice.is_published}
            class:text-gray-500={!notice.is_published}
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              class:bg-green-500={notice.is_published}
              class:bg-gray-400={!notice.is_published}
            ></span>
            {notice.is_published ? '게시됨' : '초안'}
          </span>
        </div>

        <div class="flex items-center gap-2">
          {#if !isEditing}
            {#if notice.is_published}
              <button
                onclick={() => service.unpublish(noticeId!)}
                class="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                게시 취소
              </button>
            {:else}
              <button
                onclick={() => service.publish(noticeId!)}
                class="rounded-lg bg-primary-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
              >
                게시하기
              </button>
            {/if}
          {/if}
          <button
            onclick={() =>
              service.remove(noticeId!, notice?.is_published ?? false)}
            class="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <TrashIcon size={18} />
            삭제하기
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if notice}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-4">
      <!-- 공지 내용 -->
      <div class="section-border p-6">
        <div class="mb-4 flex items-center justify-between">
          <Typography variant="title-01-normal-semibold" tag="h2">
            공지 내용
          </Typography>
          {#if isEditing}
            <Button
              color="primary"
              size="md"
              content="수정하기"
              disabled={isSaving || !canSave}
              onclick={handleSave}
            />
          {:else}
            <button
              onclick={startEditing}
              class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
              title="수정"
            >
              <EditIcon size={20} />
            </button>
          {/if}
        </div>

        {#if isEditing}
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label class={labelClass}>
                  유형 <span class="text-red-500">*</span>
                </label>
                <Select
                  class="h-11 w-full bg-white rounded-lg"
                  selected={formCategory}
                  on:change={(e) => (formCategory = e.detail.value)}
                  options={CATEGORY_OPTIONS}
                />
              </div>
            </div>

            <Input
              label="제목"
              required
              bind:value={formTitle}
              maxlength={200}
            />

            <RichEditor
              label="내용"
              required
              bind:value={formContent}
              hasLinkOption
              hasImageOption
              imageEntityId={noticeId}
            />

            <FileAttachment bind:attachments={formAttachments} {noticeId} />

            <div class="flex items-center gap-3">
              <Checkbox id="edit_is_pinned" bind:checked={formIsPinned} />
              <label
                for="edit_is_pinned"
                class="text-sm text-gray-700 cursor-pointer"
              >
                상단에 고정
              </label>
            </div>
          </div>
        {:else}
          <!-- 카테고리 뱃지 + 고정 뱃지 -->
          <div class="flex items-center gap-2 mb-3">
            <span
              class="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
            >
              {CATEGORY_LABELS[notice.category] ?? notice.category}
            </span>
            {#if notice.is_pinned}
              <span
                class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
              >
                고정
              </span>
            {/if}
          </div>

          <!-- 제목 -->
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {notice.title}
          </h3>

          <!-- 구분선 -->
          <hr class="border-gray-200 mb-5" />

          <!-- 본문 -->
          <div class="prose prose-sm max-w-none text-gray-800 min-h-30">
            {@html notice.content}
          </div>

          <!-- 첨부파일 (읽기 전용) -->
          {#if notice.attachments && notice.attachments.length > 0}
            <div class="mt-6">
              <FileAttachment attachments={notice.attachments} readonly />
            </div>
          {/if}
        {/if}
      </div>

      <!-- 메타 정보 -->
      <div class="section-border p-6">
        <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
          >메타 정보</Typography
        >
        <dl class="space-y-3">
          <div class="flex">
            <dt class="w-28 shrink-0 text-sm text-gray-500">작성일</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(notice.created_at, DATE_FORMAT)}
            </dd>
          </div>
          <div class="flex">
            <dt class="w-28 shrink-0 text-sm text-gray-500">수정일</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(notice.updated_at, DATE_FORMAT)}
            </dd>
          </div>
          {#if notice.published_at}
            <div class="flex">
              <dt class="w-28 shrink-0 text-sm text-gray-500">게시일</dt>
              <dd class="text-sm text-gray-900">
                {formatDate(notice.published_at, DATE_FORMAT)}
              </dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- 조회 현황 -->
      {#if notice.is_published}
        <NoticeReadStatus
          noticeId={noticeId!}
          onNotifyUnread={service.notifyUnread}
        />
      {/if}
    </div>
  {/if}
</div>
