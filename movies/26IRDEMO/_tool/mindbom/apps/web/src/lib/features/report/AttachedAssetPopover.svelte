<script lang="ts">
  /**
   * 이미 첨부된 자료를 다시 눌렀을 때 뜨는 말풍선.
   *
   * 두 번째 클릭의 의도는 대개 "한 번 더 넣기"가 아니라 "아까 넣은 게 어디
   * 있지"이므로, 본문의 해당 위치로 데려가고(호출부가 처리) 제거 여부를 묻는다.
   *
   * 자료 패널이 overflow-auto라 absolute로는 잘린다. 클릭한 박스의 화면
   * 좌표를 받아 fixed로 띄우므로 DOM 위치와 무관하다 — 그래서 자료 그리드
   * 안이 아니라 화면 최상위에서 렌더된다.
   */
  interface Props {
    /** 뷰포트 기준 좌표 — 자료 박스 오른쪽 가장자리 중앙 */
    x: number
    y: number
    onclose: () => void
    onremove: () => void
  }

  let { x, y, onclose, onremove }: Props = $props()
</script>

<!-- 바깥 클릭으로 닫기. 투명 레이어라 화면은 그대로 보인다. -->
<button
  type="button"
  aria-label="닫기"
  tabindex="-1"
  class="fixed inset-0 z-40 cursor-default"
  onclick={onclose}
></button>

<div
  class="fixed z-50 ml-2 w-56 -translate-y-1/2 rounded-lg border border-chrome-line bg-chrome p-3 shadow-xl"
  style="left: {x}px; top: {y}px"
  role="dialog"
  aria-label="첨부된 자료"
>
  <!-- 자료 박스를 가리키는 꼬리 -->
  <span
    class="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-chrome-line bg-chrome"
  ></span>

  <p class="text-body-03-normal-semibold text-chrome-fg">이미 본문에 있습니다</p>
  <p class="mt-2 text-label-01-reading-regular text-chrome-fg-3">
    본문에서 제거할까요?
  </p>

  <div class="mt-3 flex justify-end gap-1.5">
    <button
      type="button"
      onclick={onclose}
      class="rounded-md px-2.5 py-1 text-label-01-normal-medium text-chrome-fg-2 transition-colors hover:bg-chrome-hover"
    >
      취소
    </button>
    <button
      type="button"
      onclick={onremove}
      class="rounded-md bg-red-600 px-2.5 py-1 text-label-01-normal-medium text-white transition-colors hover:bg-red-700"
    >
      제거
    </button>
  </div>
</div>
