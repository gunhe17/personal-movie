/** API 응답 타입 */

export type HTPCategory = 'house' | 'tree' | 'man' | 'woman'
export type HTPMainCategory = '자기개념' | '정서적 안정성' | '대인관계'
export type AnalysisCategory = 'structural' | 'emotional' | 'interpersonal'

export interface PDIItem {
  question: string
  answer: string
}

export interface HTPDrawing {
  id: string
  examination_id: string
  category: HTPCategory
  image_url: string | null
  original_image_url: string | null
  image_width: number | null
  image_height: number | null
  pdi_data: PDIItem[] | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HTPObject {
  id: string
  drawing_id: string
  examination_id: string
  label: string
  bbox_data: { points: number[][]; confidence: number[] } | null
  confidence: number | null
  main_cond: string | null
  sub_cond: string | null
  is_manual: boolean
  sort_order: number
}

export interface HTPInterpretation {
  id: string
  examination_id: string
  drawing_id: string | null
  object_id: string | null
  main_category: HTPMainCategory
  sub_category: string
  sentence: string
  target_name: string | null
  is_important: boolean
  is_safety: boolean
  is_compound: boolean
  sort_order: number
}

export interface HTPDrawingWithObjects extends HTPDrawing {
  objects: HTPObject[]
}

export interface HTPFullResults {
  examination_id: string
  status: string
  drawings: HTPDrawingWithObjects[]
  interpretations: HTPInterpretation[]
  /**
   * 해석을 재생성한 응답(analyze·reinterpret)에만 담긴다.
   * 별표는 해석 레코드에 붙어 있어 재생성 때 새 문장에 다시 매달아야 하는데,
   * 문장이 바뀐 소견은 옮길 수 없다 — 그 개수(lost)를 임상가에게 알린다.
   */
  important_carry_over?: { carried: number; lost: number } | null
  /**
   * 탐지 결과가 해석보다 나중에 바뀌었는가 — '해석 다시 만들기'가 필요한 상태.
   *
   * 화면 상태로만 들고 있으면 결과 화면에 다녀오거나 새로고침하는 순간
   * 사라진다(좌표는 저장돼 있는데 "다시 만들어야 한다"는 사실만 잃는다).
   * 그래서 서버가 판정한 값을 쓴다.
   */
  needs_reinterpret?: boolean
}

/** UI 모델 — percent 기반 BBox */
export interface BBox {
  id: string
  label: string
  /**
   * 색을 고르는 기준 — 이 박스가 속한 항목의 인덱스다.
   *
   * 렌더 순서로 색을 고르면 가시성 필터에 따라 색이 매번 바뀐다
   * (constants.ts의 bboxColorFor 주석). 우패널 칩도 같은 값을 써서
   * "칩의 색 = 그림 속 박스의 색"이 성립한다.
   */
  colorIndex: number
  confidence?: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

/** UI 모델 — 그림 분석 결과 (AnalysisPanel 테이블 행) */
export interface AnalysisResult {
  category: string     // 한글 카테고리명 (집, 나무, ...)
  label: string        // 객체 레이블 (집전체, 지붕, ...)
  mainCond: string     // 분석 조건 (크기, 굵기, ...)
  element: string      // 분석 요소 텍스트
  expression: string   // 표현 양상 (크다, 작다, ...)
  hasInterpretation: boolean  // 해석 데이터 존재 여부
  /**
   * 탐지 좌표가 있는가 — 없으면 "그림에 이 객체가 없다"는 뜻이다.
   *
   * label은 AI 스키마가 고정하므로 항목 자체는 늘 목록에 있고, 있고 없고는
   * 좌표로 표현된다(clearObjectBBox 주석). '탐지 취소' 버튼도 이 값으로 건다.
   */
  hasBBox: boolean
  /** BBox와 같은 색 기준 — 칩 앞 점과 그림 속 박스가 같은 색이 된다 */
  colorIndex: number
  /** 이 항목이 가진 탐지 영역 수 — 개수 자체가 판정이라(창문 3개 → '개수 많다') 화면에 드러낸다 */
  bboxCount: number
  isManual: boolean    // 수동 추가 여부
  objectIndex: number  // 원본 objects 배열 인덱스
}

/** UI 모델 — 탭별 그림 데이터 (useDrawingState) */
export interface DrawingData {
  id: string
  type: HTPCategory
  category: string     // 한글 (집, 나무, 남자사람, 여자사람)
  label: string
  icon: string         // material icon name
  color: string
  bgClass: string
  textClass: string
  imageUrl?: string
  originalImageUrl?: string
  bboxes: BBox[]
  pdi: PDIItem[]
  analysisResults: AnalysisResult[]
}

/** 해석 테이블 아이템 */
export interface InterpretationItem {
  /**
   * 해석 레코드 id — 별표(중요 소견)의 유일한 좌표다.
   *
   * 예전에는 화면 배열의 인덱스로 별표를 다뤘다. 그런데 화면 목록은
   * (main_category + 그림 필터)로 거른 결과이고 저장 코드는 main_category로만
   * 거른 배열에 같은 인덱스를 썼다 — 썸네일로 그림을 고르는 순간 두 좌표계가
   * 어긋나 **엉뚱한 해석에 별표가 저장**됐고, 그게 그대로 PDF로 나갔다.
   * 필터·정렬이 어떻게 바뀌든 id는 그대로다.
   */
  id: string
  drawing: string
  element: string
  expression: string
  text: string
  important: boolean
  category: AnalysisCategory
  isCompound?: boolean
  compoundElements?: { drawing: string; element: string; expression: string }[]
}
