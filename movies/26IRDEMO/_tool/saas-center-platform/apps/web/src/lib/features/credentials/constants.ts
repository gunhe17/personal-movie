/**
 * Credentials 도메인 상수
 *
 * 설계 문서: docs/center/member-credentials.md
 */

import type {
  CredentialType,
  EducationDegree,
  VerificationStatus
} from '$lib/hooks/actions/credential.action'

// ─────────────────────────────────────────────────────────────
// credential_type 라벨
// ─────────────────────────────────────────────────────────────

export const KIND_LABELS: Record<CredentialType, string> = {
  education: '학력',
  career: '경력',
  certification: '자격'
}

export const KIND_EMPTY_LABEL: Record<CredentialType, string> = {
  education: '학력 사항을 추가해주세요',
  career: '경력 사항을 추가해주세요',
  certification: '자격증을 추가해주세요'
}

// ─────────────────────────────────────────────────────────────
// 학위 라벨
// ─────────────────────────────────────────────────────────────

export const DEGREE_LABELS: Record<EducationDegree, string> = {
  bachelor: '학사',
  master: '석사',
  doctorate: '박사',
  other: '기타'
}

export const DEGREE_OPTIONS: { value: EducationDegree; label: string }[] = [
  { value: 'bachelor', label: '학사' },
  { value: 'master', label: '석사' },
  { value: 'doctorate', label: '박사' },
  { value: 'other', label: '기타' }
]

// ─────────────────────────────────────────────────────────────
// 검증 상태 라벨 + 톤
// ─────────────────────────────────────────────────────────────

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: '미인증',
  pending: '검증 대기',
  verified: '인증됨',
  rejected: '반려됨'
}

/** 항목 단위 배지 색상 토큰 (TailwindCSS 클래스 형식) */
export const VERIFICATION_BADGE_TONE: Record<
  VerificationStatus,
  { bg: string; text: string; dot: string }
> = {
  unverified: {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    dot: 'bg-gray-400'
  },
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    dot: 'bg-yellow-500'
  },
  verified: {
    bg: 'bg-primary-50',
    text: 'text-primary-600',
    dot: 'bg-primary-500'
  },
  rejected: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    dot: 'bg-red-500'
  }
}

// ─────────────────────────────────────────────────────────────
// 종합 인증 등급
// ─────────────────────────────────────────────────────────────

export type OverallGrade = 'verified' | 'in_progress' | 'unverified' | 'none'

export const OVERALL_GRADE_LABELS: Record<OverallGrade, string> = {
  verified: '인증 완료',
  in_progress: '검증 진행',
  unverified: '미인증',
  none: '미입력'
}

export const OVERALL_GRADE_TONE: Record<
  OverallGrade,
  { bg: string; text: string; ring: string }
> = {
  verified: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200'
  },
  in_progress: {
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    ring: 'ring-primary-200'
  },
  unverified: {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    ring: 'ring-gray-200'
  },
  none: {
    bg: 'bg-gray-50',
    text: 'text-gray-400',
    ring: 'ring-gray-200'
  }
}

// ─────────────────────────────────────────────────────────────
// 모달 설정 (size)
// ─────────────────────────────────────────────────────────────

export const CREDENTIAL_MODAL_SIZES = {
  education: { size: 'md' as const },
  career: { size: 'md' as const },
  certification: { size: 'lg' as const } // 첨부 포함이라 조금 넓게
}

// ─────────────────────────────────────────────────────────────
// 첨부 파일 제약
// ─────────────────────────────────────────────────────────────

export const ATTACHMENT_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png'
]
export const ATTACHMENT_ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
export const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
