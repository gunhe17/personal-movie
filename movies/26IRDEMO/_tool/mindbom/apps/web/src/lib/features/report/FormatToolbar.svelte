<script lang="ts">
  /**
   * 본문 서식 툴바.
   *
   * 에디터 인스턴스를 직접 만지지 않는다 — 서식 적용은 전부 콜백으로 올린다.
   * (들여쓰기만 editor?.changeIndent를 직접 부르고 있었는데, 그것 하나 때문에
   *  editor를 통째로 넘기면 이 컴포넌트가 에디터 API 전체에 묶인다.)
   *
   * 높이(h-toolbar)는 왼쪽 사이드바 탭과 같은 값이다. 둘이 맞닿아 있어
   * 한쪽만 높으면 경계선이 어긋나 보인다 — app.css의 --spacing-toolbar.
   */
  import Select from '$lib/components/ui/Select.svelte'
  import type {
    BlockStyle,
    ListType,
    MarkKey,
    MarkStyle
  } from '$lib/components/document-editor/editor-core'
  import type { BlockState } from '$lib/components/document-editor/components/PaginatedEditor.svelte'
  import type { OverallReview } from './overall-review'

  interface Props {
    /** 커서 위치의 글자 서식 — 버튼 활성 표시용 */
    activeStyle: MarkStyle
    /** 커서 문단의 블록 상태(리스트/타이틀/인용) */
    blockState: BlockState
    /** 툴바에 보이는 글자 크기 */
    fontSize: number
    fontSizeOptions: { value: number; label: string }[]
    /** 종합 리뷰 패널이 열려 있는지 */
    reviewOpen: boolean
    /** 리뷰 결과 — 닫혀 있을 때 지적 수를 뱃지로 보여준다 */
    review: OverallReview | null
    /** 문서가 준비됐는지. false면 리뷰 버튼을 잠근다. */
    ready: boolean
    onMark: (key: MarkKey, value?: boolean | number) => void
    onFontSize: (size: number) => void
    onList: (type: ListType) => void
    onIndent: (delta: number) => void
    onBlock: (style: BlockStyle) => void
    onDivider: () => void
    onToggleReview: () => void
  }

  let {
    activeStyle,
    blockState,
    fontSize,
    fontSizeOptions,
    reviewOpen,
    review,
    ready,
    onMark,
    onFontSize,
    onList,
    onIndent,
    onBlock,
    onDivider,
    onToggleReview
  }: Props = $props()
</script>

<div
  class="flex h-toolbar shrink-0 items-center gap-1 border-b border-chrome-line bg-chrome-raised px-4"
>
  <button
    type="button"
    title="굵게"
    onclick={() => onMark('bold')}
    class="tbtn tbtn-char {activeStyle.bold ? 'tbtn-active' : ''}">B</button
  >
  <button
    type="button"
    title="기울임"
    onclick={() => onMark('italic')}
    class="tbtn tbtn-char {activeStyle.italic ? 'tbtn-active' : ''}"
    style="font-style:italic">I</button
  >
  <button
    type="button"
    title="밑줄"
    onclick={() => onMark('underline')}
    class="tbtn tbtn-char {activeStyle.underline ? 'tbtn-active' : ''}"
    style="text-decoration:underline">U</button
  >
  <button
    type="button"
    title="취소선"
    onclick={() => onMark('strike')}
    class="tbtn tbtn-char {activeStyle.strike ? 'tbtn-active' : ''}"
    style="text-decoration:line-through">S</button
  >

  <span class="mx-1.5 h-5 w-px bg-chrome-hover"></span>

  <!-- 크기 선택은 size="sm"(34px) — 옆 아이콘 버튼(.tbtn)과 같은 높이라야
       툴바 한 줄이 고르게 보인다. 기본 md(44px)는 툴바를 혼자 밀어 올린다. -->
  <label class="flex items-center gap-1.5 text-label-01-normal-regular text-chrome-fg-2">
    크기
    <Select
      options={fontSizeOptions}
      value={fontSize}
      onChange={(v) => onFontSize(Number(v))}
      size="sm"
      className="w-16 border-chrome-line bg-chrome-sunken text-chrome-fg hover:border-chrome-line"
      ariaLabel="글자 크기"
    />
  </label>

  <span class="mx-1.5 h-5 w-px bg-chrome-hover"></span>

  <!-- 리스트 -->
  <button
    type="button"
    title="불릿 목록"
    onclick={() => onList('bullet')}
    class="tbtn {blockState.listType === 'bullet' ? 'tbtn-active' : ''}"
  >
    <span class="material-icons-round text-lg">format_list_bulleted</span>
  </button>
  <button
    type="button"
    title="번호 목록"
    onclick={() => onList('number')}
    class="tbtn {blockState.listType === 'number' ? 'tbtn-active' : ''}"
  >
    <span class="material-icons-round text-lg">format_list_numbered</span>
  </button>
  <button
    type="button"
    title="내어쓰기 (Shift+Tab)"
    onclick={() => onIndent(-1)}
    class="tbtn"
  >
    <span class="material-icons-round text-lg">format_indent_decrease</span>
  </button>
  <button
    type="button"
    title="들여쓰기 (Tab)"
    onclick={() => onIndent(1)}
    class="tbtn"
  >
    <span class="material-icons-round text-lg">format_indent_increase</span>
  </button>

  <span class="mx-1.5 h-5 w-px bg-chrome-hover"></span>

  <!-- 블록 서식 -->
  <button
    type="button"
    title="타이틀 블록"
    onclick={() => onBlock('heading')}
    class="tbtn {blockState.blockStyle === 'heading' ? 'tbtn-active' : ''}"
  >
    <span class="material-icons-round text-lg">title</span>
  </button>
  <button
    type="button"
    title="인용"
    onclick={() => onBlock('quote')}
    class="tbtn {blockState.blockStyle === 'quote' ? 'tbtn-active' : ''}"
  >
    <span class="material-icons-round text-lg">format_quote</span>
  </button>
  <button type="button" title="구분선" onclick={onDivider} class="tbtn">
    <span class="material-icons-round text-lg">horizontal_rule</span>
  </button>

  <!-- 종합 AI 리뷰 — 문서 전체 검토 (구간별 리뷰는 본문 드래그로 실행) -->
  <button
    type="button"
    title="보고서 전체를 문서 단위로 검토합니다"
    onclick={() =>
      onToggleReview()}
    disabled={!ready}
    class="ml-auto inline-flex h-8.5 items-center gap-1.5 rounded-lg px-2.5 text-label-01-normal-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {reviewOpen ? 'bg-chrome-hover text-chrome-fg ring-1 ring-chrome-line' : 'bg-chrome-sunken text-chrome-fg ring-1 ring-chrome-line hover:bg-chrome-hover hover:text-chrome-fg'}"
  >
    <span
      class="material-icons-round text-[16px]! {reviewOpen
        ? 'text-chrome-fg'
        : 'text-chrome-fg-2'}"
    >
      auto_awesome
    </span>
    AI 종합 리뷰
    {#if review && !reviewOpen && review.issues.length}
      <span
        class="rounded-full bg-red-500 px-1.5 py-0.5 text-label-02-normal-bold text-white"
      >
        {review.issues.length}
      </span>
    {/if}
  </button>
</div>

<style>
  .tbtn {
    min-width: 34px;
    height: 34px;
    padding: 0 7px;
    border-radius: 6px;
    font-size: 14px;
    color: var(--chrome-fg-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background-color 0.12s,
      color 0.12s;
  }
  .tbtn:hover {
    background: var(--chrome-hover);
    color: var(--chrome-fg);
  }
  /* 활성 서식은 브랜드색으로 — 반투명 배경이라 양쪽 테마에서 다 얹힌다 */
  .tbtn-active {
    background: rgba(37, 110, 244, 0.14);
    color: var(--toolbar-active-fg);
  }
  /* 글자 서식 버튼(B/I/U/S): 아이콘 버튼과 시각 무게 맞추기 위해 크고 굵게 */
  .tbtn-char {
    font-size: 17px;
    font-weight: 700;
  }
  /* 툴바 아이콘 크기 통일 */
  .tbtn :global(.material-icons-round) {
    font-size: 20px;
  }
</style>
