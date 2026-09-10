import { describe, it, expect } from 'vitest'
import { examinationToTimelineItem } from './transforms'
import { isSameDay } from './day-view'
import type { ExaminationApiItem } from './types'

/**
 * 🔴 이 파일이 지키는 규약 하나:
 *    타임라인 카드의 위치는 **서버의 날짜 필터와 같은 컬럼**이어야 한다.
 *
 * 서버(`examination/common/repository.py` _apply_filters)는 `scheduled_at`으로
 * 걸러 하루치를 보내고, 화면은 받은 항목을 isSameDay로 한 번 더 거른다.
 * 두 식이 갈리면 **조회는 됐는데 화면에서 사라지는** 검사가 생기고,
 * 아무 에러도 나지 않아 알아채기 어렵다.
 *
 * 실제 버그: in_progress일 때 started_at을 쓰던 시절, 8/19로 예정된 검사를
 * 8/13에 시작해 두면 서버는 8/19 조회에 넣어 주고 프론트는 8/13에 그리려다
 * 걸러 버렸다.
 *
 * 예정일 없는 검사는 양쪽 모두에서 빠진다 — 예전에는 COALESCE로 created_at을
 * 대신 썼는데, 그건 잡은 적 없는 예정을 등록일에 만들어 내는 것이었다.
 */

function exam(over: Partial<ExaminationApiItem> = {}): ExaminationApiItem {
  return {
    id: 'e1',
    client_id: 'c1',
    client_name: '홍길동',
    client_birth_date: '1990-03-02',
    client_gender: 'male',
    examiner_id: 'm1',
    examiner_name: '김상담',
    exam_type: 'htp',
    status: 'created',
    scheduled_at: '2026-08-19T01:00:00',
    started_at: null,
    completed_at: null,
    created_at: '2026-08-13T03:40:00',
    ...over
  }
}

/** 서버 필터가 그 검사를 어느 날 창에 넣는지 — scheduled_at 하나 */
function serverAnchor(e: ExaminationApiItem): Date {
  if (!e.scheduled_at) throw new Error('예정일 없는 검사는 서버 창에 안 들어간다')
  return new Date(e.scheduled_at)
}

describe('타임라인 앵커 ↔ 서버 날짜 필터', () => {
  const cases: Array<[string, ExaminationApiItem]> = [
    [
      '예정일보다 먼저 시작된 검사 (버그 재현 케이스)',
      exam({
        status: 'in_progress',
        scheduled_at: '2026-08-19T01:00:00',
        started_at: '2026-08-13T03:40:00'
      })
    ],
    [
      '예정일이 지난 뒤 시작된 검사',
      exam({
        status: 'in_progress',
        scheduled_at: '2026-08-05T00:30:00',
        started_at: '2026-08-13T02:46:00'
      })
    ],
    [
      '완료 시각이 예정일과 다른 검사',
      exam({
        status: 'completed',
        scheduled_at: '2026-08-05T05:00:00',
        started_at: '2026-08-05T05:10:00',
        completed_at: '2026-08-13T04:35:00'
      })
    ],
    [
      'AI 초안 대기',
      exam({
        status: 'ai_draft_ready',
        scheduled_at: '2026-08-13T01:00:00',
        started_at: '2026-08-13T06:35:00'
      })
    ],
  ]

  for (const [name, e] of cases) {
    it(`${name} — 서버가 넣는 날과 같은 날에 그린다`, () => {
      const item = examinationToTimelineItem(e)
      expect(item).not.toBeNull()
      expect(isSameDay(item!.when.anchorAt, serverAnchor(e))).toBe(true)
    })
  }

  it('예정일이 없으면 카드를 만들지 않는다 — 등록일로 대신하지 않는다', () => {
    // created_at은 있지만 그것으로 위치를 만들면 잡은 적 없는 예정이 생긴다.
    // 서버 필터도 이 검사를 기간 조회에 넣지 않으므로 양쪽이 일치한다.
    const item = examinationToTimelineItem(
      exam({
        status: 'confirmed',
        scheduled_at: null,
        started_at: '2026-08-04T05:39:00',
        completed_at: '2026-08-13T04:35:00',
        created_at: '2026-08-04T05:39:00'
      })
    )
    expect(item).toBeNull()
  })
})

describe('앵커 라벨', () => {
  it('위치는 예정 시각이 정하고, 라벨은 현재 상태를 말한다', () => {
    const item = examinationToTimelineItem(
      exam({
        status: 'in_progress',
        scheduled_at: '2026-08-19T01:00:00',
        started_at: '2026-08-13T03:40:00'
      })
    )
    // 8/19에 놓이지만 라벨은 '시작'(이미 진행 중)
    expect(item!.when.anchorAt.getDate()).toBe(19)
    expect(item!.when.anchorLabel).toBe('시작')
  })

  it('상태별 라벨 매핑', () => {
    const label = (status: ExaminationApiItem['status']) =>
      examinationToTimelineItem(exam({ status }))!.when.anchorLabel

    expect(label('created')).toBe('예정')
    expect(label('in_progress')).toBe('시작')
    expect(label('ai_draft_ready')).toBe('검토대기')
    expect(label('under_review')).toBe('검토중')
    expect(label('confirmed')).toBe('완료')
    expect(label('report_generated')).toBe('완료')
    expect(label('completed')).toBe('완료')
  })
})
