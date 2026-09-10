/**
 * 백엔드 StructuralSummary → 참고 디자인 UpperSection 데이터 변환.
 *
 * 우리 백엔드는 raw count(M의 경우 Ma/Mp/Ma-p로 세분)이고
 * 참고 디자인은 단일 키(M)로 묶음. 변환 시 합산/분류.
 */
import type { ServerSpecialIndex, StructuralSummary } from './actions'
import { RORSCHACH_CARDS } from './constants'

function sumKeys(src: Record<string, number>, keys: string[]): number {
  let s = 0
  for (const k of keys) s += src[k] ?? 0
  return s
}

/** Determinants raw → 참고 디자인 단일 키 (M, FM, m, FC, ...). */
function mapDeterminants(raw: Record<string, number>): Record<string, number> {
  return {
    M: sumKeys(raw, ['Ma', 'Mp', 'Ma-p']),
    FM: sumKeys(raw, ['FMa', 'FMp', 'FMa-p']),
    // 무생물운동 — 다른 범주와 **같은 방식**으로 키를 나열해 센다.
    //
    // ⚠️ 예전에는 `k.startsWith("m'")`였다. 어휘가 `m'a`였을 때의 임시방편인데,
    // 표기를 워크북대로 `ma`로 고치면 **조용히 0이 된다**. 위 M·FM처럼
    // 어휘를 적어두면 어휘가 바뀔 때 여기도 같이 눈에 띈다.
    m: sumKeys(raw, ['ma', 'mp', 'ma-p']),
    FC: raw.FC ?? 0,
    CF: raw.CF ?? 0,
    C: raw.C ?? 0,
    Cn: raw.Cn ?? 0,
    "FC'": raw["FC'"] ?? 0,
    "C'F": raw["C'F"] ?? 0,
    "C'": raw["C'"] ?? 0,
    FT: raw.FT ?? 0,
    TF: raw.TF ?? 0,
    T: raw.T ?? 0,
    FV: raw.FV ?? 0,
    VF: raw.VF ?? 0,
    V: raw.V ?? 0,
    FY: raw.FY ?? 0,
    YF: raw.YF ?? 0,
    Y: raw.Y ?? 0,
    Fr: raw.Fr ?? 0,
    rF: raw.rF ?? 0,
    FD: raw.FD ?? 0,
    F: raw.F ?? 0,
  }
}

/** SUM6, WSUM6 계산 (DV1+DV2+INCOM1+INCOM2+DR1+DR2+FABCOM1+FABCOM2+ALOG+CONTAM, 가중합) */
function calcSum6(special: Record<string, number>): { SUM6: number; WSUM6: number } {
  const keys = ['DV1', 'DV2', 'INCOM1', 'INCOM2', 'DR1', 'DR2', 'FABCOM1', 'FABCOM2', 'ALOG', 'CONTAM']
  const weights: Record<string, number> = {
    DV1: 1, DV2: 2, INCOM1: 2, INCOM2: 4, DR1: 3, DR2: 6,
    FABCOM1: 4, FABCOM2: 7, ALOG: 5, CONTAM: 7,
  }
  let sum = 0
  let wsum = 0
  for (const k of keys) {
    const v = special[k] ?? 0
    sum += v
    wsum += v * (weights[k] ?? 0)
  }
  return { SUM6: sum, WSUM6: wsum }
}

export interface UpperSectionData {
  location: {
    Zf: number
    ZSum: number
    ZEst: number
    W: number
    D: number
    'W+D': number
    Dd: number
    S: number
  }
  dq: { '+': number; o: number; 'v/+': number; v: number }
  single: Record<string, number>
  determinants: Record<string, number>
  content: Record<string, number>
  fq: {
    FQx: { '+': number; o: number; u: number; '-': number; none: number }
    MQual: { '+': number; o: number; u: number; '-': number; none: number }
    'W+D': { '+': number; o: number; u: number; '-': number; none: number }
  }
  blends: string[][]
  approach: Record<string, string[]>
  special: Record<string, number | null>
}

export function mapToUpperSection(s: StructuralSummary): UpperSectionData {
  const det = mapDeterminants(s.determinants)
  const { SUM6, WSUM6 } = calcSum6(s.special_scores)

  // FQ — 우리 백엔드는 FQx만 계산. MQual/W+D는 0 placeholder (Phase 4 확장 전)
  const emptyFQ = { '+': 0, o: 0, u: 0, '-': 0, none: 0 }
  const fqx = {
    '+': s.fq['+'] ?? 0,
    o: s.fq.o ?? 0,
    u: s.fq.u ?? 0,
    '-': s.fq['-'] ?? 0,
    none: s.fq.none ?? 0,
  }

  // Blends "Ma.FC" → ["Ma","FC"]
  const blends = s.blends.map(b => b.split('.'))

  // Approach 1..10 → "I"..."X"
  const approach: Record<string, string[]> = {}
  for (const [cardNo, locs] of Object.entries(s.approach)) {
    const idx = Number(cardNo) - 1
    if (idx >= 0 && idx < 10) approach[RORSCHACH_CARDS[idx]] = locs
  }
  // 빈 카드도 키 채워두기 (UI에서 항상 10개 행)
  for (const r of RORSCHACH_CARDS) if (!(r in approach)) approach[r] = []

  // Special — SUM6/WSUM6 합치고 GHR/PHR/CP는 데이터 없으면 null
  const special: Record<string, number | null> = {
    DV1: s.special_scores.DV1 ?? 0,
    DV2: s.special_scores.DV2 ?? 0,
    INCOM1: s.special_scores.INCOM1 ?? 0,
    INCOM2: s.special_scores.INCOM2 ?? 0,
    DR1: s.special_scores.DR1 ?? 0,
    DR2: s.special_scores.DR2 ?? 0,
    FABCOM1: s.special_scores.FABCOM1 ?? 0,
    FABCOM2: s.special_scores.FABCOM2 ?? 0,
    ALOG: s.special_scores.ALOG ?? 0,
    CONTAM: s.special_scores.CONTAM ?? 0,
    SUM6,
    WSUM6,
    AB: s.special_scores.AB ?? 0,
    AG: s.special_scores.AG ?? 0,
    COP: s.special_scores.COP ?? 0,
    CP: s.special_scores.CP ?? 0,
    GHR: null,
    PHR: null,
    MOR: s.special_scores.MOR ?? 0,
    PER: s.special_scores.PER ?? 0,
    PSV: s.special_scores.PSV ?? 0,
  }

  return {
    location: {
      Zf: s.Zf,
      ZSum: s.ZSum,
      ZEst: s.ZEst,
      W: s.location.W ?? 0,
      D: s.location.D ?? 0,
      'W+D': s.location['W+D'] ?? 0,
      Dd: s.location.Dd ?? 0,
      S: s.location.S ?? 0,
    },
    dq: {
      '+': s.dq['+'] ?? 0,
      o: s.dq.o ?? 0,
      'v/+': s.dq['v/+'] ?? 0,
      v: s.dq.v ?? 0,
    },
    // single 데이터 부족 — Determinants 동일 값으로 placeholder + (2)는 백엔드 확장 전 0
    single: { ...det, '(2)': 0 },
    determinants: det,
    content: s.contents,
    fq: { FQx: fqx, MQual: { ...emptyFQ }, 'W+D': { ...emptyFQ } },
    blends,
    approach,
    special,
  }
}

// === Phase 4-3 / 4-4: Lower & Special — 패스스루 ===

export type LowerSectionData = Record<string, Record<string, number | string>>
export type SpecialIndicesData = Record<string, ServerSpecialIndex>

export function mapToLowerSection(s: StructuralSummary): LowerSectionData {
  return s.lower_section
}

export function mapToSpecialIndices(s: StructuralSummary): SpecialIndicesData {
  return s.special_indices
}
