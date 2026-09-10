/**
 * Tool 결과 컬럼 설정 — 모듈별 필드 조합 → 렌더링 매핑.
 *
 * 기존 조회 페이지의 렌더링 패턴을 분석하여,
 * 동일한 필드 조합과 스타일로 tool 결과를 표시한다.
 *
 * 단일 필드 셀:
 *   text, date, badge, gender, phone, number
 *
 * 복합 필드 셀 (fields 맵으로 여러 필드 참조):
 *   person_info   — 이름(bold) + 생년월일 + 성별   (검사현황 내담자 열)
 *   name_count    — 이름 + "외 N명"               (상담현황 내담자 열)
 *   list_summary  — 첫 항목 + "외 N건"             (검사현황 검사 열)
 *   fraction      — 분자/분모                      (진행률 열)
 *
 * 출처 페이지:
 *   client    → /clients (ClientListTable.svelte)
 *   member    → /member (+page.svelte allMembersColumns)
 *   counseling → /counseling/status (CounselingStatusTable.svelte)
 *   assessment → /assessment/status (AssessmentCaseTable.svelte)
 *   schedule  → /schedule (ScheduleListView.svelte)
 *   room      → /center/room (RoomCard.svelte)
 *   program   → /center/program (ProgramCard.svelte)
 */

// ────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────

export type SimpleCellType = 'text' | 'date' | 'datetime' | 'badge' | 'gender' | 'phone' | 'number'
export type CompositeCellType =
  | 'client_name'    // 이름 (code) 역할텍스트  — ClientListTable nameCell
  | 'birth_info'     // YYYY-MM-DD | 만 N세 | 남/여 — ClientListTable birthCell
  | 'status_chip'    // dot + 라벨 (PersonChipSelect disabled) — ClientListTable statusCell
  | 'person_info'    // 이름(semibold) + 생년월일 + |구분선 + 성별 — AssessmentCaseTable
  | 'name_count'     // 이름 + "외 N명" — CounselingStatusTable
  | 'list_summary'   // 첫 항목 + "외 N건" — AssessmentCaseTable
  | 'fraction'       // 분자/분모 또는 "완료" — 진행률
  | 'program_badge'  // 프로그램명 + 개별/그룹 인라인 배지 — CounselingStatusTable
export type CellType = SimpleCellType | CompositeCellType

export interface ColumnDef {
  key: string
  label: string
  type: CellType
  /**
   * 복합 셀의 필드 매핑.
   *
   * person_info   → { name, birth_date?, gender? }
   * name_count    → { name, count }
   * list_summary  → { items }
   * fraction      → { current, total, status? }  (status=completed → "완료" 표시)
   * program_badge → { name, type }  (프로그램명 + 개별/그룹 배지)
   */
  fields?: Record<string, string>
}

// ────────────────────────────────────────────
// Badge 스타일 (기존 페이지 실제 hex)
// ────────────────────────────────────────────

export interface BadgeStyle {
  label: string
  bg: string
  text: string
}

export const BADGE_STYLES: Record<string, BadgeStyle> = {
  // ── Client/Person 상태 ──
  // 출처: features/clients/constants.ts (PERSON_STATUS_STYLES, CLIENT_STATUS_MAP)
  active:   { label: '활성',   bg: 'bg-[#22B55F1A]', text: 'text-[#22B55F]' },
  inactive: { label: '비활성', bg: 'bg-gray-100',     text: 'text-gray-500' },
  ACTIVE:   { label: '활성',   bg: 'bg-[#49AAEF1A]', text: 'text-[#49AAEF]' },
  INACTIVE: { label: '휴면',   bg: 'bg-[#7171711A]', text: 'text-[#717171]' },

  // ── Assessment 상태 ──
  // 출처: types/assessmentStatus.ts (STATUS_BADGE_MAP), app.css hex tokens
  pending:     { label: '진행전', bg: 'bg-[#7171711A]', text: 'text-[#717171]' },
  in_progress: { label: '진행중', bg: 'bg-[#49AAEF1A]', text: 'text-[#49AAEF]' },
  completed:   { label: '완료',   bg: 'bg-[#84B5221A]', text: 'text-[#84B522]' },
  cancelled:   { label: '취소',   bg: 'bg-[#D23E461A]', text: 'text-[#D23E46]' },

  // ── Client 역할 ──
  // 출처: components/table/ClientListTable.svelte (보호자 #3B82F6, 아동 #F47500)
  client:   { label: '내담자',        bg: 'bg-[#49AAEF1A]', text: 'text-[#49AAEF]' },
  guardian: { label: '보호자',        bg: 'bg-[#3B82F61A]', text: 'text-[#3B82F6]' },
  both:     { label: '내담자+보호자', bg: 'bg-violet-50',   text: 'text-violet-600' },

  // ── Member 역할 ──
  // 출처: components/cards/MemberCard.svelte
  ADMIN:     { label: '관리자', bg: 'bg-[#FFE58733]', text: 'text-[#FFB200]' },
  MANAGER:   { label: '매니저', bg: 'bg-[#1BBF570F]', text: 'text-[#1BBF57]' },
  COUNSELOR: { label: '상담사', bg: 'bg-gray-100',    text: 'text-gray-700' },
  STAFF:     { label: '직원',   bg: 'bg-gray-100',    text: 'text-gray-700' },

  // ── Counseling 유형 ──
  // 출처: components/counseling/status/CounselingStatusTable.svelte
  individual: { label: '개별', bg: 'bg-blue-50',   text: 'text-blue-600' },
  group:      { label: '그룹', bg: 'bg-violet-50', text: 'text-violet-600' },

  // ── Program 유형 ──
  // 출처: components/ProgramCard.svelte
  INDIVIDUAL: { label: '개별', bg: 'bg-[#7171711A]', text: 'text-[#717171]' },
  GROUP:      { label: '그룹', bg: 'bg-[#7171711A]', text: 'text-[#717171]' },

  // ── Schedule 세션 상태 ──
  // 출처: features/schedule/calendar/view-model.ts (getSessionStatusColor)
  scheduled: { label: '예정', bg: 'bg-blue-50',   text: 'text-blue-600' },
  no_show:   { label: '노쇼', bg: 'bg-orange-50', text: 'text-orange-600' },
  // completed, cancelled은 위 Assessment 상태와 동일 키 사용

  // ── Room 상태 ──
  // 출처: components/RoomCard.svelte
  true:  { label: '사용가능', bg: 'bg-[#22B55F1A]', text: 'text-[#22B55F]' },
  false: { label: '사용불가', bg: 'bg-gray-100',     text: 'text-gray-500' },
}

// ────────────────────────────────────────────
// 포맷터
// ────────────────────────────────────────────

/** YYYY-MM-DD → YYYY.MM.DD */
export function formatDate(value: unknown): string {
  if (value == null || value === '') return '-'
  const s = String(value).slice(0, 10)
  if (s.length === 10 && s[4] === '-') return s.replace(/-/g, '.')
  return String(value)
}

/** ISO datetime → { date: "YYYY.MM.DD", time: "HH:MM" } — KST(+9) 기준 변환 */
export function formatDateTime(value: unknown): { date: string; time: string } {
  if (value == null || value === '') return { date: '-', time: '' }
  const raw = String(value)
  // timezone offset 없으면 UTC로 간주 (백엔드는 timezone-naive UTC 저장)
  const isoStr = /[Z+-]\d{2}:?\d{2}$|Z$/.test(raw) ? raw : raw + 'Z'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) {
    // fallback: 원본 문자열 슬라이스
    const datePart = raw.slice(0, 10)
    const timePart = raw.slice(11, 16)
    return {
      date: datePart.length === 10 && datePart[4] === '-' ? datePart.replace(/-/g, '.') : datePart,
      time: timePart || '',
    }
  }
  // KST(+9) 변환
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000
  const kst = new Date(kstMs)
  const yyyy = kst.getUTCFullYear()
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  return {
    date: `${yyyy}.${mm}.${dd}`,
    time: `${hh}:${mi}`,
  }
}

/** male→남, female→여 */
export function formatGender(value: unknown): string {
  const v = String(value).toLowerCase()
  if (v === 'male' || v === 'm') return '남'
  if (v === 'female' || v === 'f') return '여'
  return String(value)
}

/** 010-1234-5678 포맷 */
export function formatPhone(value: unknown): string {
  if (value == null || value === '') return '-'
  const s = String(value).replace(/[^0-9]/g, '')
  if (s.length === 11) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`
  if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`
  return String(value)
}

export function getBadgeStyle(value: unknown): BadgeStyle {
  const key = String(value ?? '')
  return BADGE_STYLES[key] ?? { label: key || '-', bg: 'bg-gray-100', text: 'text-gray-500' }
}

export function formatSimpleCell(type: SimpleCellType, value: unknown): string {
  if (value == null || value === '') return '-'
  switch (type) {
    case 'date':     return formatDate(value)
    case 'datetime': return formatDate(value) // fallback (2줄 렌더링은 컴포넌트에서 처리)
    case 'gender':   return formatGender(value)
    case 'phone':    return formatPhone(value)
    case 'number':   return String(value)
    default:         return String(value)
  }
}

// ────────────────────────────────────────────
// 복합 셀 데이터 추출
// ────────────────────────────────────────────

/** client_name: 이름 + (코드) + 역할텍스트 */
export interface ClientNameData {
  name: string
  code: string
  role: string         // raw role value
  isGuardian: boolean  // guardian/both → true
}

/** birth_info: 생년월일 + 나이 + 성별 */
export interface BirthInfoData {
  birth: string        // raw date string
  gender: string       // raw gender value
}

/** person_info: 이름(bold) + 생년월일 + 성별 */
export interface PersonInfoData {
  name: string
  birthDate: string | null
  gender: string | null
}

/** name_count: 이름 + "외 N명" */
export interface NameCountData {
  name: string
  extra: number
}

/** list_summary: 첫 항목 + "외 N건" */
export interface ListSummaryData {
  first: string
  remaining: number
}

/** fraction: 분자/분모 또는 "완료" */
export interface FractionData {
  current: number
  total: number
  isCompleted: boolean
}

/** program_badge: 프로그램명 + 유형 배지 */
export interface ProgramBadgeData {
  name: string
  type: string  // 'individual' | 'group'
}

export function extractClientName(row: Record<string, unknown>, fields: Record<string, string>): ClientNameData {
  const name = String(getNestedValue(row, fields.name ?? 'name') ?? '-')
  const code = String(getNestedValue(row, fields.code ?? 'code') ?? '')
  const role = String(getNestedValue(row, fields.role ?? 'role') ?? '')
  const isGuardian = ['guardian', 'both'].includes(role.toLowerCase())
  return { name, code, role, isGuardian }
}

export function extractBirthInfo(row: Record<string, unknown>, fields: Record<string, string>): BirthInfoData {
  return {
    birth: String(getNestedValue(row, fields.birth ?? 'birth_date') ?? ''),
    gender: String(getNestedValue(row, fields.gender ?? 'gender') ?? ''),
  }
}

export function extractPersonInfo(row: Record<string, unknown>, fields: Record<string, string>): PersonInfoData {
  return {
    name: String(getNestedValue(row, fields.name ?? 'name') ?? '-'),
    birthDate: fields.birth_date ? formatDate(getNestedValue(row, fields.birth_date)) : null,
    gender: fields.gender ? formatGender(getNestedValue(row, fields.gender)) : null,
  }
}

export function extractNameCount(row: Record<string, unknown>, fields: Record<string, string>): NameCountData {
  const name = String(getNestedValue(row, fields.name ?? 'name') ?? '-')
  const count = Number(getNestedValue(row, fields.count ?? 'count') ?? 1)
  return { name, extra: Math.max(0, count - 1) }
}

export function extractListSummary(row: Record<string, unknown>, fields: Record<string, string>): ListSummaryData {
  const raw = getNestedValue(row, fields.items ?? 'items')
  if (Array.isArray(raw)) {
    return { first: String(raw[0] ?? '-'), remaining: Math.max(0, raw.length - 1) }
  }
  return { first: String(raw ?? '-'), remaining: 0 }
}

export function extractFraction(row: Record<string, unknown>, fields: Record<string, string>): FractionData {
  const status = fields.status ? String(getNestedValue(row, fields.status) ?? '') : ''
  return {
    current: Number(getNestedValue(row, fields.current ?? 'current') ?? 0),
    total: Number(getNestedValue(row, fields.total ?? 'total') ?? 0),
    isCompleted: status === 'completed',
  }
}

export function extractProgramBadge(row: Record<string, unknown>, fields: Record<string, string>): ProgramBadgeData {
  return {
    name: String(getNestedValue(row, fields.name ?? 'program_name') ?? '-'),
    type: String(getNestedValue(row, fields.type ?? 'case_type') ?? 'individual'),
  }
}

// ────────────────────────────────────────────
// nested value 접근
// ────────────────────────────────────────────

export function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  // flat 키 우선 (module.field 형식: "client.name" → obj["client.name"])
  if (key in obj) return obj[key]
  // nested 접근 fallback (기존 호환: "person.name" → obj.person.name)
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// ────────────────────────────────────────────
// Tool별 컬럼 정의
//
// 각 tool의 columns는 해당 모듈 조회 페이지의
// 렌더링 패턴을 읽기 전용 형태로 매핑한 것이다.
// (인터랙션 열: 드롭다운, 버튼, 케밥메뉴는 제외)
// ────────────────────────────────────────────

export const TOOL_COLUMNS: Record<string, ColumnDef[]> = {

  // ── Client ──
  // 출처: ClientListTable.svelte
  //   내담자 = name + (code) + 역할텍스트(보호자/아동) → client_name
  //   생년월일 = YYYY-MM-DD | 만 N세 | 남/여 → birth_info
  //   상태 = PersonChipSelect (disabled) → status_chip
  'client.search': [
    { key: 'name', label: '내담자', type: 'client_name',
      fields: { name: 'name', code: 'code', role: 'role' } },
    { key: 'birth_date', label: '생년월일', type: 'birth_info',
      fields: { birth: 'birth_date', gender: 'gender' } },
    { key: 'phone',  label: '연락처', type: 'phone' },
    { key: 'status', label: '상태',   type: 'status_chip' },
  ],
  // Agent 전용 동적 조회 — module.field 키, 데이터에 없는 컬럼은 자동 스킵
  'client.query': [
    { key: 'client.name', label: '내담자', type: 'client_name',
      fields: { name: 'client.name', code: 'client.code', role: 'client.role' } },
    { key: 'client.birth_date', label: '생년월일', type: 'birth_info',
      fields: { birth: 'client.birth_date', gender: 'client.gender' } },
    { key: 'client.phone',   label: '연락처',  type: 'phone' },
    { key: 'client.email',   label: '이메일',  type: 'text' },
    { key: 'client.address', label: '주소',    type: 'text' },
    { key: 'client.status',  label: '상태',    type: 'status_chip' },
    { key: 'client.memo',    label: '메모',    type: 'text' },
    { key: 'client.created_at', label: '등록일', type: 'date' },
    { key: 'client.updated_at', label: '수정일', type: 'date' },
  ],
  'client.get': [
    { key: 'name', label: '내담자', type: 'client_name',
      fields: { name: 'name', code: 'code', role: 'role' } },
    { key: 'birth_date', label: '생년월일', type: 'birth_info',
      fields: { birth: 'birth_date', gender: 'gender' } },
    { key: 'phone',   label: '연락처', type: 'phone' },
    { key: 'email',   label: '이메일', type: 'text' },
    { key: 'address', label: '주소',   type: 'text' },
    { key: 'status',  label: '상태',   type: 'status_chip' },
  ],

  // ── Member ──
  // 출처: /member +page.svelte allMembersColumns
  //   이름 = avatar initial + name → text (avatar는 agent에서 생략)
  //   역할 = pill badge (ADMIN gold+CrownIcon, MANAGER green, etc.)
  //         → badge (CrownIcon은 agent에서 생략, 색상은 동일)
  //   상태 = PersonChipSelect → status_chip (disabled)
  'member.list': [
    { key: 'person.name',  label: '이름',   type: 'text' },
    { key: 'role_code',    label: '역할',   type: 'badge' },
    { key: 'person.phone', label: '연락처', type: 'phone' },
    { key: 'person.email', label: '이메일', type: 'text' },
    { key: 'is_active',    label: '상태',   type: 'status_chip' },
  ],
  // Agent 전용 동적 조회 — module.field 키, 데이터에 없는 컬럼은 자동 스킵
  'member.query': [
    { key: 'member.name',            label: '이름',     type: 'text' },
    { key: 'member.role_code',       label: '역할',     type: 'badge' },
    { key: 'member.role_name',       label: '역할명',   type: 'text' },
    { key: 'member.phone',           label: '연락처',   type: 'phone' },
    { key: 'member.email',           label: '이메일',   type: 'text' },
    { key: 'member.status',          label: '상태',     type: 'status_chip' },
    { key: 'member.employment_type', label: '고용형태', type: 'text' },
    { key: 'member.memo',            label: '메모',     type: 'text' },
    { key: 'member.is_active',       label: '활성여부', type: 'status_chip' },
  ],
  // 출처: MemberProfileCard.svelte (상세 카드)
  //   이름 = text-xl font-bold + role_name → person_info 패턴 대신 text + badge
  //   기본 정보 = 생년월일, 성별, 이메일, 연락처, 계약형태, 가입일, 메모
  //   label width: w-16, color: text-gray-400
  'member.get': [
    { key: 'person.name',  label: '이름',     type: 'text' },
    { key: 'role_code',    label: '역할',     type: 'badge' },
    { key: 'is_active',    label: '상태',     type: 'status_chip' },
    { key: 'person.birth', label: '생년월일', type: 'date' },
    { key: 'person.phone', label: '연락처',   type: 'phone' },
    { key: 'person.email', label: '이메일',   type: 'text' },
    { key: 'employment_type', label: '계약형태', type: 'text' },
    { key: 'memo',         label: '메모',     type: 'text' },
  ],

  // ── Room ──
  // 출처: RoomCard.svelte
  //   is_active = "사용가능"(primary) / "사용불가"(red) + Switch toggle
  //   → status_chip (disabled, boolean→active/inactive 자동 변환)
  'room.list': [
    { key: 'name',        label: '상담실', type: 'text' },
    { key: 'is_active',   label: '상태',   type: 'status_chip' },
    { key: 'description', label: '설명',   type: 'text' },
  ],
  // Agent 전용 동적 조회 — module.field 키, 데이터에 없는 컬럼은 자동 스킵
  'room.query': [
    { key: 'room.name',            label: '상담실',     type: 'text' },
    { key: 'room.is_active',       label: '상태',       type: 'status_chip' },
    { key: 'room.description',     label: '설명',       type: 'text' },
    { key: 'room.memo',            label: '메모',       type: 'text' },
    { key: 'room.inactive_reason', label: '비활성 사유', type: 'text' },
    { key: 'room.created_at',      label: '등록일',     type: 'date' },
    { key: 'room.updated_at',      label: '수정일',     type: 'date' },
  ],

  // ── Program ──
  // 출처: ProgramCard.svelte
  //   program_type = INDIVIDUAL/GROUP → badge (bg-[#7171711A] text-[#717171])
  //   price = N.toLocaleString() + "원"
  //   duration_minutes = N + "분"
  'program.list': [
    { key: 'name',             label: '프로그램',     type: 'text' },
    { key: 'program_type',     label: '유형',         type: 'badge' },
    { key: 'price',            label: '금액',         type: 'number' },
    { key: 'duration_minutes', label: '소요시간(분)', type: 'number' },
  ],
  // Agent 전용 동적 조회 — module.field 키, 데이터에 없는 컬럼은 자동 스킵
  'program.query': [
    { key: 'program.name',             label: '프로그램',     type: 'text' },
    { key: 'program.program_type',     label: '유형',         type: 'badge' },
    { key: 'program.price',            label: '금액',         type: 'number' },
    { key: 'program.duration_minutes', label: '소요시간(분)', type: 'number' },
    { key: 'program.is_active',        label: '상태',         type: 'status_chip' },
    { key: 'program.description',      label: '설명',         type: 'text' },
    { key: 'program.created_at',       label: '등록일',       type: 'date' },
    { key: 'program.updated_at',       label: '수정일',       type: 'date' },
  ],

  // ── Counseling ──
  // 출처: CounselingStatusTable.svelte
  //   내담자 = clientName + "외 N명" (clientCount > 1) → name_count
  //   프로그램 = programName + caseType badge (개별/그룹) → text + badge 분리
  //   진행률 = currentSession / totalSessions → fraction
  //   다음 상담일 = D-day 로직 복잡 → agent에서 생략
  //   상태 = badge (in_progress/completed/pending)
  'counseling.list_cases': [
    { key: 'client_name', label: '내담자', type: 'name_count',
      fields: { name: 'client_name', count: 'client_count' } },
    { key: 'counselor_name', label: '담당자', type: 'text' },
    { key: 'program_name', label: '프로그램', type: 'program_badge',
      fields: { name: 'program_name', type: 'case_type' } },
    { key: 'progress', label: '진행률', type: 'fraction',
      fields: { current: 'current_session', total: 'total_sessions' } },
    { key: 'status', label: '상태', type: 'badge' },
  ],
  // Agent 전용 동적 조회 — module.field 키, 데이터에 없는 컬럼은 자동 스킵
  'counseling.query': [
    { key: 'counseling.case_code',       label: '케이스번호', type: 'text' },
    { key: 'counseling.program_id',      label: '프로그램',   type: 'text' },
    { key: 'counseling.counselor_id',    label: '상담사',     type: 'text' },
    { key: 'counseling.chief_complaint', label: '주호소',     type: 'text' },
    { key: 'counseling.memo',            label: '메모',       type: 'text' },
    { key: 'counseling.total_sessions',  label: '총 회기',    type: 'number' },
    { key: 'counseling.status',          label: '상태',       type: 'badge' },
    { key: 'counseling.created_at',      label: '접수일',     type: 'date' },
    { key: 'counseling.updated_at',      label: '수정일',     type: 'date' },
  ],

  // ── Assessment ──
  // 출처: AssessmentCaseTable.svelte
  //   내담자 = clientName(bold semibold) + birthDate(YYYY-MM-DD) + | + gender
  //           → person_info (separator는 <span w-px h-3 bg-gray-200>)
  //   담당자 = StaffAvatar → text (avatar는 agent에서 생략)
  //   검사 = setName 우선, 없으면 assessments[0] + "외 N건" → list_summary
  //   진행률 = completed→"완료" 텍스트, else N/M → fraction
  //   바로링크/결과전송/종합보고서 = 인터랙션 → agent에서 생략
  'assessment.list_cases': [
    { key: 'client_name', label: '내담자', type: 'person_info',
      fields: { name: 'client_name', birth_date: 'birth_date', gender: 'gender' } },
    { key: 'staff_name', label: '담당자', type: 'text' },
    { key: 'assessments', label: '검사', type: 'list_summary',
      fields: { items: 'assessments' } },
    { key: 'progress', label: '진행률', type: 'fraction',
      fields: { current: 'completed_count', total: 'total_count', status: 'status' } },
    { key: 'registered_at', label: '접수일', type: 'date' },
    { key: 'status',        label: '상태',   type: 'badge' },
  ],
  // Agent 전용 동적 조회 — module.field 키, 데이터에 없는 컬럼은 자동 스킵
  'assessment_case.query': [
    { key: 'assessment_case.case_code',    label: '케이스번호', type: 'text' },
    { key: 'assessment_case.counselor_id', label: '담당자',     type: 'text' },
    { key: 'assessment_case.tags',         label: '태그',       type: 'list_summary',
      fields: { items: 'assessment_case.tags' } },
    { key: 'assessment_case.status',       label: '상태',       type: 'badge' },
    { key: 'assessment_case.created_at',   label: '접수일',     type: 'date' },
    { key: 'assessment_case.updated_at',   label: '수정일',     type: 'date' },
  ],
  'assessment.query': [
    { key: 'assessment.code',      label: '코드',         type: 'text' },
    { key: 'assessment.kor_name',  label: '검사명',       type: 'text' },
    { key: 'assessment.eng_name',  label: '영문명',       type: 'text' },
    { key: 'assessment.assessment_type', label: '유형',    type: 'badge' },
    { key: 'assessment.duration',  label: '소요시간(분)', type: 'number' },
    { key: 'assessment.age',       label: '대상 연령',    type: 'text' },
    { key: 'assessment.status',    label: '상태',         type: 'badge' },
    { key: 'assessment.description', label: '설명',       type: 'text' },
    { key: 'assessment.created_at',  label: '등록일',     type: 'date' },
    { key: 'assessment.updated_at',  label: '수정일',     type: 'date' },
  ],

  // ── Operating Time ──
  // Agent 전용 동적 조회 — module.field 키
  'operating_time.query': [
    { key: 'operating_time.weekday',          label: '요일',     type: 'text' },
    { key: 'operating_time.open_time',        label: '시작시간', type: 'text' },
    { key: 'operating_time.close_time',       label: '종료시간', type: 'text' },
    { key: 'operating_time.break_start_time', label: '휴게시작', type: 'text' },
    { key: 'operating_time.break_end_time',   label: '휴게종료', type: 'text' },
  ],

  // ── Non-Operating Time ──
  // Agent 전용 동적 조회 — module.field 키
  'non_operating_time.query': [
    { key: 'non_operating_time.reason',         label: '사유',       type: 'text' },
    { key: 'non_operating_time.year',           label: '연도',       type: 'number' },
    { key: 'non_operating_time.month',          label: '월',         type: 'number' },
    { key: 'non_operating_time.day',            label: '일',         type: 'number' },
    { key: 'non_operating_time.weekday',        label: '요일',       type: 'text' },
    { key: 'non_operating_time.start_time',     label: '시작시간',   type: 'text' },
    { key: 'non_operating_time.end_time',       label: '종료시간',   type: 'text' },
    { key: 'non_operating_time.effective_from', label: '유효시작일', type: 'date' },
    { key: 'non_operating_time.effective_to',   label: '유효종료일', type: 'date' },
  ],

  // ── Schedule ──
  // 출처: ScheduleListView.svelte
  //   내담자 = clients[].name + birth + gender (다건 가능) → text (단순화)
  //   치료실 = room_name → text
  //   항목 = program_name or getScheduleTypeLabel() → text
  //   상태 = session_status (px-2 py-0.5 rounded badge) → badge
  //   담당 = counselor_name + colored dot → text (dot는 agent에서 생략)
  'schedule.list': [
    { key: 'title',          label: '제목',   type: 'text' },
    { key: 'room_name',      label: '상담실', type: 'text' },
    { key: 'counselor_name', label: '담당',   type: 'text' },
    { key: 'session_status', label: '상태',   type: 'badge' },
    { key: 'start',          label: '시작',   type: 'date' },
  ],
  // Agent 전용 동적 조회 — schedule.field 키, 데이터에 없는 컬럼은 자동 스킵
  'schedule.query': [
    { key: 'schedule.title',         label: '제목',   type: 'text' },
    { key: 'schedule.schedule_type', label: '유형',   type: 'badge' },
    { key: 'schedule.start',         label: '시작',   type: 'datetime' },
    { key: 'schedule.end',           label: '종료',   type: 'datetime' },
    { key: 'schedule.member_name',   label: '담당자', type: 'text' },
    { key: 'schedule.room_name',     label: '상담실', type: 'text' },
  ],

  // ── 서브모듈 agent_query ──

  'assessment_set.query': [
    { key: 'assessment_set.name',        label: '세트명', type: 'text' },
    { key: 'assessment_set.description', label: '설명',   type: 'text' },
    { key: 'assessment_set.created_at',  label: '생성일', type: 'date' },
  ],
  'counseling_session.query': [
    { key: 'counseling_session.id',                  label: 'ID',     type: 'text' },
    { key: 'counseling_session.counseling_case_id',  label: '케이스', type: 'text' },
    { key: 'counseling_session.schedule_id',         label: '일정',   type: 'text' },
    { key: 'counseling_session.session_number',      label: '회차',   type: 'number' },
    { key: 'counseling_session.status',              label: '상태',   type: 'badge' },
    { key: 'counseling_session.created_at',          label: '생성일', type: 'date' },
  ],
  'counseling_note.query': [
    { key: 'counseling_note.id',                     label: 'ID',     type: 'text' },
    { key: 'counseling_note.counseling_session_id',  label: '회기',   type: 'text' },
    { key: 'counseling_note.client_id',              label: '내담자', type: 'text' },
    { key: 'counseling_note.summary',                label: '요약',   type: 'text' },
    { key: 'counseling_note.author_id',              label: '작성자', type: 'text' },
    { key: 'counseling_note.created_at',             label: '작성일', type: 'date' },
  ],
  'member_working_time.query': [
    { key: 'member_working_time.weekday',          label: '요일',       type: 'text' },
    { key: 'member_working_time.start_time',       label: '시작',       type: 'text' },
    { key: 'member_working_time.end_time',         label: '종료',       type: 'text' },
    { key: 'member_working_time.break_start_time', label: '휴식시작',   type: 'text' },
    { key: 'member_working_time.break_end_time',   label: '휴식종료',   type: 'text' },
  ],
  'member_non_working_time.query': [
    { key: 'member_non_working_time.reason',         label: '사유',     type: 'text' },
    { key: 'member_non_working_time.description',    label: '설명',     type: 'text' },
    { key: 'member_non_working_time.year',           label: '연도',     type: 'number' },
    { key: 'member_non_working_time.month',          label: '월',       type: 'number' },
    { key: 'member_non_working_time.day',            label: '일',       type: 'number' },
    { key: 'member_non_working_time.start_time',     label: '시작',     type: 'text' },
    { key: 'member_non_working_time.end_time',       label: '종료',     type: 'text' },
    { key: 'member_non_working_time.effective_from', label: '적용시작', type: 'date' },
    { key: 'member_non_working_time.effective_to',   label: '적용종료', type: 'date' },
  ],
  'member_invitation.query': [
    { key: 'member_invitation.name',            label: '이름',     type: 'text' },
    { key: 'member_invitation.email',           label: '이메일',   type: 'text' },
    { key: 'member_invitation.role_code',       label: '역할코드', type: 'badge' },
    { key: 'member_invitation.role_name',       label: '역할명',   type: 'text' },
    { key: 'member_invitation.employment_type', label: '고용형태', type: 'text' },
    { key: 'member_invitation.status',          label: '상태',     type: 'badge' },
    { key: 'member_invitation.expires_at',      label: '만료일',   type: 'date' },
    { key: 'member_invitation.created_at',      label: '생성일',   type: 'date' },
  ],
  'program_member.query': [
    { key: 'program_member.member_id',   label: '상담사',   type: 'text' },
    { key: 'program_member.program_id',  label: '프로그램', type: 'text' },
    { key: 'program_member.created_at',  label: '배정일',   type: 'date' },
  ],
  'form_template.query': [
    { key: 'form_template.name',       label: '양식명',   type: 'text' },
    { key: 'form_template.version',    label: '버전',     type: 'number' },
    { key: 'form_template.is_active',  label: '활성',     type: 'status_chip' },
    { key: 'form_template.center_id',  label: '센터',     type: 'text' },
    { key: 'form_template.created_at', label: '생성일',   type: 'date' },
  ],
  'form_instance.query': [
    { key: 'form_instance.id',           label: 'ID',       type: 'text' },
    { key: 'form_instance.template_id',  label: '양식',     type: 'text' },
    { key: 'form_instance.status',       label: '상태',     type: 'badge' },
    { key: 'form_instance.submitted_at', label: '제출일',   type: 'date' },
    { key: 'form_instance.created_at',   label: '생성일',   type: 'date' },
  ],
  'field_note.query': [
    { key: 'field_note.id',             label: 'ID',       type: 'text' },
    { key: 'field_note.schedule_id',    label: '일정',     type: 'text' },
    { key: 'field_note.author_id',      label: '작성자',   type: 'text' },
    { key: 'field_note.status',         label: '상태',     type: 'badge' },
    { key: 'field_note.total_duration', label: '총시간',   type: 'number' },
    { key: 'field_note.created_at',     label: '생성일',   type: 'date' },
  ],
  'document.query': [
    { key: 'document.name',          label: '파일명',   type: 'text' },
    { key: 'document.original_name', label: '원본명',   type: 'text' },
    { key: 'document.file_type',     label: '파일유형', type: 'text' },
    { key: 'document.file_size',     label: '크기',     type: 'number' },
    { key: 'document.created_at',    label: '업로드일', type: 'date' },
  ],
  'notification.query': [
    { key: 'notification.title',      label: '제목',   type: 'text' },
    { key: 'notification.body',       label: '내용',   type: 'text' },
    { key: 'notification.category',   label: '카테고리', type: 'badge' },
    { key: 'notification.event_type', label: '유형',   type: 'text' },
    { key: 'notification.is_read',    label: '읽음',   type: 'status_chip' },
    { key: 'notification.created_at', label: '생성일', type: 'date' },
  ],
  'assessment.list_participants': [
    { key: 'assessment_participant.participant_name', label: '이름',   type: 'text' },
    { key: 'assessment_participant.participant_type', label: '유형',   type: 'badge' },
    { key: 'assessment_participant.participant_id',   label: 'ID',     type: 'text' },
    { key: 'assessment_participant.case_id',          label: '케이스', type: 'text' },
    { key: 'assessment_participant.assigned_at',      label: '배정일', type: 'date' },
  ],
  'counseling.list_participants': [
    { key: 'counseling_participant.participant_name', label: '이름',   type: 'text' },
    { key: 'counseling_participant.role',             label: '역할',   type: 'badge' },
    { key: 'counseling_participant.participant_id',   label: 'ID',     type: 'text' },
    { key: 'counseling_participant.case_id',          label: '케이스', type: 'text' },
    { key: 'counseling_participant.assigned_at',      label: '배정일', type: 'date' },
  ],
  'assessment_session.query': [
    { key: 'assessment_session.id',          label: 'ID',     type: 'text' },
    { key: 'assessment_session.case_id',     label: '케이스', type: 'text' },
    { key: 'assessment_session.schedule_id', label: '일정',   type: 'text' },
    { key: 'assessment_session.status',      label: '상태',   type: 'badge' },
    { key: 'assessment_session.created_at',  label: '생성일', type: 'date' },
  ],

  // ── Activity Log ──
  'activity_log.list': [
    { key: 'activity_log.event_name', label: '사건', type: 'text' },
    { key: 'activity_log.category',   label: '카테고리', type: 'badge' },
    { key: 'activity_log.action',     label: '동작',     type: 'badge' },
    { key: 'activity_log.entity_type', label: '대상 유형', type: 'text' },
    { key: 'activity_log.summary',    label: '요약',     type: 'text' },
    { key: 'activity_log.actor_name', label: '수행자',   type: 'text' },
    { key: 'activity_log.created_at', label: '일시',     type: 'datetime' },
  ],

  // ── Available Slots ──
  'operating_time.available_slots': [
    { key: 'date',            label: '날짜',       type: 'date' },
    { key: 'available_slots', label: '가용 시간대', type: 'list_summary',
      fields: { items: 'available_slots' } },
  ],
  'operating_time.check_slot': [
    { key: 'date',         label: '날짜',     type: 'date' },
    { key: 'slot',         label: '시간',     type: 'text' },
    { key: 'is_operating', label: '운영여부', type: 'badge' },
    { key: 'reason',       label: '사유',     type: 'text' },
  ],
  'member_working_time.available_slots': [
    { key: 'date',            label: '날짜',       type: 'date' },
    { key: 'available_slots', label: '가용 시간대', type: 'list_summary',
      fields: { items: 'available_slots' } },
  ],
}
