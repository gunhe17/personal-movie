<style>
  .agent-dot-grid {
    background: linear-gradient(
      135deg,
      rgba(37, 110, 244, 0.45) 0%,
      rgba(28, 130, 202, 0.35) 45%,
      rgba(19, 149, 161, 0.45) 100%
    );
    -webkit-mask-image: url('/patterns/circuit-board.svg'),
      radial-gradient(
        ellipse 68% 64% at 50% 50%,
        transparent 58%,
        rgba(0, 0, 0, 0.2) 66%,
        rgba(0, 0, 0, 0.6) 74%,
        black 84%
      );
    -webkit-mask-size:
      200px 200px,
      100% 100%;
    -webkit-mask-repeat: repeat, no-repeat;
    -webkit-mask-composite: source-in;
    mask-image: url('/patterns/circuit-board.svg'),
      radial-gradient(
        ellipse 68% 64% at 50% 50%,
        transparent 58%,
        rgba(0, 0, 0, 0.2) 66%,
        rgba(0, 0, 0, 0.6) 74%,
        black 84%
      );
    mask-size:
      200px 200px,
      100% 100%;
    mask-repeat: repeat, no-repeat;
    mask-composite: intersect;
  }

  .agent-base-gradient {
    background: linear-gradient(
      135deg,
      rgba(37, 110, 244, 0.35) 0%,
      rgba(28, 130, 202, 0.25) 50%,
      rgba(19, 149, 161, 0.35) 100%
    );
  }

  .agent-center-clear {
    background: radial-gradient(
      ellipse 75% 72% at 50% 50%,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.9) 55%,
      rgba(255, 255, 255, 0.4) 78%,
      rgba(255, 255, 255, 0.1) 90%,
      transparent 100%
    );
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte'

  export type AgentBackdropMode = 'idle' | 'activating' | 'on' | 'deactivating'

  interface Props {
    mode?: AgentBackdropMode
    onanimationend?: (e: AnimationEvent) => void
    children?: Snippet
  }

  let { mode = 'idle', onanimationend, children }: Props = $props()

  const backdropStyle = $derived.by(() => {
    if (mode === 'activating')
      return 'opacity:0; animation: __backdrop-in 1.2s ease-out forwards;'
    if (mode === 'on') return 'opacity:1;'
    if (mode === 'deactivating')
      return 'opacity:1; animation: __backdrop-out 0.6s ease-in forwards;'
    return 'opacity:0; pointer-events:none;'
  })
</script>

<svelte:head>
  <style>
    @keyframes __backdrop-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes __backdrop-out {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  </style>
</svelte:head>

<!-- children은 그대로 렌더 (높이 체인 간섭 없음) -->
{#if children}{@render children()}{/if}

<!-- backdrop: fixed로 뷰포트 전체 커버, 사이드바 제외 -->
{#if mode !== 'idle'}
  <div
    class="pointer-events-none fixed inset-0"
    style="z-index:40; {backdropStyle}"
    onanimationend={(e) => {
      if (e.animationName === '__backdrop-in' && onanimationend) {
        onanimationend(
          new AnimationEvent('animationend', { animationName: 'backdrop-in' })
        )
      } else if (e.animationName === '__backdrop-out' && onanimationend) {
        onanimationend(
          new AnimationEvent('animationend', { animationName: 'backdrop-out' })
        )
      }
    }}
  >
    <div class="agent-base-gradient absolute inset-0"></div>
    <div class="agent-dot-grid absolute inset-0"></div>
    <div class="agent-center-clear absolute inset-0"></div>
  </div>
{/if}
