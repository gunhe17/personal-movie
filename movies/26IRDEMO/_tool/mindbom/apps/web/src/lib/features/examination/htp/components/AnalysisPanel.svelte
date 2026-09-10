<script lang="ts">
  import type { AnalysisResult, HTPCategory } from '../types'
  import {
    EXPRESSION_OPTIONS,
    MAIN_COND_OPTIONS,
    bboxColorFor
  } from '../constants'
  import Select from '$components/ui/Select.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import Switch from '$components/ui/Switch.svelte'

  interface Props {
    analysisResults: AnalysisResult[]
    visibleBBoxLabels: Set<string>
    /**
     * 확정된 검사 — 편집 컨트롤을 잠근다(표시/숨김 토글은 계속 된다).
     *
     * 확정 후에도 이 화면은 열려 있다. 임상가가 결과를 본 뒤 탐지 결과를
     * 다시 확인해야 하기 때문이다. 대신 확정본이 바뀌면 안 되므로 편집만 막는다.
     * 판정은 화면이 넘겨준다 — 출처는 core/status.ts 하나다.
     */
    readOnly?: boolean
    onRowClick: (label: string) => void
    onSelectAll: () => void
    onDeselectAll: () => void
    onExpressionChange: (index: number, value: string) => void
    onObjectUpdate: (
      objectIndex: number,
      fields: { label?: string; main_cond?: string; sub_cond?: string }
    ) => void
    onRemoveResult: (objectIndex: number) => void
    /** 영역 지정 — 탐지 안 된 항목에 직접 박스를 그린다 */
    onAssignRegion?: (objectIndex: number) => void
    /** 지금 영역 지정 중인 항목 (버튼 상태 표시용) */
    drawTargetIndex?: number | null
    /** 임상가 소견 항목 추가 (없으면 버튼을 숨긴다) */
    onAddResult?: () => void
  }

  let {
    analysisResults,
    visibleBBoxLabels,
    readOnly = false,
    onRowClick,
    onSelectAll,
    onDeselectAll,
    onExpressionChange,
    onObjectUpdate,
    onRemoveResult,
    onAssignRegion,
    drawTargetIndex = null,
    onAddResult
  }: Props = $props()

  /**
   * 공용 Select는 { value, label } 배열을 받는다 — 문자열 목록을 그 형태로 옮긴다.
   *
   * 이 표의 셀렉트는 좁은 우패널(420) 안에 3개가 나란히 서므로 정본 높이(44)를
   * className으로 덮어 쓴다(twMerge가 h-11을 h-8로 교체). 옵션 패널은 Select가
   * portal로 띄우므로 표가 스크롤돼도 잘리지 않는다 — native select를 쓰던
   * 이유가 사라졌다.
   */
  const toOptions = (values: string[]) =>
    values.map((v) => ({ value: v, label: v }))

  /** 표 안의 좁은 셀렉트 — 정본 h-11을 덮는다 */
  const CELL_SELECT = 'h-8 w-full rounded px-1.5 text-body-03-normal-regular'

  /**
   * 옵션 패널 폭 — 트리거를 따라가면 안 된다.
   *
   * 열 폭이 80~112px인데 '과하게 가늘다' 같은 옵션이 들어와 잘린다.
   * menuClassName을 주면 Select가 폭 고정(isFitWidth)을 꺼서 여기 값이 쓰인다.
   */
  const CELL_MENU = 'min-w-36'

  function getOptionsForCond(mainCond: string, currentValue: string): string[] {
    const options = EXPRESSION_OPTIONS[mainCond]
    if (!options) return currentValue ? [currentValue] : []
    if (options.includes(currentValue)) return options
    return currentValue ? [currentValue, ...options] : options
  }

  /**
   * 표는 이 그림의 **모든** 항목을 한 곳에 보여준다.
   *
   * 예전에는 판정 있는 것만 표로, 좌표만 있는 것은 아래 칩으로 갈라 두고,
   * 판정도 좌표도 없는 것은 아예 안 보여줬다. 그래서 칩에는 영역 추가·탐지
   * 취소 버튼이 없었고, 안 보이는 항목은 손댈 방법 자체가 없었다.
   * 임상가가 하는 일이 "각 항목의 좌표를 손보는 것"이므로 목록은 전체여야 한다.
   */
  let judged = $derived(analysisResults.filter((r) => r.hasInterpretation))

  /**
   * 영역 편집 대상 — 수동(직접) 항목은 뺀다.
   *
   * 좌표를 지정해도 해석 API가 모르는 label이라 판정을 받지 못하기 때문이다.
   * 그 항목들은 위 판정 표에서 삭제만 할 수 있다.
   */
  let regionItems = $derived(analysisResults.filter((r) => !r.isManual))

  /**
   * 직접 추가 행의 객체 후보 — **그 그림의 실제 항목**에서 뽑는다.
   *
   * 상수 목록을 따로 두면 AI 스키마와 어긋난다(예전에 화면엔 '몸통'·'옷',
   * AI는 '상체'·'단추'가 있었다). 이미 안 쓴 항목만 남기되, 지금 고른 값은
   * 목록에서 빠지므로 맨 앞에 되돌려 넣는다.
   */
  let objectCandidates = $derived(regionItems.map((r) => r.label))
  function objectOptions(current: string): string[] {
    const used = new Set(
      analysisResults.filter((r) => r.isManual && r.label).map((r) => r.label)
    )
    const avail = objectCandidates.filter((l) => !used.has(l) || l === current)
    return current && !avail.includes(current) ? [current, ...avail] : avail
  }

  /**
   * 표시 대상은 **박스가 있는 항목**뿐이다 — 영역이 없으면 보일 것도 없다.
   *
   * 여기서 전체 항목을 검사하면 '전체 표시'를 눌러도 참이 되지 않아
   * (그쪽은 박스 있는 label만 넣는다) 토글이 한쪽으로만 동작한다.
   * 판정과 조작이 같은 집합을 봐야 한다.
   */
  let visibleTargets = $derived(regionItems.filter((r) => r.hasBBox))
  let allVisible = $derived(
    visibleTargets.length > 0 && visibleTargets.every((r) => visibleBBoxLabels.has(r.label))
  )
</script>

<div class="flex flex-col gap-5 p-4">
  {#if analysisResults.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div
        class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100"
      >
        <Icon name="image_search" size="lg" class="text-gray-400" />
      </div>
      <p class="mb-1 text-body-03-normal-regular text-gray-500">분석 결과가 없습니다</p>
      <p class="text-label-01-normal-regular text-gray-400">이미지를 업로드하면 AI가 분석합니다</p>
    </div>
  {:else}
    <!--
      ── 1) AI 판정 ── 읽는 영역.
      아래 '탐지 영역'이 이 판정의 입력이다. 예전에는 둘이 한 표에 섞여 있어,
      같은 행에서 '표현'은 고쳐도 재해석 때 덮어써지고 좌표는 재해석해야
      반영되는 정반대 규칙이 아무 구분 없이 나란히 있었다.
    -->
    <section>
      <div class="mb-2 flex items-center gap-1.5">
        <h4 class="text-label-01-normal-semibold text-gray-600">AI 판정</h4>
        <span class="text-label-01-normal-regular tabular-nums text-gray-400">{judged.length}</span>
      </div>

      {#if judged.length === 0}
        <p
          class="rounded-lg border border-dashed border-gray-200 py-4 text-center text-label-01-normal-regular text-gray-400"
        >
          아직 판정이 없습니다. 아래에서 영역을 손본 뒤 '해석 다시 만들기'를
          누르세요.
        </p>
      {:else}
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="w-full text-body-03-normal-regular">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="border-b border-gray-200 px-3 py-2 text-left text-label-01-normal-medium text-gray-600"
                  >분석 요소</th
                >
                <th
                  class="w-24 border-b border-gray-200 px-3 py-2 text-left text-label-01-normal-medium text-gray-600"
                  >분석 조건</th
                >
                <th
                  class="w-28 border-b border-gray-200 px-3 py-2 text-left text-label-01-normal-medium text-gray-600"
                  >표현</th
                >
              </tr>
            </thead>
            <tbody>
              {#each judged as result (result.objectIndex)}
                {@const options = getOptionsForCond(
                  result.mainCond,
                  result.expression
                )}
                {#if result.isManual}
                  <!--
                    임상가가 직접 적는 소견 행.

                    좌표가 없어 재해석 입력에서 빠지므로(=AI 판정 대상이 아님)
                    조건·표현을 임상가가 직접 고른다. 그래서 재해석해도 이 행은
                    덮어써지지 않는다 — AI 판정 행과 정반대다.
                  -->
                  {@const subOptions =
                    EXPRESSION_OPTIONS[result.mainCond] ?? []}
                  <tr
                    class="border-b border-gray-200 bg-amber-50/40 last:border-b-0"
                  >
                    <td class="px-2 py-1.5">
                      <div class="flex items-center gap-1">
                        <Select
                          disabled={readOnly}
                          options={toOptions(objectOptions(result.label))}
                          value={result.label}
                          onChange={(v) =>
                            onObjectUpdate(result.objectIndex, {
                              label: (v as string) ?? ''
                            })}
                          placeholder="객체 선택"
                          ariaLabel="분석 요소"
                          fullWidth
                          className={CELL_SELECT}
                          menuClassName={CELL_MENU}
                        />
                        {#if !readOnly}
                          <button
                            onclick={() => onRemoveResult(result.objectIndex)}
                            class="flex-center shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:text-red-400"
                            title="삭제"
                          >
                            <Icon name="remove_circle_outline" size="sm" />
                          </button>
                        {/if}
                      </div>
                    </td>
                    <td class="px-2 py-1.5">
                      <Select
                        disabled={readOnly}
                        options={toOptions([...MAIN_COND_OPTIONS])}
                        value={result.mainCond}
                        onChange={(v) => {
                          const newCond = (v as string) ?? ''
                          // 조건이 바뀌면 표현도 그 조건의 첫 값으로 맞춘다 —
                          // 안 그러면 '크기'의 '크다'가 '개수' 조건에 남는다.
                          onObjectUpdate(result.objectIndex, {
                            main_cond: newCond,
                            sub_cond: EXPRESSION_OPTIONS[newCond]?.[0] ?? ''
                          })
                        }}
                        placeholder="선택"
                        ariaLabel="분석 조건"
                        fullWidth
                        className={CELL_SELECT}
                        menuClassName={CELL_MENU}
                      />
                    </td>
                    <td class="px-2 py-1.5">
                      <Select
                        disabled={readOnly || subOptions.length === 0}
                        options={toOptions([...subOptions])}
                        value={result.expression}
                        onChange={(v) =>
                          onObjectUpdate(result.objectIndex, {
                            sub_cond: (v as string) ?? ''
                          })}
                        placeholder="선택"
                        ariaLabel="표현"
                        fullWidth
                        className={CELL_SELECT}
                        menuClassName={CELL_MENU}
                      />
                    </td>
                  </tr>
                {:else}
                  <tr
                    class="border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                  >
                    <td class="px-3 py-2.5 text-body-03-normal-medium text-gray-800">
                      {result.element}
                    </td>
                    <td class="px-3 py-2.5">
                      <!-- '객체 유무'처럼 띄어쓰기가 있는 값이 좁은 열에서 줄바꿈되지 않게 -->
                      <span
                        class="inline-block whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-label-01-normal-regular text-gray-500"
                        >{result.mainCond || '—'}</span
                      >
                    </td>
                    <td class="px-3 py-2.5">
                      {#if options.length > 0}
                        <Select
                          disabled={readOnly}
                          options={toOptions(options)}
                          value={result.expression}
                          onChange={(v) =>
                            onExpressionChange(
                              result.objectIndex,
                              (v as string) ?? ''
                            )}
                          ariaLabel="표현"
                          fullWidth
                          className="{CELL_SELECT} border-transparent bg-transparent hover:border-gray-200 hover:bg-gray-50"
                          menuClassName={CELL_MENU}
                        />
                      {:else}
                        <span class="text-body-03-normal-medium text-gray-900"
                          >{result.expression || '—'}</span
                        >
                      {/if}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if onAddResult && !readOnly}
        <!--
          임상가 소견 항목 — AI가 판정하지 않는 별개 행이다.
          좌표가 없어 재해석 입력에서 빠지므로 재해석해도 덮어써지지 않는다.
        -->
        <button
          onclick={onAddResult}
          class="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-body-03-normal-regular text-gray-400 transition-colors hover:border-blue-300 hover:text-blue-500"
        >
          <Icon name="add" size="sm" />
          분석 항목 직접 추가
        </button>
      {/if}
    </section>

    <!--
      ── 2) 탐지 영역 ── 손대는 영역. 재해석의 입력이다.

      표가 아니라 칩으로 둔 이유: 여기서 다루는 값은 항목당 '영역 몇 개'
      하나뿐이라 열이 필요 없고, 좁은 우패널(420)에서 15~18행짜리 표보다
      훑기 쉽다. 개수를 드러내는 건 그 자체가 판정이기 때문이다
      (창문 3개 → '개수 많다').
    -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <h4 class="text-label-01-normal-semibold text-gray-600">탐지 영역</h4>
          <span class="text-label-01-normal-regular text-gray-400">
            탐지 {visibleTargets.length} · 미탐지 {regionItems.length - visibleTargets.length}
          </span>
        </div>
        <!--
          보이기/숨기기를 버튼 두 개로 두면 "지금 어느 상태인가"를 두 버튼의
          강조로 읽어야 했다. 상태는 하나(전부 보임 ↔ 전부 숨김)이므로 토글이
          그 상태 자체가 된다. 개별 항목만 골라 둔 중간 상태에서는 꺼진 것으로
          보이고, 누르면 전부 보임으로 되돌아온다.
        -->
        <label class="flex cursor-pointer items-center gap-1.5">
          <span class="text-label-02-normal-regular text-gray-400"
            >영역 표시</span
          >
          <Switch
            checked={allVisible}
            onclick={() => (allVisible ? onDeselectAll() : onSelectAll())}
            ariaLabel="탐지 영역 전체 표시"
          />
        </label>
      </div>

      <div class="flex flex-wrap gap-1.5">
        {#each regionItems as result (result.objectIndex)}
          {@const isVisible = visibleBBoxLabels.has(result.label)}
          {@const isFocused = isVisible && visibleBBoxLabels.size === 1}
          {@const isDrawing = drawTargetIndex === result.objectIndex}
          <div
            class="flex items-center gap-1 rounded-lg border py-1 pl-2 pr-1 transition-colors
              {isDrawing
              ? 'border-blue-400 bg-blue-50'
              : isFocused
                ? 'border-blue-300 bg-blue-50/60'
                : result.hasBBox
                  ? 'border-gray-200 bg-white'
                  : 'border-dashed border-gray-200 bg-gray-50'}"
          >
            <!--
              이름을 누르면 그림에서 그 영역만 남긴다. 영역이 없는 항목은
              눌러도 캔버스가 텅 비므로 아예 막는다 — 그 항목에 할 일은
              오른쪽 '영역 추가'뿐이다.
            -->
            <button
              onclick={() => onRowClick(result.label)}
              disabled={!result.hasBBox}
              class="flex items-center gap-1 text-label-01-normal-regular transition-colors
                {result.hasBBox
                ? 'text-gray-700'
                : 'cursor-default text-gray-400'}
                {isVisible || !result.hasBBox ? '' : 'opacity-50'}"
              title={result.hasBBox
                ? '그림에서 이 영역만 보기'
                : '탐지된 영역이 없습니다'}
            >
              <!-- 색 점 — 그림 속 박스와 같은 색이라 눈으로 짝지을 수 있다.
                   영역이 없으면 빈 원(테두리만)으로 둔다. -->
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                style={result.hasBBox
                  ? `background-color: ${bboxColorFor(result.colorIndex).border}`
                  : 'box-shadow: inset 0 0 0 1px #D1D5DB'}
              ></span>
              {result.element}
              {#if result.bboxCount > 0}
                <span
                  class="rounded-full px-1.5 tabular-nums text-label-02-normal-bold
                    {isFocused
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'}">{result.bboxCount}</span
                >
              {/if}
            </button>

            {#if !readOnly && onAssignRegion}
              <span class="h-4 w-px ml-1.5 shrink-0 bg-gray-200"></span>
              <!--
                영역 추가 — 탐지된 항목이든 아니든 하는 일이 같다(박스를 하나
                덧붙인다). 그래서 아이콘도 하나로 통일한다. 다른 건 안내 문구뿐.

                크기를 고정해 두 이유: 버튼이 하나뿐이라 p-0.5만으로는 아이콘이
                칩 오른쪽에 어중간하게 붙어 보인다. 정사각 상자를 주고 그 안에
                중앙 정렬한다.
              -->
              <button
                onclick={() => onAssignRegion(result.objectIndex)}
                class="flex-center h-6 w-6 shrink-0 rounded transition-colors {isDrawing
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-300 hover:bg-gray-100 hover:text-blue-500'}"
                title={result.hasBBox
                  ? '영역 추가 — 같은 객체를 하나 더 표시'
                  : '영역 추가 — 그림에서 이 객체의 위치를 표시'}
              >
                <Icon name="add_box" size="sm" />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>
