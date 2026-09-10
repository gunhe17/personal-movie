<script lang="ts">
  /**
   * 본문에서 구간을 선택했을 때 옆에 뜨는 'AI 분석' 버튼.
   *
   * 선택 직후엔 버튼만 띄운다 — 편집 중에 결과 카드가 튀어나오지 않게 하려는
   * 것이고, 결과는 누른 뒤 AiReviewCard가 같은 좌표에 뜬다.
   *
   * data-ai-review는 호출부의 mouseup 판정(span-selection.ts)이 "이 클릭은
   * 리뷰 UI 내부"라고 알아보는 표식이다. 없으면 버튼을 누르는 순간 선택이
   * 풀린 것으로 판정돼 스스로 닫힌다.
   */
  import type { SpanPhase } from './span-review.svelte'

  interface Props {
    phase: SpanPhase
    /** 뷰포트 기준 좌표 — 선택 영역 오른쪽 아래 */
    x: number
    y: number
    onrun: () => void
  }

  let { phase, x, y, onrun }: Props = $props()
</script>

{#if phase === 'prompt' || phase === 'analyzing'}
  <div class="ai-btn-wrap fixed z-80" style="left:{x}px; top:{y}px" data-ai-review>
    <div class="relative">
      <!-- 뒤에서 번지는 빛 -->
      <div class="ai-glow absolute inset-0 rounded-full"></div>
      <!-- 등장 시 한 번 퍼지는 링 -->
      {#if phase === 'prompt'}
        <div
          class="ai-ring pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary-400"
        ></div>
      {/if}
      <button
        type="button"
        onclick={onrun}
        disabled={phase === 'analyzing'}
        class="ai-btn relative flex min-w-26 items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 py-2 text-body-03-normal-semibold text-white shadow-lg ring-1 ring-white/20 transition-transform active:scale-95 disabled:cursor-wait"
      >
        <!-- 아이콘 자리를 16px로 고정 — 스피너와 별 아이콘의 크기가 달라
             상태가 바뀔 때 버튼이 흔들렸다. 글자 수도 5자로 같게 맞춘다. -->
        <span class="flex h-4 w-4 shrink-0 items-center justify-center">
          {#if phase === 'analyzing'}
            <span
              class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            ></span>
          {:else}
            <span class="material-icons-round text-[16px]">auto_awesome</span>
          {/if}
        </span>
        {phase === 'analyzing' ? '분석 중…' : 'AI 분석'}
      </button>
    </div>
  </div>
{/if}

<style>
  /* 무한 반복 애니메이션(그라데이션 흐름·발광 호흡·아이콘 반짝임)은 제거했다.
     계속 움직이면 본문을 읽는 동안 시선이 붙잡힌다. 등장 순간의 모션만 남긴다. */
  .ai-btn-wrap {
    transform-origin: left top;
    animation: ai-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes ai-pop {
    0% {
      opacity: 0;
      transform: scale(0.92) translateY(-4px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* 뒤에서 번지는 빛 — 등장할 때 한 번만 퍼졌다가 은은하게 가라앉는다 */
  .ai-glow {
    background: linear-gradient(90deg, #256ef4, #1b51b5);
    filter: blur(11px);
    animation: ai-glow-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes ai-glow-in {
    0% {
      opacity: 0;
      transform: scale(0.85);
    }
    35% {
      opacity: 0.7;
      transform: scale(1.1);
    }
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
  }

  .ai-btn {
    background: linear-gradient(90deg, #256ef4, #1b51b5);
  }

  /* 표면을 훑고 지나가는 반짝임 — 등장 직후 한 번만 */
  .ai-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      110deg,
      transparent 30%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 70%
    );
    background-size: 220% 100%;
    animation: ai-shine 0.8s ease-in-out 0.2s both;
    pointer-events: none;
  }
  @keyframes ai-shine {
    0% {
      background-position: 140% 0;
    }
    100% {
      background-position: -60% 0;
    }
  }

  /* 등장 시 한 번 퍼지는 링 */
  .ai-ring {
    animation: ai-ripple 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
  }
  @keyframes ai-ripple {
    0% {
      opacity: 0.45;
      transform: scale(0.7);
    }
    100% {
      opacity: 0;
      transform: scale(1.8);
    }
  }

  /* 접근성: 모션 최소화 설정을 존중 */
  @media (prefers-reduced-motion: reduce) {
    .ai-btn-wrap,
    .ai-glow,
    .ai-btn::after,
    .ai-ring {
      animation: none;
    }
    .ai-glow {
      opacity: 0.3;
    }
    .ai-btn::after {
      display: none;
    }
  }
</style>
