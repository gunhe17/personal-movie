<style>
  /* Ghost bubbles */
  .ghost {
    position: absolute;
    background: rgba(255, 255, 255, 0.13);
    border-radius: 20px;
    padding: 12px 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    white-space: nowrap;
    filter: blur(1.5px);
    backdrop-filter: blur(2px);
  }

  .ghost-1 {
    top: 8%;
    left: 2%;
    width: 220px;
  }
  .ghost-2 {
    top: 12%;
    right: 3%;
    width: 240px;
  }
  .ghost-3 {
    bottom: 14%;
    left: 1%;
    width: 280px;
  }
  .ghost-4 {
    bottom: 10%;
    right: 15%;
    width: 200px;
  }
  .ghost-5 {
    top: 38%;
    left: 0%;
    width: 180px;
  }
  .ghost-6 {
    top: 55%;
    right: 1%;
    width: 210px;
  }

  /* Fade-in for background */
  .animate-fade-in-bg {
    opacity: 0;
    animation: fadeInBg 0.8s ease forwards 0.2s;
  }

  @keyframes fadeInBg {
    to {
      opacity: 1;
    }
  }

  /* Main heading */
  .main-heading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #fff;
    line-height: 1.25;
    opacity: 0;
    translate: 0 -28px;
    animation: slideDownFade 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards 0.9s;
    z-index: 10;
    pointer-events: none;
  }

  @keyframes slideDownFade {
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  /* Speech bubbles */
  .bubble {
    position: absolute;
    background: #fff;
    border-radius: 18px;
    padding: 14px 18px 14px 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 200px;
    max-width: 290px;
    opacity: 0;
    scale: 0;
    transform-origin: center center;
    animation: popIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    z-index: 20;
  }

  @keyframes popIn {
    0% {
      opacity: 0;
      scale: 0.82;
    }
    60% {
      opacity: 1;
      scale: 1.02;
    }
    100% {
      opacity: 1;
      scale: 1;
    }
  }

  /* Bubble tails */
  .bubble::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    background: #fff;
  }

  .tail-bottom::after {
    bottom: -6px;
    left: 50%;
    translate: -50% 0;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }

  .tail-right::after {
    right: -6px;
    top: 50%;
    translate: 0 -50%;
    clip-path: polygon(0 0, 0 100%, 100% 50%);
  }

  .tail-left::after {
    left: -6px;
    top: 50%;
    translate: 0 -50%;
    clip-path: polygon(100% 0, 0 50%, 100% 100%);
  }

  /* Replay button */
  .replay-btn {
    position: absolute;
    bottom: 24px;
    right: 28px;
    background: rgba(255, 255, 255, 0.2);
    border: 1.5px solid rgba(255, 255, 255, 0.5);
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 18px;
    border-radius: 999px;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition: background 0.2s;
    z-index: 30;
    opacity: 0;
    animation: fadeInBg 0.5s ease forwards 4s;
  }

  .replay-btn:hover {
    background: rgba(255, 255, 255, 0.32);
  }
</style>

<script lang="ts">
  import { browser } from '$app/environment'

  let containerEl: HTMLDivElement | undefined = $state()
  let animationKey = $state(0)

  function replay() {
    animationKey++
  }

  const ghostTexts = [
    '레이아웃 관리가 너무 힘들어요',
    '서류 작업으로 너무 번거로워요',
    '클라이언트 상태 변화를 빠르게 파악하기 어려워요',
    '자동화가 필요해요',
    '기록이 너무 분산되어 있어요',
    '다음 세션 준비가 부담돼요'
  ]

  const bubbles = [
    {
      role: '상담사',
      text: '상담일지 쓰는데\n너무 오래걸려요',
      emoji: '👩',
      avatarClass: 'bg-purple-200',
      cssPosition: 'top: 18%; left: 50%; translate: -50% 0;',
      tailClass: 'tail-bottom',
      delay: '1.9s'
    },
    {
      role: '센터 관리자',
      text: '일정 변경 요청을 놓치는\n경우가 생겨요',
      emoji: '👨',
      avatarClass: 'bg-blue-200',
      cssPosition: 'top: 30%; left: 8%;',
      tailClass: 'tail-right',
      delay: '2.15s'
    },
    {
      role: '상담사',
      text: '메모하다 보면 내담자에게\n집중하기가 어려워요',
      emoji: '👩',
      avatarClass: 'bg-pink-200',
      cssPosition: 'top: 30%; right: 8%;',
      tailClass: 'tail-left',
      delay: '2.4s'
    },
    {
      role: '임상 심리사',
      text: '검사 진행 과정이\n길고 복잡해요',
      emoji: '👩',
      avatarClass: 'bg-purple-200',
      cssPosition: 'bottom: 24%; left: 12%;',
      tailClass: 'tail-right',
      delay: '2.65s'
    },
    {
      role: '임상 심리사',
      text: '내담자의 여러 검사 결과를\n한눈에 비교하기 어려워요',
      emoji: '👩',
      avatarClass: 'bg-purple-200',
      cssPosition: 'bottom: 24%; right: 8%;',
      tailClass: 'tail-left',
      delay: '2.9s'
    }
  ]
</script>

{#key animationKey}
  <div
    bind:this={containerEl}
    class="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#3a8fe8] via-[#2563d4] to-[#1a4fc4]"
  >
    <!-- Ghost bubbles (배경) -->
    <div class="absolute inset-0 animate-fade-in-bg">
      <div class="ghost ghost-1">{ghostTexts[0]}</div>
      <div class="ghost ghost-2">{ghostTexts[1]}</div>
      <div class="ghost ghost-3">{ghostTexts[2]}</div>
      <div class="ghost ghost-4">{ghostTexts[3]}</div>
      <div class="ghost ghost-5">{ghostTexts[4]}</div>
      <div class="ghost ghost-6">{ghostTexts[5]}</div>
    </div>

    <!-- 메인 텍스트 -->
    <div class="main-heading">
      <span class="block text-[clamp(24px,3.5vw,42px)] font-extrabold"
        >이런 불편함,</span
      >
      <span class="block text-[clamp(24px,3.5vw,42px)] font-extrabold"
        >겪어본 적 있나요?</span
      >
    </div>

    <!-- 말풍선들 -->
    {#each bubbles as bubble, i}
      <div
        class="bubble {bubble.tailClass}"
        style="{bubble.cssPosition} animation-delay: {bubble.delay};"
      >
        <div
          class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-lg {bubble.avatarClass}"
        >
          {bubble.emoji}
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[11px] font-semibold text-gray-400 tracking-wide"
            >{bubble.role}</span
          >
          <span
            class="text-sm font-semibold text-gray-900 leading-snug whitespace-pre-line"
            >{bubble.text}</span
          >
        </div>
      </div>
    {/each}

    <!-- 다시보기 버튼 -->
    <button class="replay-btn" onclick={replay}>↺ 다시 보기</button>
  </div>
{/key}
