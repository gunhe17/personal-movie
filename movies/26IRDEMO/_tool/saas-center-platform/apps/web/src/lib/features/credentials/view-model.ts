/**
 * Credentials View-Model
 * API 응답 → UI 표현 변환
 */

import type {
  Credential,
  CredentialType,
  EducationMeta,
  CareerMeta,
  CertificationMeta,
  VerificationStatus
} from '$lib/hooks/actions/credential.action'
import {
  DEGREE_LABELS,
  KIND_LABELS,
  VERIFICATION_BADGE_TONE,
  VERIFICATION_LABELS,
  OVERALL_GRADE_LABELS,
  OVERALL_GRADE_TONE,
  type OverallGrade
} from './constants'

// ─────────────────────────────────────────────────────────────
// 항목 ViewModel
// ─────────────────────────────────────────────────────────────

export interface CredentialItemVM {
  id: string
  credential_type: CredentialType
  kindLabel: string

  /** 표시용 타이틀 (예: "심리학과 학사", "선임상담사", "임상심리사 1급") */
  title: string
  /** 보조 라인 (예: "서울대학교") */
  organization: string
  /** 기간 표시 (예: "2015.03 - 2019.02", "2020.03 - 재직중", "2020.08") */
  periodLabel: string
  /** kind별 metadata 표시 라인 (예: 학력=전공, 경력=직책) */
  metaLine: string | null

  /** 검증 상태 */
  verification: {
    status: VerificationStatus
    label: string
    badge: { bg: string; text: string; dot: string }
    rejectReason: string | null
  }

  /** 첨부 파일 표시 */
  attachment: { filename: string; size: string } | null

  /** 만료 표시 (자격증만) */
  expiryHint: { label: string; tone: 'expired' | 'soon' | null } | null

  /** 액션 가용성 */
  canRequestVerification: boolean
  canEdit: boolean
  canDelete: boolean

  /** 원본 (모달 prefill 등에서 사용) */
  raw: Credential
}

export function mapToCredentialItemVM(c: Credential): CredentialItemVM {
  const period = formatPeriod(c)
  const metaLine = formatMetaLine(c)
  const expiryHint = c.credential_type === 'certification' ? computeExpiryHint(c) : null

  const status = c.verification.status

  return {
    id: c.id,
    credential_type: c.credential_type,
    kindLabel: KIND_LABELS[c.credential_type],
    title: c.title,
    organization: c.organization,
    periodLabel: period,
    metaLine,
    verification: {
      status,
      label: VERIFICATION_LABELS[status],
      badge: VERIFICATION_BADGE_TONE[status],
      rejectReason: c.verification.reject_reason
    },
    attachment: c.attachment
      ? {
          filename: c.attachment.filename,
          size: formatFileSize(c.attachment.size)
        }
      : null,
    expiryHint,
    canRequestVerification:
      status === 'unverified' || status === 'rejected',
    canEdit: true,
    canDelete: true,
    raw: c
  }
}

// ─────────────────────────────────────────────────────────────
// 기간 포맷 (kind별)
// ─────────────────────────────────────────────────────────────

function formatPeriod(c: Credential): string {
  const start = c.start_date ? formatDateShort(c.start_date) : ''
  if (c.credential_type === 'certification') {
    // 자격증은 발급일만 표시 (만료일은 별도 expiryHint에서)
    return start
  }

  const end = c.is_current
    ? c.credential_type === 'career'
      ? '재직중'
      : '재학중'
    : c.end_date
      ? formatDateShort(c.end_date)
      : ''

  if (!start && !end) return ''
  if (start && end) return `${start} - ${end}`
  return start || end
}

function formatDateShort(iso: string): string {
  // YYYY-MM-DD → YYYY.MM (월 단위 표시)
  const [y, m] = iso.split('-')
  if (!y || !m) return iso
  return `${y}.${m}`
}

// ─────────────────────────────────────────────────────────────
// metadata 라벨링
// ─────────────────────────────────────────────────────────────

function formatMetaLine(c: Credential): string | null {
  if (!c.meta) return null

  if (c.credential_type === 'education') {
    const meta = c.meta as EducationMeta
    const parts: string[] = []
    if (meta.major) parts.push(meta.major)
    if (meta.degree) parts.push(DEGREE_LABELS[meta.degree] ?? meta.degree)
    return parts.join(' · ') || null
  }

  if (c.credential_type === 'career') {
    const meta = c.meta as CareerMeta
    return meta.position || null
  }

  if (c.credential_type === 'certification') {
    const meta = c.meta as CertificationMeta
    return meta.certificate_number || null
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// 만료 힌트 (자격증)
// ─────────────────────────────────────────────────────────────

function computeExpiryHint(
  c: Credential
): CredentialItemVM['expiryHint'] {
  if (!c.end_date) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expires = new Date(c.end_date)
  if (Number.isNaN(expires.getTime())) return null

  const diffMs = expires.getTime() - today.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: '만료됨', tone: 'expired' }
  }
  if (diffDays <= 30) {
    return { label: `만료 임박 (D-${diffDays})`, tone: 'soon' }
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// 파일 크기 포맷
// ─────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────
// kind별 그룹화
// ─────────────────────────────────────────────────────────────

export interface CredentialGroup {
  credential_type: CredentialType
  label: string
  items: CredentialItemVM[]
}

export function groupCredentialsByKind(
  credentials: Credential[]
): CredentialGroup[] {
  const groups: Record<CredentialType, CredentialItemVM[]> = {
    education: [],
    career: [],
    certification: []
  }

  for (const c of credentials) {
    const vm = mapToCredentialItemVM(c)
    groups[c.credential_type].push(vm)
  }

  return (['education', 'career', 'certification'] as CredentialType[]).map(
    (credential_type) => ({
      credential_type,
      label: KIND_LABELS[credential_type],
      items: groups[credential_type]
    })
  )
}

// ─────────────────────────────────────────────────────────────
// 헤더 요약: 종류별 개수 + 인증 현황
// ─────────────────────────────────────────────────────────────

export interface CredentialSummary {
  /** 종류별 개수 */
  education: number
  career: number
  certification: number
  total: number
  /** 검증 상태별 개수 */
  verified: number
  pending: number
  rejected: number
}

/** credentials 배열을 헤더 요약(종류별 개수 + 인증 현황)으로 집계 */
export function summarizeCredentials(
  credentials: Credential[]
): CredentialSummary {
  const summary: CredentialSummary = {
    education: 0,
    career: 0,
    certification: 0,
    total: credentials.length,
    verified: 0,
    pending: 0,
    rejected: 0
  }

  for (const c of credentials) {
    summary[c.credential_type] += 1
    const status = c.verification.status
    if (status === 'verified') summary.verified += 1
    else if (status === 'pending') summary.pending += 1
    else if (status === 'rejected') summary.rejected += 1
  }

  return summary
}

// ─────────────────────────────────────────────────────────────
// 종합 인증 등급 계산
// ─────────────────────────────────────────────────────────────

export interface OverallGradeVM {
  grade: OverallGrade
  label: string
  tone: { bg: string; text: string; ring: string }
}

/**
 * 종합 인증 등급:
 *  - verified: 자격(certification) 1개 이상이 verified
 *  - in_progress: 자격 verified는 없지만 어느 하나라도 verified
 *  - unverified: verified 없음
 *  - none: 등록 자체가 없음
 *
 * 정책: 설계 문서 §6.3 참조 (외부 노출 작업 시 최종 컨펌)
 */
export function computeOverallGrade(
  credentials: Credential[]
): OverallGradeVM {
  if (credentials.length === 0) {
    return {
      grade: 'none',
      label: OVERALL_GRADE_LABELS.none,
      tone: OVERALL_GRADE_TONE.none
    }
  }

  const verifiedCerts = credentials.filter(
    (c) => c.credential_type === 'certification' && c.verification.status === 'verified'
  )
  if (verifiedCerts.length > 0) {
    return {
      grade: 'verified',
      label: OVERALL_GRADE_LABELS.verified,
      tone: OVERALL_GRADE_TONE.verified
    }
  }

  const hasAnyVerified = credentials.some(
    (c) => c.verification.status === 'verified'
  )
  if (hasAnyVerified) {
    return {
      grade: 'in_progress',
      label: OVERALL_GRADE_LABELS.in_progress,
      tone: OVERALL_GRADE_TONE.in_progress
    }
  }

  return {
    grade: 'unverified',
    label: OVERALL_GRADE_LABELS.unverified,
    tone: OVERALL_GRADE_TONE.unverified
  }
}
