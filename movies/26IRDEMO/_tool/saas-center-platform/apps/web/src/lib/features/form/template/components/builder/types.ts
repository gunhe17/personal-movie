/** 선택지 (저장 시 {value,label,allow_text} 로 변환. value=label) */
export interface FieldOption {
  label: string
  /** 자유 입력 허용 ("기타( )") */
  allowText: boolean
}

/** 빌더 내부 편집 모델 (canonical 스키마 ↔ UI 변환의 중간 표현) */
export interface EditableField {
  key: string
  type: string
  label: string
  required: boolean
  options: FieldOption[]
  /**
   * 레이블 요소 표시 여부 (기본 false).
   * true 면 값 요소와 같은 field_refs 를 가리키는 widget='label' 요소를 함께 저장 → "레이블↔값" 그룹.
   */
  showLabel: boolean
}

/**
 * 표현 평면 기하 — 위치(x,y) · 크기(w,h) · 정수 z-index.
 * x/w = 페이지 너비 비율, y/h = 페이지 높이 비율 (각 0~1).
 */
export interface Geometry {
  x: number
  y: number
  w: number
  h: number
  z: number
}

/** 캔버스/인스펙터가 공유하는 현재 선택 상태 */
export type Selection = { kind: 'field'; key: string } | { kind: 'none' }
