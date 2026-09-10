<script lang="ts" module>
  import type { Snippet } from 'svelte'

  export interface DataTableColumn<T = any> {
    /** item[key]로 기본 렌더. render를 주면 무시된다. */
    key: string
    label: string
    /** grid-template-columns 값 (예: '160px', 'minmax(0,1.5fr)'). 미지정 시 1fr */
    width?: string
    align?: 'left' | 'center' | 'right'
    headerClass?: string
    cellClass?: string
    /** 셀 클릭이 행 클릭으로 번지지 않게 (액션 버튼 열) */
    stopPropagation?: boolean
    render?: Snippet<[{ item: T; index: number }]>
  }
</script>

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity'
  import { slide } from 'svelte/transition'
  import { prefersReducedMotion } from 'svelte/motion'

  /**
   * DataTable — 리스트 페이지 공용 표.
   *
   * <table>이 아니라 CSS Grid로 짠다. 열 폭을 grid-template-columns 한 줄로
   * 잡으면 헤더와 행이 항상 같은 트랙을 쓰므로, sticky 헤더에서 <table>이
   * 겪는 열 폭 어긋남이 없다.
   *
   * 규격은 Web_Design.md 실측 — 헤더 52 · 좌우 패딩 24 · 열 gap 16.
   * 행 높이는 rowMinHeight 주석 참고(68/60으로 통일).
   */

  interface Props {
    columns: DataTableColumn[]
    data: any[]
    keyField?: string
    onRowClick?: (item: any) => void
    /**
     * 행 최소 높이 클래스. **목록 화면은 이 값을 넘기지 않는다** — 기본값
     * 68(min-h-17)을 그대로 쓴다.
     *
     * 화면마다 정하게 두었더니 56·64·80이 섞여, 같은 제품인데 표마다 밀도가
     * 달라 보였다. 아바타 유무로 나누는 것도 그만뒀다 — 목록을 오가며 보는
     * 사용자에게는 "행 하나의 크기"가 같은 편이 낫다(2026-08-18).
     *
     * 68은 아바타(40)에 상하 14씩 여유를 준 값이고, 정본 §table의 80보다
     * 조밀하다. 4px 단위는 유지한다.
     *
     * 목록이 아닌 표(카드 안의 서브 테이블 등)에서만 넘긴다.
     */
    rowMinHeight?: string
    /** 데이터가 없을 때 보일 내용 */
    empty?: Snippet
    class?: string
    /** 스크롤되는 본문 영역에 붙일 클래스 */
    bodyClass?: string
    /**
     * 행을 펼쳤을 때 아래에 전폭으로 붙는 상세. 주면 행이 토글 가능해진다.
     * onRowClick과 함께 주면 클릭은 onRowClick이 가져가므로 보통 둘 중 하나만 쓴다.
     */
    expanded?: Snippet<[{ item: any; index: number }]>
    /**
     * 이 행이 펼칠 것을 갖고 있는가. 미지정이면 모든 행이 펼침 가능으로 본다.
     *
     * 행 종류가 섞인 표(검사현황의 배터리/단일)에서 필요하다 — 없으면 펼칠
     * 내용이 없는 행에도 aria-expanded가 붙어 보조기술이 "접힌 상태"라고
     * 잘못 읽는다.
     */
    isExpandable?: (item: any, index: number) => boolean
    /** 펼쳐진 행의 key 집합. 미지정 시 컴포넌트가 자체 관리한다. */
    expandedKeys?: Set<any>
    onToggleExpand?: (key: any, item: any) => void
  }

  let {
    columns,
    data,
    keyField = 'id',
    onRowClick,
    rowMinHeight = 'min-h-17',
    empty,
    class: className = '',
    bodyClass = '',
    expanded,
    isExpandable,
    expandedKeys,
    onToggleExpand
  }: Props = $props()

  /** 이 행에 펼침 상세가 있는가 — expanded 스니펫 + 행별 판정 */
  function canExpand(item: any, index: number): boolean {
    if (!expanded) return false
    return isExpandable ? isExpandable(item, index) : true
  }

  let gridTemplate = $derived(
    columns.map((c) => c.width || 'minmax(0, 1fr)').join(' ')
  )

  /** 부모가 expandedKeys를 주지 않으면 여기서 관리한다. */
  let ownExpanded = $state(new SvelteSet<any>())
  let effectiveExpanded = $derived(expandedKeys ?? ownExpanded)

  function keyOf(item: any, index: number) {
    return item[keyField] ?? index
  }

  function toggleExpand(item: any, index: number) {
    const key = keyOf(item, index)
    if (onToggleExpand) {
      onToggleExpand(key, item)
      return
    }
    // SvelteSet은 변이만으로 반응한다 — 재할당하지 않는다.
    if (ownExpanded.has(key)) ownExpanded.delete(key)
    else ownExpanded.add(key)
  }

  /** 행 클릭의 의미 — onRowClick이 우선, 없고 펼칠 것이 있으면 펼침 토글. */
  function handleRowActivate(item: any, index: number) {
    if (onRowClick) onRowClick(item)
    else if (canExpand(item, index)) toggleExpand(item, index)
  }

  let isRowInteractive = $derived(Boolean(onRowClick) || Boolean(expanded))

  function alignClass(align?: 'left' | 'center' | 'right'): string {
    if (align === 'center') return 'justify-center text-center'
    if (align === 'right') return 'justify-end text-right'
    return 'justify-start text-left'
  }
</script>

<div class="flex min-h-0 flex-col {className}">
  <!--
    헤더 — 스크롤 영역 '밖'에 두어 고정한다.
    sticky로 붙이면 헤더가 스크롤 컨테이너 안에 들어가서, 위치는 고정돼도
    스크롤바 트랙이 헤더 높이까지 올라온다. 본문만 스크롤시키려면
    헤더를 형제로 빼고 아래 div에만 overflow를 줘야 한다.

    규격(Web_Design.md §table): 높이 52 · 라벨 Body_02/Medium(15) gray-600 ·
    좌우 패딩 24 · 열 gap 16.

    여기서는 border-b가 그대로 보인다 — <table>이 아니라 grid div라서다.
    (감사추적·검사현황도 이제 이 컴포넌트를 쓴다. 목록 화면에 남은 <table>은
     없다 — 검사 결과표처럼 스크롤 헤더가 없는 표만 <table>이다.)
  -->
  <div
    class="grid h-13 shrink-0 items-center gap-4 border-b border-gray-200 bg-gray-50 px-6"
    style="grid-template-columns: {gridTemplate}"
  >
    {#each columns as column (column.key)}
      <div
        class="flex min-w-0 text-body-02-normal-medium text-gray-600 {alignClass(
          column.align
        )} {column.headerClass ?? ''}"
      >
        {column.label}
      </div>
    {/each}
  </div>

  <!-- 본문 — 스크롤은 여기서만 생긴다 -->
  <div class="min-h-0 flex-1 overflow-y-auto {bodyClass}">
    {#if data.length === 0}
      {#if empty}
        {@render empty()}
      {/if}
    {:else}
      {#each data as item, index (item[keyField] ?? index)}
        {@const expandable = canExpand(item, index)}
        {@const isOpen =
          expandable && effectiveExpanded.has(keyOf(item, index))}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="grid {rowMinHeight} items-center gap-4 border-b border-gray-200 px-6 py-3 transition-colors {isOpen
            ? 'bg-gray-50'
            : 'bg-white'} {isOpen ? '' : 'last:border-b-0'} {isRowInteractive
            ? 'cursor-pointer hover:bg-gray-50'
            : ''}"
          style="grid-template-columns: {gridTemplate}"
          onclick={() => handleRowActivate(item, index)}
          onkeydown={(e) => {
            if (isRowInteractive && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              handleRowActivate(item, index)
            }
          }}
          role={isRowInteractive ? 'button' : undefined}
          tabindex={isRowInteractive ? 0 : undefined}
          aria-expanded={expandable ? isOpen : undefined}
        >
          {#each columns as column (column.key)}
            <div
              class="flex min-w-0 items-center {alignClass(column.align)} {column.cellClass ?? ''}"
              role={column.stopPropagation ? 'presentation' : undefined}
              onclick={(e) => {
                if (column.stopPropagation) e.stopPropagation()
              }}
              onkeydown={(e) => {
                if (column.stopPropagation && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
            >
              {#if column.render}
                {@render column.render({ item, index })}
              {:else}
                <!-- 기본 셀 — 정본 §table: Body_01/Regular(16) text-body-default -->
                <span class="truncate text-body-01-normal-regular text-gray-700">
                  {item[column.key] ?? '-'}
                </span>
              {/if}
            </div>
          {/each}
        </div>

        <!--
          펼침 상세 — 열 트랙을 따르지 않고 전폭을 쓴다.
          <table>의 colspan에 해당하는 자리로, grid가 아니라 일반 블록이라
          내용이 알아서 폭을 채운다.

          slide로 높이를 열고 닫는다. 툭 나타나면 아래 행들이 순간이동한 것처럼
          보여, 무엇이 새로 생겼는지 눈이 따라가지 못한다.
          접근성 설정에서 모션을 줄이면 즉시 전환한다.
        -->
        {#if expanded && expandable && isOpen}
          <div
            class="overflow-hidden border-b border-gray-200 bg-gray-50 px-6 py-3 last:border-b-0"
            transition:slide={{
              duration: prefersReducedMotion.current ? 0 : 200
            }}
          >
            {@render expanded({ item, index })}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
