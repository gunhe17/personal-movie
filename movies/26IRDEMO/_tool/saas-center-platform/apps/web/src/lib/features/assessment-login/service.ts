import { browser } from '$app/environment'
import { goto } from '$app/navigation'
import {
  assessmentCenterStore,
  type AssessmentCenterSummary
} from '$lib/stores/assessment-center.store'
import { centerStore } from '$lib/stores/center.store'
import {
  assessmentAuthStore,
  type AssessmentUser
} from '$lib/stores/assessment-auth.store'

interface LoginApiResponse {
  success: boolean
  message?: string
  user?: AssessmentUser & {
    centers?: AssessmentCenterSummary[]
  }
}

interface CentersApiResponse {
  centers?: AssessmentCenterSummary[]
  applications?: Array<{
    id: string
    name: string
    status: string
    created_at: string
  }>
}

export function getAssessmentRedirectUrl(): string {
  if (!browser) return '/assessment-flow/centers'
  const params = new URLSearchParams(window.location.search)
  const rawRedirectTo = params.get('redirectTo')

  // URL 직접 접근 후 로그인한 경우: redirectTo가 있으면 해당 경로로
  if (rawRedirectTo && rawRedirectTo.startsWith('/assessment-flow')) {
    return rawRedirectTo
  }

  return '/assessment-flow/centers'
}

export async function assessmentLogin(
  email: string,
  password: string
): Promise<{ success: boolean; user?: AssessmentUser; error?: string }> {
  const response = await fetch('/api/assessment/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  const data: LoginApiResponse = await response.json()

  if (!response.ok || !data.success || !data.user) {
    return {
      success: false,
      error: data.message || '로그인에 실패했습니다.'
    }
  }

  assessmentAuthStore.login({
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    phone: data.user.phone,
    role: data.user.role
  })

  if (Array.isArray(data.user.centers)) {
    assessmentCenterStore.setCenters(data.user.centers)
    // 기존 검사 페이지가 centerStore를 참조하므로 동기화합니다.
    centerStore.setCenters(data.user.centers)
  }

  return { success: true, user: data.user }
}

export async function fetchAssessmentCenters(
  fallbackCenters: AssessmentCenterSummary[] = []
): Promise<{
  centers: AssessmentCenterSummary[]
  applications: CentersApiResponse['applications']
  autoSelected: boolean
}> {
  const response = await fetch('/api/assessment/proxy/centers?limit=100')

  let centers: AssessmentCenterSummary[] = []
  let applications: CentersApiResponse['applications'] = []

  if (response.ok) {
    const data: CentersApiResponse = await response.json()
    centers = data.centers || []
    applications = data.applications || []
  } else {
    centers = fallbackCenters
    applications = []
  }

  if (centers.length > 0) {
    assessmentCenterStore.setCenters(centers)
    centerStore.setCenters(centers)
  }

  const autoSelected = centers.length === 1
  return { centers, applications, autoSelected }
}

export async function selectAssessmentCenter(centerId: string) {
  assessmentCenterStore.setCurrentCenterId(centerId)
  centerStore.setCurrentCenterId(centerId)
  await goto(`/assessment-flow/centers/${centerId}/identify`)
}

export async function logoutAssessmentFlow() {
  await assessmentAuthStore.logout()
  assessmentCenterStore.clear()
  centerStore.clear()
}
