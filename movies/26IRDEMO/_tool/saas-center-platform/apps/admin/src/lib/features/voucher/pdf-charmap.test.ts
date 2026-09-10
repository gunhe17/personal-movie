import { describe, expect, it } from 'vitest'
import { buildCharMap, findAll, longestToken, norm } from './pdf-charmap'

/** 조각 목록 → 매칭 구간의 원본 복원 (뷰어가 Range 로 하는 일의 순수 버전) */
function slice(chunks: { source: string; text: string }[], needle: string) {
  const { text, map } = buildCharMap(chunks)
  return findAll(text, norm(needle)).map(([lo, hi]) => {
    const a = map[lo]
    const b = map[hi - 1]
    return a.source === b.source
      ? { source: a.source, cut: a.source.slice(a.start, b.end) }
      : { source: `${a.source}…${b.source}`, cut: null }
  })
}

describe('buildCharMap', () => {
  it('불변식 — map 길이는 정규화 문자열 길이와 같다', () => {
    const chunks = [
      { source: 'a', text: '지역사회서비스 투자사업' },
      { source: 'b', text: '월 ４회 (１회당 ５０분)' },
      { source: 'c', text: '개인정보 수집･이용 동의서' },
      { source: 'd', text: '   \n\t  ' }
    ]
    const { text, map } = buildCharMap(chunks)
    expect(map).toHaveLength(text.length)
  })

  it('공백은 항목을 만들지 않는다 (조각 경계를 넘어 이어 붙는다)', () => {
    const { text } = buildCharMap([
      { source: 'a', text: '월 4회' },
      { source: 'b', text: ' 이용' }
    ])
    expect(text).toBe('월4회이용')
  })

  it('조각을 걸친 매칭도 양끝 앵커가 각 조각을 가리킨다', () => {
    const { text, map } = buildCharMap([
      { source: 'a', text: '바우처 ' },
      { source: 'b', text: '지원금액' }
    ])
    const [[lo, hi]] = findAll(text, norm('처 지원'))
    expect(map[lo].source).toBe('a')
    expect(map[hi - 1].source).toBe('b')
  })

  it('글자 단위 — 조각 일부만 정확히 잘라낸다 (종전 조각 통째 강조 대비)', () => {
    const hits = slice([{ source: '월 4회, 1회당 50분 이용', text: '월 4회, 1회당 50분 이용' }], '1회당')
    expect(hits).toEqual([{ source: '월 4회, 1회당 50분 이용', cut: '1회당' }])
  })

  it('가운뎃점 이형(･)과 전각 숫자를 흡수해 매칭한다', () => {
    const hits = slice([{ source: 'x', text: '수집･이용 ５０분' }], '수집·이용 50분')
    expect(hits).toHaveLength(1)
  })

  it('자모 분해 조각은 조각 전체 앵커로 안전 격하한다', () => {
    // NFD 한글 — 글자별 NFKC 로는 결합되지 않는다
    const raw = '한글'.normalize('NFD')
    const { text, map } = buildCharMap([{ source: 's', text: raw }])
    expect(text).toBe('한글')
    expect(map).toHaveLength(2)
    // 격하: 모든 앵커가 조각 전체를 가리킨다
    expect(map.every((a) => a.start === 0 && a.end === raw.length)).toBe(true)
  })

  it('정상 조각은 격하되지 않는다', () => {
    const { map } = buildCharMap([{ source: 's', text: '한글' }])
    expect(map.map((a) => [a.start, a.end])).toEqual([
      [0, 1],
      [1, 2]
    ])
  })

  it('빈 조각·공백 전용 조각을 건너뛴다', () => {
    const { text, map } = buildCharMap([
      { source: 'a', text: '' },
      { source: 'b', text: '  ' },
      { source: 'c', text: '값' }
    ])
    expect(text).toBe('값')
    expect(map).toHaveLength(1)
    expect(map[0].source).toBe('c')
  })
})

describe('findAll', () => {
  it('겹치지 않는 모든 등장을 찾는다', () => {
    expect(findAll('abcabcabc', 'abc')).toEqual([
      [0, 3],
      [3, 6],
      [6, 9]
    ])
  })

  it('빈 needle 은 무한 루프가 아니라 빈 결과', () => {
    expect(findAll('abc', '')).toEqual([])
  })
})

describe('longestToken', () => {
  it('순수 숫자와 2자 이하를 거르고 최장을 고른다', () => {
    expect(longestToken('월 4회, 발달재활서비스 50분')).toBe('발달재활서비스')
  })

  it('쓸 토큰이 없으면 null', () => {
    expect(longestToken('4 50 12')).toBeNull()
  })
})
