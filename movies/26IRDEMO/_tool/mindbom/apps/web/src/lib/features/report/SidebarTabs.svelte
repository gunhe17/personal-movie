<script lang="ts">
  /**
   * 사이드바 상단 탭 — 검사자료 / 교차분석.
   *
   * 활성 표시는 아래 슬라이딩 인디케이터가 담당한다. 탭이 2개 균등
   * 분할(flex-1)이라 ResizeObserver 없이 translateX만으로 충분하다.
   * 버튼마다 border-b-2를 켜고 끄면 순간 이동이라 움직임이 보이지 않는다.
   *
   * 높이(h-toolbar)는 오른쪽 서식 툴바와 같은 값이다 — 사이드바와 본문이
   * 맞닿아 있어 한쪽만 높으면 경계선이 어긋나 보인다. 패딩(py-*)으로 맞추면
   * 글자 크기나 뱃지가 바뀔 때마다 다시 틀어지므로 양쪽 다 높이를 고정하고
   * 내용은 세로 가운데 정렬로 채운다.
   */
  export type SideTab = 'materials' | 'longitudinal'

  interface Props {
    active: SideTab
    onselect: (tab: SideTab) => void
  }

  let { active, onselect }: Props = $props()
</script>

<div class="relative flex h-toolbar shrink-0 border-b border-chrome-line px-3">
  <button
    type="button"
    onclick={() => onselect('materials')}
    class="tab-btn flex-1 rounded-t-md px-3 text-title-01-normal-medium transition-colors {active ===
    'materials'
      ? 'is-active'
      : ''}"
  >
    검사자료
  </button>
  <button
    type="button"
    onclick={() => onselect('longitudinal')}
    class="tab-btn flex flex-1 items-center justify-center gap-1 rounded-t-md px-3 text-title-01-normal-medium transition-colors {active ===
    'longitudinal'
      ? 'is-active'
      : ''}"
  >
    교차분석
    <span
      class="rounded-full px-1.5 py-px text-label-02-normal-bold transition-colors {active ===
      'longitudinal'
        ? 'tab-badge-active'
        : 'bg-chrome-hover text-chrome-fg-2'}"
    >
      AI
    </span>
  </button>

  <!-- 슬라이딩 인디케이터 — 좌우 px-3(12px)를 뺀 영역을 반씩 차지한다.
       bottom:-1px로 컨테이너의 border-b 위에 겹쳐 그린다. -->
  <span
    class="tab-indicator pointer-events-none absolute -bottom-px left-3 h-0.5 rounded-full transition-transform duration-200 ease-out"
    style="width: calc((100% - 1.5rem) / 2); transform: translateX({active ===
    'materials'
      ? '0'
      : '100%'})"
    aria-hidden="true"
  ></span>
</div>

<style>
  /* 활성 표시 방식이 테마마다 다르다. 라이트는 배경 없이 파란 글씨(참조 가이드),
     다크는 기존처럼 밝은 면을 깔고 흰 글씨. 값은 app.css의 --tab-* 토큰에 있다. */
  .tab-btn {
    color: var(--chrome-fg-2);
  }
  .tab-btn:hover {
    color: var(--chrome-fg);
  }
  .tab-btn.is-active {
    background: var(--tab-active-bg);
    color: var(--tab-active-fg);
  }
  .tab-indicator {
    background: var(--tab-indicator);
  }
  .tab-badge-active {
    background: color-mix(in srgb, var(--tab-active-fg) 14%, transparent);
    color: var(--tab-active-fg);
  }

  /* 접근성: 인디케이터는 이동 없이 바로 자리를 잡는다 */
  @media (prefers-reduced-motion: reduce) {
    .tab-indicator {
      transition: none;
    }
  }
</style>
