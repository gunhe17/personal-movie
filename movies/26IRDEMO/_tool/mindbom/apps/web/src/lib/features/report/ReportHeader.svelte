<script lang="ts">
  /**
   * 종합보고서 편집 화면의 최상단 헤더.
   *
   * 전폭 최상단에 놓이고 사이드바가 그 아래로 들어간다 — 검사 진행 화면
   * (ExamLayoutShell)과 같은 순서다. 화면 이름은 헤더가 갖고, 사이드바는
   * 검사자료와 내담자만 담는다.
   *
   * 출구(목록으로)도 여기 하나로 모은다. 예전엔 사이드바에 링크가 따로
   * 있었는데, 검사 화면과 나가는 자리가 달라 헷갈렸다.
   */
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'

  interface Props {
    /** 본문 분량 — 화면 이름 뒤에 붙는 "지금 상태" */
    paras: number
    chars: number
    /** PDF 생성 중 */
    generating: boolean
    /** 검사 정보 로드 완료 — 그 전엔 생성 버튼을 잠근다 */
    ready: boolean
    ongenerate: () => void
    onexit: () => void
  }

  let { paras, chars, generating, ready, ongenerate, onexit }: Props = $props()
</script>

<header
  class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-chrome-line bg-chrome px-4 md:px-6"
>
  <div class="flex min-w-0 items-baseline gap-2">
    <h1 class="shrink-0 text-body-01-normal-bold text-chrome-fg">종합보고서</h1>
    <span
      class="hidden shrink-0 text-label-01-normal-regular text-chrome-fg-3 md:inline"
    >
      검사 결과 통합 · 작성
    </span>
    <span class="shrink-0 text-chrome-fg-3">/</span>
    <span class="truncate text-body-02-normal-medium text-chrome-fg-2">
      문단 {paras} · 글자 {chars}
    </span>
  </div>

  <div class="flex shrink-0 items-center gap-2">
    <button
      type="button"
      onclick={ongenerate}
      disabled={generating || !ready}
      class="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-500 px-4 text-label-01-normal-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {#if generating}
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        ></span>
        생성 중…
      {:else}
        보고서 생성
      {/if}
    </button>

    <button
      type="button"
      onclick={onexit}
      class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-chrome-line px-3 text-label-01-normal-medium text-chrome-fg-2 transition-colors hover:bg-chrome-hover hover:text-chrome-fg"
    >
      <ArrowLeft size={16} />
      목록으로
    </button>
  </div>
</header>
