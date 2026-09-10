<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getNoticeDetail } from '$lib/hooks/actions/notice.action'
  import {
    CATEGORY_LABELS,
    CATEGORY_COLORS
  } from '$lib/features/notice/constants'
  import { centerId as centerIdStore } from '$lib/stores/center.store'
  import { get } from 'svelte/store'
  import { formatUtcToKst } from '$lib/utils/date'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import DownloadIcon20 from '$lib/assets/DownloadIcon20.svelte'
  import PinIcon24 from '$lib/assets/PinIcon24.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'

  const noticeId = $derived($page.params.id)

  const detailQuery = $derived(
    queryBuilder(getNoticeDetail, () => ({
      noticeId,
      center_id: get(centerIdStore) ?? undefined
    }))
  )

  const notice = $derived(detailQuery.data)
  const siblings = $derived(notice?.siblings ?? { prev: null, next: null })

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  async function downloadFile(url: string, name: string) {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }
</script>

<div in:fade class="h-full flex flex-col">
  <!-- 상단 네비게이션 — 브레드크럼(내담자·상담·검사 상세와 동일 규격) -->
  <nav
    class="mb-2 flex h-11 shrink-0 items-center gap-2"
    aria-label="breadcrumb"
  >
    <button
      onclick={() => goto('/notice')}
      aria-label="뒤로가기"
      class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <ArrowBackIcon />
    </button>

    <button
      onclick={() => goto('/notice')}
      class="transition-colors hover:text-body-default"
    >
      <Typography
        variant="body-02-normal-regular"
        tag="span"
        color="text-body-subtle"
      >
        공지사항
      </Typography>
    </button>
    {#if notice}
      <Typography
        variant="body-02-normal-regular"
        tag="span"
        color="text-gray-300"
      >
        /
      </Typography>
      <Typography
        variant="body-02-normal-medium"
        tag="span"
        color="text-body-default"
        className="truncate-safe"
      >
        {notice.title}
      </Typography>
    {/if}
  </nav>

  {#if detailQuery.isLoading}
    <div
      class="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white"
    >
      <Typography variant="body-01-normal-regular" color="text-body-default">
        로딩 중...
      </Typography>
    </div>
  {:else if notice}
    <div
      class="flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-card"
    >
      <!-- 헤더 -->
      <div class="mb-6 border-b border-border-subtle pb-6">
        <div class="mb-3 flex items-center gap-2">
          <BadgeRectangle
            label={CATEGORY_LABELS[notice.category]}
            color={CATEGORY_COLORS[notice.category]}
          />
          <!-- 고정은 분류가 아니라 배치 속성 — 유형 배지와 같은 배지 형태로 두면
               파란 배지 둘이 나란히 서서 어느 쪽이 유형인지 흐려진다. 목록과 같은 압정 마커로 표시 -->
          {#if notice.is_pinned}
            <span class="flex items-center gap-1">
              <PinIcon24 />
              <Typography
                variant="body-03-normal-medium"
                tag="span"
                color="text-body-default"
              >
                상단 고정
              </Typography>
            </span>
          {/if}
        </div>
        <Typography
          variant="headline-02-normal-semibold"
          tag="h1"
          className="mb-3"
        >
          {notice.title}
        </Typography>
        <!-- 인라인 병기 데이터 — 값 · 세로선(1px h-3) · 값 (§반복 패턴) -->
        <div class="flex items-center gap-1.5">
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-default"
          >
            {notice.created_by_name ?? '관리자'}
          </Typography>
          <span class="h-3 w-px bg-border-strong" aria-hidden="true"></span>
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-default"
          >
            {formatUtcToKst(
              notice.published_at ?? notice.created_at,
              'YYYY-MM-DD HH:mm'
            )}
          </Typography>
        </div>
      </div>

      <!-- 본문 -->
      <div
        class="prose prose-gray max-w-none flex-1 text-body-01-reading-regular text-gray-800"
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html notice.content}
      </div>

      <!-- 첨부파일 -->
      {#if notice.attachments && notice.attachments.length > 0}
        <div class="mt-6 border-t border-border-subtle pt-6">
          <!-- 섹션 M 타이틀(텍스트만) — 행 높이 24 · 아래 콘텐츠와 gap 16 -->
          <div class="mb-4 flex h-6 items-center gap-1">
            <Typography variant="title-01-normal-semibold" tag="h2">
              첨부파일
            </Typography>
            <Typography
              variant="body-03-normal-regular"
              color="text-title-subtitle"
            >
              {notice.attachments.length}
            </Typography>
          </div>
          <ul class="flex flex-col gap-2">
            {#each notice.attachments as file (file.path)}
              <li>
                <button
                  type="button"
                  onclick={() => downloadFile(file.url, file.name)}
                  class="flex h-12 w-full items-center gap-2 rounded-lg border border-border-default px-4 transition-colors hover:bg-gray-50"
                >
                  <DownloadIcon20 />
                  <span
                    class="flex-1 truncate-safe text-left text-body-02-normal-regular text-body-default"
                    >{file.name}</span
                  >
                  <span
                    class="shrink-0 text-body-02-normal-regular text-body-default"
                    >{formatFileSize(file.size)}</span
                  >
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- 이전글 / 다음글 -->
      {#if siblings.prev || siblings.next}
        <div class="mt-6 border-t border-border-subtle">
          {#if siblings.prev}
            <button
              type="button"
              onclick={() => goto(`/notice/${siblings.prev!.id}`)}
              class="group flex h-14 w-full items-center gap-3 border-b border-border-subtle px-2 transition-colors hover:bg-gray-50"
            >
              <span class="flex rotate-180"><ArrowDownIcon20 /></span>
              <span
                class="w-12 shrink-0 text-left text-body-02-normal-medium text-title-subtitle"
                >이전글</span
              >
              <span
                class="min-w-0 flex-1 truncate-safe text-left text-body-02-normal-regular text-body-default"
                >{siblings.prev.title}</span
              >
            </button>
          {/if}
          {#if siblings.next}
            <button
              type="button"
              onclick={() => goto(`/notice/${siblings.next!.id}`)}
              class="group flex h-14 w-full items-center gap-3 px-2 transition-colors hover:bg-gray-50"
            >
              <span class="flex"><ArrowDownIcon20 /></span>
              <span
                class="w-12 shrink-0 text-left text-body-02-normal-medium text-title-subtitle"
                >다음글</span
              >
              <span
                class="min-w-0 flex-1 truncate-safe text-left text-body-02-normal-regular text-body-default"
                >{siblings.next.title}</span
              >
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div
      class="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white"
    >
      <Typography variant="body-01-normal-regular" color="text-body-default">
        공지사항을 찾을 수 없어요
      </Typography>
    </div>
  {/if}
</div>
