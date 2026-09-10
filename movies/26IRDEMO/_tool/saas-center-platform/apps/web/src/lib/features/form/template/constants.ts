export const OWNER_LABELS: Record<string, string> = {
  system: '시스템',
  center: '센터'
}

export const OWNER_BADGE_STYLES: Record<string, { text: string; bg: string }> = {
  system: { text: 'text-blue-700', bg: 'bg-blue-50' },
  center: { text: 'text-green-700', bg: 'bg-green-50' }
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  textarea: '장문',
  radio: '단일선택',
  checkbox: '체크박스',
  checkbox_group: '다중선택',
  select: '드롭다운',
  number: '숫자',
  date: '날짜',
  time: '시간',
  datetime: '날짜/시간',
  email: '이메일',
  phone: '전화번호',
  file: '파일',
  image: '이미지',
  signature: '서명',
  divider: '구분선',
  heading: '제목'
}

export const FIELD_TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  text: { text: 'text-gray-600', bg: 'bg-gray-100' },
  textarea: { text: 'text-gray-600', bg: 'bg-gray-100' },
  radio: { text: 'text-violet-700', bg: 'bg-violet-50' },
  checkbox: { text: 'text-violet-700', bg: 'bg-violet-50' },
  checkbox_group: { text: 'text-violet-700', bg: 'bg-violet-50' },
  select: { text: 'text-violet-700', bg: 'bg-violet-50' },
  number: { text: 'text-sky-700', bg: 'bg-sky-50' },
  date: { text: 'text-amber-700', bg: 'bg-amber-50' },
  time: { text: 'text-amber-700', bg: 'bg-amber-50' },
  datetime: { text: 'text-amber-700', bg: 'bg-amber-50' },
  email: { text: 'text-sky-700', bg: 'bg-sky-50' },
  phone: { text: 'text-sky-700', bg: 'bg-sky-50' },
  file: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
  image: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
  signature: { text: 'text-rose-700', bg: 'bg-rose-50' },
  divider: { text: 'text-gray-400', bg: 'bg-gray-50' },
  heading: { text: 'text-gray-400', bg: 'bg-gray-50' }
}

/** 필드 타입 선택용 옵션 (편집기 드롭다운) — 레이아웃 타입은 별도 그룹 */
export const FIELD_TYPE_OPTIONS = [
  { group: '입력', items: [
    // 한 줄 문자열 — 현재 동일 형태(렌더·저장 동일), 인접 배치
    { value: 'text', label: '텍스트' },
    { value: 'email', label: '이메일' },
    { value: 'phone', label: '전화번호' },
    { value: 'number', label: '숫자' },
    // 여러 줄 문자열
    { value: 'textarea', label: '장문' },
  ]},
  { group: '선택', items: [
    // 단일값(하나 선택)
    { value: 'radio', label: '단일선택' },
    { value: 'select', label: '드롭다운' },
    // 배열(여러 선택)
    { value: 'checkbox_group', label: '다중선택' },
  ]},
  { group: '날짜/시간', items: [
    { value: 'date', label: '날짜' },
    { value: 'time', label: '시간' },
    { value: 'datetime', label: '날짜/시간' },
  ]},
  { group: '기타', items: [
    { value: 'file', label: '파일' },
    { value: 'image', label: '이미지' },
    { value: 'signature', label: '서명' },
  ]},
  { group: '레이아웃', items: [
    { value: 'divider', label: '구분선' },
    { value: 'heading', label: '제목' },
  ]},
] as const

/** 필드 타입 선택용 플랫 옵션 (공용 Select 컴포넌트용 {title, value}) */
export const FIELD_TYPE_SELECT_OPTIONS: { title: string; value: string }[] =
  FIELD_TYPE_OPTIONS.flatMap((group) =>
    group.items.map((item) => ({ title: item.label, value: item.value }))
  )

/** 선택지(options)를 지원하는 필드 타입 */
export const OPTION_FIELD_TYPES = new Set(['radio', 'checkbox_group', 'select'])

export const STATUS_LABELS: Record<string, string> = {
  active: '활성',
  inactive: '비활성'
}

/** 발급된 양식(인스턴스) 상태 */
export const INSTANCE_STATUS_LABELS: Record<string, string> = {
  draft: '작성 중',
  submitted: '제출됨'
}

export const INSTANCE_STATUS_BADGE_STYLES: Record<string, { text: string; bg: string }> = {
  draft: { text: 'text-amber-700', bg: 'bg-amber-50' },
  submitted: { text: 'text-green-700', bg: 'bg-green-50' }
}

/** 템플릿 상세의 발급된 양식 목록 페이지 크기 */
export const INSTANCE_PAGE_SIZE = 10

export const STATUS_BADGE_STYLES: Record<string, { text: string; bg: string }> = {
  active: { text: 'text-green-700', bg: 'bg-green-50' },
  inactive: { text: 'text-gray-500', bg: 'bg-gray-100' }
}
