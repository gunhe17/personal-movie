/**
 * mock 대상자 — 기관이 바뀌어도 이 데이터는 바뀌지 않는다.
 *
 * 핵심: 코어 필드(name·birth_date·phone…)는 컬럼, 기관 고유 정보는 attributes.
 * 화면은 `resolve(row, key)` 하나로 둘을 구분 없이 꺼낸다(§12-4).
 * 실제로는 센터마다 자기 기관의 attributes만 갖지만, 프로토타입에서는
 * 칩 전환을 보이려고 한 행에 네 기관 attributes를 모두 담았다.
 */

export interface MockClient {
  id: string
  /** 코어 — 전 기관 공통 */
  name: string
  code: string
  birth_date: string
  gender: 'MALE' | 'FEMALE'
  phone: string
  email: string
  address: string
  memo: string
  status: 'active' | 'inactive' | 'archived'
  /** 심리센터의 보호자/아동 축 */
  role: 'client' | 'guardian'
  /** 기관 고유 — 온톨로지 attributes가 가리키는 값 */
  attributes: Record<string, string | number>
  /** 바우처 (구조는 전 기관 공통, 이름만 다름 §4-3) */
  voucher: { name: string; remaining: number; total: number } | null
  /** 관계 */
  guardians: { name: string; kind: string }[]
  /** 진행현황 */
  progress: Record<string, number>
}

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: 'c1',
    name: '박지우',
    code: 'A1B2C3',
    birth_date: '2014-03-12',
    gender: 'FEMALE',
    phone: '010-1234-5678',
    email: 'jiwoo.park@example.com',
    address: '서울 성동구 왕십리로 123',
    memo: '학교 적응 문제로 의뢰됨. 모 상담 병행 희망.',
    status: 'active',
    role: 'client',
    attributes: {
      grade: 2,
      class_no: 3,
      number: 14,
      homeroom: '김선영',
      rank: '일병',
      unit: '1대대 2중대',
      discharge_date: '2027-03-14',
      doctor: '이현우',
      visit_type: '외래',
      diagnosis: 'F41.1'
    },
    voucher: { name: '아동청소년 심리지원', remaining: 6, total: 12 },
    guardians: [
      { name: '김미영', kind: '엄마' },
      { name: '박준호', kind: '아빠' }
    ],
    progress: { counseling: 3, assessment: 1, prescription: 2 }
  },
  {
    id: 'c2',
    name: '이서준',
    code: 'D4E5F6',
    birth_date: '2011-07-25',
    gender: 'MALE',
    phone: '010-2345-6789',
    email: 'seojun.lee@example.com',
    address: '서울 광진구 능동로 45',
    memo: '또래관계 어려움 호소.',
    status: 'active',
    role: 'client',
    attributes: {
      grade: 3,
      class_no: 1,
      number: 7,
      homeroom: '정민호',
      rank: '상병',
      unit: '1대대 1중대',
      discharge_date: '2026-11-02',
      doctor: '박서연',
      visit_type: '외래',
      diagnosis: 'F32.0'
    },
    voucher: { name: '아동청소년 심리지원', remaining: 2, total: 12 },
    guardians: [{ name: '이정훈', kind: '아빠' }],
    progress: { counseling: 8, assessment: 2, prescription: 0 }
  },
  {
    id: 'c3',
    name: '최유나',
    code: 'G7H8I9',
    birth_date: '2013-11-08',
    gender: 'FEMALE',
    phone: '010-3456-7890',
    email: 'yuna.choi@example.com',
    address: '서울 중랑구 면목로 210',
    memo: '',
    status: 'inactive',
    role: 'client',
    attributes: {
      grade: 2,
      class_no: 5,
      number: 22,
      homeroom: '김선영',
      rank: '이병',
      unit: '2대대 3중대',
      discharge_date: '2027-08-30',
      doctor: '이현우',
      visit_type: '입원',
      diagnosis: 'F43.2'
    },
    voucher: null,
    guardians: [{ name: '최성민', kind: '아빠' }],
    progress: { counseling: 1, assessment: 0, prescription: 1 }
  },
  {
    id: 'c4',
    name: '정하늘',
    code: 'J1K2L3',
    birth_date: '2012-02-19',
    gender: 'MALE',
    phone: '010-4567-8901',
    email: 'haneul.jung@example.com',
    address: '경기 성남시 분당구 판교로 88',
    memo: '검사 결과 상담 예정.',
    status: 'active',
    role: 'client',
    attributes: {
      grade: 1,
      class_no: 2,
      number: 3,
      homeroom: '정민호',
      rank: '병장',
      unit: '2대대 1중대',
      discharge_date: '2026-09-15',
      doctor: '박서연',
      visit_type: '외래',
      diagnosis: 'F90.0'
    },
    voucher: { name: '아동청소년 심리지원', remaining: 10, total: 10 },
    guardians: [{ name: '정우성', kind: '아빠' }],
    progress: { counseling: 5, assessment: 3, prescription: 4 }
  },
  {
    id: 'c5',
    name: '김미영',
    code: 'M4N5O6',
    birth_date: '1985-06-30',
    gender: 'FEMALE',
    phone: '010-5678-9012',
    email: 'miyoung.kim@example.com',
    address: '서울 성동구 왕십리로 123',
    memo: '자녀(박지우) 관련 보호자 상담.',
    status: 'active',
    role: 'guardian',
    attributes: {
      grade: 0,
      class_no: 0,
      number: 0,
      homeroom: '—',
      rank: '장교',
      unit: '본부대',
      discharge_date: '2028-01-20',
      doctor: '이현우',
      visit_type: '외래',
      diagnosis: 'Z71.9'
    },
    voucher: null,
    guardians: [],
    progress: { counseling: 2, assessment: 0, prescription: 0 }
  }
]
