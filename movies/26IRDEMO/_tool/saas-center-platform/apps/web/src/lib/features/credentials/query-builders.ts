/**
 * Credentials Query/Form Builders
 *
 * 모달에서 사용하는 폼 데이터 타입 정의와
 * 폼 데이터 → API payload 변환을 캡슐화한다.
 */

import {
  listMyCredentials,
  type CreateCredentialPayload,
  type Credential,
  type CredentialType,
  type EducationDegree,
  type UpdateCredentialPayload
} from '$lib/hooks/actions/credential.action'

// ─────────────────────────────────────────────────────────────
// 쿼리 입력 빌더
// ─────────────────────────────────────────────────────────────

export function buildMyCredentialsInput(credential_type?: CredentialType) {
  return {
    action: listMyCredentials,
    params: credential_type ? { credential_type } : {}
  }
}

// ─────────────────────────────────────────────────────────────
// 폼 데이터 타입 (kind별)
// ─────────────────────────────────────────────────────────────

export interface EducationFormData {
  /** 학교명 (organization으로 매핑) */
  school: string
  /** 전공 (metadata.major) */
  major: string
  /** 학위 (metadata.degree) → title에도 반영 */
  degree: EducationDegree
  /** 시작일 (YYYY-MM-DD) */
  start_date: string
  /** 종료일 (YYYY-MM-DD) — is_attending이면 비움 */
  end_date: string
  is_attending: boolean
}

export interface CareerFormData {
  /** 기관/회사명 (organization) */
  organization: string
  /** 직책 (metadata.position) → title에 반영 */
  position: string
  /** 부가 설명 (description) */
  description: string
  start_date: string
  end_date: string
  is_current: boolean
}

export interface CertificationFormData {
  /** 자격증명 (title) */
  name: string
  /** 발급 기관 (organization) */
  issuer: string
  /** 자격증 번호 (metadata.certificate_number) */
  certificate_number: string
  /** 발급일 (start_date) */
  issued_date: string
  /** 만료일 (end_date) — 빈 값이면 만료 없음 */
  expires_at: string
}

// ─────────────────────────────────────────────────────────────
// Form → Create Payload 변환
// ─────────────────────────────────────────────────────────────

export function toEducationCreatePayload(
  form: EducationFormData
): CreateCredentialPayload {
  const degreeLabel = DEGREE_TITLE_PART[form.degree] ?? ''
  const titleParts = [form.major, degreeLabel].filter(Boolean)
  return {
    credential_type: 'education',
    title: titleParts.join(' ') || form.major || '학력',
    organization: form.school,
    description: null,
    start_date: form.start_date || null,
    end_date: form.is_attending ? null : form.end_date || null,
    is_current: form.is_attending,
    meta: {
      major: form.major,
      degree: form.degree
    }
  }
}

export function toCareerCreatePayload(
  form: CareerFormData
): CreateCredentialPayload {
  return {
    credential_type: 'career',
    title: form.position || '경력',
    organization: form.organization,
    description: form.description || null,
    start_date: form.start_date || null,
    end_date: form.is_current ? null : form.end_date || null,
    is_current: form.is_current,
    meta: {
      position: form.position
    }
  }
}

export function toCertificationCreatePayload(
  form: CertificationFormData
): CreateCredentialPayload {
  return {
    credential_type: 'certification',
    title: form.name,
    organization: form.issuer,
    description: null,
    start_date: form.issued_date || null,
    end_date: form.expires_at || null,
    is_current: false,
    meta: {
      certificate_number: form.certificate_number
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Update Payload는 Create와 동일한 형태로 부분 전송
// ─────────────────────────────────────────────────────────────

export function toEducationUpdatePayload(
  form: EducationFormData
): UpdateCredentialPayload {
  return toEducationCreatePayload(form)
}

export function toCareerUpdatePayload(
  form: CareerFormData
): UpdateCredentialPayload {
  return toCareerCreatePayload(form)
}

export function toCertificationUpdatePayload(
  form: CertificationFormData
): UpdateCredentialPayload {
  return toCertificationCreatePayload(form)
}

// ─────────────────────────────────────────────────────────────
// Credential → Form 변환 (수정 모달 prefill)
// ─────────────────────────────────────────────────────────────

export function toEducationForm(c: Credential): EducationFormData {
  const meta = (c.meta ?? {}) as { major?: string; degree?: EducationDegree }
  return {
    school: c.organization,
    major: meta.major ?? '',
    degree: meta.degree ?? 'bachelor',
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? '',
    is_attending: c.is_current
  }
}

export function toCareerForm(c: Credential): CareerFormData {
  const meta = (c.meta ?? {}) as { position?: string }
  return {
    organization: c.organization,
    position: meta.position ?? c.title,
    description: c.description ?? '',
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? '',
    is_current: c.is_current
  }
}

export function toCertificationForm(c: Credential): CertificationFormData {
  const meta = (c.meta ?? {}) as { certificate_number?: string | null }
  return {
    name: c.title,
    issuer: c.organization,
    certificate_number: meta.certificate_number ?? '',
    issued_date: c.start_date ?? '',
    expires_at: c.end_date ?? ''
  }
}

// ─────────────────────────────────────────────────────────────
// 내부: 학위 → 타이틀에 들어갈 라벨
// ─────────────────────────────────────────────────────────────

const DEGREE_TITLE_PART: Record<EducationDegree, string> = {
  bachelor: '학사',
  master: '석사',
  doctorate: '박사',
  other: ''
}
