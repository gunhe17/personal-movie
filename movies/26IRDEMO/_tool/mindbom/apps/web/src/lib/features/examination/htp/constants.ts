import type { HTPCategory, HTPMainCategory, AnalysisCategory } from './types'

export const CATEGORY_ORDER: HTPCategory[] = ['house', 'tree', 'man', 'woman']

export const CATEGORY_CONFIG: Record<
  HTPCategory,
  {
    label: string
    icon: string
    color: string
    bgClass: string
    textClass: string
    borderClass: string
  }
> = {
  house: {
    label: '집',
    icon: 'home',
    color: '#F97316',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200'
  },
  tree: {
    label: '나무',
    icon: 'park',
    color: '#22C55E',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-200'
  },
  man: {
    label: '남자사람',
    icon: 'man',
    color: '#3B82F6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200'
  },
  woman: {
    label: '여자사람',
    icon: 'woman',
    color: '#EC4899',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    borderClass: 'border-pink-200'
  }
}

export const ANALYSIS_CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  structural: '자기개념',
  emotional: '정서적 안정성',
  interpersonal: '대인관계'
}

export const ANALYSIS_CATEGORY_TO_MAIN: Record<
  AnalysisCategory,
  HTPMainCategory
> = {
  structural: '자기개념',
  emotional: '정서적 안정성',
  interpersonal: '대인관계'
}

/** 표현 드롭다운 옵션 (mainCond별) */
export const EXPRESSION_OPTIONS: Record<string, string[]> = {
  크기: ['과하게 크다', '크다', '적당하다', '작다', '과하게 작다'],
  굵기: ['과하게 굵다', '굵다', '적당하다', '가늘다', '과하게 가늘다'],
  길이: ['과하게 길다', '길다', '적당하다', '짧다', '과하게 짧다'],
  위치: ['상단', '하단'],
  '객체 유무': ['무'],
  개수: ['과하게 많다', '많다']
}

/** BBox 색상 팔레트 (sample과 동일) */
export const BBOX_COLORS = [
  {
    border: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.15)',
    activeBorder: '#1D4ED8',
    activeBg: 'rgba(59, 130, 246, 0.25)'
  },
  {
    border: '#10B981',
    bg: 'rgba(16, 185, 129, 0.15)',
    activeBorder: '#047857',
    activeBg: 'rgba(16, 185, 129, 0.25)'
  },
  {
    border: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.15)',
    activeBorder: '#B45309',
    activeBg: 'rgba(245, 158, 11, 0.25)'
  },
  {
    border: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    activeBorder: '#B91C1C',
    activeBg: 'rgba(239, 68, 68, 0.25)'
  },
  {
    border: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.15)',
    activeBorder: '#6D28D9',
    activeBg: 'rgba(139, 92, 246, 0.25)'
  },
  {
    border: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.15)',
    activeBorder: '#BE185D',
    activeBg: 'rgba(236, 72, 153, 0.25)'
  },
  {
    border: '#06B6D4',
    bg: 'rgba(6, 182, 212, 0.15)',
    activeBorder: '#0E7490',
    activeBg: 'rgba(6, 182, 212, 0.25)'
  },
  {
    border: '#84CC16',
    bg: 'rgba(132, 204, 22, 0.15)',
    activeBorder: '#4D7C0F',
    activeBg: 'rgba(132, 204, 22, 0.25)'
  },
  {
    border: '#F97316',
    bg: 'rgba(249, 115, 22, 0.15)',
    activeBorder: '#C2410C',
    activeBg: 'rgba(249, 115, 22, 0.25)'
  },
  {
    border: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.15)',
    activeBorder: '#4338CA',
    activeBg: 'rgba(99, 102, 241, 0.25)'
  }
]

/**
 * BBox 색은 **항목(objectIndex)에 고정한다** — 렌더 순서로 정하면 안 된다.
 *
 * 예전에는 오버레이가 `{#each bboxes as bbox, index}`의 index로 색을 골랐다.
 * 그런데 그 배열은 가시성으로 걸러진 결과라, 항목 하나를 숨길 때마다 남은
 * 박스들의 색이 전부 바뀌었다. 같은 label의 박스 여럿도 서로 다른 색이었다.
 * 색을 항목에 묶어 두면 우패널의 칩과 캔버스의 박스가 같은 색을 가리킨다.
 */
export function bboxColorFor(objectIndex: number) {
  return BBOX_COLORS[objectIndex % BBOX_COLORS.length]
}

/** 카테고리 아이콘 매핑 (해석 테이블용) */
export const CATEGORY_ICONS: Record<string, string> = {
  집: 'home',
  나무: 'park',
  남자사람: 'man',
  여자사람: 'woman'
}

/** 한글 → HTPCategory 역매핑 */
export const KOREAN_TO_CATEGORY: Record<string, HTPCategory> = {
  집: 'house',
  나무: 'tree',
  남자사람: 'man',
  여자사람: 'woman'
}

/** HTPCategory → 한글 매핑 */
export const CATEGORY_TO_KOREAN: Record<HTPCategory, string> = {
  house: '집',
  tree: '나무',
  man: '남자사람',
  woman: '여자사람'
}

/**
 * 임상가가 직접 항목을 넣을 때 고르는 분석 조건.
 *
 * ⚠️ 객체 label 목록은 **여기에 두지 않는다**. label 집합은 해석 API 스키마가
 * 고정하고, 그 검사의 htp_objects가 이미 카테고리별 전체 label을 담고 있다
 * (탐지 안 된 것은 빈 좌표로). 예전에 CATEGORY_OBJECTS 상수를 따로 두었다가
 * 두 목록이 어긋났다 — 화면에는 '몸통'·'옷'이 있는데 AI는 '상체'·'단추'·
 * '주머니'·'운동화'·'구두'를 쓴다. 후보는 화면이 실제 항목에서 뽑는다.
 *
 * 조건 목록은 사정이 다르다. 임상가가 **자기 소견으로** 적는 값이라 AI 응답과
 * 대응할 필요가 없다(수동 항목은 좌표가 없어 재해석 입력에서 빠진다).
 *
 * 그래도 EXPRESSION_OPTIONS의 키에서 뽑는다 — 손으로 적으면 표현 선택지가
 * 없는 조건('방향' 같은)이 목록에 섞여, 고르는 순간 표현 칸이 비어 버린다.
 */
export const MAIN_COND_OPTIONS = Object.keys(EXPRESSION_OPTIONS)


/** 토스트 표시 시간 (ms) */
export const TOAST_DURATION = 2000

/** 한글 카테고리명으로 스타일 조회 */
export function getCategoryStyleByKorean(koreanName: string) {
  const key = KOREAN_TO_CATEGORY[koreanName]
  if (!key) return null
  return CATEGORY_CONFIG[key]
}
