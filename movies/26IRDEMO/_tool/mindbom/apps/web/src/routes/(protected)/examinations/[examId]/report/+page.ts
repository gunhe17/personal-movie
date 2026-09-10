import type { PageLoad } from './$types'

// 에디터는 DOM을 직접 조작하므로 SSR 끔 (browser 환경 전용)
export const ssr = false

export const load: PageLoad = ({ params, url }) => {
  // 종합보고서는 여러 검사를 묶을 수 있음.
  // ?ids=a,b,c 로 전달된 전체 검사 목록을 사용하되,
  // 없으면 경로의 단일 검사(params.examId)만 사용.
  const idsParam = url.searchParams.get('ids')
  const examIds = idsParam
    ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [params.examId]
  // 경로의 검사가 목록에 없으면 맨 앞에 포함 (진입 검사 보장)
  if (!examIds.includes(params.examId)) examIds.unshift(params.examId)
  return { examId: params.examId, examIds }
}
