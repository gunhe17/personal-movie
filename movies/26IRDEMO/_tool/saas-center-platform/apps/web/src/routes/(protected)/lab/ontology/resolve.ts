/**
 * 값 해소기 — §12-4
 *
 * 화면이 "이 필드가 컬럼인지 JSONB인지" 몰라도 되게 만드는 한 줄.
 * 덕분에 나중에 성능 때문에 attributes 키를 컬럼으로 승격해도(§7 Q5)
 * 화면 코드는 그대로다.
 */

import type { MockClient } from './mock-clients'
import type { OntologyDef } from './definitions'

/** 표시용으로 합성되는 파생 키 — 온톨로지가 list_columns/info_block에서 참조 */
const DERIVED: Record<string, (row: MockClient) => string> = {
  // 학교: "2학년 3반 14번"
  grade_class: (row) => {
    const { grade, class_no, number } = row.attributes
    if (!grade) return '-'
    return `${grade}학년 ${class_no}반${number ? ` ${number}번` : ''}`
  }
}

/** 코어 필드 → 표시 문자열 */
function core(row: MockClient, key: string): string | null {
  switch (key) {
    case 'name':
      return row.name
    case 'code':
      return row.code
    case 'birth_date':
      return row.birth_date
    case 'gender':
      return row.gender === 'MALE' ? '남' : '여'
    case 'phone':
      return row.phone
    case 'email':
      return row.email
    case 'address':
      return row.address
    case 'memo':
      return row.memo
    case 'role':
      return row.role === 'guardian' ? '보호자' : '아동'
    default:
      return null
  }
}

/**
 * 코어 · 파생 · 확장(attributes)을 구분 없이 꺼낸다.
 * 화면은 이 함수만 부르면 된다.
 */
export function resolve(row: MockClient, key: string): string {
  const derived = DERIVED[key]
  if (derived) return derived(row) || '-'

  const c = core(row, key)
  if (c !== null) return c || '-'

  const v = row.attributes?.[key]
  if (v === undefined || v === '' || v === 0) return '-'
  return String(v)
}

/** 온톨로지 attributes 정의를 참고해 라벨을 붙인 값 (예: "2학년") */
export function resolveWithSuffix(
  row: MockClient,
  key: string,
  ont: OntologyDef
): string {
  const value = resolve(row, key)
  if (value === '-') return value
  const attr = ont.entities.client.attributes.find((a) => a.key === key)
  return attr?.suffix ? `${value}${attr.suffix}` : value
}

/** 컬럼/필드 키의 표시 라벨 — 온톨로지 우선, 없으면 코어 사전 */
const CORE_LABELS: Record<string, string> = {
  name: '이름',
  code: '코드',
  birth_date: '생년월일',
  gender: '성별',
  phone: '연락처',
  email: '이메일',
  address: '주소',
  memo: '메모',
  role: '역할',
  status: '상태',
  voucher: '바우처',
  grade_class: '학년/반'
}

export function fieldLabel(key: string, ont: OntologyDef): string {
  const attr = ont.entities.client.attributes.find((a) => a.key === key)
  if (attr) return attr.label
  if (key === 'code') return ont.labels.client_code
  if (key === 'voucher') return ont.labels.voucher
  return CORE_LABELS[key] ?? key
}

/** 1차 축으로 행을 묶는다. 축이 없으면 단일 그룹 */
export function groupByAxis(
  rows: MockClient[],
  ont: OntologyDef
): { key: string; label: string; rows: MockClient[] }[] {
  const axis = ont.entities.client.primary_axis
  if (!axis) return [{ key: 'all', label: '전체', rows }]

  const buckets = new Map<string, MockClient[]>()
  const unassigned: MockClient[] = []

  for (const row of rows) {
    const raw = resolve(row, axis.key)
    // 축 값이 없는 행(예: 학년 없는 보호자)은 별도 버킷으로 모은다.
    // 빈 라벨의 그룹이 생기면 목록이 깨져 보인다.
    if (raw === '-') {
      unassigned.push(row)
      continue
    }
    const label = axis.key === 'grade' ? `${raw}학년` : raw
    const list = buckets.get(label)
    if (list) list.push(row)
    else buckets.set(label, [row])
  }

  const groups = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'ko', { numeric: true }))
    .map(([label, list]) => ({ key: label, label, rows: list }))

  if (unassigned.length > 0) {
    groups.push({ key: '__unassigned', label: '미지정', rows: unassigned })
  }

  return groups
}
