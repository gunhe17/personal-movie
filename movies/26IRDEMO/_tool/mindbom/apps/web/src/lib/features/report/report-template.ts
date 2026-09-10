/**
 * 보고서 템플릿 조립 — [표지] + [자유 본문] + [마무리].
 *
 * ViewModel 층이다. 실데이터(검사·내담자·검사자)를 받아 편집기가 먹는 모양
 * (DocMeta + InitialBlock[])으로 바꾸기만 한다. 에디터도 DOM도 알지 못한다.
 * 표지/마무리(cover 블록)만 고정·잠금이고 사이 본문은 완전 자유 편집이다.
 */
import type { InitialBlock } from '$lib/components/document-editor/components/PaginatedEditor.svelte'
import type { DocMeta } from '$lib/components/document-editor/components/report-cover'
import {
  formatDate,
  calcAge,
  genderLabel,
  clientCode
} from '$lib/utils/format'
import { codeFor, type ClientInfo, type ExamDetail, type MemberInfo } from './materials'
import { presetBody } from './preset-body'

export const REPORT_DATE = '2026-07-06' // TODO: 서버 생성일로 대체

export interface ReportTemplate {
  docMeta: DocMeta
  blocks: InitialBlock[]
}

export interface TemplateInput {
  exams: ExamDetail[]
  client: ClientInfo | null
  /** 표지·서명 대표값에 쓰는 진입(첫) 검사의 검사자 */
  primaryExaminer: MemberInfo | null
  /** 검사자 id → 멤버 (검사마다 다를 수 있다) */
  examiners: Record<string, MemberInfo>
}

export function buildReportTemplate({
  exams,
  client,
  primaryExaminer,
  examiners
}: TemplateInput): ReportTemplate {
  const name = client?.name ?? '내담자'
  const code = client ? clientCode(client.id) : '-'
  const clientLabel = `${name} (${code})`
  const age = calcAge(client?.birth_date)
  const genderBirth = `${genderLabel(client?.gender)}${
    client?.birth_date ? ` · ${client.birth_date}` : ''
  }${age !== null ? ` (만 ${age}세)` : ''}`

  /*
   * 검사일과 등록일은 다른 사실이므로 칸을 나눈다.
   *
   * 예전에는 `scheduled_at ?? created_at`으로 한 칸에 담았다. 그러면 일정을
   * 정하지 않고 등록한 검사가 **등록일을 검사일로** 갖는다 — 아무도 그 날로
   * 잡은 적이 없는데. 임상 문서에 실리는 값이라 더 무겁다.
   * (앵커 개념 제거와 같은 논지. docs/온톨로지/앵커개념-제거.md)
   *
   * 일정이 없으면 검사일은 '-'로 두고, 등록일 칸이 사실을 말한다.
   */
  const uniqueDates = (pick: (e: ExamDetail) => string | null) => [
    ...new Set(exams.map((e) => formatDate(pick(e))).filter((d) => d !== '-'))
  ]
  const scheduledDates = uniqueDates((e) => e.scheduled_at ?? null)
  const createdDates = uniqueDates((e) => e.created_at ?? null)
  const examDate = scheduledDates.length ? scheduledDates.join(', ') : '-'
  const registeredDate = createdDates.length ? createdDates.join(', ') : '-'

  // 검사 항목: 묶인 검사 종류 나열 (HTP, 로샤, SCT)
  const examTypeLabel = exams.length
    ? [...new Set(exams.map((e) => codeFor(e.exam_type)))].join(', ')
    : '-'

  // 검사자: 묶인 검사들의 고유 검사자 나열
  const examinerNames = [
    ...new Set(
      exams
        .map((e) => examiners[e.examiner_id]?.name)
        .filter((n): n is string => !!n)
    )
  ]
  const examinerLabel = examinerNames.length
    ? examinerNames.map((n) => `${n} 임상심리사`).join(', ')
    : '-'

  const docMeta: DocMeta = {
    headerTitle: '심리평가 보고서',
    clientName: clientLabel,
    // 일정이 없으면 '검사일'이라 부르지 않는다 — 라벨이 값과 맞아야 한다.
    headerSub:
      examDate !== '-' ? `검사일 ${examDate}` : `등록일 ${registeredDate}`,
    footerText: '마인드봄 심리상담센터 · 투사적 심리검사 해석 보조 시스템'
  }

  const blocks: InitialBlock[] = [
    {
      kind: 'cover',
      meta: {
        cover: {
          title: '심리평가 보고서',
          subtitle: 'Comprehensive Psychological Assessment Report',
          info: [
            ['내담자', clientLabel],
            ['성별 / 생년월일', genderBirth],
            ['검사일', examDate],
            ['등록일', registeredDate],
            ['보고일', formatDate(REPORT_DATE)],
            ['검사 항목', examTypeLabel],
            ['검사자', examinerLabel]
          ],
          badge: 'SaMD CLASS Ⅱ',
          footerLines: [
            '마인드봄 심리상담센터',
            `작성일 ${formatDate(REPORT_DATE)}`
          ]
        }
      }
    },
    ...presetBody(),
    {
      kind: 'cover',
      meta: {
        closing: {
          paragraphs: [
            '본 보고서는 마인드봄 AI 해석 보조 시스템이 생성한 초안을 바탕으로 하며, 모든 해석과 최종 진단은 임상심리사의 검토·수정·확인을 거쳐 작성되었습니다.',
            '본 결과는 심리평가의 보조 자료로서, 임상적 판단 및 다른 정보와 종합하여 해석되어야 합니다.'
          ],
          signLabel: '임상심리사',
          signName: primaryExaminer ? `${primaryExaminer.name} (인)` : '(인)'
        }
      }
    }
  ]

  return { docMeta, blocks }
}

/** PDF 파일명 — `종합보고서_홍길동_20260706.pdf` */
export function reportFileName(client: ClientInfo | null): string {
  const name = client?.name ?? '내담자'
  const date = formatDate(REPORT_DATE).replace(/\./g, '') || 'report'
  return `종합보고서_${name}_${date}.pdf`
}
