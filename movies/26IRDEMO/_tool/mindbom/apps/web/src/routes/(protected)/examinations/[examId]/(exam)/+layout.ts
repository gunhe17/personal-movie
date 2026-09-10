import { error } from '@sveltejs/kit'
import { get } from '$lib/services/api/instances'
import { institutionStore } from '$lib/stores/institution.store'
import { isSupportedExamType } from '$lib/features/examination/core/registry'
import type { ExamDetail } from '$lib/features/examination/core/exam-context.svelte'
import type { LayoutLoad } from './$types'

/**
 * 검사 진행 화면은 DOM(캔버스·녹음·에디터)을 직접 다루는 단계가 있어 SSR을 끈다.
 */
export const ssr = false

/**
 * 어떤 모듈을 쓸지는 exam_type이 정해져야 알 수 있다.
 * 컴포넌트가 뜨기 전에 여기서 확정해야 setContext 타이밍(초기화 중)을 맞출 수 있다.
 *
 * 받아 온 exam은 컨텍스트의 첫 값으로도 쓴다 — 예전에는 여기서 exam_type만
 * 뽑아 버리고 컨텍스트가 같은 URL을 한 번 더 불렀다(진입마다 2회 조회).
 */
/**
 * 기관 ID 확보.
 *
 * institutionStore는 메모리 전용(httpOnly cookie가 원본)이라 새로고침 직후에는 비어 있다.
 * hydrate는 (protected)/+layout.svelte의 onMount → /api/auth/check 응답 뒤에 일어나는데,
 * load는 컴포넌트 마운트보다 먼저 실행되므로 스토어만 믿으면 새로고침 시 항상 null이다.
 * 따라서 비어 있으면 쿠키를 들고 있는 서버에 직접 물어보고, 받은 값으로 스토어도 채운다.
 */
async function resolveInstitutionId(
  fetchFn: typeof fetch
): Promise<string | null> {
  const cached = institutionStore.getCurrentInstitutionId()
  if (cached) return cached

  try {
    const res = await fetchFn('/api/auth/check')
    if (!res.ok) return null
    const data = await res.json()
    const instId: string | null = data?.currentInstitutionId ?? null
    if (instId) {
      institutionStore.hydrate({
        currentInstitutionId: instId,
        institutions: []
      })
    }
    return instId
  } catch {
    return null
  }
}

export const load: LayoutLoad = async ({ params, fetch }) => {
  const examId = params.examId
  if (!examId) throw error(404, '검사를 찾을 수 없습니다.')

  const instId = await resolveInstitutionId(fetch)
  if (!instId) throw error(403, '기관이 선택되지 않았습니다.')

  let exam: ExamDetail
  try {
    exam = await get<ExamDetail>(`/institutions/${instId}/examinations/${examId}`)
  } catch (e) {
    // 원인을 404로 뭉개면 권한 문제와 진짜 없는 검사를 구분할 수 없다.
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 403) throw error(403, '이 검사에 접근할 권한이 없습니다.')
    if (status === 404) throw error(404, '검사를 찾을 수 없습니다.')
    throw error(503, '검사 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
  }

  if (!isSupportedExamType(exam.exam_type)) {
    throw error(400, '아직 지원하지 않는 검사입니다.')
  }

  return { examId, examType: exam.exam_type, exam }
}
