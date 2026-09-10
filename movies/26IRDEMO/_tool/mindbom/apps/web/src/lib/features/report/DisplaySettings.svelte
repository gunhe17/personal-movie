<script lang="ts">
  /**
   * 화면 표시 설정 — 툴바 아래 좌상단에 떠 있는 톱니 버튼과 패널.
   *
   * 표지/마무리를 화면에서만 감춘다. PDF엔 항상 포함되므로 "숨김"이 아니라
   * "편집 화면 시야 정리"다 — 패널 아래 안내 문구가 그 말을 한다.
   *
   * 바깥 클릭으로 닫는 일은 호출부가 한다(mouseup 한 번에 구간 선택 판정과
   * 함께 처리해야 해서). 여기 컨테이너의 data-display-panel이 그 표식이다.
   */
  import Switch from '$lib/components/ui/Switch.svelte'

  interface Props {
    open: boolean
    hideCover: boolean
    hideClosing: boolean
    ontoggle: () => void
  }

  let {
    open,
    hideCover = $bindable(),
    hideClosing = $bindable(),
    ontoggle
  }: Props = $props()

  /** 버튼의 숫자 뱃지 — 지금 몇 장을 감추고 있는지 */
  let hiddenCount = $derived((hideCover ? 1 : 0) + (hideClosing ? 1 : 0))
</script>

<div class="absolute left-4 top-4 z-20" data-display-panel>
  <button
    type="button"
    onclick={ontoggle}
    class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 shadow-md ring-1 transition-colors
      {open
      ? 'bg-chrome-hover text-chrome-fg ring-chrome-line'
      : 'bg-chrome-raised text-chrome-fg-2 ring-chrome-line hover:bg-chrome-hover hover:text-chrome-fg'}"
    aria-label="화면 표시 설정"
    aria-expanded={open}
    title="화면 표시 설정"
  >
    <span class="material-icons-round text-lg">tune</span>
    {#if hiddenCount > 0}
      <span
        class="rounded-full bg-primary-500 px-1.5 py-px text-label-02-normal-bold text-white"
      >
        {hiddenCount}
      </span>
    {/if}
  </button>

  {#if open}
    <div
      class="spread-panel mt-2 w-60 rounded-xl bg-chrome-raised p-3 shadow-xl ring-1 ring-chrome-line"
    >
      <p
        class="mb-2.5 text-label-01-reading-semibold uppercase tracking-wide text-chrome-fg-3"
      >
        화면 표시
      </p>
      <div class="space-y-2.5">
        <label class="flex items-center justify-between gap-3">
          <span class="text-body-02-normal-regular text-chrome-fg-2">
            표지 숨기기
          </span>
          <Switch bind:checked={hideCover} ariaLabel="표지 숨기기" />
        </label>
        <label class="flex items-center justify-between gap-3">
          <span class="text-body-02-normal-regular text-chrome-fg-2">
            마지막장 숨기기
          </span>
          <Switch bind:checked={hideClosing} ariaLabel="마지막장 숨기기" />
        </label>
      </div>
      <p class="mt-2.5 text-label-01-reading-regular text-chrome-fg-3">
        화면에서만 감춰지며 PDF에는 그대로 포함됩니다.
      </p>
    </div>
  {/if}
</div>

<style>
  /* 좌상단 기준으로 펼쳐지는 spread 애니메이션 */
  .spread-panel {
    transform-origin: top left;
    animation: spread-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes spread-in {
    0% {
      opacity: 0;
      transform: scale(0.88) translate(-6px, -6px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translate(0, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spread-panel {
      animation: none;
    }
  }
</style>
