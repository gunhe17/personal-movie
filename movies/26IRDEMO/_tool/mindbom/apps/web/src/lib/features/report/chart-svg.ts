// 목업 차트 SVG 생성기 — 썸네일(작게)과 본문 삽입(크게) 양쪽에서 쓴다.
// ⚠️ 시연용. 실기능 전환 시 실제 차트 이미지/렌더 결과로 교체.

export type ChartVariant = 'profile' | 'bar' | 'radar' | 'line' | 'table'

/** seed 기반 결정적 의사난수 — Math.random을 쓰면 리렌더마다 모양이 바뀐다 */
function rand(seed: number, i: number): number {
  const x = Math.sin((seed + 1) * 999 + i * 37.7) * 10000
  return x - Math.floor(x)
}

export interface ChartSvgOptions {
  variant: ChartVariant
  color: string
  seed: number
  /** 뷰포트 크기 (기본은 썸네일 비율) */
  width?: number
  height?: number
  /** 배경색. 기본은 흰 종이 — 결과지를 나타내는 그림이라 테마와 무관하게
   *  실제 이미지 썸네일(bg-white)과 톤을 맞춘다. */
  background?: string
  /** 배경이 어두울 때 격자·축·라벨을 밝은 쪽으로 뒤집는다 */
  dark?: boolean
  /** 눈금/축 라벨 표시 (큰 크기에서만 의미 있음) */
  detailed?: boolean
  /** 상단 제목 (detailed일 때만) */
  title?: string
}

/**
 * 차트 SVG를 문자열로 생성한다.
 * viewBox 좌표계는 100x56 고정, width/height는 실제 렌더 크기.
 */
export function buildChartSvg(opts: ChartSvgOptions): string {
  const {
    variant,
    color,
    seed,
    width = 100,
    height = 56,
    background = '#ffffff',
    dark = false,
    detailed = false,
    title = ''
  } = opts

  const W = 100
  const H = 56
  const r = (i: number) => rand(seed, i)

  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="${background}" rx="3"/>`)

  // 밝은 배경이면 선/격자 색을 어둡게 뒤집는다
  const isLight = !dark
  const grid = isLight ? '#e2e8f0' : '#334155'
  const axis = isLight ? '#94a3b8' : '#475569'
  const label = isLight ? '#64748b' : '#94a3b8'

  if (detailed && title) {
    parts.push(
      `<text x="4" y="6" style="font-size:4px;font-weight:700;fill:${isLight ? '#334155' : '#e2e8f0'}">${escapeXml(title)}</text>`
    )
  }
  const top = detailed && title ? 9 : 0

  if (variant === 'profile') {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const x = 6 + (i * (W - 12)) / 9
      const y = H - 8 - (0.25 + r(i) * 0.6) * (H - 18 - top)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    // T=65 임상 유의 기준선
    const refY = (H * 0.42 + top * 0.5).toFixed(1)
    parts.push(
      `<line x1="4" y1="${refY}" x2="${W - 4}" y2="${refY}" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.65"/>`
    )
    if (detailed) {
      parts.push(
        `<text x="${W - 3}" y="${Number(refY) - 1.5}" text-anchor="end" style="font-size:3px;fill:#ef4444">T=65</text>`
      )
      for (const t of [30, 50, 70, 90]) {
        const y = H - 8 - ((t - 20) / 80) * (H - 18 - top)
        parts.push(
          `<line x1="6" y1="${y.toFixed(1)}" x2="${W - 4}" y2="${y.toFixed(1)}" stroke="${grid}" stroke-width="0.3" opacity="0.6"/>`,
          `<text x="4" y="${(y + 1).toFixed(1)}" text-anchor="end" style="font-size:2.6px;fill:${label}">${t}</text>`
        )
      }
    }
    parts.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`
    )
    for (const p of pts) {
      const [x, y] = p.split(',')
      parts.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="${color}"/>`)
    }
  } else if (variant === 'bar') {
    for (let i = 0; i < 6; i++) {
      const h = (0.25 + r(i) * 0.7) * (H - 16 - top)
      parts.push(
        `<rect x="${8 + i * 15}" y="${(H - 8 - h).toFixed(1)}" width="9" height="${h.toFixed(1)}" rx="1.5" fill="${color}" opacity="0.85"/>`
      )
    }
    parts.push(
      `<line x1="4" y1="${H - 8}" x2="${W - 4}" y2="${H - 8}" stroke="${axis}" stroke-width="0.8"/>`
    )
  } else if (variant === 'radar') {
    const cy = H / 2 + top / 2
    const R = 20
    const ring = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
      return `${(W / 2 + Math.cos(a) * R).toFixed(1)},${(cy + Math.sin(a) * R).toFixed(1)}`
    }).join(' ')
    const data = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
      const rr = (0.35 + r(i) * 0.55) * R
      return `${(W / 2 + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`
    }).join(' ')
    parts.push(
      `<polygon points="${ring}" fill="none" stroke="${grid}" stroke-width="0.7"/>`,
      `<polygon points="${data}" fill="${color}" fill-opacity="0.28" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`
    )
  } else if (variant === 'line') {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const x = 6 + (i * (W - 12)) / 7
      const y = H - 8 - (0.2 + r(i + 5) * 0.65) * (H - 18 - top)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    parts.push(
      `<polygon points="${pts} ${W - 6},${H - 8} 6,${H - 8}" fill="${color}" fill-opacity="0.18"/>`,
      `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`
    )
  } else {
    // table — 채점표 미리보기.
    // 예전에는 머리줄 하나 + 통짜 회색 막대 넷이라 **로딩 뼈대처럼** 읽혔다.
    // 부호·값 두 칸으로 나누고 행 구분선을 넣어 "표"로 보이게 한다.
    const x0 = 5
    const w = W - 10
    const valX = x0 + w * 0.62 // 값 칸 시작
    const rowH = 7.2
    const bar = isLight ? '#cbd5e1' : '#475569'
    const rule = isLight ? '#e2e8f0' : '#334155'
    parts.push(
      `<rect x="${x0}" y="${7 + top}" width="${w}" height="6.5" rx="1.5" fill="${color}" opacity="0.85"/>`,
      // 머리줄 안의 두 칸 표시 — 헤더도 표의 일부로 읽히게
      `<rect x="${(valX - 1).toFixed(1)}" y="${7 + top}" width="0.6" height="6.5" fill="#ffffff" opacity="0.55"/>`
    )
    for (let i = 0; i < 5; i++) {
      const y = 16.5 + top + i * rowH
      if (y + 4 > H - 3) break
      parts.push(
        `<line x1="${x0}" y1="${(y + 5).toFixed(1)}" x2="${x0 + w}" y2="${(y + 5).toFixed(1)}" stroke="${rule}" stroke-width="0.4"/>`,
        // 왼쪽: 부호·항목 이름 (길이가 들쭉날쭉)
        `<rect x="${x0 + 1}" y="${y.toFixed(1)}" width="${(w * (0.28 + r(i) * 0.26)).toFixed(1)}" height="4" rx="1" fill="${bar}"/>`,
        // 오른쪽: 값 — 짧고 폭이 고르다
        `<rect x="${valX.toFixed(1)}" y="${y.toFixed(1)}" width="${(w * (0.1 + r(i + 3) * 0.09)).toFixed(1)}" height="4" rx="1" fill="${color}" opacity="0.55"/>`
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${width}" height="${height}" preserveAspectRatio="none">${parts.join('')}</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 본문 삽입용 data URI (흰 배경 + 눈금 표시, 큰 크기) */
/**
 * 본문 삽입용 data URI (흰 배경 + 눈금 표시, 큰 크기).
 *
 * 그림 안에는 제목을 넣지 않는다 — 실제 결과지 이미지와 마찬가지로
 * 제목은 블록의 caption이 담당한다. (그림 안 제목 + 캡션이 겹쳐 보였다)
 */
export function chartDataUri(variant: ChartVariant, color: string, seed: number): string {
  const svg = buildChartSvg({
    variant,
    color,
    seed,
    width: 640,
    height: 358,
    background: '#ffffff',
    detailed: true
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
