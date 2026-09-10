/**
 * 보고서 표지/마무리 블록 렌더러 (DOM 생성).
 *
 * 기존 PDF 서식(apps/api/app/templates/*_report.html)의 .cover 디자인을
 * 화면 에디터에서 그대로 재현한다. 에디터는 DOM을 직접 조작하므로
 * Svelte 컴포넌트가 아니라 순수 DOM 팩토리로 제공한다.
 *
 * cover 블록은 편집 불가(잠긴 블록). meta.cover에 표지 데이터를 싣는다.
 */

export interface CoverData {
  /** 상단 영문 브랜드 (기본 MINDBOM) */
  brand?: string
  /** 브랜드 한글 부제 */
  brandKo?: string
  /** 큰 제목 (예: '심리평가 보고서') */
  title: string
  /** 영문/부제 */
  subtitle?: string
  /** info 행들: [라벨, 값] */
  info?: Array<[string, string]>
  /** 하단 배지 문구 (예: 'SaMD CLASS II') */
  badge?: string
  /** 하단 우측 기관/작성 정보 여러 줄 */
  footerLines?: string[]
}

export interface ClosingData {
  /** 마무리 문단들 */
  paragraphs: string[]
  /** 서명란 라벨 (예: '임상심리사') */
  signLabel?: string
  signName?: string
}

/** cover 블록의 meta 형태 */
export interface CoverMeta {
  cover?: CoverData
  closing?: ClosingData
}

/** 본문 페이지 머리말/꼬리말 데이터 (내담자·센터 정보) */
export interface DocMeta {
  /** 헤더 좌측 제목 (예: '심리평가 보고서') */
  headerTitle?: string
  /** 헤더 우측 내담자명 */
  clientName?: string
  /** 헤더 우측 보조(검사일 등) */
  headerSub?: string
  /** 푸터 문구 (센터/생성일 등) */
  footerText?: string
}

function div(cls: string, text?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = cls
  if (text != null) el.textContent = text
  return el
}

/** 표지 DOM 생성 */
export function makeCoverEl(data: CoverData): HTMLDivElement {
  const root = div('rpt-cover')
  const inner = div('rpt-cover-inner')

  inner.appendChild(div('rpt-cover-brand', data.brand ?? 'MINDBOM'))
  inner.appendChild(
    div('rpt-cover-brand-ko', data.brandKo ?? '마인드봄 · 투사적 심리검사 해석 보조 시스템')
  )
  inner.appendChild(div('rpt-cover-divider'))
  inner.appendChild(div('rpt-cover-title', data.title))
  if (data.subtitle) inner.appendChild(div('rpt-cover-subtitle', data.subtitle))

  // spacer를 제목/부제 다음에 둬서 검사정보·footer를 표지 아래쪽으로 민다
  inner.appendChild(div('rpt-cover-spacer'))

  if (data.info?.length) {
    const block = div('rpt-cover-info')
    for (const [label, value] of data.info) {
      const row = div('rpt-cover-row')
      row.appendChild(div('rpt-cover-label', label))
      row.appendChild(div('rpt-cover-value', value))
      block.appendChild(row)
    }
    inner.appendChild(block)
  }

  const footer = div('rpt-cover-footer')
  const left = div('rpt-cover-footer-left')
  if (data.badge) left.appendChild(div('rpt-cover-badge', data.badge))
  footer.appendChild(left)
  if (data.footerLines?.length) {
    const right = div('rpt-cover-footer-right')
    for (const line of data.footerLines) right.appendChild(div('', line))
    footer.appendChild(right)
  }
  inner.appendChild(footer)

  root.appendChild(inner)
  return root
}

/** 마무리(마지막 장) DOM 생성.
 *  본문 문단은 페이지 정중앙, 서명란은 페이지 하단에 배치된다. */
export function makeClosingEl(data: ClosingData): HTMLDivElement {
  const root = div('rpt-closing')

  // 본문: 남는 공간을 채우며 세로 가운데 정렬 → 페이지 정중앙
  const bodyWrap = div('rpt-closing-body')
  for (const p of data.paragraphs) bodyWrap.appendChild(div('rpt-closing-p', p))
  root.appendChild(bodyWrap)

  // 서명란: 페이지 하단
  if (data.signLabel || data.signName) {
    const sign = div('rpt-closing-sign')
    sign.appendChild(div('rpt-closing-sign-label', data.signLabel ?? ''))
    sign.appendChild(div('rpt-closing-sign-name', data.signName ?? ''))
    root.appendChild(sign)
  }
  return root
}

/** 본문 페이지 머리말 DOM (기존 PDF .page-header 톤) */
export function makePageHeaderEl(meta: DocMeta): HTMLDivElement {
  const header = div('rpt-page-header')
  header.appendChild(div('rpt-page-header-title', meta.headerTitle ?? '심리평가 보고서'))
  const right = div('rpt-page-header-meta')
  if (meta.clientName) right.appendChild(div('rpt-page-header-name', meta.clientName))
  if (meta.headerSub) right.appendChild(div('', meta.headerSub))
  header.appendChild(right)
  return header
}

/** 본문 페이지 꼬리말 DOM (기존 PDF .report-footer 톤) */
export function makePageFooterEl(meta: DocMeta): HTMLDivElement {
  return div(
    'rpt-page-footer',
    meta.footerText ?? '마인드봄 (MindBom) · 투사적 심리검사 해석 보조 시스템'
  )
}
