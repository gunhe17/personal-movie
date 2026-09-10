<script lang="ts">
  import type { Snippet } from 'svelte'
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  let {
    modalId = '',
    closeModal = () => {},
    title,
    subtitle = '',
    canSubmit,
    isSubmitting,
    onSubmit,
    submitLabel = '청구서 생성',
    summary,
    showSummary = true,
    children
  } = $props<{
    modalId?: string
    closeModal?: () => void
    title: string
    /** 타이틀 아래 설명 한 줄 (2줄 헤더 — Web_Design.md §Components>modal) */
    subtitle?: string
    canSubmit: boolean
    isSubmitting: boolean
    onSubmit: () => void
    submitLabel?: string
    /** 하단 고정 계산서 영역 — 스크롤과 무관하게 액션 바 위에 붙어 있는다 */
    summary?: Snippet
    showSummary?: boolean
    children: Snippet
  }>()
</script>

<BaseModal
  {modalId}
  {closeModal}
  showFooterBorder={false}
  bodyClass="p-0 overflow-hidden flex flex-col min-h-0"
  bodyScrollable={false}
  headerClass={subtitle ? 'px-5 py-4 items-start' : 'px-5 py-4'}
  footerClass="hidden"
>
  {#snippet header()}
    <!-- 모달 헤더 = 좌우 20 · 상하 16 · 타이틀 L(20/600).
         부제가 붙는 2줄 헤더만 상단 정렬 + 타이틀↔부제 8 (Web_Design.md §Components>modal) -->
    <div class="flex flex-col gap-2">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        {title}
      </Typography>
      {#if subtitle}
        <Typography variant="body-02-normal-regular" color="text-body-subtle">
          {subtitle}
        </Typography>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    <!-- 스크롤 영역 — 본문 상·좌·우 20 · 하 28 -->
    <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-7">
      <div class="flex flex-col gap-6">
        {@render children()}
      </div>
    </div>

    <!-- 하단 고정 — 계산서 + 액션 바가 한 층으로 붙어 있고 본문이 그 아래로 지나간다 -->
    <div class="shrink-0 bg-white">
      {#if summary && showSummary}
        <!-- 계산서가 붙고 빠질 때 모달 높이가 한 번에 튀지 않도록 높이를 전이시킨다.
             (패널 높이는 콘텐츠가 정하므로 이 블록의 slide가 곧 모달의 성장이다) -->
        <div
          class="shadow-sticky-top"
          transition:slide={{ duration: 220, easing: cubicOut }}
        >
          <div class="px-5 pt-4">
            {@render summary()}
          </div>
        </div>
      {:else}
        <!-- 계산서가 없을 땐 MD 모달 footer 규격의 구분선(1px border-default)이
             본문 끝과 액션 바를 가른다. 계산서가 있으면 고정층 그림자가 그 경계를
             대신하므로 선을 두지 않는다. (Web_Design.md §Components>modal Footer) -->
        <div class="border-t border-border-default"></div>
      {/if}
      <div class="px-5 pt-4 pb-5">
        <div class="grid w-full grid-cols-2 gap-3">
          <button
            class="flex-center h-11 w-full rounded-lg border border-gray-200 text-body-01-normal-medium text-gray-700 hover:border-gray-300 duration-200"
            onclick={closeModal}
          >
            취소
          </button>
          <button
            onclick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            class="flex-center h-11 w-full rounded-lg text-body-01-normal-medium text-white duration-200 disabled:opacity-50 {canSubmit &&
            !isSubmitting
              ? 'bg-mint-500 hover:bg-mint-600'
              : 'cursor-not-allowed bg-gray-300'}"
          >
            {isSubmitting ? '처리 중...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  {/snippet}
</BaseModal>
