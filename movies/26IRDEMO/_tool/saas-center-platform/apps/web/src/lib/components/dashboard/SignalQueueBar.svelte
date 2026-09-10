<script lang="ts">
  import { slide } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { navigating, page } from '$app/state'
  import { signalQueue } from '$lib/stores/signal-queue.svelte'

  // onClear: 페이지 측 정리(시그널 필터 해제 등) — 바 닫기(✕) 시 호출.
  // fallback: 큐 없이 시그널 필터만 있는 진입(공유 URL·새 탭)에서 보여줄 축소 모드 라벨
  // — 큐 바와 같은 시각 언어의 단일 항목 바로 렌더된다.
  // 강조색은 primary 하나(배지 + 다음 액션)로 제한 — 톤 색·펄스는 대시보드 카드 몫.
  let {
    onClear,
    fallback = null
  }: {
    onClear?: () => void
    fallback?: { label: string } | null
  } = $props()

  const queue = $derived(signalQueue.value)
  const current = $derived(signalQueue.current)
  // 이동 중에는 목적지 URL로 판정한다. 같은 페이지 안에서 항목을 옮기면(상담 시그널 2종)
  // 스토어 인덱스는 이미 새 항목인데 page.url은 아직 이전 항목이라, 그 틈에 축소 모드
  // 바가 끼어들어 두 줄로 깜빡였다.
  const visible = $derived(
    signalQueue.activeFor(navigating.to?.url ?? page.url)
  )
  // 다른 화면으로 떠나는 중이면 축소 모드도 띄우지 않는다(언마운트 직전 깜빡임 방지)
  const leaving = $derived(
    !!navigating.to && navigating.to.url.pathname !== page.url.pathname
  )

  const hasPrev = $derived(!!queue && queue.index > 0)
  const hasNext = $derived(!!queue && queue.index < queue.signals.length - 1)

  // 명사구 + 건수로 조립. 이전 세션에 저장된 구 스키마 큐는 저장돼 있던 문장을 그대로 쓴다.
  const currentText = $derived(
    current
      ? current.noun
        ? `${current.noun} ${current.count}${current.unit}`
        : (current.label ?? current.title ?? '')
      : ''
  )

  function goDashboard() {
    signalQueue.clear()
    goto('/dashboard')
  }

  function goPrev() {
    if (!queue || !hasPrev) return
    const i = queue.index - 1
    signalQueue.setIndex(i)
    goto(queue.signals[i].href)
  }

  function goNext() {
    if (!queue || !hasNext) return
    const i = queue.index + 1
    signalQueue.setIndex(i)
    goto(queue.signals[i].href)
  }

  function dismiss() {
    signalQueue.clear()
    onClear?.()
  }
</script>

{#if visible && queue && current}
  <div
    out:slide={{ duration: 220 }}
    class="mb-2.5 flex h-11 shrink-0 items-center gap-3 rounded-lg border border-gray-200 bg-white pl-3 pr-2 shadow-sm"
  >
    <span
      class="flex h-6 shrink-0 items-center rounded-full bg-primary-50 px-2.5 text-label-01-normal-medium text-primary-600"
    >
      처리해 주세요 {queue.index + 1}/{queue.signals.length}
    </span>
    <span
      class="min-w-0 flex-1 truncate-safe text-body-02-normal-medium text-gray-800"
    >
      {currentText}
    </span>

    <div class="flex shrink-0 items-center gap-1">
      <button
        class="h-8 rounded-lg px-2.5 text-body-02-normal-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        onclick={goPrev}
        disabled={!hasPrev}
      >
        ← 이전
      </button>
      {#if hasNext}
        <button
          class="h-8 rounded-lg px-2.5 text-body-02-normal-medium text-primary-500 hover:bg-primary-50"
          onclick={goNext}
        >
          다음 항목 →
        </button>
      {:else}
        <button
          class="h-8 rounded-lg px-2.5 text-body-02-normal-medium text-primary-500 hover:bg-primary-50"
          onclick={goDashboard}
        >
          대시보드로 돌아가기
        </button>
      {/if}
      {#if hasNext}
        <button
          class="h-8 rounded-lg px-2.5 text-body-02-normal-medium text-gray-500 hover:bg-gray-50"
          onclick={goDashboard}
        >
          대시보드
        </button>
      {/if}
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        onclick={dismiss}
        aria-label="살펴보기 닫기"
      >
        ✕
      </button>
    </div>
  </div>
{:else if fallback && !leaving}
  <!-- 축소 모드: 큐 없이 필터 컨텍스트만 — 같은 바 형태, 카운터·이전/다음 없음 -->
  <div
    out:slide={{ duration: 220 }}
    class="mb-2.5 flex h-11 shrink-0 items-center gap-3 rounded-lg border border-gray-200 bg-white pl-3 pr-2 shadow-sm"
  >
    <span
      class="flex h-6 shrink-0 items-center rounded-full bg-primary-50 px-2.5 text-label-01-normal-medium text-primary-600"
    >
      처리해 주세요
    </span>
    <span
      class="min-w-0 flex-1 truncate-safe text-body-02-normal-medium text-gray-800"
    >
      {fallback.label}
    </span>
    <div class="flex shrink-0 items-center gap-1">
      <button
        class="h-8 rounded-lg px-2.5 text-body-02-normal-medium text-gray-500 hover:bg-gray-50"
        onclick={goDashboard}
      >
        대시보드
      </button>
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        onclick={() => onClear?.()}
        aria-label="필터 해제"
      >
        ✕
      </button>
    </div>
  </div>
{/if}
