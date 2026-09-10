<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'

  interface Props {
    /** 다음 페이지 로드 트리거 */
    onLoadMore: () => void
    /** 더 불러올 페이지가 있는지 */
    hasMore: boolean
    /** 다음 페이지 로딩 중인지 (중복 트리거 방지) */
    loading: boolean
    /** 미리 로드 시작 여백 */
    rootMargin?: string
  }

  let {
    onLoadMore,
    hasMore,
    loading,
    rootMargin = '400px 0px'
  }: Props = $props()

  let sentinel: HTMLDivElement | null = $state(null)
  let isIntersecting = $state(false)

  onMount(() => {
    if (!browser || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        isIntersecting = entries[0]?.isIntersecting ?? false
      },
      { rootMargin }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })

  // sentinel 이 보이고 있고 아직 로딩 전 + 더 있을 때만 로드.
  // (짧은 목록이라 로드 후에도 계속 보이는 경우까지 이어서 트리거)
  $effect(() => {
    if (isIntersecting && hasMore && !loading) {
      onLoadMore()
    }
  })
</script>

<div bind:this={sentinel} class="h-px w-full" aria-hidden="true"></div>

{#if loading}
  <div class="flex justify-center py-6">
    <div
      class="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"
    ></div>
  </div>
{/if}
