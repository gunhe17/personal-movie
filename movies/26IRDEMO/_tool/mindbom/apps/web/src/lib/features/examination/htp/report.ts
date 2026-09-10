/**
 * HTP가 종합보고서에 제공하는 것 — 그림 이미지 + 해석표, 그리고 보고서 PDF.
 *
 * 예전에는 이 추출 로직과 카테고리 라벨표가 리포트 화면에 exam_type if-체인과
 * 함께 있었다. 검사 고유 어휘('집'·'나무'·'자기개념')가 화면에 박혀 있으면
 * 새 검사를 붙일 때 모듈만 봐서는 어디를 고쳐야 하는지 알 수 없다.
 */
import { get } from '$lib/services/api/instances'
import type { ReportAsset } from '../core/module'
import { resolveImageUrl } from '../core/report-asset'

const CATEGORY_LABEL: Record<string, string> = {
  house: '집',
  tree: '나무',
  man: '남자사람',
  woman: '여자사람'
}

/** 해석 3대 카테고리 — 보고서에 실리는 순서다. */
const INTERP_CATEGORIES = ['자기개념', '정서적 안정성', '대인관계']

interface Drawing {
  id: string
  category: string
  image_url: string | null
}
interface Interpretation {
  id: string
  main_category: string
  sub_category: string
  sentence: string
  is_important: boolean
}
interface Results {
  drawings: Drawing[]
  interpretations: Interpretation[]
}

export async function loadHtpReportAssets(
  instId: string,
  examId: string
): Promise<ReportAsset[]> {
  // 검사별 서브경로(/htp)가 있어야 한다 — 검사 공통 /results 라우트는 없다.
  const res = await get<Results>(
    `/institutions/${instId}/examinations/${examId}/htp/results`
  )
  const out: ReportAsset[] = []

  for (const d of res.drawings ?? []) {
    if (!d.image_url) continue
    out.push({
      id: `img-${d.id}`,
      name: `${CATEGORY_LABEL[d.category] ?? d.category}.png`,
      kind: 'image',
      src: resolveImageUrl(d.image_url)
    })
  }

  const byCat = new Map<string, Interpretation[]>()
  for (const it of res.interpretations ?? []) {
    const arr = byCat.get(it.main_category) ?? []
    arr.push(it)
    byCat.set(it.main_category, arr)
  }
  for (const cat of INTERP_CATEGORIES) {
    const items = byCat.get(cat)
    if (!items || !items.length) continue
    out.push({
      id: `interp-${cat}`,
      name: `해석 · ${cat}`,
      kind: 'table',
      count: items.length,
      table: {
        title: `${cat}`,
        headers: ['', '하위영역', '해석'],
        rows: items.map((it) => [
          it.is_important ? '★' : '',
          it.sub_category,
          it.sentence
        ])
      }
    })
  }
  return out
}

export async function downloadHtpReport(
  instId: string,
  examId: string
): Promise<void> {
  const { htpService } = await import('./htp-service')
  await htpService.downloadReportPdf(instId, examId)
}
