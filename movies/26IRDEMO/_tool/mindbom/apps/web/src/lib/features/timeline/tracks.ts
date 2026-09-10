import type { TimelineItem } from './types'

export interface PackedItem {
  item: TimelineItem
  /** 카드 좌측 x(px) */
  left: number
  track: number
}

export interface OverflowGroup {
  /** 넘친 카드들이 놓였어야 할 위치의 대표 x(px) */
  left: number
  items: TimelineItem[]
}

export interface PackResult {
  placed: PackedItem[]
  /**
   * 트랙 상한을 넘겨 접힌 항목들.
   * 칩은 카드 트랙이 아니라 그 아래 전용 행에 놓인다.
   */
  overflow: OverflowGroup[]
  /** 카드가 실제로 사용한 트랙 수 (1 이상) */
  trackCount: number
}

export interface PackOptions {
  cardWidthPx: number
  minGapPx: number
  maxTracks: number
  viewportWidth: number
  /**
   * 위아래 트랙에 놓인 카드끼리 최소한 이만큼은 가로로 어긋나게 한다.
   *
   * 트랙이 다르면 논리적으로는 안 겹치지만, 같은 시각에 몰린 카드들이
   * 몇 px 차이로 층층이 쌓이면 거의 포개져 보여서 앞 카드의 내용이 가려진다.
   * 시각을 조금 왜곡하더라도 읽히는 쪽을 택한다.
   */
  minStaggerPx: number
}

/**
 * 시간축 위에 고정폭 카드를 얹는다.
 *
 * 정렬은 반드시 위치 오름차순이다 — 그리디 트랙 패킹은 "왼쪽부터 순서대로"를
 * 전제로 `trackEnds`를 갱신하므로, 다른 키(예: 긴급도)로 섞으면 겹치지도 않는
 * 카드가 새 트랙을 만들며 높이가 부풀어 오른다.
 * 긴급도는 트랙 위치가 아니라 카드의 상태 색으로 드러낸다.
 *
 * 트랙이 maxTracks를 넘으면 더 쌓지 않고 overflow로 접는다 —
 * 대시보드 위젯은 높이 예산이 고정이라 세로로 자랄 수 없다.
 */
export function packDay(
  items: TimelineItem[],
  timeToX: (t: Date) => number,
  { cardWidthPx, minGapPx, maxTracks, viewportWidth, minStaggerPx }: PackOptions
): PackResult {
  const half = cardWidthPx / 2
  const maxLeft = Math.max(0, viewportWidth - cardWidthPx)

  const positioned = items
    .map((item) => {
      // 카드 폭은 고정 — 담는 정보(이름·상태)가 검사 소요 시간과 무관하다.
      // 시간축을 따르는 건 위치뿐.
      const anchorX = timeToX(item.when.anchorAt)
      // 뷰포트 양끝에서 카드가 잘리지 않게 안쪽으로 붙인다
      const left = clamp(anchorX - half, 0, maxLeft)
      return { item, left, anchorX }
    })
    .sort((a, b) => a.left - b.left || a.anchorX - b.anchorX)

  const trackEnds: number[] = []
  const placed: PackedItem[] = []
  const overflowByTrack: TimelineItem[][] = []
  const overflowChipLeft: number[] = []
  // 트랙별로 마지막에 놓인 카드의 left — stagger 판정에 쓴다
  const trackLastLeft: number[] = []

  for (const p of positioned) {
    // 이미 놓인 카드와 minStagger 이상 어긋나게 민다.
    // 정렬이 left 오름차순이므로 기본 방향은 오른쪽.
    let left = p.left
    for (const prev of trackLastLeft) {
      if (prev === undefined) continue
      if (Math.abs(left - prev) < minStaggerPx) left = prev + minStaggerPx
    }

    // 뷰포트 오른쪽 끝에 닿으면 더 밀 수 없다 → 이번엔 왼쪽으로 밀어
    // 간격을 확보한다. 하루의 마지막 시간대에 검사가 몰린 날이 이 경우.
    if (left > maxLeft) {
      left = maxLeft
      for (let i = trackLastLeft.length - 1; i >= 0; i--) {
        const prev = trackLastLeft[i]
        if (prev === undefined) continue
        if (Math.abs(left - prev) < minStaggerPx) left = prev - minStaggerPx
      }
    }
    left = clamp(left, 0, maxLeft)

    let track = -1
    for (let t = 0; t < trackEnds.length; t++) {
      if (left >= trackEnds[t] + minGapPx) {
        track = t
        break
      }
    }

    if (track === -1) {
      if (trackEnds.length < maxTracks) {
        track = trackEnds.length
        trackEnds.push(left + cardWidthPx)
        trackLastLeft.push(left)
      } else {
        // 상한 초과 — 접는다.
        //
        // 칩은 카드 트랙을 쓰지 않고 전용 행(chipRow)에 놓인다.
        // 칩은 "마지막 트랙이 꽉 찬 뒤"에야 존재를 알 수 있어서, 카드 트랙 안에
        // 자리를 예약하려 해도 이미 그 자리에 카드가 놓인 뒤다. 행을 분리해야
        // 순서에 상관없이 겹치지 않는다.
        const openChip = overflowChipLeft.findIndex(
          (chipLeft: number | undefined) =>
            chipLeft !== undefined && left < chipLeft + cardWidthPx
        )

        if (openChip !== -1) {
          // 이미 열린 칩의 사정권 — 거기에 합류
          overflowByTrack[openChip].push(p.item)
        } else {
          const idx = overflowByTrack.length
          overflowByTrack[idx] = [p.item]
          overflowChipLeft[idx] = left
        }
        continue
      }
    } else {
      trackEnds[track] = left + cardWidthPx
      trackLastLeft[track] = left
    }

    placed.push({ item: p.item, left, track })
  }

  const overflow: OverflowGroup[] = []
  for (let t = 0; t < overflowByTrack.length; t++) {
    const bucket = overflowByTrack[t]
    if (bucket?.length) {
      overflow.push({ left: overflowChipLeft[t], items: bucket })
    }
  }

  return {
    placed,
    overflow,
    trackCount: Math.max(1, trackEnds.length)
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
