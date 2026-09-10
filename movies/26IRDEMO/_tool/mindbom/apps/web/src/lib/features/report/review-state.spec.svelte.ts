/**
 * 리뷰 상태머신의 회귀 방지.
 *
 * 이 둘은 route에서 뽑아낸 것이라 "옮기면서 반응성이 끊기지 않았는지"가
 * 핵심이다. $state를 getter로 감싸 내보내는데, 그 getter를 통해 읽어도
 * $effect가 다시 도는지를 실제로 관찰한다(타입체크로는 잡히지 않는다).
 *
 * 타이머 취소도 함께 본다 — 닫은 뒤에 예약된 콜백이 뒤늦게 상태를
 * 덮어쓰는 종류의 버그는 눈으로 보기 어렵다.
 */
import { describe, it, expect, vi } from 'vitest'
import { flushSync } from 'svelte'
import { createOverallReview } from './overall-review.svelte'
import { createSpanReview } from './span-review.svelte'
import type { ReviewBlock } from './overall-review'

const blocks: ReviewBlock[] = [
  { id: 'b1', text: 'Ⅳ. 검사 결과', isHeading: true },
  {
    id: 'b2',
    text: '내담자는 매우 우울한 것으로 보여진다. 환자의 상태가 그러하다.',
    isHeading: false
  }
]

describe('종합 리뷰 상태머신', () => {
  it('run → analyzing → result로 가고, getter로 읽어도 반응형이 산다', () => {
    vi.useFakeTimers()
    const o = createOverallReview(() => blocks)

    const cleanup = $effect.root(() => {
      const seen: string[] = []
      $effect(() => {
        seen.push(`${o.phase}:${o.step}`)
      })
      flushSync()

      expect(o.open).toBe(false)
      expect(o.phase).toBe('idle')

      o.run()
      flushSync()
      expect(o.open).toBe(true)
      expect(o.phase).toBe('analyzing')

      vi.advanceTimersByTime(10_000)
      flushSync()
      expect(o.phase).toBe('result')
      expect(o.review).not.toBeNull()

      // effect가 여러 번 돌았다 = 파일을 넘어서도 반응형이 이어진다.
      // (한 번만 돌았다면 초기값만 읽고 끝난 것이다)
      expect(seen.length).toBeGreaterThan(2)
      return () => {}
    })
    cleanup()
    vi.useRealTimers()
  })

  it('close()가 예약된 타이머를 취소한다 — 닫은 뒤 result로 넘어가지 않는다', () => {
    vi.useFakeTimers()
    const o = createOverallReview(() => blocks)
    o.run()
    o.close()
    vi.advanceTimersByTime(10_000)
    expect(o.open).toBe(false)
    expect(o.phase).toBe('analyzing')
    vi.useRealTimers()
  })

  it('destroy()가 타이머를 남기지 않는다', () => {
    vi.useFakeTimers()
    const o = createOverallReview(() => blocks)
    o.run()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    o.destroy()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('refresh()는 진행 애니메이션 없이 결과만 갱신한다', () => {
    vi.useFakeTimers()
    const o = createOverallReview(() => blocks)
    o.refresh()
    expect(o.phase).toBe('result')
    expect(o.review).not.toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})

describe('구간 리뷰 상태머신', () => {
  it('prompt → run → 900ms → result', () => {
    vi.useFakeTimers()
    const s = createSpanReview()
    expect(s.phase).toBe('idle')

    s.prompt('매우 우울한', { x: 100, y: 200 }, null)
    expect(s.phase).toBe('prompt')
    expect(s.text).toBe('매우 우울한')
    expect(s.x).toBe(100)
    expect(s.y).toBe(200)

    s.run()
    expect(s.phase).toBe('analyzing')
    vi.advanceTimersByTime(900)
    expect(s.phase).toBe('result')
    vi.useRealTimers()
  })

  it('close()가 예약된 분석을 취소한다', () => {
    vi.useFakeTimers()
    const s = createSpanReview()
    s.prompt('x', { x: 0, y: 0 }, null)
    s.run()
    s.close()
    vi.advanceTimersByTime(900)
    expect(s.phase).toBe('idle')
    vi.useRealTimers()
  })

  it('범위는 보관했다가 clearRange()로 비운다', () => {
    const s = createSpanReview()
    const range = {
      start: { paraId: 'p1', offset: 0 },
      end: { paraId: 'p1', offset: 3 }
    }
    s.prompt('abc', { x: 0, y: 0 }, range)
    expect(s.currentRange()).toEqual(range)
    s.clearRange()
    expect(s.currentRange()).toBeNull()
  })
})
