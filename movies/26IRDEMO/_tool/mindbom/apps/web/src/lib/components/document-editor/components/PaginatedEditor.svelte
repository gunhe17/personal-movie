<style>
  /* 종이(page)를 둘러싼 작업대. 테마를 탄다 — 라이트에서는 연한 회색이라
     흰 A4가 살짝 떠 보이고, 다크에서는 기존의 진회색 작업대가 된다. */
  .editor-shell {
    background: var(--editor-desk);
    min-height: 100%;
    padding-bottom: 40px;
  }
  .editor-status {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--editor-status-bg);
    color: var(--editor-status-fg);
    font-size: 12px;
    padding: 8px 16px;
  }
  .workspace {
    position: relative;
    padding: 32px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
  /* 자체 선택(페이지 넘김) 중에는 네이티브 텍스트 선택 숨김 */
  :global(.workspace.custom-selecting .page-body) {
    user-select: none;
    -webkit-user-select: none;
  }
  /* 하이라이트 오버레이 — workspace 기준 절대배치, 이벤트 통과 */
  :global(.workspace .hilite-layer) {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 50;
  }
  :global(.workspace .hl-rect) {
    position: absolute;
    background: rgba(37, 110, 244, 0.28);
    border-radius: 1px;
  }
  /* 아래는 동적 생성 요소 대상이라 :global 필요 */
  :global(.workspace .page) {
    width: 794px;
    min-height: 1123px;
    background: #fff;
    /* 종이는 항상 흰색. 그림자만 작업대 밝기에 맞춘다
       (밝은 작업대에 0.35 그림자를 그대로 쓰면 때가 낀 것처럼 보인다) */
    box-shadow: var(--editor-page-shadow);
    position: relative;
    padding: 72px 64px;
    display: flex;
    flex-direction: column;
  }
  :global(.workspace .page-body) {
    flex: 1;
    outline: none;
  }
  /* cover 단독 페이지: body를 flex로 만들어 표지/마무리가 페이지를 꽉 채우게 */
  :global(.workspace .page-cover .page-body) {
    display: flex;
    flex-direction: column;
  }
  /* 화면에서만 숨김(표지/마무리 시야 정리) — PDF 캡처 전에는 해제되므로 PDF엔 포함 */
  :global(.workspace .page.screen-hidden) {
    display: none;
  }
  /* 본문 머리말 (기존 PDF .page-header 톤) */
  :global(.workspace .rpt-page-header) {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #2563eb;
    user-select: none;
  }
  :global(.workspace .rpt-page-header-title) {
    font-size: 15px;
    font-weight: 700;
    color: #1e3a8a;
  }
  :global(.workspace .rpt-page-header-meta) {
    font-size: 11px;
    color: #7d848f;
    text-align: right;
    line-height: 1.5;
  }
  :global(.workspace .rpt-page-header-name) {
    font-weight: 600;
    color: #2d333b;
    font-size: 12px;
  }
  /* 본문 꼬리말 영역: 센터 문구 + 페이지 번호 */
  :global(.workspace .page-foot) {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #e2e5e9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
  }
  :global(.workspace .rpt-page-footer) {
    font-size: 10px;
    color: #aab2be;
  }
  :global(.workspace .page-number) {
    font-size: 11px;
    color: #9ca3af;
  }
  :global(.workspace .para) {
    font-size: 14px;
    line-height: 1.85;
    margin-bottom: 4px;
    min-height: 1.85em;
    white-space: pre-wrap;
    word-break: break-word;
    color: #1f2937; /* gray-800 */
  }
  /* 빈 문단: placeholder 텍스트 없이 제로폭 공백으로 라인박스 높이만 확보.
     (리스트는 마커 ::before를 따로 그리므로 여기서 제외) */
  :global(.workspace .para-body:empty:not(.para-list)::before) {
    content: '\200b';
    color: #9ca3af; /* gray-400 */
  }
  /* ── 리스트 항목 (body에 listType/indent 표시속성) ── */
  /* 마커는 ::before로. --list-indent(들여쓰기 단계)로 좌측 패딩 계산. */
  :global(.workspace .para-list) {
    position: relative;
    padding-left: calc(24px + var(--list-indent, 0) * 24px);
    margin-bottom: 4px;
  }
  :global(.workspace .para-list::before) {
    position: absolute;
    left: calc(var(--list-indent, 0) * 24px);
    top: 0;
    width: 22px;
    text-align: left;
    color: #4b5563; /* gray-600 */
    /* font-size는 .para-list(문단 el)에 걸린 값을 상속 → 마커가 텍스트 크기를 따라감 */
    line-height: 1.85;
    user-select: none;
  }
  /* 불릿: 들여쓰기 단계별로 마커 모양 변화(•, ◦, ▪) */
  :global(.workspace .para-bullet::before) {
    content: '•';
  }
  :global(.workspace .para-bullet[data-indent='1']::before) {
    content: '◦';
  }
  :global(.workspace .para-bullet[data-indent='2']::before) {
    content: '▪';
  }
  :global(.workspace .para-bullet[data-indent='3']::before),
  :global(.workspace .para-bullet[data-indent='4']::before),
  :global(.workspace .para-bullet[data-indent='5']::before) {
    content: '•';
  }
  /* 번호: data-num(자동 계산된 표시 번호)을 마커로. font-size는 문단에서 상속. */
  :global(.workspace .para-number::before) {
    content: attr(data-num) '.';
    color: #374151;
  }
  /* ── 인용 블록 (body에 blockStyle='quote') ── */
  :global(.workspace .para-quote) {
    border-left: 3px solid #cbd5e1; /* slate-300 */
    padding: 4px 0 4px 14px;
    margin: 8px 0;
    color: #4b5563; /* gray-600 */
    font-style: italic;
    line-height: 1.6;
    min-height: 1.6em;
  }
  /* ── 타이틀 블록 (body에 blockStyle='heading', 기존 보고서 section-title 톤) ── */
  :global(.workspace .para-titleblock) {
    font-size: 14px;
    font-weight: 700;
    color: #1e3a8a; /* blue-900 */
    padding: 8px 14px;
    background: #eff6ff; /* blue-50 */
    border-left: 4px solid #2563eb; /* brand-600 */
    margin: 18px 0 12px;
    line-height: 1.5;
    /* 빈 상태에서도 텍스트 한 줄(line-height 1.5) 높이를 유지해 어색한 높이 방지.
       .para 기본 min-height(1.85em)를 이 블록 기준으로 재정의. */
    min-height: 1.5em;
    word-break: break-word;
  }
  /* 빈 타이틀/인용 placeholder는 굵기/기울임 톤을 빼고 옅은 회색으로 */
  :global(.workspace .para-titleblock:empty::before),
  :global(.workspace .para-quote:empty::before) {
    font-weight: 400;
    font-style: normal;
    color: #9ca3af; /* gray-400 */
  }
  :global(.workspace .page-body > .para-titleblock:first-child) {
    margin-top: 0;
  }
  /* ── 가로 구분선 (divider 잠긴 블록) ── */
  :global(.workspace .para-divider) {
    user-select: none;
    position: relative; /* 삭제 버튼(absolute) 기준 */
    margin: 6px 0;
    padding: 4px 0; /* 얇은 hr 위 hover 영역 확보 */
  }
  :global(.workspace .rpt-hr) {
    border: none;
    border-top: 1px solid #d1d5db; /* gray-300 */
    margin: 8px 0;
  }
  /* ── 이미지 블록 ── */
  :global(.workspace .para-image) {
    user-select: none;
    margin: 10px 0;
  }
  :global(.workspace .rpt-image) {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
  }
  :global(.workspace .rpt-image img) {
    /* 본문 폭을 꽉 채운다 — 검사 결과지는 글자가 작아 축소하면 읽기 어렵다.
       max-height를 두면 세로가 긴 결과지가 눌려 폭까지 줄어드므로 두지 않는다. */
    width: 100%;
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    display: block;
  }
  :global(.workspace .rpt-image figcaption) {
    margin-top: 6px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
  }
  :global(.workspace .rpt-block-del) {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: rgba(17, 24, 39, 0.7);
    color: #fff;
    font-size: 12px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.12s;
    cursor: pointer;
  }
  :global(.workspace .rpt-image:hover .rpt-block-del),
  :global(.workspace .rpt-table:hover .rpt-block-del),
  :global(.workspace .para-divider:hover .rpt-block-del) {
    opacity: 1;
  }
  /* divider는 얇으므로 삭제 버튼을 세로 중앙에 배치 */
  :global(.workspace .para-divider .rpt-block-del) {
    top: 50%;
    transform: translateY(-50%);
  }
  /* 자료 패널에서 '위치 보기'로 찾아왔을 때 잠깐 강조 */
  :global(.workspace .rpt-para-flash) {
    animation: rpt-para-flash 1.6s ease-out;
    border-radius: 4px;
  }
  @keyframes rpt-para-flash {
    0%,
    60% {
      box-shadow: 0 0 0 3px rgba(33, 97, 215, 0.45);
      background: rgba(33, 97, 215, 0.08);
    }
    100% {
      box-shadow: 0 0 0 3px rgba(33, 97, 215, 0);
      background: transparent;
    }
  }
  /* ── 표 블록 (보고서 interp-table 톤) ── */
  :global(.workspace .para-table) {
    user-select: none;
    margin: 12px 0;
  }
  :global(.workspace .rpt-table) {
    position: relative;
  }
  :global(.workspace .rpt-table-title) {
    font-size: 13px;
    font-weight: 700;
    color: #1e3a8a;
    padding: 6px 12px;
    background: #eff6ff;
    border-left: 3px solid #2563eb;
    margin-bottom: 8px;
  }
  :global(.workspace .rpt-table table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    border: 1px solid #e2e5e9;
  }
  :global(.workspace .rpt-table th) {
    background: #f7f8f8;
    font-weight: 600;
    color: #464f58;
    padding: 6px 8px;
    border-bottom: 1px solid #e2e5e9;
    text-align: left;
  }
  :global(.workspace .rpt-table td) {
    padding: 5px 8px;
    border-bottom: 1px solid #eef1f3;
    color: #2d333b;
    vertical-align: top;
  }
  :global(.workspace .rpt-table tr:last-child td) {
    border-bottom: none;
  }
  /* ── 고정 서식 블록 (기존 보고서 톤: brand-600 #2563eb, gray 계열) ── */
  /* 표지 */
  :global(.workspace .para-cover) {
    font-size: 14px;
    line-height: 2;
    color: #374151; /* gray-700 */
    white-space: pre-wrap;
    text-align: center;
    padding: 32px 0 40px;
    margin-bottom: 20px;
    border-bottom: 2px solid #2563eb; /* brand-600 */
    user-select: none;
    cursor: default;
  }
  /* 섹션 제목 */
  :global(.workspace .para-heading) {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.6;
    color: #1f2937; /* gray-800 */
    margin: 24px 0 10px;
    padding: 6px 0 6px 12px;
    border-left: 3px solid #2563eb; /* brand-600 */
    background: #f9fafb; /* gray-50 */
    white-space: pre-wrap;
    word-break: break-word;
    user-select: none;
    cursor: default;
  }
  /* 첫 heading은 위 여백 최소화 */
  :global(.workspace .page-body > .para-heading:first-child) {
    margin-top: 0;
  }

  /* ── 표지 (기존 PDF 서식 재현: apps/api/app/templates/*_report.html .cover) ── */
  /* 표지 para는 종이 여백(72/64px)을 무시하고 페이지를 꽉 채운다.
     page-body(flex:1)의 자식으로서 세로 공간을 전부 차지 → 하단 흰 여백 제거. */
  :global(.workspace .para-cover-page) {
    margin: -72px -64px;
    padding: 0;
    flex: 1;
    display: flex;
    min-height: 0;
  }
  :global(.workspace .rpt-cover) {
    background: linear-gradient(180deg, #34363d 0%, #232830 100%);
    color: #fff;
    flex: 1;
    display: flex;
  }
  :global(.workspace .rpt-cover-inner) {
    padding: 96px 72px 72px;
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  :global(.workspace .rpt-cover-brand) {
    font-size: 12px;
    letter-spacing: 4px;
    color: #93c5fd;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  :global(.workspace .rpt-cover-brand-ko) {
    font-size: 14px;
    color: #d1d5db;
    margin-bottom: 64px;
  }
  :global(.workspace .rpt-cover-divider) {
    width: 52px;
    height: 3px;
    background: #2563eb;
    margin-bottom: 20px;
  }
  :global(.workspace .rpt-cover-title) {
    font-size: 38px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -1px;
    margin-bottom: 8px;
    border: none;
    text-align: left;
  }
  :global(.workspace .rpt-cover-subtitle) {
    font-size: 14px;
    color: #aab2be;
    letter-spacing: 1px;
    text-align: left;
    margin-bottom: 0; /* 하단은 spacer가 담당 */
  }
  :global(.workspace .rpt-cover-info) {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 24px 28px;
    margin-bottom: 30px; /* info와 하단 footer 사이 간격 */
  }
  :global(.workspace .rpt-cover-row) {
    display: flex;
    padding: 11px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  :global(.workspace .rpt-cover-row:last-child) {
    border-bottom: none;
  }
  :global(.workspace .rpt-cover-label) {
    width: 112px;
    color: #aab2be;
    font-size: 12px;
  }
  :global(.workspace .rpt-cover-value) {
    flex: 1;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
  }
  :global(.workspace .rpt-cover-spacer) {
    flex: 1;
    min-height: 40px;
  }
  :global(.workspace .rpt-cover-footer) {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 11px;
    color: #aab2be;
  }
  :global(.workspace .rpt-cover-badge) {
    display: inline-block;
    background: rgba(37, 99, 235, 0.2);
    border: 1px solid #2563eb;
    color: #93c5fd;
    padding: 4px 10px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  :global(.workspace .rpt-cover-footer-right) {
    text-align: right;
    line-height: 1.6;
  }

  /* ── 마무리(마지막 장) ── */
  /* closing para는 page-body(flex column)의 자식으로서 페이지 전체 높이를 차지 */
  :global(.workspace .para-closing) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  /* rpt-closing: 세로 flex — 본문(flex:1, 정중앙) + 서명(하단) */
  :global(.workspace .rpt-closing) {
    flex: 1;
    display: flex;
    flex-direction: column;
    color: #374151;
  }
  /* 본문 영역: 남는 공간을 채우며 내용은 정중앙 */
  :global(.workspace .rpt-closing-body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center; /* 세로 정중앙 */
    align-items: center; /* 가로 정중앙 */
    text-align: center;
  }
  :global(.workspace .rpt-closing-p) {
    font-size: 13px;
    line-height: 1.9;
    color: #4b5563;
    max-width: 520px;
    margin-bottom: 12px;
  }
  /* 서명란: rpt-closing 세로 flex의 마지막 → 자연히 페이지 하단 */
  :global(.workspace .rpt-closing-sign) {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 14px;
    padding-top: 20px;
  }
  :global(.workspace .rpt-closing-sign-label) {
    font-size: 12px;
    color: #6b7280;
  }
  :global(.workspace .rpt-closing-sign-name) {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    min-width: 120px;
    border-bottom: 1px solid #9ca3af;
    text-align: center;
    padding-bottom: 2px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import {
    makeUid,
    deleteRange,
    insertTextAt,
    splitAt,
    deleteBackward,
    deleteForward,
    isEditable,
    sliceMarks,
    applyStyle,
    queryStyle,
    normalizeMarks,
    rebaseMarks,
    insertImageAt,
    insertTableAt,
    insertDividerAt,
    removeParaById,
    toggleList,
    indentList,
    toggleBlockStyle,
    type EditorDoc,
    type Para,
    type Pos,
    type ModelSelection,
    type MarkStyle,
    type MarkKey,
    type StyledSegment,
    type ImageMeta,
    type TableMeta,
    type ListType,
    type BlockStyle
  } from '../editor-core'
  import {
    makeCoverEl,
    makeClosingEl,
    makePageHeaderEl,
    makePageFooterEl,
    type CoverMeta,
    type DocMeta
  } from './report-cover'

  /** 초기 블록 지정용(표지/섹션 골격). id는 자동 부여. */
  export interface InitialBlock {
    text?: string
    kind?: Para['kind']
    /** 리스트 표시(body) */
    listType?: ListType
    indent?: number
    /** 블록 서식(body) */
    blockStyle?: BlockStyle
    /**
     * 블록 데이터. kind에 따라 형태가 다르다.
     * - cover: { cover } 또는 { closing } 표지/마무리 데이터
     * - image: ImageMeta / table: TableMeta
     */
    meta?: CoverMeta | ImageMeta | TableMeta
  }

  /** 현재 커서 문단의 블록 상태 (툴바 활성 표시용) */
  export interface BlockState {
    listType?: ListType
    blockStyle?: BlockStyle
  }

  interface Props {
    /** 초기 문단 텍스트(단순). initialBlocks가 있으면 무시. */
    initialParas?: string[]
    /** 초기 블록(표지/heading 포함). 고정 서식 템플릿 주입용. */
    initialBlocks?: InitialBlock[]
    /** 본문 페이지 머리말/꼬리말 데이터(내담자·센터). 있으면 본문 페이지에 표시. */
    docMeta?: DocMeta
    /** 모델 변경 시 콜백 (저장 등 상위 연결용) */
    onChange?: (doc: EditorDoc) => void
    /** 선택 서식 상태 변경 콜백 (툴바 활성 표시용) */
    onStyleChange?: (style: MarkStyle) => void
    /** 커서 문단의 블록 상태(리스트/타이틀/인용) 변경 콜백 */
    onBlockChange?: (state: BlockState) => void
    /** 표지 페이지를 화면에서만 숨김(PDF엔 포함). */
    hideCover?: boolean
    /** 마무리 페이지를 화면에서만 숨김(PDF엔 포함). */
    hideClosing?: boolean
  }
  let {
    initialParas,
    initialBlocks,
    docMeta,
    onChange,
    onStyleChange,
    onBlockChange,
    hideCover = false,
    hideClosing = false
  }: Props = $props()

  // A4 794x1123 @96dpi, 상하 여백 72px
  const PAGE_CONTENT_HEIGHT = 1123 - 72 * 2

  // 모델 — Runes $state로 감싸지 않는다. 코어가 직접 mutate하고 relayout으로 수동 렌더.
  function buildInitialParas(): Para[] {
    if (initialBlocks && initialBlocks.length) {
      return initialBlocks.map((b) => ({
        id: makeUid(),
        text: b.text ?? '',
        kind: b.kind ?? 'body',
        ...(b.listType ? { listType: b.listType } : {}),
        ...(b.indent ? { indent: b.indent } : {}),
        ...(b.blockStyle ? { blockStyle: b.blockStyle } : {}),
        ...(b.meta ? { meta: b.meta } : {})
      }))
    }
    const texts = initialParas && initialParas.length ? initialParas : ['']
    return texts.map((t) => ({ id: makeUid(), text: t, kind: 'body' as const }))
  }
  const doc: EditorDoc = { paras: buildInitialParas() }

  let workspace: HTMLDivElement
  const paraEls = new Map<string, HTMLDivElement>()
  let composing = false
  let lastLayoutKey = ''

  // 자체 선택 — 페이지 경계를 넘는 선택일 때만 활성(한 페이지 내는 네이티브 유지)
  let customSel: { anchor: Pos; focus: Pos } | null = null
  let dragging = false
  let dragAnchor: Pos | null = null
  let hiliteLayer: HTMLDivElement | null = null

  const idIndex = (id: string) => doc.paras.findIndex((p) => p.id === id)
  // 문서 순서 비교: a가 b보다 앞이면 <0
  function cmpPos(a: Pos, b: Pos): number {
    const ia = idIndex(a.paraId),
      ib = idIndex(b.paraId)
    if (ia !== ib) return ia - ib
    return a.offset - b.offset
  }

  // ── 인라인 서식 렌더 ──
  /** 스타일 세그먼트 하나를 span으로 (스타일 없으면 순수 텍스트노드) */
  function segNode(seg: StyledSegment): Node {
    const s = seg.style
    const hasStyle =
      s.bold || s.italic || s.underline || s.strike || s.size !== undefined
    if (!hasStyle) return document.createTextNode(seg.text)
    const span = document.createElement('span')
    span.className = 'seg'
    if (s.bold) span.style.fontWeight = '700'
    if (s.italic) span.style.fontStyle = 'italic'
    const deco: string[] = []
    if (s.underline) deco.push('underline')
    if (s.strike) deco.push('line-through')
    if (deco.length) span.style.textDecoration = deco.join(' ')
    if (s.size !== undefined) span.style.fontSize = s.size + 'px'
    span.appendChild(document.createTextNode(seg.text))
    return span
  }
  /** 편집 문단 el의 내용을 marks에 맞춰 span들로 채운다 */
  function fillParaContent(el: HTMLElement, p: Para) {
    const segs = sliceMarks(p.text, p.marks)
    if (!segs.length) {
      // 빈 문단: 텍스트노드 하나(placeholder는 :empty로 처리되지만
      // 커서 배치를 위해 빈 텍스트노드 유지)
      el.replaceChildren(document.createTextNode(''))
      return
    }
    el.replaceChildren(...segs.map(segNode))
  }
  /** 블록 삭제 버튼(호버 시 표시). 이미지·표 공통. */
  function makeBlockDelButton(paraId: string, title: string): HTMLButtonElement {
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'rpt-block-del'
    del.textContent = '✕'
    del.title = title
    del.contentEditable = 'false'
    del.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const caret = removeParaById(doc, paraId)
      relayout(caret)
    })
    return del
  }
  /** 이미지 블록 DOM: <figure><img><figcaption> + 삭제 버튼 */
  function makeImageEl(meta: ImageMeta, paraId: string): HTMLElement {
    const fig = document.createElement('figure')
    fig.className = 'rpt-image'

    const img = document.createElement('img')
    img.src = meta.src
    img.alt = meta.alt ?? ''
    if (meta.width) img.style.width = meta.width + 'px'
    fig.appendChild(img)

    if (meta.caption) {
      const cap = document.createElement('figcaption')
      cap.textContent = meta.caption
      fig.appendChild(cap)
    }
    fig.appendChild(makeBlockDelButton(paraId, '이미지 삭제'))
    return fig
  }
  /** 표 블록 DOM: 제목 + <table> + 삭제 버튼 (보고서 톤) */
  function makeTableEl(meta: TableMeta, paraId: string): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'rpt-table'

    if (meta.title) {
      const cap = document.createElement('div')
      cap.className = 'rpt-table-title'
      cap.textContent = meta.title
      wrap.appendChild(cap)
    }

    const table = document.createElement('table')
    if (meta.headers?.length) {
      const thead = document.createElement('thead')
      const tr = document.createElement('tr')
      for (const h of meta.headers) {
        const th = document.createElement('th')
        th.textContent = h
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
    }
    const tbody = document.createElement('tbody')
    for (const row of meta.rows ?? []) {
      const tr = document.createElement('tr')
      for (const cell of row) {
        const td = document.createElement('td')
        td.textContent = cell
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    wrap.appendChild(table)
    wrap.appendChild(makeBlockDelButton(paraId, '표 삭제'))
    return wrap
  }

  // 번호 리스트 표시번호 계산: 각 문단 id → 화면에 찍을 번호.
  // 규칙: 같은 indent에서 연속된 number 항목끼리 1,2,3…. 리스트가 아닌 문단이나
  // 더 얕은 indent를 만나면 그 레벨 이하 카운터를 리셋한다(중첩 독립).
  function computeListNumbers(): Map<string, number> {
    const nums = new Map<string, number>()
    const counters: number[] = [] // counters[indent] = 해당 레벨의 현재 번호
    for (const p of doc.paras) {
      const isNum = (p.kind ?? 'body') === 'body' && p.listType === 'number'
      if (!isNum) {
        counters.length = 0 // 리스트 흐름 끊김 → 전체 리셋
        continue
      }
      const lvl = p.indent ?? 0
      counters[lvl] = (counters[lvl] ?? 0) + 1
      counters.length = lvl + 1 // 더 깊은 레벨 카운터는 버림(재진입 시 1부터)
      nums.set(p.id, counters[lvl])
    }
    return nums
  }
  let listNumbers = new Map<string, number>()

  function makeParaEl(para: Para): HTMLDivElement {
    const el = document.createElement('div')
    const kind = para.kind ?? 'body'
    el.className = 'para para-' + kind
    el.dataset.id = para.id
    el.dataset.kind = kind

    // divider(hr) 블록: 편집 불가 잠긴 블록
    if (kind === 'divider') {
      el.contentEditable = 'false'
      const hr = document.createElement('hr')
      hr.className = 'rpt-hr'
      el.appendChild(hr)
      el.appendChild(makeBlockDelButton(para.id, '구분선 삭제'))
      return el
    }

    // cover 블록: 텍스트 대신 표지/마무리 디자인 DOM을 렌더 (편집 불가)
    if (kind === 'cover') {
      el.contentEditable = 'false'
      const meta = (para.meta ?? {}) as CoverMeta
      if (meta.cover) {
        el.classList.add('para-cover-page') // 페이지 꽉 채움(다크 표지)
        el.appendChild(makeCoverEl(meta.cover))
      } else if (meta.closing) {
        el.classList.add('para-closing') // 종이 여백 안 마무리
        el.appendChild(makeClosingEl(meta.closing))
      } else {
        el.appendChild(document.createTextNode(para.text))
      }
      return el
    }

    // image 블록: <img> + 삭제 버튼 (텍스트 편집 불가)
    if (kind === 'image') {
      el.contentEditable = 'false'
      el.appendChild(makeImageEl(para.meta as ImageMeta, para.id))
      return el
    }

    // table 블록: <table> + 삭제 버튼 (텍스트 편집 불가)
    if (kind === 'table') {
      el.contentEditable = 'false'
      el.appendChild(makeTableEl(para.meta as TableMeta, para.id))
      return el
    }

    if (kind === 'body') {
      applyBodyDecoration(el, para)
      // 리스트 항목은 placeholder 없음(마커만 보이면 됨)
      el.dataset.placeholder = para.listType ? '' : ''
      // 빈 문단은 자식 없이 둬야 :empty placeholder가 뜬다
      if (para.text.length) fillParaContent(el, para)
      // sig는 syncEl과 동일 기준(renderSig)으로 통일 — 빈 문단도 deco 변화 감지
      el.dataset.sig = renderSig(para)
    } else {
      // heading 등 잠긴 블록: 네이티브 편집/선택 차단. beforeinput은 body만 발생.
      el.contentEditable = 'false'
      el.appendChild(document.createTextNode(para.text))
    }
    return el
  }

  /** 리스트 마커 크기용 문단 대표 size(px). 텍스트 전체가 균일한 size로 덮여
   *  있으면 그 값, 아니면 undefined(기본). 빈 문단은 마지막 mark의 size를 참고. */
  function paraUniformSize(p: Para): number | undefined {
    const marks = (p.marks ?? []).filter((m) => m.size !== undefined)
    // 빈 문단: 활성 서식이 없으니 mark 하나라도 있으면 그 size(다음 입력 크기 예상)
    if (!p.text.length) return marks[0]?.size
    // 텍스트 전체([0,len))가 동일 size mark 하나로 덮여야 균일로 인정
    if (marks.length !== 1) return undefined
    const m = marks[0]
    return m.start <= 0 && m.end >= p.text.length ? m.size : undefined
  }

  /** body 문단 el에 리스트/블록 서식 표시(클래스·data·CSS변수)를 반영 */
  function applyBodyDecoration(el: HTMLElement, p: Para) {
    el.classList.remove(
      'para-list',
      'para-bullet',
      'para-number',
      'para-quote',
      'para-titleblock'
    )
    el.style.removeProperty('--list-indent')
    el.style.removeProperty('font-size')
    delete el.dataset.indent
    delete el.dataset.num
    if (p.listType) {
      const lvl = p.indent ?? 0
      el.classList.add('para-list', 'para-' + p.listType)
      el.style.setProperty('--list-indent', String(lvl))
      el.dataset.indent = String(lvl)
      if (p.listType === 'number') {
        el.dataset.num = String(listNumbers.get(p.id) ?? 1)
      }
      // 마커(::before)는 문단 font-size를 상속 → 대표 size가 있으면 문단에 세팅해
      // 마커가 텍스트 크기를 따라가게 한다. (텍스트 span은 자기 인라인 size가 우선)
      const size = paraUniformSize(p)
      if (size !== undefined) el.style.fontSize = size + 'px'
    } else if (p.blockStyle === 'quote') {
      el.classList.add('para-quote')
    } else if (p.blockStyle === 'heading') {
      el.classList.add('para-titleblock')
    }
  }

  /** 텍스트+marks 렌더 시그니처 (변경 감지용). 리스트/블록 서식 변화도 포함. */
  function renderSig(p: Para): string {
    const deco =
      (p.listType ?? '') +
      ':' +
      (p.indent ?? 0) +
      ':' +
      (p.blockStyle ?? '') +
      ':' +
      (p.listType === 'number' ? (listNumbers.get(p.id) ?? 1) : '')
    return p.text + ' ' + JSON.stringify(p.marks ?? []) + ' ' + deco
  }

  function syncEl(id: string) {
    const el = paraEls.get(id)
    const p = doc.paras.find((x) => x.id === id)
    if (!el || !p) return
    // 잠긴 블록(cover/heading)은 DOM을 건드리지 않는다.
    if (!isEditable(p)) return
    // sig에 리스트/블록 데코가 포함되므로 빈 문단이어도 deco 변화를 감지한다.
    const sig = renderSig(p)
    if (el.dataset.sig === sig) return // 변화 없음
    // 리스트/블록 서식(클래스·번호·들여쓰기)을 먼저 반영
    applyBodyDecoration(el, p)
    el.dataset.placeholder = p.listType ? '' : ''
    if (!p.text.length) {
      el.replaceChildren() // 빈 문단 → :empty placeholder
    } else {
      fillParaContent(el, p)
    }
    el.dataset.sig = sig
  }

  // ── selection ↔ 모델 좌표 ──
  function elOfNode(node: Node | null): HTMLDivElement | null {
    const n =
      node?.nodeType === 3 ? node.parentElement : (node as Element | null)
    return (n?.closest?.('.para') as HTMLDivElement) ?? null
  }
  function offsetInPara(el: HTMLElement, node: Node, off: number): number {
    const r = document.createRange()
    r.selectNodeContents(el)
    try {
      r.setEnd(node, off)
    } catch {
      return el.textContent?.length ?? 0
    }
    return r.toString().length
  }
  /** 문단 내 문자 오프셋 → 실제 (텍스트노드, 노드내 오프셋). span 분할 대응. */
  function nodeAtOffset(el: HTMLElement, offset: number): { node: Node; offset: number } {
    let remaining = offset
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let last: Text | null = null
    let node = walker.nextNode() as Text | null
    while (node) {
      last = node
      const len = node.textContent?.length ?? 0
      if (remaining <= len) return { node, offset: remaining }
      remaining -= len
      node = walker.nextNode() as Text | null
    }
    // 텍스트노드가 없으면(빈 문단) el 자체에 offset 0
    if (!last) {
      const tn = document.createTextNode('')
      el.appendChild(tn)
      return { node: tn, offset: 0 }
    }
    return { node: last, offset: last.textContent?.length ?? 0 }
  }
  function posFromPoint(node: Node | null, off: number): Pos | null {
    const el = elOfNode(node)
    if (!el || !el.dataset.id) return null
    return { paraId: el.dataset.id, offset: offsetInPara(el, node!, off) }
  }
  function getModelSelection(): ModelSelection | null {
    // 자체 선택(페이지 넘김)이 활성이면 그것을 우선
    if (customSel) {
      const { anchor, focus } = customSel
      const [start, end] =
        cmpPos(anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor]
      const collapsed =
        start.paraId === end.paraId && start.offset === end.offset
      return { start, end, collapsed }
    }
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const a = posFromPoint(sel.anchorNode, sel.anchorOffset)
    const f = posFromPoint(sel.focusNode, sel.focusOffset)
    if (!a || !f) return null
    return { start: a, end: f, collapsed: sel.isCollapsed }
  }

  // ── 인라인 서식 적용 (툴바용) — stored marks 방식 ──
  // activeFmt: 다음 입력에 적용될 "활성 서식". 워드/구글독스의 stored marks.
  // - 편집(입력/삭제/엔터/IME)으로는 절대 바뀌지 않고 지속된다.
  //   → 글자를 다 지우고 다시 입력해도 유지됨.
  // - 오직 사용자의 명시적 커서 이동(클릭/화살표)에서만 문맥 서식으로 교체된다.
  // - 툴바 토글은 activeFmt를 직접 바꾼다.
  let activeFmt: MarkStyle = {}
  // 툴바로 방금 서식을 설정했음을 표시. 다음 사용자 커서이동 1회는 activeFmt를
  // 문맥으로 덮지 않는다(포커스 전에 설정한 서식이 첫 클릭에 지워지지 않게).
  let toolbarSetSticky = false

  /** 선택 범위를 문자 오프셋으로 복원(서식 적용 후 selection 유지) */
  function restoreSelection(sel: ModelSelection) {
    const aEl = paraEls.get(sel.start.paraId)
    const fEl = paraEls.get(sel.end.paraId)
    if (!aEl || !fEl) return
    const a = nodeAtOffset(aEl, sel.start.offset)
    const f = nodeAtOffset(fEl, sel.end.offset)
    const s = window.getSelection()
    if (!s) return
    const r = document.createRange()
    try {
      r.setStart(a.node, a.offset)
      r.setEnd(f.node, f.offset)
      s.removeAllRanges()
      s.addRange(r)
    } catch {
      /* noop */
    }
  }

  /** 툴바에서 호출: 현재 선택에 스타일 토글/설정 */
  export function toggleStyle(key: MarkKey, value?: boolean | number) {
    const msel = getModelSelection()
    // 에디터에 선택이 없거나(포커스 밖) collapsed면: activeFmt만 갱신.
    // 툴바로 방금 설정했으므로, 다음 사용자 커서이동 1회는 이 서식을 덮지 않는다.
    if (!msel || msel.collapsed) {
      if (key === 'size') activeFmt.size = value as number | undefined
      else activeFmt[key] = !activeFmt[key]
      toolbarSetSticky = true
      notifyStyleChange()
      return
    }
    applyStyle(doc, msel, key, value)
    relayout()
    restoreSelection(msel)
    // 선택에 서식을 적용했으면 활성 서식도 그 상태로 맞춘다
    activeFmt = queryStyle(doc, msel)
    if (key === 'size') activeFmt.size = value as number | undefined
    notifyStyleChange()
  }

  /** 현재 활성 서식(또는 선택 서식)을 상위(툴바)에 알림 */
  function notifyStyleChange() {
    if (!onStyleChange) return
    const msel = getModelSelection()
    if (msel && !msel.collapsed) onStyleChange(queryStyle(doc, msel))
    else onStyleChange({ ...activeFmt })
  }

  /** 커서(또는 마지막 커서) 문단의 블록 상태를 상위(툴바)에 알림 */
  function notifyBlockChange() {
    if (!onBlockChange) return
    const at = getModelSelection()?.start ?? lastCaret
    const p = at ? doc.paras.find((x) => x.id === at.paraId) : null
    if (!p || !isEditable(p)) {
      onBlockChange({})
      return
    }
    onBlockChange({ listType: p.listType, blockStyle: p.blockStyle })
  }

  // 마지막으로 에디터 안에 있던 커서 위치(에셋 삽입 등 포커스 밖 동작에 사용)
  let lastCaret: Pos | null = null

  /** 블록 삽입 지점: 현재 커서 → 마지막 커서 → 마지막 편집 문단 끝 */
  function blockInsertPos(): Pos {
    let at = getModelSelection()?.start ?? lastCaret
    if (!at || idIndex(at.paraId) === -1) {
      const editables = doc.paras.filter((p) => isEditable(p))
      const last = editables[editables.length - 1] ?? doc.paras[doc.paras.length - 1]
      at = { paraId: last.id, offset: last.text.length }
    }
    return at
  }
  /**
   * 드롭 좌표에 커서를 놓는다 — 사이드바 자료를 끌어다 놓을 때 삽입 지점이 된다.
   * 좌표가 문단 위가 아니면 false(그때는 blockInsertPos의 기본 규칙대로 들어간다).
   */
  export function placeCaretAtPoint(x: number, y: number): boolean {
    const pos = posFromClientPoint(x, y)
    if (!pos || idIndex(pos.paraId) === -1) return false
    lastCaret = pos
    setCaret(pos)
    return true
  }
  /** 이미지 삽입(좌측 에셋 클릭). */
  export function insertImage(image: ImageMeta) {
    relayout(insertImageAt(doc, blockInsertPos(), image))
  }
  /** 표 삽입(좌측 해석 에셋 클릭). */
  export function insertTable(table: TableMeta) {
    relayout(insertTableAt(doc, blockInsertPos(), table))
  }
  /** 가로 구분선 삽입(툴바). */
  export function insertDivider() {
    relayout(insertDividerAt(doc, blockInsertPos()))
  }

  /**
   * 현재 선택 범위를 모델 좌표로 반환(외부 보관용).
   * AI 리뷰처럼 버튼 클릭으로 selection이 풀린 뒤 되돌아와 고칠 때 쓴다.
   */
  export function captureSelection(): ModelSelection | null {
    const msel = getModelSelection()
    return msel && !msel.collapsed ? orderSel(msel) : null
  }

  /**
   * 보관해둔 선택 범위의 텍스트를 replacement로 치환한다.
   * 범위가 유효하지 않으면(문단 삭제 등) 아무것도 하지 않고 false를 반환.
   */
  export function replaceRange(msel: ModelSelection, replacement: string): boolean {
    if (idIndex(msel.start.paraId) === -1 || idIndex(msel.end.paraId) === -1) return false
    const ordered = orderSel(msel)
    const pos = deleteRange(doc, ordered)
    const after = insertTextAt(doc, pos, replacement)
    relayout(after) // relayout이 onChange까지 통지한다
    restoreSelection({ start: after, end: after, collapsed: true })
    return true
  }

  /** 툴바용 대상 선택: 현재 선택 → 마지막 커서(collapsed). 없으면 null. */
  function targetSelection(): ModelSelection | null {
    const msel = getModelSelection()
    if (msel) return msel
    if (lastCaret && idIndex(lastCaret.paraId) !== -1) {
      return { start: lastCaret, end: lastCaret, collapsed: true }
    }
    return null
  }

  /** 리스트 토글(불릿/번호). 대상 문단들의 커서 유지 후 재레이아웃. */
  export function toggleListStyle(type: ListType) {
    const msel = targetSelection()
    if (!msel) return
    toggleList(doc, msel, type)
    relayout()
    restoreSelection(orderSel(msel))
    notifyBlockChange()
  }
  /** 리스트 들여쓰기(+1)/내어쓰기(-1) (Tab/Shift+Tab 또는 툴바). */
  export function changeIndent(delta: number) {
    const msel = targetSelection()
    if (!msel) return
    indentList(doc, msel, delta)
    relayout()
    restoreSelection(orderSel(msel))
    notifyBlockChange()
  }
  /** 블록 서식(타이틀/인용) 토글. */
  export function toggleBlock(style: BlockStyle) {
    const msel = targetSelection()
    if (!msel) return
    toggleBlockStyle(doc, msel, style)
    relayout()
    restoreSelection(orderSel(msel))
    notifyBlockChange()
  }

  /** 선택 위치 정렬(문서 순서) — restoreSelection에 넘길 좌표 계산 */
  function orderSel(msel: ModelSelection): ModelSelection {
    const ia = idIndex(msel.start.paraId),
      ib = idIndex(msel.end.paraId)
    if (ia < ib || (ia === ib && msel.start.offset <= msel.end.offset)) return msel
    return { start: msel.end, end: msel.start }
  }

  /** 스타일이 비었나(적용할 서식 없음) */
  function fmtEmpty(s: MarkStyle): boolean {
    return (
      !s.bold && !s.italic && !s.underline && !s.strike && s.size === undefined
    )
  }
  /** 삽입에 적용할 활성 서식(없으면 undefined) */
  function inheritStyleFor(): MarkStyle | undefined {
    toolbarSetSticky = false // 입력이 일어나면 툴바 설정은 소비됨
    return fmtEmpty(activeFmt) ? undefined : { ...activeFmt }
  }
  /** 커서 위치의 서식으로 activeFmt를 재설정 (사용자 커서 이동 시만 호출) */
  function syncActiveFmtToCaret(pos: Pos) {
    const len = curParaLen(pos.paraId)
    if (len === 0) return // 빈 문단은 문맥이 없으니 활성 서식 유지
    // 커서 앞 문자의 서식을 활성 서식으로. 문단 맨앞이면 뒤 문자.
    const at =
      pos.offset > 0
        ? { start: { ...pos, offset: pos.offset - 1 }, end: pos }
        : { start: pos, end: { ...pos, offset: Math.min(1, len) } }
    activeFmt = queryStyle(doc, at)
  }
  function curParaLen(paraId: string): number {
    return doc.paras.find((p) => p.id === paraId)?.text.length ?? 0
  }

  // ── 자체 선택: 좌표 → 모델 pos ──
  function caretFromClientPoint(
    x: number,
    y: number
  ): { node: Node; offset: number } | null {
    // 표준 caretPositionFromPoint, 웹킷 caretRangeFromPoint
    const anyDoc = document as unknown as {
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    if (anyDoc.caretPositionFromPoint) {
      const p = anyDoc.caretPositionFromPoint(x, y)
      return p ? { node: p.offsetNode, offset: p.offset } : null
    }
    if (anyDoc.caretRangeFromPoint) {
      const r = anyDoc.caretRangeFromPoint(x, y)
      return r ? { node: r.startContainer, offset: r.startOffset } : null
    }
    return null
  }
  function posFromClientPoint(x: number, y: number): Pos | null {
    const c = caretFromClientPoint(x, y)
    if (!c) return null
    return posFromPoint(c.node, c.offset)
  }

  // ── 하이라이트 렌더 (workspace 기준 절대배치) ──
  function clearHighlight() {
    if (hiliteLayer) hiliteLayer.innerHTML = ''
  }
  function renderHighlight(anchor: Pos, focus: Pos) {
    if (!hiliteLayer) return
    hiliteLayer.innerHTML = ''
    const [start, end] =
      cmpPos(anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor]
    const wsRect = workspace.getBoundingClientRect()
    const si = idIndex(start.paraId),
      ei = idIndex(end.paraId)
    const pushBox = (rect: DOMRect | DOMRectReadOnly) => {
      const box = document.createElement('div')
      box.className = 'hl-rect'
      box.style.left = rect.left - wsRect.left + 'px'
      box.style.top = rect.top - wsRect.top + 'px'
      box.style.width = rect.width + 'px'
      box.style.height = rect.height + 'px'
      hiliteLayer!.appendChild(box)
    }
    for (let i = si; i <= ei; i++) {
      const p = doc.paras[i]
      const el = paraEls.get(p.id)
      if (!el) continue
      // 잠긴 블록(cover/heading)은 텍스트 offset이 없으니 요소 전체를 박스로.
      if (!isEditable(p)) {
        pushBox(el.getBoundingClientRect())
        continue
      }
      const len = p.text.length
      const from = i === si ? start.offset : 0
      const to = i === ei ? end.offset : len
      const a = nodeAtOffset(el, Math.min(from, len))
      const b = nodeAtOffset(el, Math.min(Math.max(to, from), len))
      const r = document.createRange()
      try {
        r.setStart(a.node, a.offset)
        r.setEnd(b.node, b.offset)
      } catch {
        continue
      }
      for (const rect of r.getClientRects()) pushBox(rect)
    }
  }

  // ── 드래그 추적 ──
  // 원칙: 한 페이지 내 선택은 네이티브 유지. 드래그가 페이지 경계를 넘는 순간만 자체 모드.
  function pageOfPara(paraId: string): Element | null {
    return paraEls.get(paraId)?.closest('.page') ?? null
  }
  function onMouseDown(e: MouseEvent) {
    // 좌클릭만
    if (e.button !== 0) return
    const p = posFromClientPoint(e.clientX, e.clientY)
    if (!p) return
    dragAnchor = p
    dragging = true
    customSel = null
    workspace.classList.remove('custom-selecting')
    clearHighlight()
  }
  // anchor 지점에 collapsed 네이티브 커서를 놓아 page-body 포커스 유지(beforeinput 수신용).
  // setCaret과 달리 하이라이트를 건드리지 않는다.
  function placeNativeCaret(pos: Pos) {
    const el = paraEls.get(pos.paraId)
    if (!el) return
    const sel = window.getSelection()
    if (!sel) return
    const { node, offset } = nodeAtOffset(el, pos.offset)
    const r = document.createRange()
    try {
      r.setStart(node, offset)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
      ;(el.closest('.page-body') as HTMLElement | null)?.focus?.({
        preventScroll: true
      })
    } catch {
      /* noop */
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging || !dragAnchor) return
    const focus = posFromClientPoint(e.clientX, e.clientY)
    if (!focus) return
    const crossesPage =
      pageOfPara(dragAnchor.paraId) !== pageOfPara(focus.paraId)
    if (crossesPage) {
      const wasCustom = customSel !== null
      // 자체 모드: 우리 하이라이트로 표시
      customSel = { anchor: dragAnchor, focus }
      workspace.classList.add('custom-selecting')
      renderHighlight(dragAnchor, focus)
      // 자체모드 "진입 순간"에만 네이티브 커서를 anchor에 collapsed로 남긴다.
      // (removeAllRanges로 지우면 page-body 포커스가 풀려 beforeinput이 안 뜬다)
      if (!wasCustom) placeNativeCaret(dragAnchor)
      e.preventDefault()
    } else if (customSel) {
      // 다시 한 페이지 안으로 돌아옴 → 네이티브로 복귀
      customSel = null
      workspace.classList.remove('custom-selecting')
      clearHighlight()
    }
  }
  function onMouseUp() {
    dragging = false
    dragAnchor = null
    // customSel은 유지(편집·복사에 쓰임). 다음 클릭에서 해제됨.
    // 사용자가 클릭/드래그로 커서를 옮김 → 활성 서식을 문맥으로 교체
    syncActiveFmtFromUserCaret()
  }

  // 화살표/Home/End 등 커서 이동 키 → 활성 서식을 문맥으로 교체
  function onKeyUp(e: KeyboardEvent) {
    const navKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown'
    ]
    if (navKeys.includes(e.key)) {
      syncActiveFmtFromUserCaret()
      notifyBlockChange() // 커서 이동 시 블록 상태(리스트/타이틀/인용) 갱신
    }
  }

  // Tab/Shift+Tab: 리스트 항목이면 들여쓰기 조정(기본 포커스 이동 차단).
  // 리스트가 아니면 브라우저 기본 동작에 맡긴다.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const at = getModelSelection()?.start ?? lastCaret
    const p = at ? doc.paras.find((x) => x.id === at.paraId) : null
    if (!p || !p.listType) return // 리스트 항목에서만 가로챈다
    e.preventDefault()
    changeIndent(e.shiftKey ? -1 : 1)
  }

  // ── 레이아웃 ──
  function ensureEls() {
    // 번호 리스트 표시번호를 먼저 계산 → makeParaEl/syncEl이 참조
    listNumbers = computeListNumbers()
    for (const p of doc.paras) {
      if (!paraEls.get(p.id)) paraEls.set(p.id, makeParaEl(p))
      else syncEl(p.id)
    }
    for (const id of [...paraEls.keys()]) {
      if (idIndex(id) === -1) paraEls.delete(id)
    }
  }
  // 본문 페이지의 머리말+꼬리말이 잡아먹는 세로 높이(px).
  // docMeta가 있을 때만 헤더/푸터를 그리므로 그 경우에만 차감. 실측정으로 보정된다.
  // svelte-ignore state_referenced_locally
  let bodyOverhead = docMeta ? 112 : 0

  /** 페인트된 본문 페이지에서 헤더/푸터 실제 높이를 재서 bodyOverhead를 보정.
   *  값이 바뀌면 true를 반환(재레이아웃 필요). */
  function measureBodyOverhead(): boolean {
    if (!docMeta) return false
    const header = workspace.querySelector<HTMLElement>('.page:not(.page-cover) .rpt-page-header')
    const foot = workspace.querySelector<HTMLElement>('.page:not(.page-cover) .page-foot')
    if (!header && !foot) return false
    // margin까지 포함해야 정확 → 헤더 top margin은 없고 bottom margin 20, 푸터 top margin 20
    const hStyle = header ? getComputedStyle(header) : null
    const fStyle = foot ? getComputedStyle(foot) : null
    const hH = header
      ? header.offsetHeight + (hStyle ? parseFloat(hStyle.marginBottom) : 0)
      : 0
    const fH = foot
      ? foot.offsetHeight + (fStyle ? parseFloat(fStyle.marginTop) : 0)
      : 0
    const measured = Math.round(hH + fH)
    if (measured > 0 && Math.abs(measured - bodyOverhead) > 1) {
      bodyOverhead = measured
      return true
    }
    return false
  }

  function computePages(): string[][] {
    const pages: string[][] = []
    let cur: string[] = [],
      used = 0
    const flush = () => {
      if (cur.length) pages.push(cur)
      cur = []
      used = 0
    }
    const bodyLimit = PAGE_CONTENT_HEIGHT - bodyOverhead
    for (const p of doc.paras) {
      // cover(표지/마무리)는 항상 단독 페이지를 차지한다.
      if ((p.kind ?? 'body') === 'cover') {
        flush()
        pages.push([p.id])
        continue
      }
      const el = paraEls.get(p.id)!
      const h = el.offsetHeight + 4
      if (used + h > bodyLimit && cur.length > 0) flush()
      cur.push(p.id)
      used += h
    }
    flush()
    return pages
  }
  function paintPages(pages: string[][]) {
    const frag = document.createDocumentFragment()

    // 본문 페이지만 별도로 번호 매김(표지·마무리 제외)
    const isCover = (ids: string[]) => {
      if (ids.length !== 1) return false
      const p = doc.paras.find((x) => x.id === ids[0])
      return !!p && (p.kind ?? 'body') === 'cover'
    }
    const bodyPageTotal = pages.filter((ids) => !isCover(ids)).length
    let bodyPageNo = 0

    pages.forEach((ids) => {
      const page = document.createElement('div')
      page.className = 'page'
      const only = ids.length === 1 ? doc.paras.find((p) => p.id === ids[0]) : null
      const coverMeta = only && (only.kind ?? 'body') === 'cover'
        ? ((only.meta ?? {}) as CoverMeta)
        : null

      const body = document.createElement('div')
      body.className = 'page-body'
      body.contentEditable = 'true'
      ids.forEach((id) => body.appendChild(paraEls.get(id)!))

      if (coverMeta) {
        // 표지/마무리: 헤더·푸터·번호 없음. body만 페이지를 채움.
        page.classList.add('page-cover')
        if (coverMeta.closing) page.classList.add('page-closing')
        page.appendChild(body)
      } else {
        // 본문 페이지: 머리말 + body + 꼬리말/번호
        bodyPageNo += 1
        if (docMeta) page.appendChild(makePageHeaderEl(docMeta))
        page.appendChild(body)

        const footer = document.createElement('div')
        footer.className = 'page-foot'
        footer.contentEditable = 'false'
        if (docMeta?.footerText || docMeta) {
          footer.appendChild(makePageFooterEl(docMeta ?? {}))
        }
        const pn = document.createElement('div')
        pn.className = 'page-number'
        pn.textContent = `${bodyPageNo} / ${bodyPageTotal}`
        footer.appendChild(pn)
        page.appendChild(footer)
      }

      frag.appendChild(page)
    })
    workspace.replaceChildren(frag)
    // 하이라이트 레이어는 replaceChildren에 날아가므로 페이지 위(맨 뒤)에 다시 얹는다
    if (hiliteLayer) workspace.appendChild(hiliteLayer)
    applyScreenHidden() // 재렌더로 클래스가 날아가므로 표지/마무리 숨김 재적용
  }

  /** 표지(page-cover:not(.page-closing))/마무리(page-closing) 페이지에
   *  화면 전용 숨김 클래스를 prop 상태대로 적용. */
  function applyScreenHidden() {
    if (!workspace) return
    for (const page of workspace.querySelectorAll<HTMLElement>('.page.page-cover')) {
      const isClosing = page.classList.contains('page-closing')
      const hide = isClosing ? hideClosing : hideCover
      page.classList.toggle('screen-hidden', hide)
    }
  }
  function relayout(caret?: Pos | null) {
    if (composing) return
    ensureEls()
    let pages = computePages()
    let key = pages.map((p) => p.join(',')).join('|')
    if (key !== lastLayoutKey) {
      paintPages(pages)
      lastLayoutKey = key
    }
    // 첫 페인트 후 헤더/푸터 실제 높이를 측정해 오버헤드 보정.
    // 값이 바뀌면 페이지 분할이 달라지므로 아래 재계산에서 반영된다.
    measureBodyOverhead()
    pages = computePages()
    key = pages.map((p) => p.join(',')).join('|')
    if (key !== lastLayoutKey) {
      paintPages(pages)
      lastLayoutKey = key
    }
    if (caret) setCaret(caret)
    onChange?.(doc)
  }
  function setCaret(pos: Pos) {
    const el = paraEls.get(pos.paraId)
    if (!el) return
    const sel = window.getSelection()
    if (!sel) return
    const r = document.createRange()
    const { node, offset } = nodeAtOffset(el, pos.offset)
    try {
      r.setStart(node, offset)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
      ;(el.closest('.page-body') as HTMLElement | null)?.focus?.({
        preventScroll: true
      })
      sel.removeAllRanges()
      sel.addRange(r)
    } catch {
      /* noop */
    }
  }

  // ── beforeinput 파이프라인 (모델-우선) ──
  function onBeforeInput(e: InputEvent) {
    const t = e.inputType
    if (t === 'insertCompositionText') return // IME는 composition 경로로

    const msel = getModelSelection()
    if (!msel) return
    e.preventDefault()

    // 자체 선택이 이 편집으로 소비됨 → 해제(편집 후엔 커서 상태로)
    customSel = null
    workspace.classList.remove('custom-selecting')
    clearHighlight()

    let caret: Pos | null = null
    switch (t) {
      case 'insertText': {
        const start = msel.collapsed ? msel.start : deleteRange(doc, msel)
        // 활성 서식을 그대로 입력에 적용 (지속).
        caret = insertTextAt(doc, start, e.data ?? '', inheritStyleFor())
        break
      }
      case 'insertParagraph': {
        const start = msel.collapsed ? msel.start : deleteRange(doc, msel)
        const prevPara = doc.paras.find((p) => p.id === start.paraId)
        const wasBlock = !!prevPara?.blockStyle // 타이틀/인용에서 엔터?
        // 엔터해도 활성 서식은 그대로 유지 → 새 줄 첫 입력이 이어받음
        caret = splitAt(doc, start)
        // 타이틀/인용 블록에서 엔터 → 새 줄은 일반 본문. 블록 CSS 크기가
        // 빠지므로 활성 서식(크기 포함)도 새 문단 문맥으로 리셋해 툴바/입력을
        // 실제 본문 크기에 맞춘다. (24 등 이전 크기가 남는 문제 해결)
        if (wasBlock) activeFmt = {}
        break
      }
      case 'insertFromPaste':
      case 'insertReplacementText': {
        const start = msel.collapsed ? msel.start : deleteRange(doc, msel)
        const text = e.dataTransfer
          ? e.dataTransfer.getData('text/plain')
          : (e.data ?? '')
        caret = insertTextAt(doc, start, text)
        break
      }
      case 'deleteContentBackward':
      case 'deleteWordBackward':
      case 'deleteSoftLineBackward':
        caret = msel.collapsed
          ? deleteBackward(doc, msel.start)
          : deleteRange(doc, msel)
        break
      case 'deleteContentForward':
      case 'deleteWordForward':
      case 'deleteSoftLineForward':
        caret = msel.collapsed
          ? deleteForward(doc, msel.start)
          : deleteRange(doc, msel)
        break
      case 'deleteByCut':
      case 'deleteContent':
        caret = msel.collapsed ? msel.start : deleteRange(doc, msel)
        break
      default:
        return
    }
    // 편집은 activeFmt를 건드리지 않는다(지속). 문맥 교체는 사용자 커서이동에서만.
    relayout(caret)
    // 엔터로 블록 전환 시 activeFmt를 리셋했을 수 있으니 툴바 표시 갱신
    if (t === 'insertParagraph') {
      notifyStyleChange()
      notifyBlockChange()
    }
  }

  // paste 보강 (일부 브라우저는 beforeinput에 dataTransfer 미제공)
  function onPaste(e: ClipboardEvent) {
    const msel = getModelSelection()
    if (!msel) return
    const text = e.clipboardData?.getData('text/plain')
    if (text == null) return
    e.preventDefault()
    const start = msel.collapsed ? msel.start : deleteRange(doc, msel)
    const caret = insertTextAt(doc, start, text)
    relayout(caret)
  }

  // ── IME 경로 ──
  // 이번 조합이 여러 문단 걸친 선택삭제를 동반했는지. 그 경우만 compositionend에서
  // 전체 DOM 재수집(recollect)이 필요하다. 일반 조합은 커서 문단 하나만 흡수 →
  // 매 조합마다 전체를 다시 읽는 타이밍 경합(글자 씹힘)을 없앤다.
  let didMultiDeleteOnComposition = false
  // 조합 시작 스냅샷(marks rebase용): 조합 시작 문단·오프셋·원본 텍스트·상속 스타일
  let composeSnap: {
    paraId: string
    offset: number
    origText: string
    inherit?: MarkStyle
  } | null = null

  function onCompositionStart() {
    const msel = getModelSelection()
    didMultiDeleteOnComposition = false
    composeSnap = null
    if (msel && !msel.collapsed) {
      const caret = deleteRange(doc, msel)
      didMultiDeleteOnComposition = true
      const keepEl = paraEls.get(caret.paraId)
      const keepText = doc.paras.find((p) => p.id === caret.paraId)?.text ?? ''
      if (keepEl) {
        const tn = keepEl.firstChild
        if (tn && tn.nodeType === 3) tn.textContent = keepText
        else keepEl.replaceChildren(document.createTextNode(keepText))
      }
      for (const [id, el] of [...paraEls.entries()]) {
        if (idIndex(id) === -1) {
          el.remove()
          paraEls.delete(id)
        }
      }
      setCaret(caret)
    }
    // 조합 시작 스냅샷: 커서 문단의 원본 텍스트/오프셋 + 활성 서식(지속)
    const startPos = saveCaretPos()
    if (startPos) {
      const p = doc.paras.find((x) => x.id === startPos.paraId)
      composeSnap = {
        paraId: startPos.paraId,
        offset: startPos.offset,
        origText: p?.text ?? '',
        inherit: inheritStyleFor()
      }
    }
    composing = true
  }
  function onCompositionEnd() {
    composing = false
    const caret = saveCaretPos()
    if (didMultiDeleteOnComposition) {
      // 선택삭제로 문단 구조가 바뀐 경우만 DOM 전체를 신뢰의 원천으로 재수집
      recollectModelFromDom()
      didMultiDeleteOnComposition = false
    } else if (caret) {
      // 일반 조합: 커서 문단 하나만 DOM에서 흡수
      const p = doc.paras.find((x) => x.id === caret.paraId)
      const el = paraEls.get(caret.paraId)
      if (p && el) {
        const newText = el.textContent ?? ''
        // 조합으로 삽입된 구간을 계산해 marks를 rebase (서식 유지 + 상속)
        if (composeSnap && composeSnap.paraId === caret.paraId) {
          const insLen = newText.length - composeSnap.origText.length
          if (insLen !== 0) {
            p.marks = normalizeMarks(
              rebaseMarks(
                p.marks,
                composeSnap.offset,
                0,
                Math.max(0, insLen),
                composeSnap.inherit
              ),
              newText.length
            )
          }
        }
        p.text = newText
      }
    }
    // activeFmt는 지속(편집으로 비우지 않음).
    composeSnap = null
    relayout(caret)
  }
  function saveCaretPos(): Pos | null {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const el = elOfNode(sel.anchorNode)
    if (!el || !el.dataset.id) return null
    return {
      paraId: el.dataset.id,
      offset: offsetInPara(el, sel.anchorNode!, sel.anchorOffset)
    }
  }
  function recollectModelFromDom() {
    const newParas: Para[] = []
    workspace.querySelectorAll<HTMLElement>('.para').forEach((el) => {
      const p = doc.paras.find((x) => x.id === el.dataset.id)
      if (p) {
        // 잠긴 블록(heading/cover)은 DOM 텍스트를 신뢰하지 않고 모델 텍스트를 유지
        if (isEditable(p)) p.text = el.textContent ?? ''
        newParas.push(p)
      } else {
        // 새로 나타난 문단은 항상 body (잠긴 블록은 IME로 생성될 수 없음)
        newParas.push({
          id: el.dataset.id || makeUid(),
          text: el.textContent ?? '',
          kind: 'body'
        })
      }
    })
    if (newParas.length) doc.paras = newParas
  }

  onMount(() => {
    // 하이라이트 오버레이 레이어
    hiliteLayer = document.createElement('div')
    hiliteLayer.className = 'hilite-layer'
    workspace.appendChild(hiliteLayer)

    doc.paras.forEach((p) => paraEls.set(p.id, makeParaEl(p)))
    relayout()

    workspace.addEventListener('beforeinput', onBeforeInput as EventListener)
    workspace.addEventListener('paste', onPaste as EventListener)
    workspace.addEventListener('compositionstart', onCompositionStart)
    workspace.addEventListener('compositionend', onCompositionEnd)
    workspace.addEventListener('mousedown', onMouseDown)
    workspace.addEventListener('keyup', onKeyUp)
    workspace.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('selectionchange', onSelectionChange)

    return () => {
      if (!browser) return
      workspace.removeEventListener(
        'beforeinput',
        onBeforeInput as EventListener
      )
      workspace.removeEventListener('paste', onPaste as EventListener)
      workspace.removeEventListener('compositionstart', onCompositionStart)
      workspace.removeEventListener('compositionend', onCompositionEnd)
      workspace.removeEventListener('mousedown', onMouseDown)
      workspace.removeEventListener('keyup', onKeyUp)
      workspace.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  })

  // selectionchange는 툴바 표시 갱신만 담당(activeFmt를 건드리지 않는다).
  // activeFmt 문맥 교체는 오직 사용자의 명시적 커서 이동(클릭/화살표)에서만.
  function onSelectionChange() {
    if (composing) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    if (!workspace.contains(sel.anchorNode)) return
    // 마지막 커서 위치 기억(포커스 밖 에셋 삽입에 사용)
    const pos = posFromPoint(sel.anchorNode, sel.anchorOffset)
    if (pos) lastCaret = pos
    notifyStyleChange()
    notifyBlockChange()
  }

  /** 사용자가 직접 커서를 옮겼을 때(클릭/화살표) 호출: 활성 서식을 문맥 서식으로 교체 */
  function syncActiveFmtFromUserCaret() {
    if (composing) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    if (!workspace.contains(sel.anchorNode)) return
    if (sel.isCollapsed) {
      // 툴바로 방금 서식을 설정한 직후의 첫 클릭이면 문맥 교체를 건너뛴다(설정 우선).
      if (toolbarSetSticky) {
        toolbarSetSticky = false
        notifyStyleChange()
        return
      }
      const pos = posFromPoint(sel.anchorNode, sel.anchorOffset)
      if (pos) syncActiveFmtToCaret(pos)
    } else {
      // 범위 선택은 명확한 의도 → 선택 서식으로 교체(sticky 해제)
      toolbarSetSticky = false
      const msel = getModelSelection()
      if (msel) activeFmt = queryStyle(doc, msel)
    }
    notifyStyleChange()
  }

  export function getDoc(): EditorDoc {
    return doc
  }

  /** 자료 id(sourceId)로 삽입된 블록의 문단 id를 찾는다. 없으면 null. */
  export function findParaIdBySource(sourceId: string): string | null {
    const hit = doc.paras.find((p) => {
      if (p.kind !== 'image' && p.kind !== 'table') return false
      const meta = p.meta as { sourceId?: string } | undefined
      return meta?.sourceId === sourceId
    })
    return hit?.id ?? null
  }

  /**
   * 해당 블록으로 스크롤하고 잠시 하이라이트한다.
   *
   * 표지/마무리처럼 화면에서 숨겨진 페이지 안에 있으면 스크롤할 수 없으므로
   * 찾지 못한 것으로 처리한다(호출부가 안내를 띄운다).
   */
  export function revealPara(paraId: string): boolean {
    const el = paraEls.get(paraId)
    if (!el || !el.isConnected || el.offsetParent === null) return false

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('rpt-para-flash')
    // 리플로우를 강제해 같은 블록을 연속 클릭해도 애니메이션이 다시 재생되게 한다
    void el.offsetWidth
    el.classList.add('rpt-para-flash')
    window.setTimeout(() => el.classList.remove('rpt-para-flash'), 1600)
    return true
  }

  /** 자료 id로 삽입된 블록을 본문에서 제거한다. 제거했으면 true. */
  export function removeParaBySource(sourceId: string): boolean {
    const paraId = findParaIdBySource(sourceId)
    if (!paraId) return false
    relayout(removeParaById(doc, paraId))
    return true
  }

  // PDF 내보내기용: 현재 렌더된 A4 페이지(.page) 요소들을 순서대로 반환.
  // 각 요소는 794x1123px(A4@96dpi)로, 페이지당 1장씩 캡처하면 된다.
  export function getPageElements(): HTMLElement[] {
    if (!workspace) return []
    return Array.from(workspace.querySelectorAll<HTMLElement>('.page'))
  }

  /**
   * PDF 생성 중에는 표지/마무리의 화면 숨김을 일시 해제한다(캡처엔 포함돼야 하므로).
   * fn(비동기 캡처) 실행 후 원래 숨김 상태로 원복한다.
   * html2canvas는 display:none 요소를 캡처하지 못하므로 이 래퍼로 감싼다.
   */
  export async function withAllPagesVisible<T>(fn: () => Promise<T>): Promise<T> {
    if (!workspace) return fn()
    const hidden = Array.from(
      workspace.querySelectorAll<HTMLElement>('.page.screen-hidden')
    )
    hidden.forEach((p) => p.classList.remove('screen-hidden'))
    try {
      return await fn()
    } finally {
      hidden.forEach((p) => p.classList.add('screen-hidden'))
    }
  }

  // prop(hideCover/hideClosing) 변화 시 화면 숨김 재적용 (relayout 불필요, 클래스만 토글)
  $effect(() => {
    // 의존성 등록
    void hideCover
    void hideClosing
    applyScreenHidden()
  })
</script>

<div class="editor-shell">
  <div class="workspace" bind:this={workspace}></div>
</div>
