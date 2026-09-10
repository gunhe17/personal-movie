/**
 * 로르샤하가 종합보고서에 제공하는 것 — 구조요약의 7개 클러스터표 +
 * 특수지표표, 그리고 보고서 PDF.
 *
 * 클러스터·지표 라벨은 Exner CS 고유 어휘라 이 검사에 속한다. 예전에는
 * 리포트 화면이 ROR_CLUSTER_LABEL·ROR_INDEX_LABEL을 직접 들고 있었다.
 */
import { get } from '$lib/services/api/instances'
import type { ReportAsset } from '../core/module'
import type { ServerSpecialIndex } from './actions'

const CLUSTER_LABEL: Record<string, string> = {
  core: '핵심 (Core)',
  affection: '정서 (Affect)',
  interpersonal: '대인관계 (Interpersonal)',
  ideation: '사고 (Ideation)',
  cognitiveMediation: '인지적 중재 (Mediation)',
  informationProcessing: '정보처리 (Processing)',
  selfPerception: '자기지각 (Self-Perception)'
}

// 지표 이름은 **서버가 준다**(`ServerSpecialIndex.label`). 예전에는 여기에도
// 표가 하나 더 있었고, 항목 문장은 결과 화면에 또 따로 있었다.

interface StructuralSummary {
  R: number
  /** 'valid' | 'insufficient_r' | 'not_scored' — 서버가 R로 판정한다 */
  validity?: string
  lower_section: Record<string, Record<string, number | string>>
  special_indices: Record<string, ServerSpecialIndex>
}

/** {키: 값} 묶음 하나를 표 자료 한 건으로. 행이 없으면 만들지 않는다. */
function toTable(
  idPrefix: string,
  key: string,
  label: string,
  obj: Record<string, number | string> | undefined,
  headers: [string, string]
): ReportAsset | null {
  const rows = Object.entries(obj ?? {}).map(([k, v]) => [k, String(v)])
  if (!rows.length) return null
  return {
    id: `${idPrefix}-${key}`,
    name: label,
    kind: 'table',
    count: rows.length,
    table: { title: label, headers, rows }
  }
}

export async function loadRorschachReportAssets(
  instId: string,
  examId: string
): Promise<ReportAsset[]> {
  const res = await get<StructuralSummary>(
    `/institutions/${instId}/examinations/${examId}/rorschach/structural-summary`
  )
  const out: ReportAsset[] = []

  // 봉인된 프로토콜(R<14)은 클러스터·특수지표가 전부 0/빈 값으로 온다.
  // 그대로 표로 내보내면 종합보고서에 "S-CON 0" 같은 **측정값처럼** 실린다.
  // 표를 빼되, 왜 없는지는 남긴다 — 조용히 사라지면 수집 실패로 읽힌다.
  if (res.validity && res.validity !== 'valid') {
    const reason =
      res.validity === 'not_scored'
        ? '채점된 반응이 없어 구조 요약을 산출하지 않았습니다.'
        : `Exner CS 해석 기준 미달(R = ${res.R} < 14). 하단 클러스터와 특수 지표를 산출하지 않았습니다. 재실시가 권고됩니다.`
    return [
      {
        id: 'ror-validity',
        name: '프로토콜 타당성 — 해석 불가',
        kind: 'table',
        count: 1,
        table: {
          title: '프로토콜 타당성',
          headers: ['구분', '내용'],
          rows: [['해석 불가 프로토콜', reason]]
        }
      }
    ]
  }

  for (const [key, obj] of Object.entries(res.lower_section ?? {})) {
    const asset = toTable('ror-cluster', key, CLUSTER_LABEL[key] ?? key, obj, [
      '지표',
      '값'
    ])
    if (asset) out.push(asset)
  }
  /**
   * 특수지표는 **항목 문장과 해당 여부**로 낸다.
   *
   * 예전에는 서버가 주던 `{"0": "v", "1": ""}`를 그대로 표로 만들어
   * 행이 `["0", "v"]`였다 — 종합보고서에 실려도 **읽을 수 없는 표**였고,
   * 무엇보다 양성 여부가 어디에도 없었다.
   */
  for (const [key, idx] of Object.entries(res.special_indices ?? {})) {
    if (!idx?.items?.length) continue
    out.push({
      id: `ror-index-${key}`,
      name: `${idx.label} — ${idx.positive ? '양성' : '정상 범위'}`,
      kind: 'table',
      count: idx.items.length,
      table: {
        title: `${idx.label} · ${idx.rule}`,
        headers: ['항목', '해당'],
        rows: idx.items.map((i) => [i.label, i.met ? '✓' : ''])
      }
    })
  }
  return out
}

export async function downloadRorschachReport(
  instId: string,
  examId: string
): Promise<void> {
  const { downloadRorschachReportPdf } = await import('./actions')
  await downloadRorschachReportPdf(instId, examId)
}
