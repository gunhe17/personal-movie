/**
 * HTP Drawing 상태 관리 composable
 * Sample의 useDrawingState.ts를 Svelte 5 Runes로 변환
 */
import { CATEGORY_ORDER, CATEGORY_CONFIG } from './constants'
import type {
  HTPCategory,
  HTPDrawingWithObjects,
  DrawingData,
  BBox,
  PDIItem,
  AnalysisResult,
} from './types'

/**
 * BBox의 화면 id — 객체 하나가 박스를 여럿 가질 수 있어서 필요하다.
 *
 * 이 규칙은 **반드시 한 곳에만** 있어야 한다. 화면을 그릴 때(toDrawingData)와
 * 편집 결과를 서버 좌표로 되돌릴 때(updateBBoxes)가 같은 id를 만들어야
 * 하는데, 예전에 한쪽은 '유효한 점만 거른 뒤의 순번', 다른 쪽은 '원본
 * 순번'을 쓰면 좌표가 **엉뚱한 박스에 저장된다** — 그리고 그 좌표가 그대로
 * 재해석의 입력이 되어 조건 판정까지 틀어진다.
 *
 * pointIndex는 언제나 **원본 points 배열의 인덱스**다.
 */
export function bboxIdFor(objectId: string, pointCount: number, pointIndex: number): string {
  return pointCount > 1 ? `${objectId}#${pointIndex}` : objectId
}

/** 서버 DrawingWithObjects → UI DrawingData 변환 */
function toDrawingData(cat: HTPCategory, serverDrawing?: HTPDrawingWithObjects): DrawingData {
  const cfg = CATEGORY_CONFIG[cat]
  function resolveUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined
    return url.startsWith('http') ? url : `/api/proxy/storage/${url}`
  }

  const imageUrl = resolveUrl(serverDrawing?.image_url)
  const originalImageUrl = resolveUrl(serverDrawing?.original_image_url)

  const imgW = serverDrawing?.image_width || 1
  const imgH = serverDrawing?.image_height || 1
  const bboxes: BBox[] =
    serverDrawing?.objects?.flatMap((obj, objIdx) => {
      const allPts = obj.bbox_data?.points
      if (!allPts?.length) return []
      // flatMap으로 거른다 — filter 뒤에 map하면 순번이 밀려 id 규칙이
      // 역변환(updateBBoxes)과 어긋난다(bboxIdFor 주석 참고).
      return allPts.flatMap((pts, idx) => {
        if (pts?.length !== 4) return []
        return [{
          id: bboxIdFor(obj.id, allPts.length, idx),
          label: obj.label,
          colorIndex: objIdx,
          confidence: obj.confidence ?? 0,
          xPercent: (pts[0] / imgW) * 100,
          yPercent: (pts[1] / imgH) * 100,
          widthPercent: ((pts[2] - pts[0]) / imgW) * 100,
          heightPercent: ((pts[3] - pts[1]) / imgH) * 100,
        }]
      })
    }) ?? []

  const pdi: PDIItem[] = serverDrawing?.pdi_data ?? []

  // BBox가 있는 label 집합 (탐지된 객체)
  const bboxLabelSet = new Set(bboxes.map((b) => b.label))

  /**
   * 분석 항목 — 이 그림의 **모든** 객체를 담는다.
   *
   * 예전에는 판정도 좌표도 없는 항목을 버렸다. 그런데 그런 항목이 실제로
   * 대부분이다(한 검사에서 집 11 / 나무 8 / 사람 9+8개). 버리면 임상가가
   * "AI가 못 찾은 객체에 영역을 지정"할 대상 자체가 화면에 없다 — 추가할
   * 방법이 사라진다. label 집합은 해석 API가 고정하므로 목록은 언제나 전체가
   * 맞고, 있고 없고는 좌표로만 표현된다.
   *
   * 정렬은 판정 있음 → 좌표만 있음 → 아무것도 없음. 임상가가 볼 순서다.
   */
  const analysisResults: AnalysisResult[] = (() => {
    if (!serverDrawing?.objects) return []
    const withInterp: AnalysisResult[] = []
    const detectOnly: AnalysisResult[] = []
    const empty: AnalysisResult[] = []
    for (let i = 0; i < serverDrawing.objects.length; i++) {
      const obj = serverDrawing.objects[i]
      const hasInterp = !!(obj.main_cond || obj.sub_cond)
      const hasBBox = bboxLabelSet.has(obj.label)
      const bboxCount = (obj.bbox_data?.points ?? []).filter((p) => p?.length === 4).length
      const isManual = obj.id.startsWith('manual-') || obj.is_manual === true
      const item: AnalysisResult = {
        category: cfg.label,
        label: obj.label,
        mainCond: obj.main_cond ?? '',
        element: obj.label,
        expression: obj.sub_cond ?? '',
        hasInterpretation: hasInterp || isManual,
        hasBBox,
        colorIndex: i,
        bboxCount,
        isManual,
        objectIndex: i,
      }
      if (hasInterp || isManual) withInterp.push(item)
      else if (hasBBox) detectOnly.push(item)
      else empty.push(item)
    }
    return [...withInterp, ...detectOnly, ...empty]
  })()

  return {
    id: serverDrawing?.id ?? `drawing-${CATEGORY_ORDER.indexOf(cat)}`,
    type: cat,
    category: cfg.label,
    label: cfg.label,
    icon: cfg.icon,
    color: cfg.color,
    bgClass: cfg.bgClass,
    textClass: cfg.textClass,
    imageUrl,
    originalImageUrl,
    bboxes,
    pdi,
    analysisResults,
  }
}

export function useDrawingState() {
  let rawDrawings = $state<HTPDrawingWithObjects[]>([])
  let currentTabIndex = $state(0)
  let isAnalyzing = $state(false)
  let examStatus = $state('created')

  // 서버 데이터 → UI DrawingData 변환 (derived)
  const drawings = $derived<DrawingData[]>(
    CATEGORY_ORDER.map((cat, i) => {
      const serverDrawing = rawDrawings.find((d) => d.category === cat) || rawDrawings[i]
      return toDrawingData(cat, serverDrawing)
    })
  )

  const currentDrawing = $derived(drawings[currentTabIndex])
  const isFirstTab = $derived(currentTabIndex === 0)
  const isLastTab = $derived(currentTabIndex === CATEGORY_ORDER.length - 1)
  const currentCategory = $derived(CATEGORY_ORDER[currentTabIndex])

  function switchTab(index: number) {
    if (index >= 0 && index < CATEGORY_ORDER.length) {
      currentTabIndex = index
    }
  }

  function nextTab() {
    if (!isLastTab) switchTab(currentTabIndex + 1)
  }

  function prevTab() {
    if (!isFirstTab) switchTab(currentTabIndex - 1)
  }

  function setRawDrawings(data: HTPDrawingWithObjects[]) {
    rawDrawings = data
  }

  function updateRawDrawing(id: string, updater: (d: HTPDrawingWithObjects) => HTPDrawingWithObjects) {
    rawDrawings = rawDrawings.map((d) => (d.id === id ? updater(d) : d))
  }

  /** 현재 탭의 서버 drawing 가져오기 */
  function getCurrentServerDrawing(): HTPDrawingWithObjects | undefined {
    return rawDrawings.find((d) => d.category === currentCategory) || rawDrawings[currentTabIndex]
  }

  /** expression(sub_cond) 변경 — 로컬 상태만 업데이트 */
  function updateExpression(objectIndex: number, value: string) {
    const drawing = getCurrentServerDrawing()
    if (!drawing?.objects?.[objectIndex]) return
    drawing.objects[objectIndex] = { ...drawing.objects[objectIndex], sub_cond: value }
    rawDrawings = [...rawDrawings]
  }

  /** 객체 필드 업데이트 (label, main_cond, sub_cond 등) */
  function updateObject(objectIndex: number, fields: Partial<{ label: string; main_cond: string; sub_cond: string }>) {
    const drawing = getCurrentServerDrawing()
    if (!drawing?.objects?.[objectIndex]) return
    drawing.objects[objectIndex] = { ...drawing.objects[objectIndex], ...fields }
    rawDrawings = [...rawDrawings]
  }

  /**
   * BBox 편집을 서버 좌표로 되돌려 rawDrawings에 반영한다.
   *
   * 화면 BBox는 컨테이너 대비 percent이고 서버는 실제 이미지 픽셀이다.
   * toDrawingData의 변환을 그대로 뒤집는다 — 한쪽 식만 고치면 박스가
   * 조금씩 어긋난 채 저장되고, 그 좌표가 재해석 입력이 되어 조건 판정
   * (크다/작다)까지 틀어진다.
   *
   * BBox id 규약도 거기서 온다: 한 객체에 points가 여럿이면 `${objId}#${i}`,
   * 하나면 `objId`.
   */
  function updateBBoxes(updated: BBox[]) {
    const drawing = getCurrentServerDrawing()
    if (!drawing?.objects) return

    const byId = new Map(updated.map((b) => [b.id, b]))
    const imgW = drawing.image_width || 1
    const imgH = drawing.image_height || 1

    const objects = drawing.objects.map((obj) => {
      const pts = obj.bbox_data?.points
      if (!pts?.length) return obj

      let changed = false
      const nextPoints = pts.map((p, idx) => {
        const b = byId.get(bboxIdFor(obj.id, pts.length, idx))
        if (!b || p?.length !== 4) return p
        const x1 = (b.xPercent / 100) * imgW
        const y1 = (b.yPercent / 100) * imgH
        const next = [
          x1,
          y1,
          x1 + (b.widthPercent / 100) * imgW,
          y1 + (b.heightPercent / 100) * imgH,
        ]
        // 픽셀 → percent → 픽셀은 정확히 돌아오지 않는다(20 → 20.000000000000004).
        // 엄격 비교를 쓰면 아무도 건드리지 않은 박스가 매번 '변경됨'으로 잡혀
        // 계속 저장되고, 저장된 값이 다음 왕복의 원본이 되어 좌표가 조금씩
        // 표류한다. 1픽셀 미만은 같은 것으로 보고 **원본을 그대로 둔다**.
        if (next.every((v, i) => Math.abs(v - p[i]) < 1)) return p
        changed = true
        return next
      })

      if (!changed) return obj
      return { ...obj, bbox_data: { ...obj.bbox_data!, points: nextPoints } }
    })

    rawDrawings = rawDrawings.map((d) => (d.id === drawing.id ? { ...d, objects } : d))
  }

  /**
   * 영역 추가 — 항목에 박스를 하나 **덧붙인다**.
   *
   * 덮어쓰지 않는 이유: 한 항목의 박스 개수가 그 자체로 판정이다. 창문 박스가
   * 3개면 해석 API가 `개수 → 많다`로 판정한다(1~2개일 때는 판정이 없다).
   * 그래서 "탐지 요소 추가"는 label을 새로 만드는 게 아니라 **같은 label에
   * 박스를 더하는 것**이다 — label 집합 자체는 해석 API가 고정한다.
   *
   * confidence는 1로 둔다. AI 확신도가 아니라 임상가가 직접 지정했다는
   * 뜻이고, 해석 API도 좌표와 함께 이 값을 받는다.
   */
  function addObjectBBox(
    objectIndex: number,
    rect: { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number }
  ) {
    const drawing = getCurrentServerDrawing()
    const obj = drawing?.objects?.[objectIndex]
    if (!obj) return

    const imgW = drawing!.image_width || 1
    const imgH = drawing!.image_height || 1
    const x1 = (rect.xPercent / 100) * imgW
    const y1 = (rect.yPercent / 100) * imgH
    const newPoint = [
      x1,
      y1,
      x1 + (rect.widthPercent / 100) * imgW,
      y1 + (rect.heightPercent / 100) * imgH,
    ]

    const points = [...(obj.bbox_data?.points ?? []), newPoint]
    const confidence = [...(obj.bbox_data?.confidence ?? []), 1]

    drawing!.objects[objectIndex] = {
      ...obj,
      bbox_data: { points, confidence },
      confidence: obj.confidence ?? 1,
    }
    rawDrawings = [...rawDrawings]
  }

  /**
   * 영역 하나만 제거 — 항목은 남기고 그 박스만 뺀다.
   *
   * 항목 전체를 비우는 clearObjectBBox와 다르다. 박스 개수가 판정이므로
   * (창문 3개 → '개수 많다') 잘못 잡힌 박스 하나를 빼는 것과 "이 객체가
   * 아예 없다"고 말하는 것은 서로 다른 임상적 진술이다.
   *
   * pointIndex는 **원본 points 배열의 인덱스**다(bboxIdFor 주석).
   */
  function removeObjectBBoxAt(objectIndex: number, pointIndex: number) {
    const drawing = getCurrentServerDrawing()
    const obj = drawing?.objects?.[objectIndex]
    const pts = obj?.bbox_data?.points
    if (!obj || !pts?.[pointIndex]) return

    const points = pts.filter((_, i) => i !== pointIndex)
    const confidence = (obj.bbox_data?.confidence ?? []).filter((_, i) => i !== pointIndex)

    // 마지막 영역을 뺐으면 조건도 비운다 — 좌표가 없는데 그 좌표로 나온
    // 판정('크기: 크다')이 남으면 표의 '표현' 열과 근거가 어긋난다.
    // 서버도 같은 규칙으로 판정한다(UpdateObjectsService).
    const cleared = points.length === 0
    drawing!.objects[objectIndex] = {
      ...obj,
      bbox_data: { points, confidence },
      ...(cleared ? { main_cond: null, sub_cond: null, confidence: null } : {}),
    }
    rawDrawings = [...rawDrawings]
  }

  /** 화면 BBox id(`objId` 또는 `objId#idx`) → 원본 위치 */
  function locateBBox(bboxId: string): { objectIndex: number; pointIndex: number } | null {
    const [objId, idxPart] = bboxId.split('#')
    const drawing = getCurrentServerDrawing()
    const objectIndex = drawing?.objects?.findIndex((o) => o.id === objId) ?? -1
    if (objectIndex < 0) return null
    return { objectIndex, pointIndex: idxPart ? Number(idxPart) : 0 }
  }

  /**
   * (제거됨) clearObjectBBox — 항목의 좌표를 한 번에 비우던 '탐지 취소'.
   *
   * 영역을 하나씩 지우면 같은 결과에 도달하므로 고유한 의미가 없었고,
   * 두 경로가 어긋나 있었다 — 개별 삭제는 조건(main_cond)을 남기고 탐지
   * 취소는 지워서, 좌표가 없는 같은 상태인데 조건이 달랐다. 지금은
   * removeObjectBBoxAt이 마지막 영역을 뺄 때 조건까지 정리한다.
   */

  /** 분석 항목 삭제 */
  function removeAnalysisResult(objectIndex: number) {
    const drawing = getCurrentServerDrawing()
    if (!drawing?.objects?.[objectIndex]) return
    rawDrawings = rawDrawings.map((d) =>
      d.id === drawing.id
        ? { ...d, objects: d.objects.filter((_, i) => i !== objectIndex) }
        : d
    )
  }

  /**
   * 분석 항목 직접 추가 — 임상가가 자기 소견으로 적는 행.
   *
   * AI 탐지 항목과 다른 종류다. 좌표(bbox_data)가 없어서 재해석 입력에서
   * 빠지고(_objects_to_detection_result), 그래서 AI 판정을 받지도, 재해석을
   * 깨뜨리지도 않는다. label 집합 제약은 **좌표가 있는 항목**에만 걸린다.
   *
   * label 후보는 화면이 그 그림의 실제 항목에서 뽑아 준다 — 상수로 따로
   * 두면 AI 스키마와 어긋난다(constants.ts의 MAIN_COND_OPTIONS 주석).
   */
  function addAnalysisResult() {
    const drawing = getCurrentServerDrawing()
    if (!drawing) return
    const newObj: HTPDrawingWithObjects['objects'][number] = {
      id: `manual-${Date.now()}`,
      drawing_id: drawing.id,
      examination_id: drawing.examination_id,
      label: '',
      bbox_data: null,
      confidence: null,
      main_cond: '',
      sub_cond: '',
      is_manual: true,
      sort_order: drawing.objects?.length ?? 0,
    }
    rawDrawings = rawDrawings.map((d) =>
      d.id === drawing.id ? { ...d, objects: [...(d.objects ?? []), newObj] } : d
    )
  }

  /** PDI 데이터 변경 — 로컬 상태 업데이트 */
  function updatePDI(pdiLines: { question: string; answer: string }[]) {
    const drawing = getCurrentServerDrawing()
    if (!drawing) return
    rawDrawings = rawDrawings.map((d) =>
      d.id === drawing.id ? { ...d, pdi_data: pdiLines } : d
    )
  }

  return {
    get rawDrawings() { return rawDrawings },
    get drawings() { return drawings },
    get currentTabIndex() { return currentTabIndex },
    get currentDrawing() { return currentDrawing },
    get currentCategory() { return currentCategory },
    get isFirstTab() { return isFirstTab },
    get isLastTab() { return isLastTab },
    get isAnalyzing() { return isAnalyzing },
    set isAnalyzing(v: boolean) { isAnalyzing = v },
    get examStatus() { return examStatus },
    set examStatus(v: string) { examStatus = v },
    switchTab,
    nextTab,
    prevTab,
    setRawDrawings,
    updateRawDrawing,
    getCurrentServerDrawing,
    updateExpression,
    updateObject,
    updateBBoxes,
    addObjectBBox,
    removeObjectBBoxAt,
    locateBBox,
    addAnalysisResult,
    removeAnalysisResult,
    updatePDI,
  }
}
