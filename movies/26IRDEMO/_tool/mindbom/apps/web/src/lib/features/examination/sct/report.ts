/**
 * SCT가 종합보고서에 제공하는 것 — 영역별 점수 요약표 + 영역별 응답 상세표,
 * 그리고 보고서 PDF.
 */
import { get } from '$lib/services/api/instances'
import type { ReportAsset } from '../core/module'

interface ScoreItem {
  stemId: number
  stem: string
  score: number
  answer?: string | null
}
interface DomainScore {
  domain: string
  domainLabel: string
  totalScore: number
  maxScore: number
  items: ScoreItem[]
}
interface Results {
  results: { scores: DomainScore[] } | null
}

export async function loadSctReportAssets(
  instId: string,
  examId: string
): Promise<ReportAsset[]> {
  // 검사별 서브경로(/sct)가 있어야 한다 — 검사 공통 /results 라우트는 없다.
  const res = await get<Results>(
    `/institutions/${instId}/examinations/${examId}/sct/results`
  )
  const scores = res.results?.scores ?? []
  if (!scores.length) return []

  const out: ReportAsset[] = [
    {
      id: 'sct-summary',
      name: '영역별 점수 요약',
      kind: 'table',
      count: scores.length,
      table: {
        title: '영역별 점수 요약',
        headers: ['영역', '점수', '비율'],
        rows: scores.map((s) => [
          s.domainLabel,
          `${s.totalScore} / ${s.maxScore}`,
          s.maxScore > 0
            ? `${Math.round((s.totalScore / s.maxScore) * 100)}%`
            : '-'
        ])
      }
    }
  ]

  for (const s of scores) {
    if (!s.items?.length) continue
    out.push({
      id: `sct-items-${s.domain}`,
      name: `응답 · ${s.domainLabel}`,
      kind: 'table',
      count: s.items.length,
      table: {
        title: `${s.domainLabel} — 응답 상세 (${s.totalScore} / ${s.maxScore})`,
        headers: ['문항', '응답', '점수'],
        rows: s.items.map((it) => [
          it.stem,
          it.answer || '(미응답)',
          String(it.score)
        ])
      }
    })
  }
  return out
}

export async function downloadSctReport(
  instId: string,
  examId: string
): Promise<void> {
  const { appInstance } = await import('$lib/services/api/instances')
  const res = await appInstance.get(
    `/institutions/${instId}/examinations/${examId}/sct/report/pdf`,
    { responseType: 'blob' }
  )
  const blobUrl = URL.createObjectURL(
    new Blob([res.data], { type: 'application/pdf' })
  )
  try {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `sct_report_${examId.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}
