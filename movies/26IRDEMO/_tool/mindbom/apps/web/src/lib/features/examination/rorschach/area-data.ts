/**
 * 표준 영역 데이터 로더 + 매칭 유틸.
 *
 * 영역 JSON은 `static/rorschach/areas/card-{n}.json` 에 있고, normalized 좌표(0..1).
 */
import type { Point } from './types'

export type AreaType = 'W' | 'D' | 'Dd' | 'DdS'

export interface StandardArea {
  code: string
  name: string
  type: AreaType
  /** Normalized 좌표 (0..1) polygon */
  path: { x: number; y: number }[]
}

export interface CardAreaData {
  cardNo: number
  areas: StandardArea[]
}

const CACHE = new Map<number, CardAreaData | null>()

/** 카드 영역 데이터 fetch. 없으면 null 반환. */
export async function loadCardAreas(cardNo: number): Promise<CardAreaData | null> {
  if (CACHE.has(cardNo)) return CACHE.get(cardNo)!
  try {
    const res = await fetch(`/rorschach/areas/card-${cardNo}.json`)
    if (!res.ok) {
      CACHE.set(cardNo, null)
      return null
    }
    const data = (await res.json()) as CardAreaData
    CACHE.set(cardNo, data)
    return data
  } catch {
    CACHE.set(cardNo, null)
    return null
  }
}

function toNorm(p: Point, vbW: number, vbH: number): Point {
  return { x: p.x / vbW, y: p.y / vbH }
}

function centroid(path: Point[]): Point {
  if (path.length === 0) return { x: 0.5, y: 0.5 }
  let sx = 0, sy = 0
  for (const p of path) { sx += p.x; sy += p.y }
  return { x: sx / path.length, y: sy / path.length }
}

function bbox(path: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (path.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of path) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Polygon IoU — 라이브러리 없이 래스터화 기반.
 *
 * 외부 의존성 없이 비-convex/구멍/자기교차까지 모두 처리하기 위해
 * 두 polygon을 동일 그리드에 마스크화한 뒤 픽셀 카운트로 IoU 계산.
 * 표준 영역 마스크는 객체 reference로 캐싱(WeakMap) — 매 프레임 재계산 방지.
 */
const RASTER_SIZE = 128
const standardMaskCache = new WeakMap<StandardArea, Uint8Array>()

function pointInPolygon(x: number, y: number, path: Point[]): boolean {
  let inside = false
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const xi = path[i].x, yi = path[i].y
    const xj = path[j].x, yj = path[j].y
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

function rasterize(path: Point[], size: number): Uint8Array {
  const mask = new Uint8Array(size * size)
  if (path.length < 3) return mask
  const b = bbox(path)
  const x0 = Math.max(0, Math.floor(b.minX * size))
  const x1 = Math.min(size, Math.ceil(b.maxX * size))
  const y0 = Math.max(0, Math.floor(b.minY * size))
  const y1 = Math.min(size, Math.ceil(b.maxY * size))
  for (let py = y0; py < y1; py++) {
    const y = (py + 0.5) / size
    const row = py * size
    for (let px = x0; px < x1; px++) {
      const x = (px + 0.5) / size
      if (pointInPolygon(x, y, path)) mask[row + px] = 1
    }
  }
  return mask
}

function maskIoU(a: Uint8Array, b: Uint8Array): number {
  let inter = 0
  let union = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai && bi) inter++
    if (ai || bi) union++
  }
  return union > 0 ? inter / union : 0
}

function getStandardMask(area: StandardArea): Uint8Array {
  let mask = standardMaskCache.get(area)
  if (!mask) {
    mask = rasterize(area.path, RASTER_SIZE)
    standardMaskCache.set(area, mask)
  }
  return mask
}

export interface AreaMatch {
  area: StandardArea
  /** 일치도 0..1 (높을수록 일치) */
  score: number
}

/**
 * 그려진 path와 카드의 표준 영역 비교.
 *
 * @param path 가상 좌표 (vbW × vbH 범위) polygon
 * @param vbW path 좌표계 너비
 * @param vbH path 좌표계 높이
 * @param areas 표준 영역 (normalized 0..1)
 * @param topN 상위 후보 수
 */
export function matchAreas(
  path: Point[],
  vbW: number,
  vbH: number,
  areas: StandardArea[],
  topN = 3,
): AreaMatch[] {
  if (path.length === 0 || areas.length === 0) return []

  const drawnNorm = path.map(p => toNorm(p, vbW, vbH))
  if (drawnNorm.length < 3) return []
  const drawnMask = rasterize(drawnNorm, RASTER_SIZE)
  const drawnCenter = centroid(drawnNorm)

  const scored: AreaMatch[] = areas.map(area => {
    const aMask = getStandardMask(area)
    const aCenter = centroid(area.path)

    const iou = maskIoU(drawnMask, aMask)
    const dx = drawnCenter.x - aCenter.x
    const dy = drawnCenter.y - aCenter.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const distScore = Math.max(0, 1 - dist * 1.5)

    const score = iou * 0.6 + distScore * 0.4
    return { area, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.filter(m => m.score >= 0.05).slice(0, topN)
}
