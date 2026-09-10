/**
 * 감사 로그 ViewModel — API 응답 → UI 표현 변환
 */

import type { ActivityLogItem } from '$lib/hooks/actions/activity-log.action'
import { formatUtcToKst } from '$lib/utils/date'
import {
  CATEGORY_LABELS,
  ACTION_LABELS,
  ACTION_COLORS,
  DEFAULT_ACTION_COLOR
} from './constants'

export interface ExtraSummaryItem {
  label: string
  value: string
}

export interface ActivityLogVM {
  id: string
  actorId: string
  actorName: string
  categoryLabel: string
  actionLabel: string
  actionColor: { bg: string; text: string }
  entityType: string
  entityId: string
  summary: string
  date: string
  time: string
  extraSummary: ExtraSummaryItem[]
  hasExtra: boolean
  changes: ActivityChangeVM[]
}

export interface ActivityChangeVM {
  id: string
  actionLabel: string
  summary: string
  extraSummary: ExtraSummaryItem[]
}

/** extra 내부에서 무시할 기술적 필드 */
const SKIP_FIELDS = new Set([
  'id',
  'center_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'person_id',
  'account_id',
  'role_id',
  'is_active',
  'role'
])

/** 영어 enum 값 → 한글 변환 */
const VALUE_KO: Record<string, string> = {
  male: '남성',
  female: '여성',
  active: '활성',
  inactive: '비활성',
  pending: '대기',
  completed: '완료',
  cancelled: '취소',
  confirmed: '확정',
  scheduled: '예정',
  in_progress: '진행 중',
  draft: '임시저장',
  published: '발행',
  approved: '승인',
  rejected: '반려',
  full_time: '정규직',
  part_time: '시간제',
  contract: '계약직',
  individual: '개인',
  group: '단체',
  client: '내담자',
  guardian: '보호자',
  both: '내담자/보호자',
  counselor: '상담사',
  manager: '관리자'
}

/** 필드명 → 한글 라벨 매핑 (주요 필드만) */
const FIELD_LABELS: Record<string, string> = {
  name: '이름',
  title: '제목',
  phone: '연락처',
  email: '이메일',
  memo: '메모',
  status: '상태',
  start: '시작',
  end: '종료',
  schedule_type: '일정 유형',
  employment_type: '고용 형태',
  gender: '성별',
  birth_date: '생년월일',
  address: '주소',
  relation_type: '관계 유형',
  relation_detail: '관계 상세',
  is_primary: '주양육자',
  role_name: '역할',
  role_code: '역할 코드',
  opinion: '소견',
  description: '설명',
  content: '내용',
  summary: '요약',
  purpose: '목적',
  category: '카테고리',
  room_name: '상담실',
  color: '색상',
  price: '금액',
  amount: '금액',
  unit_price: '단가',
  quantity: '수량',
  day_of_week: '요일',
  start_time: '시작 시간',
  end_time: '종료 시간',
  template_name: '양식명'
}

/**
 * extra 데이터에서 요약 항목 추출
 * - updated: input(변경 요청) 필드만 표시
 * - created/deleted: data에서 핵심 필드만 표시
 */
function buildExtraSummary(
  extra: Record<string, unknown> | null,
  action: string
): ExtraSummaryItem[] {
  if (!extra) return []

  // updated: input 필드가 곧 "무엇이 변경되었는가"
  if (action === 'updated' && extra.input && typeof extra.input === 'object') {
    return extractFields(extra.input as Record<string, unknown>)
  }

  // created/deleted: data에서 핵심 필드
  if (extra.data && typeof extra.data === 'object') {
    return extractFields(extra.data as Record<string, unknown>)
  }

  // 기타: extra 자체를 시도
  return extractFields(extra)
}

function extractFields(obj: Record<string, unknown>): ExtraSummaryItem[] {
  const items: ExtraSummaryItem[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_FIELDS.has(key)) continue
    if (value === null || value === undefined || value === '') continue
    // 중첩 객체(result 등)는 생략
    if (typeof value === 'object' && !Array.isArray(value)) continue

    const label = FIELD_LABELS[key] ?? key
    items.push({ label, value: formatValue(value) })
  }

  return items.slice(0, 6) // 최대 6개
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  if (typeof value === 'number') return value.toLocaleString()
  if (Array.isArray(value)) return value.map(String).join(', ')
  const str = String(value)
  // enum 값 한글 변환
  if (VALUE_KO[str]) return VALUE_KO[str]
  // ISO datetime → KST 변환 후 읽기 쉬운 형태
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return formatUtcToKst(str, 'YYYY.MM.DD HH:mm')
  }
  // 너무 긴 값 truncate-safe
  return str.length > 60 ? str.slice(0, 57) + '...' : str
}

/** 영어 entity_type → 한글 매핑 (백엔드 미적용 기존 데이터 폴백) */
const ENTITY_TYPE_KO: Record<string, string> = {
  client: '내담자',
  guardian_relation: '보호자 관계',
  sibling_relation: '형제자매 관계',
  relation: '관계',
  client_link_request: '내담자 연동 요청',
  schedule: '일정',
  assessment_set: '검사 세트',
  assessment_session: '검사 세션',
  assessment_task: '검사 과제',
  center_assessment: '센터 검사',
  counseling_session: '상담 세션',
  counseling_note: '상담일지',
  case_analysis: '사례 분석',
  session_participant: '세션 참여자',
  member: '구성원',
  member_invitation: '구성원 초대',
  center: '센터',
  room: '상담실',
  non_operating_time: '비운영 시간',
  member_non_working_time: '비근무 시간',
  program: '프로그램',
  price_list: '단가',
  billable: '청구 항목',
  payment: '결제',
  payment_record: '결제 기록',
  role: '권한',
  document: '문서',
  share_token: '공유 토큰',
  field_note: '현장노트',
  agent_conversation: 'AI 대화',
  message_template: '문자 양식',
  form_template: '양식 템플릿',
  form_template_version: '양식 버전',
  form_instance: '양식',
  signature: '서명'
}

/**
 * 영어 summary를 한글로 변환 (기존 데이터 호환)
 * "client created" → "내담자 생성"
 */
function localizeSummary(
  summary: string,
  entityType: string,
  action: string
): string {
  const entityKo = ENTITY_TYPE_KO[entityType]
  const actionKo = ACTION_LABELS[action]

  // 이미 한글이면 그대로
  if (/[가-힣]/.test(summary)) return summary

  // "{entity_type} {action}" 패턴이면 한글로 변환
  if (entityKo && actionKo) return `${entityKo} ${actionKo}`

  return summary
}

export function mapToActivityLogVM(item: ActivityLogItem): ActivityLogVM {
  const extraSummary = buildExtraSummary(item.extra, item.action)

  return {
    id: item.id,
    actorId: item.actor_id,
    actorName: item.actor_name ?? item.actor_id.slice(0, 8),
    categoryLabel: CATEGORY_LABELS[item.category] ?? item.category,
    actionLabel: ACTION_LABELS[item.action] ?? item.action,
    actionColor: ACTION_COLORS[item.action] ?? DEFAULT_ACTION_COLOR,
    entityType: item.entity_type,
    entityId: item.entity_id,
    summary: localizeSummary(item.summary, item.entity_type, item.action),
    date: formatUtcToKst(item.created_at, 'YYYY.MM.DD'),
    time: formatUtcToKst(item.created_at, 'HH:mm'),
    extraSummary,
    hasExtra: extraSummary.length > 0,
    changes: item.changes.map((change) => ({
      id: change.id,
      actionLabel: ACTION_LABELS[change.action] ?? change.action,
      summary: localizeSummary(
        change.summary,
        change.entity_type,
        change.action
      ),
      extraSummary: buildExtraSummary(change.extra, change.action)
    }))
  }
}

export function mapToActivityLogVMs(items: ActivityLogItem[]): ActivityLogVM[] {
  return items.map(mapToActivityLogVM)
}
