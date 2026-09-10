<script lang="ts">
  import { slide } from 'svelte/transition'
  import Icon from '$components/ui/Icon.svelte'
  import type { PDIItem, AnalysisResult } from '../types'
  import PDIPanel from './PDIPanel.svelte'
  import AnalysisPanel from './AnalysisPanel.svelte'

  interface Props {
    pdiLines: PDIItem[]
    analysisResults: AnalysisResult[]
    visibleBBoxLabels: Set<string>
    drawingType?: string
    /** 확정된 검사 — 분석 탭의 편집 컨트롤을 잠근다 */
    readOnly?: boolean
    inDrawer?: boolean
    onRowClick: (label: string) => void
    onSelectAll: () => void
    onDeselectAll: () => void
    onExpressionChange: (index: number, value: string) => void
    onObjectUpdate: (objectIndex: number, fields: { label?: string; main_cond?: string; sub_cond?: string }) => void
    onRemoveResult: (objectIndex: number) => void
    /** 영역 지정 — 탐지 안 된 항목에 직접 박스를 그린다 */
    onAssignRegion?: (objectIndex: number) => void
    drawTargetIndex?: number | null
    /** 임상가 소견 항목 추가 */
    onAddResult?: () => void
    /**
     * 재해석 — 탐지 영역을 고친 뒤 조건·해석을 다시 만든다.
     *
     * 푸터가 아니라 이 패널에 둔다. 영역을 손보는 곳이 여기라, 고친 자리에서
     * 바로 이어지는 행동이기 때문이다.
     */
    onReinterpret?: () => void
    isReinterpreting?: boolean
    /** 마지막 재해석 이후 영역이 바뀌었는가 — 바뀌었을 때만 액션이 올라온다 */
    regionDirty?: boolean
    onPDIUpdate: (pdiLines: PDIItem[]) => void
  }

  let {
    pdiLines,
    analysisResults,
    visibleBBoxLabels,
    drawingType = '',
    readOnly = false,
    inDrawer = false,
    onRowClick,
    onSelectAll,
    onDeselectAll,
    onExpressionChange,
    onObjectUpdate,
    onRemoveResult,
    onAssignRegion,
    drawTargetIndex = null,
    onAddResult,
    onReinterpret,
    isReinterpreting = false,
    regionDirty = false,
    onPDIUpdate,
  }: Props = $props()

  let activeTab = $state<'pdi' | 'analysis'>('analysis')

  let rootClass = $derived(
    inDrawer
      ? 'flex w-[min(var(--spacing-exam-panel),100vw)] h-full flex-col border-l border-gray-200 bg-white z-10'
      : 'hidden xl:flex w-exam-panel flex-col flex-shrink-0 border-l border-gray-200 bg-white z-10'
  )
</script>

<div class={rootClass}>
  <!-- Tab Header -->
  <div class="relative flex border-b border-gray-200 bg-gray-50/50 shrink-0">
    <button
      onclick={() => activeTab = 'pdi'}
      class="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-body-03-normal-medium transition-colors relative
        {activeTab === 'pdi' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}"
    >
      <span class="material-icons-round text-base">chat</span>
      사후질문
      {#if pdiLines.length > 0}
        <span class="text-label-01-normal-regular tabular-nums {activeTab === 'pdi' ? 'text-blue-400' : 'text-gray-400'}">{pdiLines.length}</span>
      {/if}
    </button>
    <button
      onclick={() => activeTab = 'analysis'}
      class="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-body-03-normal-medium transition-colors relative
        {activeTab === 'analysis' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}"
    >
      <span class="material-icons-round text-base">analytics</span>
      그림분석
      {#if analysisResults.filter(r => r.hasInterpretation).length > 0}
        <span class="text-label-01-normal-regular tabular-nums {activeTab === 'analysis' ? 'text-blue-400' : 'text-gray-400'}">{analysisResults.filter(r => r.hasInterpretation).length}</span>
      {/if}
    </button>

    <!--
      활성 표시 — 버튼 안에 그리면 탭을 바꿀 때 지워졌다 새로 생겨 튄다.
      트랙에 하나만 띄우고 좌우로 미끄러지게 한다. 두 탭이 flex-1이라
      폭은 항상 절반이므로 translate만으로 충분하다(공용 Tabs와 같은 원리).

      공용 Tabs를 쓰지 않는 이유: 탭마다 아이콘이 붙고 색이 blue 계열이라
      (이 패널 고유) 라벨+카운트만 받는 공용 컴포넌트에 안 들어간다.
    -->
    <span
      class="pointer-events-none absolute bottom-0 left-3 h-0.5 rounded-full bg-blue-600 transition-transform duration-300 ease-out motion-reduce:transition-none"
      style="width: calc(50% - 1.5rem); transform: translateX({activeTab === 'analysis' ? 'calc(100% + 1.5rem)' : '0'});"
    ></span>
  </div>

  <!-- Content area -->
  <div class="flex-1 overflow-y-auto">
    {#if activeTab === 'pdi'}
      <PDIPanel {pdiLines} {drawingType} {readOnly} onUpdate={onPDIUpdate} />
    {:else}
      <AnalysisPanel
        {readOnly}
        {analysisResults}
        {visibleBBoxLabels}
        {onRowClick}
        {onSelectAll}
        {onDeselectAll}
        {onExpressionChange}
        {onObjectUpdate}
        {onRemoveResult}
        {onAssignRegion}
        {drawTargetIndex}
        {onAddResult}
      />
    {/if}
  </div>

  <!--
    영역을 고쳤을 때만 아래에서 올라온다.

    늘 떠 있으면 "지금 눌러야 하나"를 매번 판단해야 하고, 고친 게 없을 때
    누르면 같은 결과를 위해 AI를 한 번 더 부른다. 바뀐 게 있을 때만
    나타나는 편이 "고쳤으니 다시 만든다"는 인과를 그대로 보여준다.
    (reference web의 접수 화면이 같은 방식으로 완료 띠를 올린다)
  -->
  {#if onReinterpret && activeTab === 'analysis' && regionDirty}
    <!-- 띠: 상단 보더 위에 붙어 위만 라운드 (reference의 완료 배너와 같은 형태) -->
    <div transition:slide={{ duration: 280 }} class="shrink-0 px-5">
      <div class="flex items-center gap-2 rounded-t-xl bg-primary-400 px-5 py-2.5">
        <Icon name="edit_note" size="md" class="shrink-0 text-white" />
        <span class="text-body-02-normal-medium text-white">탐지 영역이 바뀌었습니다</span>
      </div>
    </div>

    <div transition:slide={{ duration: 280 }} class="shrink-0 border-t border-gray-100 px-5 py-4">
      <button
        type="button"
        onclick={onReinterpret}
        disabled={isReinterpreting}
        class="flex-center h-11 w-full gap-1.5 rounded-lg text-white transition-all duration-200 {isReinterpreting
          ? 'cursor-not-allowed bg-gray-300'
          : 'bg-primary-500 shadow-[0_2px_8px_rgba(41,121,255,0.25)] hover:bg-primary-600'}"
      >
        <Icon name="refresh" size="md" />
        <span class="text-body-01-normal-medium"
          >{isReinterpreting ? '해석 만드는 중...' : '해석 다시 만들기'}</span
        >
      </button>
    </div>
  {/if}
</div>
