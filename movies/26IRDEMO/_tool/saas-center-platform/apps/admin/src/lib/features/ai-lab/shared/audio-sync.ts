/**
 * 오디오 싱크 유틸리티
 * 타임스탬프 기반 세그먼트 파싱/탐색/진행률 계산
 */

// ── 세그먼트 타입 ──

export interface SyncSegment {
  speaker: string
  text: string
  start: number
  end: number
}

/**
 * JSON 문자열에서 싱크 가능한 세그먼트 배열을 추출.
 * 두 가지 포맷 지원:
 *   - 배열: [{speaker, text, start, end}, ...]  (refined_transcript)
 *   - 객체: {text, segments: [...]}              (output_json)
 * 타임스탬프가 유효하지 않으면 null 반환 (싱크 불가 → 일반 텍스트 모드).
 */
export function parseSyncSegments(jsonStr: string | null | undefined): SyncSegment[] | null {
  if (!jsonStr) return null
  try {
    const parsed = JSON.parse(jsonStr)
    const segments: unknown[] = Array.isArray(parsed) ? parsed : parsed?.segments
    if (!Array.isArray(segments) || segments.length === 0) return null

    const mapped: SyncSegment[] = segments.map((s) => {
      const seg = s as Record<string, unknown>
      return {
        speaker: (seg.speaker ?? seg.speaker_id ?? '?') as string,
        text: (seg.text ?? '') as string,
        start: typeof seg.start === 'number' ? seg.start : 0,
        end: typeof seg.end === 'number' ? seg.end : 0,
      }
    })

    // 타임스탬프 유효성: 최소 1개 세그먼트가 start > 0 또는 end > 0
    const hasTimestamps = mapped.some((s) => s.start > 0 || s.end > 0)
    return hasTimestamps ? mapped : null
  } catch {
    return null
  }
}

/**
 * 이진 탐색으로 현재 시간에 해당하는 세그먼트 인덱스를 찾음.
 * 매칭되는 세그먼트가 없으면 -1 반환 (세그먼트 간 갭 구간).
 */
export function findActiveSegment(segments: SyncSegment[], currentTime: number): number {
  let lo = 0
  let hi = segments.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].end <= currentTime) {
      lo = mid + 1
    } else if (segments[mid].start > currentTime) {
      hi = mid - 1
    } else {
      return mid
    }
  }
  return -1
}

/** 세그먼트 내 진행률 (0~1) */
export function getSegmentProgress(segment: SyncSegment, currentTime: number): number {
  const dur = segment.end - segment.start
  if (dur <= 0) return 0
  return Math.min(1, Math.max(0, (currentTime - segment.start) / dur))
}
