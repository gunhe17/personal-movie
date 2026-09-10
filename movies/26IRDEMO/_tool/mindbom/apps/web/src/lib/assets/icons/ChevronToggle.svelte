<script lang="ts">
  /**
   * 펼침/접힘 표시 — 두 획이 평평해졌다가 반대로 꺾인다.
   *
   * 통짜 chevron을 180도 돌리면 아이콘이 "뒤집히는" 것으로 보인다. 여기서는
   * 획 두 개를 각자 가운데(12,12)를 축으로 반대 방향으로 돌려, 중간에 `-`를
   * 지나 반대 모양이 되게 한다 — 펼침/접힘이라는 동작 자체를 보여준다.
   *
   * 두 획이 이루는 각은 90도다(각 획 45도). 그보다 벌어지면 둔해 보인다.
   *
   * SVG는 y축이 아래로 증가하므로 각도 부호가 직관과 반대다.
   * 접힘(v, 양끝이 위)  = 왼쪽 +45, 오른쪽 -45
   * 펼침(^, 양끝이 아래) = 왼쪽 -45, 오른쪽 +45
   */
  interface Props {
    /** 펼쳐진 상태인가 */
    open?: boolean
    size?: number
    class?: string
    strokeWidth?: number
  }

  let {
    open = false,
    size = 18,
    class: className = '',
    strokeWidth = 2.5
  }: Props = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  class={className}
  class:open
>
  <!--
    획 길이 7.5 — 45도로 돌면 자유단이 (6.7, 6.7)이라 stroke 두께를 감안해도
    viewBox 안에 든다. 45도는 세로 폭을 줄이므로 획을 길게 잡아 크기를 맞춘다.

    회전축이 꼭짓점(12,12)이라 획만 돌리면 도형 전체가 한쪽으로 쏠린다:
    접힘(v)은 y 6.70~12(중심 9.35), 펼침(^)은 y 12~17.30(중심 14.65).
    viewBox 중심 12에서 각각 2.65 어긋나고, 토글할 때 5.3만큼 위아래로 튄다.
    그래서 그룹을 반대로 2.65 옮겨 두 상태 모두 중심이 12가 되게 한다.
  -->
  <g class="shape">
    <line x1="4.5" y1="12" x2="12" y2="12" class="arm left" />
    <line x1="12" y1="12" x2="19.5" y2="12" class="arm right" />
  </g>
</svg>

<style>
  .arm {
    transform-box: view-box;
    transform-origin: 12px 12px;
    transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* 쏠림 보정 (위 주석의 2.65) — 획 회전과 같은 곡선으로 함께 움직인다 */
  .shape {
    transform-box: view-box;
    transform: translateY(2.65px);
    transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .open .shape {
    transform: translateY(-2.65px);
  }
  /* 접힘 — v (양끝이 위). 두 획이 90도를 이룬다 */
  .left {
    transform: rotate(45deg);
  }
  .right {
    transform: rotate(-45deg);
  }
  /* 펼침 — ^ (양끝이 아래). 평평한 상태를 지나며 뒤집힌다 */
  .open .left {
    transform: rotate(-45deg);
  }
  .open .right {
    transform: rotate(45deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .arm,
    .shape {
      transition: none;
    }
  }
</style>
