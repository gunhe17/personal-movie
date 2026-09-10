import type { HTPCategory } from './types'
import { KOREAN_TO_CATEGORY } from './constants'

/**
 * HTP 사후질문(PDI, Post-Drawing Interrogation) 표준 문항.
 *
 * 그림을 다 그린 뒤 검사자가 묻는 정해진 질문들이다. 예전에는 임상가가 매번
 * 직접 타이핑해야 했는데, 표준 문항을 매번 손으로 옮겨 적으면 검사자마다
 * 문구가 달라져 결과를 나란히 비교할 수 없다.
 *
 * ⚠️ 출처와 검토
 * Buck(1948) PDI를 국내 임상에서 통용되는 형태로 옮긴 것으로, **임상심리사
 * 검토가 필요하다**. 판본에 따라 문항 수·표현이 갈리는 영역이라(집 6~8문항 등)
 * 기관에서 쓰는 판본과 대조한 뒤 확정할 것.
 *
 * 문항을 고칠 때는 여기만 고친다 — 화면에 하드코딩하지 않는다.
 *
 * 자유 문항 추가는 그대로 열려 있다. 표준 문항은 시작점일 뿐이고,
 * 임상가가 지우거나 덧붙일 수 있다(그림마다 물을 것이 다르기 때문).
 */
export const PDI_QUESTIONS: Record<HTPCategory, string[]> = {
  house: [
    '이 집은 어떤 집인가요?',
    '이 집에는 누가 살고 있나요?',
    '이 집의 분위기는 어떤가요?',
    '이 집에 살고 있는 사람들은 어떤 사람들인가요?',
    '나중에 이 집은 어떻게 될 것 같나요?',
    '이 집을 그릴 때 무슨 생각을 했나요?'
  ],
  tree: [
    '이 나무는 어떤 나무인가요?',
    '이 나무는 몇 살쯤 되었나요?',
    '이 나무는 살아 있나요?',
    '이 나무는 어디에 서 있나요?',
    '이 나무의 주변에는 무엇이 있나요?',
    '나중에 이 나무는 어떻게 될 것 같나요?',
    '이 나무를 그릴 때 무슨 생각을 했나요?'
  ],
  man: [
    '이 사람은 누구인가요?',
    '이 사람은 몇 살인가요?',
    '이 사람은 무엇을 하고 있나요?',
    '이 사람은 무슨 생각을 하고 있나요?',
    '이 사람의 기분은 어떤가요?',
    '이 사람의 좋은 점과 나쁜 점은 무엇인가요?',
    '나중에 이 사람은 어떻게 될 것 같나요?'
  ],
  woman: [
    '이 사람은 누구인가요?',
    '이 사람은 몇 살인가요?',
    '이 사람은 무엇을 하고 있나요?',
    '이 사람은 무슨 생각을 하고 있나요?',
    '이 사람의 기분은 어떤가요?',
    '이 사람의 좋은 점과 나쁜 점은 무엇인가요?',
    '나중에 이 사람은 어떻게 될 것 같나요?'
  ]
}

/**
 * 표준 문항을 빈 응답과 짝지어 PDI 항목으로 만든다.
 *
 * 화면이 넘겨주는 category는 한글 라벨('집','나무'…)이므로 키로 변환한다
 * (types.ts의 Drawing.category 주석 참고). 영문 키를 그대로 줘도 받는다.
 *
 * 카테고리를 모르면(그림이 아직 안 정해졌거나 예상 밖 값) 빈 배열을 준다 —
 * 엉뚱한 그림의 질문을 들이미는 것보다 낫다.
 */
export function buildDefaultPDI(
  category: HTPCategory | string | null | undefined
): { question: string; answer: string }[] {
  if (!category) return []
  const key = (KOREAN_TO_CATEGORY[category] ?? category) as HTPCategory
  const list = PDI_QUESTIONS[key]
  if (!list) return []
  return list.map((question) => ({ question, answer: '' }))
}
