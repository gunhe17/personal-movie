/**
 * PDF 텍스트층 → 정규화 문자열 + 글자별 출처 대응표.
 *
 * 뷰어가 quote_pdf 를 찾아 강조할 때, 조각(span) 통째가 아니라 글자 단위로 칠하려면
 * "정규화 문자열의 i번째 글자가 원본 조각 어디서 왔는지"를 알아야 한다.
 *
 * 정규화 규칙은 백엔드 quote_snapping._norm 과 짝 — NFKC + 가운뎃점 통일.
 * (뷰어는 추가로 공백 제거·소문자화: 줄바꿈으로 쪼개진 조각을 잇기 위함)
 */

const MID_DOTS = /[·･・ㆍ‧∙•]/g

export function norm(s: string): string {
  return s.normalize('NFKC').replace(MID_DOTS, '·').replace(/\s+/g, '').toLowerCase()
}

/** 정규화 문자열의 한 글자가 온 곳 — 원본 조각과 그 안의 [start, end) 구간 */
export type Anchor<T> = { source: T; start: number; end: number }

export type CharMap<T> = { text: string; map: Anchor<T>[] }

/**
 * 조각들을 이어 정규화 문자열을 만들고, 글자마다 출처를 남긴다.
 * 불변식: `map.length === text.length`.
 */
export function buildCharMap<T>(chunks: { source: T; text: string }[]): CharMap<T> {
  let text = ''
  const map: Anchor<T>[] = []

  for (const { source, text: raw } of chunks) {
    const per: Anchor<T>[] = []
    let piece = ''
    for (let i = 0; i < raw.length; i++) {
      const n = norm(raw[i])
      piece += n
      for (let k = 0; k < n.length; k++) per.push({ source, start: i, end: i + 1 })
    }

    // 글자별 NFKC 는 자모 결합(ᄒ+ᅡ+ᆫ → 한)을 못 한다. 통짜 정규화와 어긋나는 조각은
    // 글자 단위를 포기하고 조각 전체를 앵커한다 — 종전(조각 통째) 동작으로 안전 격하.
    const whole = norm(raw)
    if (piece === whole) {
      text += piece
      for (const a of per) map.push(a)
    } else {
      text += whole
      for (let k = 0; k < whole.length; k++) map.push({ source, start: 0, end: raw.length })
    }
  }

  return { text, map }
}

/** 정규화 문자열에서 needle 이 나오는 모든 구간 [lo, hi) */
export function findAll(haystack: string, needle: string): [number, number][] {
  const out: [number, number][] = []
  if (!needle) return out
  let at = haystack.indexOf(needle)
  while (at >= 0) {
    out.push([at, at + needle.length])
    at = haystack.indexOf(needle, at + needle.length)
  }
  return out
}

/** 강조 폴백용 — 의미 있는 최장 토큰(3자 이상, 순수 숫자 제외) */
export function longestToken(s: string): string | null {
  const toks = s
    .split(/[\s,./()[\]{}~·、，。:;|"'`%]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t))
  if (!toks.length) return null
  return toks.reduce((a, b) => (b.length > a.length ? b : a))
}
