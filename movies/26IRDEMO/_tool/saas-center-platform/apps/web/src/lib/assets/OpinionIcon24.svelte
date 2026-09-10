<style>
  /* 각 줄: 순차 드로잉만 (opacity 안 건드림)
     사이클 3s — delay 포함 모든 줄이 충분히 리셋된 뒤 다음 사이클 시작 */
  svg.animate .line {
    transform-origin: left center;
    transform-box: fill-box;
    animation: draw 3s ease-out infinite;
  }
  svg.animate .line-1 {
    animation-delay: 0s;
  }
  svg.animate .line-2 {
    animation-delay: 0.2s;
  }
  svg.animate .line-3 {
    animation-delay: 0.4s;
  }
  svg.animate .line-4 {
    animation-delay: 0.6s;
  }

  /* 0~10%: 드로잉(0.3s) / 10~50%: 유지 / 50%: 즉시 리셋 (그룹이 이미 안 보이므로 안전) */
  @keyframes draw {
    0% {
      transform: scaleX(0);
    }
    10% {
      transform: scaleX(1);
    }
    50% {
      transform: scaleX(1);
    }
    50.01%,
    100% {
      transform: scaleX(0);
    }
  }

  /* 그룹 전체: 동시 페이드아웃 → 충분히 쉰 뒤 페이드인
     line-4가 delay 0.6s → 실제 드로잉 완료 ~0.9s (사이클의 30%)
     45%: 모든 줄이 보인 상태에서 페이드 시작
     55%: 완전히 사라짐 (이후 draw가 50%에서 리셋 — delay 감안해도 안전)
     90%: 충분히 쉬고 페이드인 시작
     100%→0%: 완전히 보이며 다음 사이클 드로잉 시작 */
  svg.animate .lines {
    animation: groupFade 3s ease-in-out infinite;
  }

  @keyframes groupFade {
    0%,
    45% {
      opacity: 1;
    }
    55%,
    90% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    svg.animate .line,
    svg.animate .lines {
      animation: none;
    }
  }
</style>

<script lang="ts">
  interface Props {
    /** 글이 쓰이는 애니메이션 재생 */
    animate?: boolean
  }
  let { animate = false }: Props = $props()
</script>

<svg
  class:animate
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M19.5822 4.39844H6.03101C5.68166 4.39844 5.39844 4.68166 5.39844 5.03101V21.2924C5.39844 21.6418 5.68166 21.925 6.03101 21.925H19.5822C19.9315 21.925 20.2148 21.6418 20.2148 21.2924V5.03101C20.2148 4.68166 19.9316 4.39844 19.5822 4.39844Z"
    fill="#D0D6EB"
  />
  <path
    d="M17.1837 2H3.63258C3.28323 2 3 2.28323 3 2.63258V18.894C3 19.2433 3.28323 19.5266 3.63258 19.5266H17.1837C17.5331 19.5266 17.8163 19.2433 17.8163 18.894V2.63258C17.8163 2.28323 17.5331 2 17.1837 2Z"
    fill="#F6F7FD"
  />
  <!-- 4개 줄: 위 → 아래 순서로 좌→우 채워짐 -->
  <g class="lines">
    <path
      class="line line-1"
      d="M14.4742 7.3296H6.34351C5.99416 7.3296 5.71094 7.04638 5.71094 6.69703C5.71094 6.34768 5.99416 6.06445 6.34351 6.06445H14.4742C14.8236 6.06445 15.1068 6.34768 15.1068 6.69703C15.1068 7.04638 14.8236 7.3296 14.4742 7.3296Z"
      fill="#666B7C"
    />
    <path
      class="line line-2"
      d="M11.764 10.0405H6.34351C5.99416 10.0405 5.71094 9.75732 5.71094 9.40797C5.71094 9.05862 5.99416 8.77539 6.34351 8.77539H11.764C12.1133 8.77539 12.3965 9.05862 12.3965 9.40797C12.3965 9.75732 12.1133 10.0405 11.764 10.0405Z"
      fill="#666B7C"
    />
    <path
      class="line line-3"
      d="M12.8067 12.7495H6.34351C5.99416 12.7495 5.71094 12.4663 5.71094 12.117C5.71094 11.7676 5.99416 11.4844 6.34351 11.4844H12.8067C13.1561 11.4844 13.4393 11.7676 13.4393 12.117C13.4393 12.4663 13.1561 12.7495 12.8067 12.7495Z"
      fill="#666B7C"
    />
    <path
      class="line line-4"
      d="M11.764 15.4605H6.34351C5.99416 15.4605 5.71094 15.1772 5.71094 14.8279C5.71094 14.4785 5.99416 14.1953 6.34351 14.1953H11.764C12.1133 14.1953 12.3965 14.4785 12.3965 14.8279C12.3965 15.1772 12.1133 15.4605 11.764 15.4605Z"
      fill="#666B7C"
    />
  </g>
</svg>
