import type { TemplateSummary, TemplateResponse, FormField, FormSchema, InstanceSummary, FormSendSummary } from '$lib/hooks/actions/form.action'
import { OWNER_LABELS, OWNER_BADGE_STYLES, FIELD_TYPE_LABELS, FIELD_TYPE_COLORS, STATUS_LABELS, STATUS_BADGE_STYLES, INSTANCE_STATUS_LABELS, INSTANCE_STATUS_BADGE_STYLES } from './constants'
import { orderedFieldKeys, optionLabels, elementCount, pageCount } from './schema-utils'
import { formatUtcToKst } from '$lib/utils/date'

export interface TemplateVM {
  id: string
  name: string
  version: number
  isActive: boolean
  isSystem: boolean
  ownerLabel: string
  ownerBadgeText: string
  ownerBadgeBg: string
  statusLabel: string
  statusBadgeText: string
  statusBadgeBg: string
  createdAt: string
  fieldCount: number
  /** 문서 스냅샷 렌더용 폼 스키마 */
  schema: FormSchema
}

export interface SectionVM {
  title: string
  fields: FieldVM[]
}

export interface FieldVM {
  key: string
  label: string
  type: string
  typeLabel: string
  typeBadgeText: string
  typeBadgeBg: string
  required: boolean
  hasOptions: boolean
  options: string[]
  optionCount: number
}

export interface SchemaStatsVM {
  totalFields: number
  requiredFields: number
  optionalFields: number
  elementCount: number
  pageCount: number
  fieldTypeCounts: { label: string; count: number }[]
}

export interface TemplateDetailVM extends TemplateVM {
  sections: SectionVM[]
  stats: SchemaStatsVM
}

function getOwnerType(centerId: string | null): 'system' | 'center' {
  return centerId === null ? 'system' : 'center'
}

function countFields(item: TemplateSummary | TemplateResponse): number {
  if ('schema' in item && item.schema?.fields) {
    return Object.keys(item.schema.fields).length
  }
  return 0
}

export function mapToTemplateVM(item: TemplateSummary): TemplateVM {
  const ownerType = getOwnerType(item.center_id)
  const statusKey = item.is_active ? 'active' : 'inactive'

  return {
    id: item.id,
    name: item.name,
    version: item.version,
    isActive: item.is_active,
    isSystem: ownerType === 'system',
    ownerLabel: OWNER_LABELS[ownerType],
    ownerBadgeText: OWNER_BADGE_STYLES[ownerType].text,
    ownerBadgeBg: OWNER_BADGE_STYLES[ownerType].bg,
    statusLabel: STATUS_LABELS[statusKey],
    statusBadgeText: STATUS_BADGE_STYLES[statusKey].text,
    statusBadgeBg: STATUS_BADGE_STYLES[statusKey].bg,
    createdAt: item.created_at ? formatUtcToKst(item.created_at, 'YYYY.MM.DD') : '',
    fieldCount: countFields(item),
    schema: item.schema
  }
}

function mapField(key: string, field: FormField): FieldVM {
  const typeColors = FIELD_TYPE_COLORS[field.type] ?? { text: 'text-gray-600', bg: 'bg-gray-100' }
  const options = optionLabels(field)

  return {
    key,
    label: field.label,
    type: field.type,
    typeLabel: FIELD_TYPE_LABELS[field.type] ?? field.type,
    typeBadgeText: typeColors.text,
    typeBadgeBg: typeColors.bg,
    required: field.required,
    hasOptions: options.length > 0,
    options,
    optionCount: options.length
  }
}

function buildStats(schema: FormSchema): SchemaStatsVM {
  const entries = Object.values(schema.fields ?? {})
  const requiredFields = entries.filter((f) => f.required).length

  const typeCounts = new Map<string, number>()
  for (const field of entries) {
    const label = FIELD_TYPE_LABELS[field.type] ?? field.type
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1)
  }
  const fieldTypeCounts = [...typeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalFields: entries.length,
    requiredFields,
    optionalFields: entries.length - requiredFields,
    elementCount: elementCount(schema),
    pageCount: pageCount(schema),
    fieldTypeCounts
  }
}

export interface InstanceVM {
  id: string
  shortId: string
  statusLabel: string
  statusBadgeText: string
  statusBadgeBg: string
  createdAt: string
  submittedAt: string
}

export function mapToInstanceVM(item: InstanceSummary): InstanceVM {
  const badge = INSTANCE_STATUS_BADGE_STYLES[item.status] ?? { text: 'text-gray-500', bg: 'bg-gray-100' }
  return {
    id: item.id,
    shortId: item.id.slice(0, 8),
    statusLabel: INSTANCE_STATUS_LABELS[item.status] ?? item.status,
    statusBadgeText: badge.text,
    statusBadgeBg: badge.bg,
    createdAt: item.created_at ? formatUtcToKst(item.created_at, 'YYYY.MM.DD HH:mm') : '',
    submittedAt: item.submitted_at ? formatUtcToKst(item.submitted_at, 'YYYY.MM.DD HH:mm') : ''
  }
}

// ───────── 발급 내역 (전송 + 대상 + 작성 여부) ─────────

export interface IssuanceRowVM {
  key: string
  sendId: string
  name: string
  relation: string
  phone: string
  channelLabel: string
  sentAt: string
  /** 작성 여부 */
  statusLabel: string
  statusBadgeText: string
  statusBadgeBg: string
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: '문자',
  alarmtalk: '알림톡'
}

function issuanceStatus(status?: string | null): {
  label: string
  text: string
  bg: string
} {
  if (status === 'submitted') {
    return { label: '작성완료', text: 'text-green-700', bg: 'bg-green-50' }
  }
  // draft 또는 미연결 → 미작성
  return { label: '미작성', text: 'text-gray-500', bg: 'bg-gray-100' }
}

/** 발급(전송) 목록을 수신자 단위 행으로 평탄화 (최신순 유지) */
export function mapToIssuanceRows(sends: FormSendSummary[]): IssuanceRowVM[] {
  const rows: IssuanceRowVM[] = []
  for (const send of sends) {
    const sentAt = send.created_at
      ? formatUtcToKst(send.created_at, 'YYYY.MM.DD HH:mm')
      : ''
    const channelLabel = CHANNEL_LABELS[send.channel ?? ''] ?? (send.channel ?? '-')
    send.recipients.forEach((r, idx) => {
      const st = issuanceStatus(r.status)
      rows.push({
        key: `${send.id}-${idx}`,
        sendId: send.id,
        name: r.name,
        relation: r.relation ?? '',
        phone: r.phone,
        channelLabel,
        sentAt,
        statusLabel: st.label,
        statusBadgeText: st.text,
        statusBadgeBg: st.bg
      })
    })
  }
  return rows
}

export function mapToTemplateDetailVM(item: TemplateResponse): TemplateDetailVM {
  const base = mapToTemplateVM(item)
  const schema = item.schema ?? { fields: {} }
  const fields = schema.fields ?? {}

  // canonical 은 섹션이 없으므로 element 표시 순서로 단일 그룹 구성
  const orderedKeys = orderedFieldKeys(schema).filter((k) => fields[k])
  const sections: SectionVM[] = [
    { title: '양식 항목', fields: orderedKeys.map((key) => mapField(key, fields[key])) }
  ]

  const stats = buildStats(schema)

  return {
    ...base,
    fieldCount: stats.totalFields,
    sections,
    stats
  }
}
