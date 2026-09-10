/**
 * 상태 계약 대조 — 백엔드와 프론트가 같은 표를 통과하는가.
 *
 * contracts/exam-state.json은 백엔드 state_machine.py에서 생성된다
 * (apps/api/scripts/export_state_contract.py). 백엔드 테스트도 같은 파일을
 * 검증하므로(test_state_machine.py TestStateContract), 양쪽이 이 표를
 * 통과하면 **서로의 구현을 몰라도 동작이 같음**이 보장된다.
 *
 * 왜 소스 파싱이 아니라 계약 파일인가
 * ------------------------------------
 * 기존 test_exam_types.py는 프론트 소스를 정규식으로 읽어 대조했는데,
 * ExamType 선언이 registry로 옮겨가자 정규식이 못 찾아 조용히 깨졌다.
 * 소스 파싱은 리팩터링에 취약하다 — 계약은 데이터라 그 문제가 없다.
 *
 * 계약이 바뀌었는데 이 테스트가 깨지면, 프론트가 따라가야 한다는 뜻이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { EXAM_STATUS_ORDER, EXAM_STATUS_VISUAL } from '../common/exam-visual'
import { isConfirmed, isCollecting, isReviewable } from './status'
import { EXAM_TYPES, isSupportedExamType } from './registry'
import type { ExamStatus } from '../common/constants'

type Contract = {
  statuses: string[]
  labels: Record<string, string>
  exam_types: string[]
  confirmed_statuses: string[]
  transitions: { from: string; to: string; allowed: boolean }[]
  next_statuses: Record<string, string[]>
}

// core/ → examination/ → features/ → lib/ → src/ → web/ → apps/ → 루트
const HERE = dirname(fileURLToPath(import.meta.url))
const CONTRACT_PATH = resolve(HERE, '../../../../../../..', 'contracts/exam-state.json')

const contract: Contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'))

describe('상태 계약 — 백엔드와 합의된 표', () => {
  it('계약 파일을 읽을 수 있다', () => {
    expect(contract.statuses.length).toBeGreaterThan(0)
  })

  it('전이표가 전수다 — 빠진 칸이 있으면 어긋나도 모르게 지나간다', () => {
    const n = contract.statuses.length
    expect(contract.transitions).toHaveLength(n * n)
  })
})

/**
 * 상태 머신에서 빠졌지만 과거 데이터에 남아 있는 값.
 *
 * 새로 만들어지지는 않으므로 계약(statuses)에는 없다. 그래도 서버가 그
 * 값을 돌려줄 수 있으니 화면은 그릴 수 있어야 한다 — 표시 설정에는 남는다.
 * 여기 적힌 것 외의 잔재는 아래 테스트가 잡는다.
 */
const LEGACY_STATUSES = ['completed']

describe('상태 목록 — 프론트가 백엔드와 같은 상태를 안다', () => {
  it('EXAM_STATUS_ORDER가 계약의 상태 집합과 일치한다', () => {
    expect([...EXAM_STATUS_ORDER].sort()).toEqual([...contract.statuses].sort())
  })

  it('EXAM_STATUS_ORDER가 계약의 순서를 그대로 따른다', () => {
    // 순서까지 맞춰야 필터 목록·차트 범례가 워크플로 순으로 나온다
    expect(EXAM_STATUS_ORDER).toEqual(contract.statuses)
  })

  it('모든 상태에 표시 설정이 있다 — 새 상태를 추가하고 빠뜨리면 여기서 죽는다', () => {
    for (const status of contract.statuses) {
      expect(EXAM_STATUS_VISUAL[status as ExamStatus], `${status}에 VISUAL 없음`).toBeDefined()
    }
  })

  it('표시 설정에 계약·레거시 외의 상태가 없다 — 지운 상태의 잔재 검출', () => {
    expect(Object.keys(EXAM_STATUS_VISUAL).sort()).toEqual(
      [...contract.statuses, ...LEGACY_STATUSES].sort()
    )
  })

  it('레거시 상태는 워크플로 목록에 노출되지 않는다', () => {
    // 필터·범례에 나오면 "만들 수 있는 상태"로 오해된다
    for (const legacy of LEGACY_STATUSES) {
      expect(EXAM_STATUS_ORDER).not.toContain(legacy)
      expect(contract.statuses).not.toContain(legacy)
    }
  })
})

describe('검사 유형 — 레지스트리가 백엔드 허용 목록과 같은가', () => {
  it('레지스트리와 계약이 정확히 일치한다', () => {
    // 프론트에만 있으면 모듈은 있는데 API가 422를 돌려주고,
    // 백엔드에만 있으면 등록은 되는데 화면이 없다.
    expect([...EXAM_TYPES].sort()).toEqual([...contract.exam_types].sort())
  })

  it.each(contract.exam_types)('%s를 지원 유형으로 인식한다', (type) => {
    expect(isSupportedExamType(type)).toBe(true)
  })

  it('계약에 없는 유형은 거부한다', () => {
    expect(isSupportedExamType('mmpi2')).toBe(false)
  })
})

describe('술어 — 같은 입력에 같은 답을 내는가', () => {
  it.each(contract.statuses)('isConfirmed(%s)가 계약과 일치한다', (status) => {
    const expected = contract.confirmed_statuses.includes(status)
    expect(isConfirmed(status)).toBe(expected)
  })

  it('isCollecting은 확정 이후와 겹치지 않는다', () => {
    // 두 술어가 동시에 참이면 화면이 "수집 중이면서 확정됨"을 그리게 된다
    for (const status of contract.statuses) {
      const s = status as ExamStatus
      expect(isCollecting(s) && isConfirmed(s), `${status}가 양쪽 다 참`).toBe(false)
    }
  })

  it('확정된 상태는 전부 검토 가능 구간에 든다', () => {
    // isReviewable은 확정 이후를 포함한다 — 빠지면 확정된 검사의 결과가 안 보인다
    for (const status of contract.confirmed_statuses) {
      expect(isReviewable(status as ExamStatus), `${status}`).toBe(true)
    }
  })

  it('모든 상태가 정확히 한 구간에 속한다 — 수집 중이거나, 검토 가능하거나', () => {
    for (const status of contract.statuses) {
      const s = status as ExamStatus
      expect(isCollecting(s) || isReviewable(s), `${status}가 어느 구간에도 없음`).toBe(true)
    }
  })
})
