/**
 * 종합보고서 시연용 목업 자료.
 *
 * ⚠️ 시연용: 실검사(HTP/로샤/SCT) 뒤에 목업 표준화 검사(MMPI-2·S-척도·TCI)를
 *    덧붙여 "종합 심리평가 배터리"처럼 보이게 한다.
 *    실기능 전환 시 이 파일을 통째로 지우고, materialGroups에서 MOCK_MATERIALS
 *    전개와 groupRank 정렬만 걷어내면 된다.
 *
 * 실검사와 달리 색을 모듈에서 파생하지 않는다 — 여기 검사들은 모듈이 없다.
 * (모듈이 생기는 순간 이 파일에서 빠져나가야 할 항목이라는 뜻이기도 하다.)
 */
import type { MaterialGroup } from './materials'

// 목업 표준화 검사 — 차트 썸네일로 "있어 보이는" 자료 채우기
export const MOCK_MATERIALS: MaterialGroup[] = [
  {
    examId: 'mock-mmpi',
    code: 'MMPI-2',
    nameKo: '다면적 인성검사 II',
    date: '2026.06.28',
    status: 'confirmed',
    dotColor: '#0ea5e9', // sky-500
    origin: 'mock',
    card: null,
    items: [
      {
        id: 'mmpi-1',
        name: '타당도·임상 척도',
        kind: 'image',
        src: '/mock-reports/mmpi/clinical.png',
        hint: 'T점수 프로파일'
      },
      {
        id: 'mmpi-2',
        name: '재구성 임상척도',
        kind: 'image',
        src: '/mock-reports/mmpi/rc-psy5.png',
        hint: 'RC & PSY-5'
      },
      {
        id: 'mmpi-3',
        name: '내용 척도',
        kind: 'image',
        src: '/mock-reports/mmpi/content.png',
        hint: '15개 척도'
      },
      {
        id: 'mmpi-4',
        name: '보충 척도',
        kind: 'image',
        src: '/mock-reports/mmpi/supplementary.png',
        hint: '15개 척도'
      },
      // 결과지에 없는 파생 분석 (AI 생성 성격)
      {
        id: 'mmpi-5',
        name: '척도 간 상관 프로파일',
        kind: 'chart',
        chart: 'radar',
        color: '#0ea5e9',
        hint: 'AI 파생 분석'
      },
      {
        id: 'mmpi-6',
        name: '규준 대비 편차',
        kind: 'chart',
        chart: 'bar',
        color: '#0ea5e9',
        hint: 'AI 파생 분석'
      }
    ]
  },
  {
    examId: 'mock-sscale',
    code: 'S-척도',
    nameKo: '스마트폰 과의존 척도 (성인)',
    date: '2026.06.28',
    status: 'confirmed',
    dotColor: '#f43f5e', // rose-500
    origin: 'mock',
    card: null,
    items: [
      {
        id: 'sscale-1',
        name: '총점 및 위험군 분류',
        kind: 'chart',
        chart: 'profile',
        color: '#f43f5e',
        hint: '41점 · 고위험군'
      },
      {
        id: 'sscale-2',
        name: '하위영역별 점수',
        kind: 'chart',
        chart: 'bar',
        color: '#f43f5e',
        hint: '조절실패·현저성·문제적결과'
      },
      {
        id: 'sscale-3',
        name: '규준집단 대비 백분위',
        kind: 'chart',
        chart: 'table',
        color: '#f43f5e',
        hint: '성인 규준'
      },
      // 결과지에 없는 파생 분석 (AI 생성 성격)
      {
        id: 'sscale-4',
        name: '사용 패턴 추정',
        kind: 'chart',
        chart: 'radar',
        color: '#f43f5e',
        hint: 'AI 파생 분석'
      }
    ]
  },
  {
    examId: 'mock-tci',
    code: 'TCI',
    nameKo: '기질 및 성격검사',
    date: '2026.07.02',
    status: 'confirmed',
    dotColor: '#14b8a6', // teal-500
    origin: 'mock',
    card: null,
    items: [
      {
        id: 'tci-1',
        name: '기질 4차원',
        kind: 'image',
        src: '/mock-reports/tci/temperament.png',
        hint: '자극추구·위험회피·민감성·인내력'
      },
      {
        id: 'tci-2',
        name: '성격 3차원',
        kind: 'image',
        src: '/mock-reports/tci/character.png',
        hint: '자율성·연대감·자기초월'
      },
      {
        id: 'tci-3',
        name: '척도별 프로파일',
        kind: 'image',
        src: '/mock-reports/tci/profile.png',
        hint: 'T점수 · 백분위'
      },
      {
        id: 'tci-4',
        name: '하위척도 상세',
        kind: 'image',
        src: '/mock-reports/tci/subscales.png',
        hint: '규준집단 대비'
      },
      // 결과지에 없는 파생 분석 (AI 생성 성격)
      {
        id: 'tci-5',
        name: '기질·성격 통합 요약',
        kind: 'chart',
        chart: 'radar',
        color: '#14b8a6',
        hint: 'AI 파생 분석'
      }
    ]
  }
]

// 검사자료 표시 순서 — 실제 결과지 이미지가 있는 검사를 최상단으로.
// 여기 없는 검사는 뒤에 원래 순서대로 붙는다.
const GROUP_ORDER = ['mock-tci', 'mock-mmpi']
export function groupRank(examId: string): number {
  const i = GROUP_ORDER.indexOf(examId)
  return i === -1 ? GROUP_ORDER.length : i
}
