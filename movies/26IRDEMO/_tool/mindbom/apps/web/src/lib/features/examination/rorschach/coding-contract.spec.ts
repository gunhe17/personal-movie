/**
 * 코딩 부호 계약 대조 — 임상가가 고를 수 있는 부호가 채점이 읽는 부호를 덮는가.
 *
 * contracts/rorschach-coding.json은 백엔드 coding_codes.py에서 생성된다
 * (apps/api/scripts/export_rorschach_codes.py). 백엔드 테스트는 그 표가
 * scoring.py가 실제로 참조하는 부호를 전부 담는지 AST로 검증하고
 * (tests/unit/test_rorschach_codes.py), 여기서는 프론트 드롭다운이 그 표를
 * 좁히지 않았는지 본다. 둘을 이으면:
 *
 *     scoring.py가 읽는 부호 ⊆ 계약 ⊆ UI 드롭다운
 *
 * 이 사슬이 끊기면 임상가가 입력할 수 없는 부호가 생기고, 그 지표는
 * **에러 없이 항상 0**이 된다. 실제로 그렇게 죽어 있었다(2026-08):
 * ISO Index·COP·AG·MOR·PER·Fd·CP — 대인관계 클러스터가 통째로.
 *
 * 왜 소스 파싱이 아니라 계약 파일인가
 * ------------------------------------
 * exam-state.json과 같은 이유다. 정규식으로 상대편 소스를 읽으면 리팩터링에
 * 취약해 조용히 아무것도 못 찾는 상태가 된다. 계약은 데이터라 그 문제가 없다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  CODING_OPTIONS,
  LOCATION_PATTERN,
  POPULAR_RESPONSES,
  Z_VALUES,
  popularCandidates,
  zValue
} from './constants'

type Contract = {
  groups: Record<string, string[]>
  /** 채점(scoring.py)이 부호를 이름으로 읽는 그룹 */
  scored_groups: string[]
  /** 평범반응 표 (워크북 〈표 5-2〉 89쪽) */
  popular_responses: {
    card_no: number
    locations: string[]
    content: string
    criteria: string
  }[]
  /** 조직활동 Z값 — 카드(문자열 키) → {ZW/ZA/ZD/ZS → 값} */
  z_values: Record<string, Record<string, number>>
  /** 영역 부호의 형태 — 서버 `coding_codes.LOCATION_RE`의 패턴 문자열 */
  location_pattern: string
}

// rorschach/ → examination/ → features/ → lib/ → src/ → web/ → apps/ → 루트 (7단계)
const HERE = dirname(fileURLToPath(import.meta.url))
const CONTRACT_PATH = resolve(
  HERE,
  '../../../../../../..',
  'contracts/rorschach-coding.json'
)

const contract: Contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'))

const uiGroups = CODING_OPTIONS as unknown as Record<string, readonly string[]>

describe('코딩 부호 계약 — 백엔드와 합의된 표', () => {
  it('계약 파일을 읽을 수 있다', () => {
    expect(Object.keys(contract.groups).length).toBeGreaterThan(0)
    expect(contract.scored_groups.length).toBeGreaterThan(0)
  })

  it('계약의 그룹 이름이 UI 표의 키와 같다', () => {
    // 이름이 갈리면 아래 대조가 통째로 헛돈다(빈 배열끼리 비교해 통과한다)
    expect(Object.keys(uiGroups).sort()).toEqual(
      Object.keys(contract.groups).sort()
    )
  })
})

describe('영역 부호의 형태 — 정규식은 열거할 수 없어 패턴을 계약에 싣는다', () => {
  it('UI 패턴이 서버 LOCATION_RE와 글자까지 같다', () => {
    // 어긋나면 서버가 받아준 값을 LocationPicker가 못 읽어 **칸이 비어 보인다.**
    // 임상가에겐 "부호가 사라졌다"로 보이고, 그 상태로 저장하면 진짜 사라진다.
    expect(LOCATION_PATTERN).toBe(contract.location_pattern)
  })

  it('실제 부호 형태를 받아준다', () => {
    const re = new RegExp(LOCATION_PATTERN)
    for (const ok of ['W', 'WS', 'D1', 'DS6', 'Dd', 'Dd99', 'Ds1']) {
      expect(re.test(ok), ok).toBe(true)
    }
    for (const no of ['', 'X', 'w1', 'D1S', 'Dd 9']) {
      expect(re.test(no), no).toBe(false)
    }
  })

  it('Dd가 D보다 앞이다 — 뒤면 Dd6이 D로 갈린다', () => {
    // 순서가 바뀌어도 test()는 통과하므로 **캡처를 봐야** 잡힌다.
    const m = new RegExp(LOCATION_PATTERN).exec('Dd99')
    expect(m?.[1]).toBe('Dd')
    expect(m?.[3]).toBe('99')
  })

  it('평범반응 표의 영역 부호도 이 형태다', () => {
    const re = new RegExp(LOCATION_PATTERN)
    for (const p of POPULAR_RESPONSES) {
      for (const loc of p.locations) {
        expect(re.test(loc), `카드 ${p.card_no} ${p.content} — ${loc}`).toBe(true)
      }
    }
  })
})

describe('채점이 읽는 부호는 전부 UI에서 고를 수 있어야 한다', () => {
  it.each(contract.scored_groups)('%s', (group) => {
    const offered = new Set(uiGroups[group] ?? [])
    const missing = (contract.groups[group] ?? []).filter(
      (code) => !offered.has(code)
    )

    expect(
      missing,
      `'${group}'에서 계약에 있지만 UI 드롭다운에 없는 부호: ${missing.join(', ')}\n` +
        '이 부호는 임상가가 입력할 수 없으므로 채점 시 항상 0이 된다.\n' +
        'constants.ts의 CODING_OPTIONS에 추가할 것.'
    ).toEqual([])
  })
})

describe('부호 표 자체의 정합성', () => {
  it.each(Object.keys(uiGroups))('%s — 중복 없음', (group) => {
    const codes = uiGroups[group]
    expect(new Set(codes).size).toBe(codes.length)
  })

  it.each(Object.keys(uiGroups))('%s — 빈 값·공백 없음', (group) => {
    for (const code of uiGroups[group]) {
      expect(code).toBeTruthy()
      expect(code).toBe(code.trim())
    }
  })

  /**
   * UI에만 있고 계약에 없는 부호는 무해하다(기록으로 남을 뿐 계산을 안 바꾼다).
   * 다만 오타로 생긴 것일 수 있으니 눈에 띄게 남긴다 — 실패는 아니다.
   */
  it('UI에만 있는 부호를 보고한다 (실패 아님)', () => {
    const extras: string[] = []
    for (const [group, codes] of Object.entries(uiGroups)) {
      const known = new Set(contract.groups[group] ?? [])
      for (const c of codes) if (!known.has(c)) extras.push(`${group}.${c}`)
    }
    if (extras.length) {
      console.warn(`[coding-contract] UI에만 있는 부호: ${extras.join(', ')}`)
    }
    expect(true).toBe(true)
  })
})


/**
 * 평범반응 표 — 부호 목록과 **같은 방식으로 어긋날 수 있다.**
 *
 * 표가 양쪽에 적혀 있으므로(백엔드 `POPULAR_RESPONSES`, 프론트 동명 상수)
 * 한쪽만 고치면 화면이 "이 자리는 평범반응이 아닙니다"라고 말하는데 채점은
 * P로 세는 상태가 된다. 부호에서 이미 겪은 종류다.
 *
 * P는 임상가의 인상이 아니라 Exner 표의 함수라(§13 E-2) 표가 정확해야 한다.
 */
describe('평범반응 표 — 백엔드와 합의된 표', () => {
  it('개수가 같다', () => {
    expect(POPULAR_RESPONSES.length).toBe(contract.popular_responses.length)
  })

  it('내용이 완전히 같다', () => {
    // 카드→영역→내용 순으로 정렬해 순서 차이를 배제한다.
    const key = (p: { card_no: number; locations: string[]; content: string }) =>
      `${p.card_no}|${[...p.locations].sort().join(',')}|${p.content}`
    expect(POPULAR_RESPONSES.map(key).sort()).toEqual(
      contract.popular_responses.map(key).sort()
    )
  })

  it('기준 문구까지 같다', () => {
    // 기준은 화면에 그대로 보여주는 문장이다. 한쪽만 고치면 임상가가
    // 다른 근거를 보고 판단하게 된다.
    const byKey = new Map(
      contract.popular_responses.map((p) => [`${p.card_no}|${p.content}`, p.criteria])
    )
    for (const p of POPULAR_RESPONSES) {
      expect(p.criteria, `카드 ${p.card_no} ${p.content}`).toBe(
        byKey.get(`${p.card_no}|${p.content}`)
      )
    }
  })

})

describe('popularCandidates — 이 자리가 평범반응 자리인가', () => {
  it('카드 I의 W는 박쥐·나비 둘 다 후보다', () => {
    expect(popularCandidates(1, 'W').map((p) => p.content)).toEqual(['박쥐', '나비'])
  })

  it('공백 반응(S)이 붙어도 같은 자리로 본다', () => {
    // WS는 W 자리다 — 백엔드 popular_candidates()와 같은 규칙이어야 한다.
    expect(popularCandidates(1, 'WS').length).toBe(2)
  })

  it('평범반응 자리가 아니면 빈 배열이다', () => {
    expect(popularCandidates(1, 'D1')).toEqual([])
    expect(popularCandidates(2, 'D2')).toEqual([])
  })

  it('영역이 없으면 빈 배열이다', () => {
    expect(popularCandidates(1, null)).toEqual([])
    expect(popularCandidates(1, '')).toEqual([])
  })

  it('카드 IV는 W와 D7 두 자리 모두 후보다', () => {
    expect(popularCandidates(4, 'W').length).toBe(1)
    expect(popularCandidates(4, 'D7').length).toBe(1)
  })
})


/**
 * 조직활동 Z값 — 부호 목록·평범반응과 **같은 방식으로 어긋날 수 있다.**
 *
 * 정본은 백엔드 `scoring.py`의 `Z_TABLE`이다. 화면이 다른 값을 보여주면
 * 임상가는 그 숫자를 보고 부호를 고르는데(두 기준 중 높은 값을 준다,
 * 워크북 94쪽) 실제 합산은 다른 값으로 된다 — 값이 아니라 **판단이 틀어진다.**
 */
describe('조직활동 Z값 — 백엔드와 합의된 표', () => {
  it('카드 10장이 다 있다', () => {
    expect(Object.keys(contract.z_values).length).toBe(10)
    expect(Object.keys(Z_VALUES).length).toBe(10)
  })

  it('모든 카드·부호의 값이 계약과 같다', () => {
    for (const [card, vals] of Object.entries(contract.z_values)) {
      for (const [code, v] of Object.entries(vals)) {
        expect(Z_VALUES[Number(card)]?.[code], `카드 ${card} ${code}`).toBe(v)
      }
    }
  })

  it('Z 부호 4종이 계약의 zScore 그룹과 같다', () => {
    // 표의 열과 드롭다운 목록이 갈리면 고를 수 없는 부호가 생긴다
    for (const card of Object.values(contract.z_values)) {
      expect(Object.keys(card).sort()).toEqual([...contract.groups.zScore].sort())
    }
  })

  it('zValue는 소수 한 자리로 준다', () => {
    // 채점지 표기가 소수 한 자리다. 1.0을 '1'로 줄이면 3.5와 자릿수가 어긋난다.
    expect(zValue(1, 'ZW')).toBe('1.0')
    expect(zValue(6, 'ZS')).toBe('6.5')
    expect(zValue(9, 'ZW')).toBe('5.5')
  })

  it('카드마다 값이 다르다는 사실을 고정한다', () => {
    // 이게 화면에 값을 띄우는 이유다 — 부호만으로는 무엇을 고르는지 알 수 없다
    expect(zValue(1, 'ZW')).not.toBe(zValue(9, 'ZW'))
  })

  it('모르는 조합이면 null이다', () => {
    expect(zValue(null, 'ZW')).toBeNull()
    expect(zValue(1, null)).toBeNull()
    expect(zValue(99, 'ZW')).toBeNull()
    expect(zValue(1, 'ZX')).toBeNull()
  })
})
