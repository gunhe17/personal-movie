/**
 * LAB 시안 레지스트리
 *
 * 추가 절차:
 *   1) `app/(main)/lab/<slug>.tsx` 파일을 만든다 (Expo Router 자동 라우팅)
 *   2) 이 배열 맨 앞에 항목을 추가한다 — 최신 시안이 목록 위로 온다
 */

import type { LabExperiment } from './types';

export const LAB_EXPERIMENTS: LabExperiment[] = [
  {
    slug: 'home-restructure',
    title: '[홈] 구성 재정리 — 미연동 플로우 / 연동 섹션',
    description:
      '현재 홈은 치료별 카드·주변 센터·바우처 소식·육아 이야기까지 쌓여 "이 앱이 뭘 하는 곳인지"가 흐리다는 문제. [미연동] 섹션 나열을 버리고 한 플로우로 — ① 아이 정보(생년월일·성별·지역) → ② 자격 문항 3개(소득·진단서/검사결과·장애등록) → ③ 받을 수 있는 지원 → ④ 그 지원을 쓸 수 있는 센터. 입력 두 화면(진행바 1/2·2/2)까지 시안에 포함하고, 미리보기 안의 버튼으로 직접 걸어볼 수 있다. 자격 문항 답변은 실제 matchVouchers 로직에 물려 있어 신청 가능/확인 필요/대상 아님 판정이 진짜로 바뀐다(문항 설계 검증용). 바우처 소식·내 주변 센터·치료 카드·육아 이야기는 홈에서 제거, 초대 코드는 하단 탈출구. [연동] 아직 취사선택 단계 — 섹션 스위치 + [현행]·[정리안] 프리셋 대조. 제도·센터 목록은 mock — 확정 시 UnlinkedHome·LinkedHome에 반영.',
    status: 'ready',
  },
];

export const getLabRoute = (slug: string) => `/(main)/lab/${slug}`;
