import { describe, it, expect } from 'vitest'
import seed from '../../plans/plan-42a3a371.json'
import { parsePlan, parseSelection, restoreDraft } from './schema'
import {
  reviewItems,
  reviewStatus,
  reviewDiff,
  setContentReview,
  parseContentReviews,
  nextUnreviewed
} from './content-review'
import { selectionFingerprint } from './comparison'
import { reviewMap } from './review-map'
const plan = parsePlan(seed)
describe('item content review', () => {
  it('records adoption without changing scope, policy or implementation comparison', () => {
    const draft = restoreDraft(null, plan)
    const before = JSON.stringify(draft)
    const item = reviewItems(plan, draft)[1]
    const reviews = setContentReview([], item, 'accepted', '내용 확인')
    expect(reviewStatus(item, reviews)).toBe('accepted')
    expect(JSON.stringify(draft)).toBe(before)
    expect(
      selectionFingerprint({ ...draft, contentReviews: reviews }, plan)
    ).toBe(selectionFingerprint(draft, plan))
  })
  it('marks only changed content stale and shows previous/current values', () => {
    const draft = restoreDraft(null, plan)
    const items = reviewItems(plan, draft)
    const reviews = items.reduce(
      (r, item) => setContentReview(r, item, 'accepted', ''),
      [] as ReturnType<typeof parseContentReviews>
    )
    const changed = structuredClone(plan)
    changed.audit!.cases[0].feedback = '제출 상태를 확인 중이에요.'
    const next = reviewItems(changed, draft)
    expect(
      next.filter((i) => reviewStatus(i, reviews) === 'stale').map((i) => i.key)
    ).toEqual(['case/' + changed.audit!.cases[0].id])
    const item = next.find((i) => reviewStatus(i, reviews) === 'stale')!
    expect(
      reviewDiff(
        item,
        reviews.find((r) => r.key === item.key)
      )
    ).toEqual([
      {
        label: '사용자 안내',
        before: plan.audit!.cases[0].feedback,
        after: changed.audit!.cases[0].feedback
      }
    ])
  })
  it('reopens affected feature when scope or effect changes', () => {
    const draft = restoreDraft(null, plan)
    const item = reviewItems(plan, draft).find((i) => i.kind === 'feature')!
    const reviews = setContentReview([], item, 'accepted', '')
    draft.items[0].choice = 'exclude'
    expect(
      reviewStatus(
        reviewItems(plan, draft).find((i) => i.key === item.key)!,
        reviews
      )
    ).toBe('stale')
  })
  it('requires a change reason and advances to new or stale items, wrapping once', () => {
    const items = reviewItems(plan, restoreDraft(null, plan)).slice(0, 3)
    expect(() => setContentReview([], items[0], 'changes', '  ')).toThrow(
      '이유'
    )
    let reviews = setContentReview([], items[1], 'deferred', '정책 확인')
    expect(nextUnreviewed(items, reviews, items[0].key)).toBe(items[2].key)
    expect(nextUnreviewed(items, reviews, items[2].key)).toBe(items[0].key)
    reviews = setContentReview(reviews, items[0], 'changes', '조건 보완')
    expect(nextUnreviewed(items, reviews, items[2].key)).toBeUndefined()
  })
  it('roundtrips review snapshots and salvages valid local entries independently', () => {
    const draft = restoreDraft(null, plan)
    const reviews = setContentReview(
      [],
      reviewItems(plan, draft)[0],
      'accepted',
      '합의한 목적'
    )
    expect(
      parseSelection({ ...draft, contentReviews: reviews }, plan).contentReviews
    ).toEqual(reviews)
    expect(
      restoreDraft(
        { ...draft, contentReviews: [{ key: 'invalid' }, ...reviews] },
        plan
      ).contentReviews
    ).toEqual(reviews)
    expect(restoreDraft(draft, plan).contentReviews).toBeUndefined()
    expect(() => parseContentReviews([...reviews, ...reviews])).toThrow('ID')
    expect(() =>
      parseContentReviews([{ ...reviews[0], status: 'changes', note: '' }])
    ).toThrow('의견')
    expect(() =>
      parseContentReviews([{ ...reviews[0], snapshot: '{}' }])
    ).toThrow('스냅샷')
  })
  it('lays out every detail node inside bounds and only connects declared relationships', () => {
    const items = reviewItems(plan, restoreDraft(null, plan))
    const map = reviewMap(items)
    expect(map.nodes).toHaveLength(items.length - 1)
    for (const node of map.nodes) {
      expect(node.x + node.width).toBeLessThanOrEqual(map.width)
      expect(node.y + node.height).toBeLessThanOrEqual(map.height)
      for (const other of map.nodes.filter((n) => n !== node && n.x === node.x))
        expect(Math.abs(node.y - other.y)).toBeGreaterThanOrEqual(node.height)
    }
    for (const edge of map.edges)
      expect(items.find((i) => i.key === edge.from)!.links).toContain(edge.to)
    expect(
      map.nodes.find((n) => n.item.key === 'requirement/result-access')!.item
        .links
    ).toEqual([])
  })
})
