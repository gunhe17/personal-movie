export interface ChangelogEntry {
  version: string
  date: string
  summary?: string
  changes: string[]
}

/**
 * 릴리스 노트 (최신순 정렬)
 *
 * 배포 시 `pnpm changelog` 스크립트로 자동 생성 가능.
 * 스크립트가 git 커밋을 수집하여 초안을 생성하면, 개발자가 리뷰 후 확정.
 */
export const changelog: ChangelogEntry[] = [
  {
    version: '1.8.0',
    date: '2026-03-20',
    summary: 'AI 상담 어시스턴트 도입',
    changes: [
      'AI 어시스턴트가 접수·예약 등 업무를 대화로 도와드립니다',
      '대화 내역 저장 및 이어서 대화 가능',
      '일정 수정·상세 화면 개선',
      '고객센터 페이지 개선',
      '일정 관련 오류 수정'
    ]
  },
  {
    version: '1.7.3',
    date: '2026-03-20',
    summary: '일정 보기 방식 확장 및 접수 편의 개선',
    changes: [
      '일정을 목록형·타임라인형으로도 확인 가능',
      '검사 접수 시 엑셀 파일로 내담자 한번에 등록',
      '검사 의뢰 기관/단체 등록 및 선택 기능 추가',
      '센터 주소 검색 기능 추가',
      '상담 회기 연장 알림 및 상담 일지 화면 개선',
      '직원 역할별 메뉴 표시 적용'
    ]
  },
  {
    version: '1.7.2',
    date: '2026-03-19',
    summary: '청구 관리 및 상담·검사 편의 기능 강화',
    changes: [
      '청구 관리 기능 추가 (생성, 수정, 그룹 청구)',
      '상담/검사 상세 화면에서 바로 정보 수정 가능',
      '회기 취소 사유 선택 및 취소 되돌리기 지원',
      '시스템 정보 및 업데이트 내역 페이지 추가',
      '최초 로그인 시 비밀번호 변경 안내'
    ]
  },
  {
    version: '1.7.0',
    date: '2026-03-18',
    summary: '상담 접수 개선 및 일정 관리 편의 강화',
    changes: [
      '상담 접수 및 일정 관리 화면 개선',
      '여러 날짜의 일정 충돌을 한 번에 확인 가능',
      '검사 상세 화면에서 일정 직접 추가/변경 가능',
      '시간 선택 시 5분 단위 및 직접 입력 지원'
    ]
  },
  {
    version: '1.6.0',
    date: '2026-03-16',
    summary: '홈 화면 새 단장 및 모바일 앱 지원',
    changes: [
      '홈 화면 전면 재설계',
      '내담자별 필드노트(메모) 기능 추가',
      '모바일 앱 푸시 알림 지원',
      '알림 목록 무한 스크롤 및 읽음 표시 개선',
      '검사 제출/완료 단계 세분화',
      '운영시간 요일별 설정 지원'
    ]
  },
  {
    version: '1.5.0',
    date: '2026-03-10',
    summary: '알림 시스템 도입 및 보안 강화',
    changes: [
      '실시간 알림 기능 추가 (앱 내 알림, 카카오 알림톡)',
      '웹 푸시 알림 지원',
      '알림 종류별 수신 설정 기능',
      '개인정보 보호 모드 비밀번호 확인 추가',
      '직원별 메뉴 접근 권한 세분화'
    ]
  },
  {
    version: '1.4.0',
    date: '2026-03-09',
    summary: '화면 디자인 전면 개선',
    changes: [
      '메뉴 디자인 리뉴얼 (접힘/펼침 전환, 호버 메뉴)',
      '검사/상담 접수, 현황, 상세 화면 디자인 개선',
      '회기 취소 및 일정 겹침 알림 기능',
      '고객센터 페이지 리뉴얼 및 1:1 문의 기능',
      '공지사항 기능 추가',
      '일정에 프로그램명 표시 추가'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-02-27',
    summary: '검사 결과 전송 및 태블릿 화면 지원',
    changes: [
      '검사 결과를 내담자에게 온라인 전송 가능',
      '태블릿에서도 편리하게 사용할 수 있도록 화면 최적화',
      '구성원 목록 카드형/목록형 보기 전환 지원'
    ]
  },
  {
    version: '1.2.0',
    date: '2026-02-25',
    summary: '내담자 관리 강화 및 안정화',
    changes: [
      '내담자 등록/수정/상세 화면 전면 개편',
      '보호자 관계 등록 및 수정 기능',
      '직원별 권한 설정 기능',
      '개인정보처리방침 및 이용약관 페이지 추가',
      '검사 보고서 디자인 개선'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-02-23',
    summary: '서비스 첫 출시',
    changes: [
      '내담자 관리 (등록, 목록, 상세, 보호자 연결)',
      '심리검사 접수 및 진행 관리',
      '상담 케이스 및 회기 관리',
      '일정 캘린더 (주간/일간 보기, 일정 겹침 확인)',
      '구성원 관리 및 초대',
      '센터 등록 및 승인'
    ]
  }
]

export interface OpenSourceLicense {
  name: string
  url: string
  license: string
}

export const openSourceLicenses: OpenSourceLicense[] = [
  { name: 'SvelteKit', url: 'https://kit.svelte.dev', license: 'MIT' },
  { name: 'Svelte', url: 'https://svelte.dev', license: 'MIT' },
  { name: 'TailwindCSS', url: 'https://tailwindcss.com', license: 'MIT' },
  { name: 'TanStack Query', url: 'https://tanstack.com/query', license: 'MIT' },
  { name: 'Axios', url: 'https://axios-http.com', license: 'MIT' },
  { name: 'Vite', url: 'https://vite.dev', license: 'MIT' },
  { name: 'Firebase', url: 'https://firebase.google.com', license: 'Apache-2.0' },
  { name: 'Playwright', url: 'https://playwright.dev', license: 'Apache-2.0' }
]
