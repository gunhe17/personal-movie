import type { SCTDomain } from './types'

export const DOMAIN_COLORS: Record<SCTDomain, { bg: string; text: string; border: string; hex: string }> = {
  A: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', hex: '#ff9200' },
  B: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', hex: '#00bf40' },
  C: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', hex: '#3B82F6' },
  D: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', hex: '#EC4899' },
  E: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', hex: '#9b5dff' }
}

// SCT 점수 척도: 해당 도메인 맥락 안에서 낮을수록 건강, 높을수록 병리
// 백엔드 컨벤션과 일치 (apps/api/app/infrastructure/ai/base.py:89 참조)
export const SCORE_RUBRIC: { score: number; label: string; description: string }[] = [
  { score: 0, label: '건강', description: '적응적, 긍정적, 안정적 표상' },
  { score: 1, label: '긍정적 반응의 중간 강도', description: '' },
  { score: 2, label: '약한 긍정', description: '긍정 쪽으로 기울지만 강도가 약함' },
  { score: 3, label: '중립', description: '적응/부적응 어느 쪽도 명확치 않음' },
  { score: 4, label: '약한 갈등', description: '일상 수준의 불편·고민' },
  { score: 5, label: '중등도 갈등', description: '비관·내적 불화·반복적 호소' },
  { score: 6, label: '심각한 갈등', description: '적대감·증상 호소·현실 괴리' }
]
