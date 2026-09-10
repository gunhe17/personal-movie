<script lang="ts">
  import { fly } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import {
    pushToastStore,
    type PushToastData
  } from '../stores/push-toast.store'
  import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    DEFAULT_CATEGORY_COLOR,
    EVENT_TYPE_LABELS
  } from '../constants'
  import { goto } from '$app/navigation'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'

  const toasts: PushToastData[] = $derived($pushToastStore)

  /** 카테고리별 좌측 accent bar 색상 */
  const ACCENT_COLORS: Record<string, string> = {
    assessment: 'bg-blue-500',
    counseling: 'bg-amber-500',
    system: 'bg-gray-400'
  }

  function handleClick(toast: PushToastData) {
    pushToastStore.dismiss(toast.id)
    if (toast.navigateTo) {
      goto(toast.navigateTo)
    }
  }

  function handleDismiss(e: MouseEvent, id: string) {
    e.stopPropagation()
    pushToastStore.dismiss(id)
  }
</script>

{#if toasts.length > 0}
  <div class="fixed top-4 right-4 z-20000 flex flex-col gap-2.5">
    {#each toasts as toast (toast.id)}
      {#if toast.isVisible}
        {@const accent = ACCENT_COLORS[toast.category ?? ''] ?? 'bg-gray-400'}
        {@const badgeColor =
          CATEGORY_COLORS[toast.category ?? ''] ?? DEFAULT_CATEGORY_COLOR}
        {@const categoryLabel = CATEGORY_LABELS[toast.category ?? ''] ?? '알림'}
        {@const eventLabel = EVENT_TYPE_LABELS[toast.eventType ?? ''] ?? ''}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          role="button"
          tabindex="0"
          class="flex w-95 cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-lg transition-colors hover:bg-gray-50"
          onclick={() => handleClick(toast)}
          onkeydown={(e) => {
            if (e.key === 'Enter') handleClick(toast)
          }}
          in:fly|global={{ x: 100, duration: 400, easing: quintOut }}
          out:fly|global={{ x: 100, duration: 300, easing: quintOut }}
        >
          <!-- 좌측 accent bar -->
          <div class="w-1 shrink-0 {accent}"></div>

          <!-- 본문 -->
          <div class="flex flex-1 items-start gap-3 px-4 py-3.5">
            <!-- 벨 아이콘 -->
            <div
              class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
            >
              <svg
                class="h-4.5 w-4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
            </div>

            <!-- 텍스트 -->
            <div class="min-w-0 flex-1">
              <!-- 카테고리 배지 + 이벤트 라벨 -->
              <div class="mb-1 flex items-center gap-2">
                <BadgeRectangle label={categoryLabel} color={badgeColor} />
                {#if eventLabel}
                  <span class="text-body-03-normal-regular text-gray-400"
                    >{eventLabel}</span
                  >
                {/if}
              </div>

              <!-- 제목 -->
              <p
                class="text-sm font-semibold text-gray-900 leading-snug truncate-safe"
              >
                {toast.title}
              </p>

              <!-- 본문 -->
              {#if toast.body}
                <p
                  class="mt-0.5 text-xs text-gray-500 leading-relaxed line-clamp-2"
                >
                  {toast.body}
                </p>
              {/if}
            </div>

            <!-- 닫기 버튼 -->
            <Tooltip text="닫기">
              <button
                type="button"
                class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-300 transition-colors hover:text-gray-500"
                onclick={(e) => handleDismiss(e, toast.id)}
                aria-label="닫기"
              >
                <svg
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}
