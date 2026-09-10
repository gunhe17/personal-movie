import { describe, it, expect } from 'vitest'
import {
  deleteRange,
  insertTextAt,
  splitAt,
  deleteBackward,
  deleteForward,
  checkInvariants,
  normalizeMarks,
  rebaseMarks,
  applyStyle,
  queryStyle,
  sliceMarks,
  insertImageAt,
  insertTableAt,
  insertDividerAt,
  removeParaById,
  toggleList,
  indentList,
  toggleBlockStyle,
  type EditorDoc,
  type Mark,
  type Para,
  type Pos
} from './editor-core'

const makeDoc = (texts: string[]): EditorDoc => ({
  paras: texts.map((t, i) => ({ id: 't' + i, text: t }))
})
/** kind 지정 문서 생성: ['heading:섹션', 'body:내용', 'x'](kind 생략=body) */
const makeKindDoc = (specs: string[]): EditorDoc => ({
  paras: specs.map((s, i) => {
    const m = /^(heading|cover|body):(.*)$/.exec(s)
    const para: Para = m
      ? { id: 't' + i, text: m[2], kind: m[1] as Para['kind'] }
      : { id: 't' + i, text: s }
    return para
  })
})
const P = (paraId: string, offset: number): Pos => ({ paraId, offset })
const texts = (doc: EditorDoc) => doc.paras.map((p) => p.text)

describe('editor-core 모델 프리미티브', () => {
  it('한 문단 내 범위삭제', () => {
    const d = makeDoc(['abcdef'])
    const c = deleteRange(d, { start: P('t0', 1), end: P('t0', 4) })
    expect(texts(d)).toEqual(['aef'])
    expect(c).toEqual(P('t0', 1))
    expect(checkInvariants(d)).toBeNull()
  })

  it('2문단 걸친 삭제→병합', () => {
    const d = makeDoc(['abcdef', 'ghijkl'])
    const c = deleteRange(d, { start: P('t0', 2), end: P('t1', 3) })
    expect(texts(d)).toEqual(['abjkl'])
    expect(c).toEqual(P('t0', 2))
  })

  it('3문단 걸친 삭제(중간제거)', () => {
    const d = makeDoc(['abc', 'MIDDLE', 'xyz'])
    const c = deleteRange(d, { start: P('t0', 1), end: P('t2', 2) })
    expect(texts(d)).toEqual(['az'])
    expect(c).toEqual(P('t0', 1))
  })

  it('역순 선택 삭제', () => {
    const d = makeDoc(['abcdef'])
    const c = deleteRange(d, { start: P('t0', 4), end: P('t0', 1) })
    expect(texts(d)).toEqual(['aef'])
    expect(c).toEqual(P('t0', 1))
  })

  it('첫 문단 전체 선택 삭제', () => {
    const d = makeDoc(['abc', 'xyz'])
    deleteRange(d, { start: P('t0', 0), end: P('t0', 3) })
    expect(texts(d)).toEqual(['', 'xyz'])
  })

  it('전체 문서 선택 삭제 → 빈 문단 1개', () => {
    const d = makeDoc(['abc', 'def', 'ghi'])
    const c = deleteRange(d, { start: P('t0', 0), end: P('t2', 3) })
    expect(texts(d)).toEqual([''])
    expect(c).toEqual(P('t0', 0))
    expect(checkInvariants(d)).toBeNull()
  })

  it('단일 텍스트 삽입', () => {
    const d = makeDoc(['aXb'])
    const c = insertTextAt(d, P('t0', 2), 'YY')
    expect(texts(d)).toEqual(['aXYYb'])
    expect(c).toEqual(P('t0', 4))
  })

  it('여러 줄 붙여넣기 → 문단 분할', () => {
    const d = makeDoc(['start_end'])
    insertTextAt(d, P('t0', 6), 'A\nB\nC')
    expect(texts(d)).toEqual(['start_A', 'B', 'Cend'])
    expect(checkInvariants(d)).toBeNull()
  })

  it('엔터 문단 중간 분할', () => {
    const d = makeDoc(['hello world'])
    splitAt(d, P('t0', 5))
    expect(texts(d)).toEqual(['hello', ' world'])
  })

  it('엔터 문단 끝', () => {
    const d = makeDoc(['hello'])
    splitAt(d, P('t0', 5))
    expect(texts(d)).toEqual(['hello', ''])
  })

  it('백스페이스 문단 내', () => {
    const d = makeDoc(['abc'])
    const c = deleteBackward(d, P('t0', 2))
    expect(texts(d)).toEqual(['ac'])
    expect(c).toEqual(P('t0', 1))
  })

  it('백스페이스 맨앞 병합', () => {
    const d = makeDoc(['abc', 'def'])
    const c = deleteBackward(d, P('t1', 0))
    expect(texts(d)).toEqual(['abcdef'])
    expect(c).toEqual(P('t0', 3))
  })

  it('백스페이스 문서 맨앞 no-op', () => {
    const d = makeDoc(['abc'])
    const c = deleteBackward(d, P('t0', 0))
    expect(texts(d)).toEqual(['abc'])
    expect(c).toEqual(P('t0', 0))
  })

  it('Delete 문단 내', () => {
    const d = makeDoc(['abc'])
    const c = deleteForward(d, P('t0', 1))
    expect(texts(d)).toEqual(['ac'])
    expect(c).toEqual(P('t0', 1))
  })

  it('Delete 맨끝 병합', () => {
    const d = makeDoc(['abc', 'def'])
    const c = deleteForward(d, P('t0', 3))
    expect(texts(d)).toEqual(['abcdef'])
    expect(c).toEqual(P('t0', 3))
  })

  it('Delete 문서 맨끝 no-op', () => {
    const d = makeDoc(['abc'])
    const c = deleteForward(d, P('t0', 3))
    expect(texts(d)).toEqual(['abc'])
    expect(c).toEqual(P('t0', 3))
  })

  it('이모지(서로게이트) 백스페이스', () => {
    const d = makeDoc(['a😀b'])
    const c = deleteBackward(d, P('t0', 3))
    expect(texts(d)).toEqual(['ab'])
    expect(c).toEqual(P('t0', 1))
  })

  it('이모지(서로게이트) Delete', () => {
    const d = makeDoc(['a😀b'])
    const c = deleteForward(d, P('t0', 1))
    expect(texts(d)).toEqual(['ab'])
    expect(c).toEqual(P('t0', 1))
  })

  it('선택 대체(삭제후삽입)', () => {
    const d = makeDoc(['abc', 'def'])
    const c1 = deleteRange(d, { start: P('t0', 1), end: P('t1', 1) })
    const c2 = insertTextAt(d, c1, 'X')
    expect(texts(d)).toEqual(['aXef'])
    expect(c2).toEqual(P('t0', 2))
  })

  it('빈 문단 백스페이스 병합', () => {
    const d = makeDoc(['', '', 'x'])
    const c = deleteBackward(d, P('t1', 0))
    expect(texts(d)).toEqual(['', 'x'])
    expect(c).toEqual(P('t0', 0))
  })
})

describe('고정 서식: 잠긴 블록(heading/cover) 보호', () => {
  it('heading에는 텍스트 입력 불가(no-op)', () => {
    const d = makeKindDoc(['heading:I. 의뢰 사유', 'body:'])
    const c = insertTextAt(d, P('t0', 3), 'XXX')
    expect(texts(d)).toEqual(['I. 의뢰 사유', ''])
    expect(c).toEqual(P('t0', 3))
  })

  it('heading은 엔터로 분할 불가(no-op)', () => {
    const d = makeKindDoc(['heading:섹션', 'body:본문'])
    const c = splitAt(d, P('t0', 1))
    expect(texts(d)).toEqual(['섹션', '본문'])
    expect(d.paras.length).toBe(2)
    expect(c).toEqual(P('t0', 1))
  })

  it('body 맨앞 백스페이스: 앞이 heading이면 병합 안 함', () => {
    const d = makeKindDoc(['heading:섹션', 'body:본문'])
    const c = deleteBackward(d, P('t1', 0))
    expect(texts(d)).toEqual(['섹션', '본문'])
    expect(d.paras.length).toBe(2)
    expect(c).toEqual(P('t1', 0))
  })

  it('body 맨끝 Delete: 다음이 heading이면 병합 안 함', () => {
    const d = makeKindDoc(['body:본문', 'heading:섹션'])
    const c = deleteForward(d, P('t0', 2))
    expect(texts(d)).toEqual(['본문', '섹션'])
    expect(d.paras.length).toBe(2)
    expect(c).toEqual(P('t0', 2))
  })

  it('heading 안에서 백스페이스/Delete 불가', () => {
    const d = makeKindDoc(['heading:섹션'])
    expect(deleteBackward(d, P('t0', 2))).toEqual(P('t0', 2))
    expect(deleteForward(d, P('t0', 1))).toEqual(P('t0', 1))
    expect(texts(d)).toEqual(['섹션'])
  })

  it('heading을 걸치는 범위삭제: heading 텍스트 보존, 앞뒤 body만 잘림', () => {
    // [body '내용앞'] [heading '섹션'] [body '내용뒤']
    const d = makeKindDoc(['body:내용앞', 'heading:섹션', 'body:내용뒤'])
    // 'body앞'의 1부터 'body뒤'의 2까지 선택 → heading은 살아야 함
    const c = deleteRange(d, { start: P('t0', 1), end: P('t2', 2) })
    expect(texts(d)).toEqual(['내', '섹션', '뒤'])
    expect(d.paras[1].kind).toBe('heading')
    expect(c).toEqual(P('t0', 1))
    expect(checkInvariants(d)).toBeNull()
  })

  it('heading으로 시작하는 범위삭제: heading 보존, 커서는 첫 편집문단', () => {
    const d = makeKindDoc(['heading:섹션', 'body:내용'])
    const c = deleteRange(d, { start: P('t0', 0), end: P('t1', 2) })
    expect(texts(d)).toEqual(['섹션', ''])
    expect(c).toEqual(P('t1', 0))
  })

  it('잠긴 블록 없는 범위삭제는 기존대로 병합', () => {
    const d = makeKindDoc(['body:abcdef', 'body:ghijkl'])
    const c = deleteRange(d, { start: P('t0', 2), end: P('t1', 3) })
    expect(texts(d)).toEqual(['abjkl'])
    expect(c).toEqual(P('t0', 2))
  })

  it('중간 빈 body는 제거되고 heading 사이 body는 유지', () => {
    // [body 'AA'] [body 'BB'(중간·전부삭제)] [heading 'H'] [body 'CC']
    const d = makeKindDoc(['body:AA', 'body:BB', 'heading:H', 'body:CC'])
    const c = deleteRange(d, { start: P('t0', 1), end: P('t3', 1) })
    // t0='A', t1 전부지워져 제거, heading 보존, t3='C'
    expect(texts(d)).toEqual(['A', 'H', 'C'])
    expect(d.paras[1].kind).toBe('heading')
    expect(c).toEqual(P('t0', 1))
    expect(checkInvariants(d)).toBeNull()
  })
})

describe('인라인 서식: normalizeMarks', () => {
  const b = (start: number, end: number): Mark => ({ start, end, bold: true })

  it('빈/역전 범위 제거', () => {
    expect(normalizeMarks([b(2, 2), b(5, 3)], 10)).toEqual([])
  })
  it('textLen으로 클리핑', () => {
    expect(normalizeMarks([b(2, 20)], 8)).toEqual([{ start: 2, end: 8, bold: true }])
  })
  it('같은 스타일 겹침 병합', () => {
    expect(normalizeMarks([b(0, 4), b(3, 7)], 10)).toEqual([{ start: 0, end: 7, bold: true }])
  })
  it('같은 스타일 맞닿음 병합', () => {
    expect(normalizeMarks([b(0, 3), b(3, 6)], 10)).toEqual([{ start: 0, end: 6, bold: true }])
  })
  it('다른 스타일은 병합 안 함', () => {
    const marks: Mark[] = [{ start: 0, end: 3, bold: true }, { start: 0, end: 3, italic: true }]
    const out = normalizeMarks(marks, 10)
    expect(out).toHaveLength(2)
  })
  it('빈 스타일 mark 제거', () => {
    expect(normalizeMarks([{ start: 0, end: 3 }], 10)).toEqual([])
  })
})

describe('인라인 서식: rebaseMarks', () => {
  const b = (start: number, end: number): Mark => ({ start, end, bold: true })

  it('삽입 전이면 그대로', () => {
    // "abc[bold]def" 에서 앞 'X' 삽입: bold 3~6 → 4~7
    expect(rebaseMarks([b(3, 6)], 0, 0, 1)).toEqual([b(4, 7)])
  })
  it('삽입 후면 불변', () => {
    expect(rebaseMarks([b(3, 6)], 8, 0, 2)).toEqual([b(3, 6)])
  })
  it('mark 내부 삽입은 확장', () => {
    // bold 2~6, 위치 4에 2글자 삽입 → 2~8
    expect(rebaseMarks([b(2, 6)], 4, 0, 2)).toEqual([b(2, 8)])
  })
  it('mark 뒤 삭제로 축소', () => {
    // bold 2~8, [4,6) 삭제 → 2~6
    expect(rebaseMarks([b(2, 8)], 4, 2, 0)).toEqual([b(2, 6)])
  })
  it('mark 전체 포함 삭제로 제거', () => {
    expect(rebaseMarks([b(3, 6)], 2, 6, 0)).toEqual([])
  })
  it('mark 앞부분 걸친 삭제', () => {
    // bold 4~8, [2,6) 삭제: start 4→2, end 8→4 → 2~4
    expect(rebaseMarks([b(4, 8)], 2, 4, 0)).toEqual([b(2, 4)])
  })
  it('삽입 구간 상속 스타일', () => {
    // 위치 3에 2글자 삽입, italic 상속
    expect(rebaseMarks([], 3, 0, 2, { italic: true })).toEqual([
      { start: 3, end: 5, italic: true }
    ])
  })
  it('상속 스타일 없으면 삽입 구간 서식 없음', () => {
    expect(rebaseMarks([], 3, 0, 2)).toEqual([])
  })

  // ── 서식 번짐 방지: 커서가 mark 끝에 맞닿을 때(순수 삽입) ──
  it('mark 끝에 맞닿은 삽입은 서식이 번지지 않는다', () => {
    // "AB", bold 0~1(A만). offset 1(A 뒤)에 서식없이 1글자 삽입 → bold는 0~1 유지
    // (기존 버그: e===pos인데도 밀려 0~2가 되어 삽입글자까지 bold)
    expect(rebaseMarks([b(0, 1)], 1, 0, 1)).toEqual([b(0, 1)])
  })
  it('mark 시작에 맞닿은 삽입은 mark 밖(앞)에 들어간다', () => {
    // bold 2~4, offset 2(mark 시작)에 삽입 → mark는 뒤로 밀려 3~5, 삽입글자는 서식 없음
    expect(rebaseMarks([b(2, 4)], 2, 0, 1)).toEqual([b(3, 5)])
  })
  it('mark 끝 맞닿음 + 상속 스타일이면 삽입 구간에만 상속 적용', () => {
    // bold "A"(0~1) 뒤에서 bold를 켠 채(inheritStyle) 입력 → 기존 mark는 0~1 유지,
    // 삽입 구간 1~2에 별도 bold mark가 붙는다(번짐이 아니라 명시적 상속)
    const out = rebaseMarks([b(0, 1)], 1, 0, 1, { bold: true })
    expect(out).toEqual([b(0, 1), { start: 1, end: 2, bold: true }])
  })
})

describe('인라인 서식: 편집 프리미티브의 marks 유지', () => {
  const doc1 = (text: string, marks: Mark[]): EditorDoc => ({
    paras: [{ id: 't0', text, kind: 'body', marks }]
  })

  it('문단 내 삭제로 mark 축소', () => {
    // "abcdef", bold 1~5. [2,4) 삭제 → "abef", bold 1~3
    const d = doc1('abcdef', [{ start: 1, end: 5, bold: true }])
    deleteRange(d, { start: P('t0', 2), end: P('t0', 4) })
    expect(d.paras[0].text).toBe('abef')
    expect(d.paras[0].marks).toEqual([{ start: 1, end: 3, bold: true }])
  })

  it('mark 앞에 삽입하면 mark shift', () => {
    // "abc", bold 0~3. pos0에 "XX" → "XXabc", bold 2~5
    const d = doc1('abc', [{ start: 0, end: 3, bold: true }])
    insertTextAt(d, P('t0', 0), 'XX')
    expect(d.paras[0].text).toBe('XXabc')
    expect(d.paras[0].marks).toEqual([{ start: 2, end: 5, bold: true }])
  })

  it('splitAt이 mark를 두 문단으로 분할', () => {
    // "abcdef", bold 1~5. split at 3 → ["abc" bold 1~3, "def" bold 0~2]
    const d = doc1('abcdef', [{ start: 1, end: 5, bold: true }])
    splitAt(d, P('t0', 3))
    expect(d.paras[0].marks).toEqual([{ start: 1, end: 3, bold: true }])
    expect(d.paras[1].marks).toEqual([{ start: 0, end: 2, bold: true }])
  })

  it('병합 시 뒤 문단 marks가 shift되어 합쳐짐', () => {
    // ["abc" bold 0~3, "def" italic 0~3] 병합 → "abcdef" bold0~3 + italic3~6
    const d: EditorDoc = {
      paras: [
        { id: 't0', text: 'abc', kind: 'body', marks: [{ start: 0, end: 3, bold: true }] },
        { id: 't1', text: 'def', kind: 'body', marks: [{ start: 0, end: 3, italic: true }] }
      ]
    }
    deleteForward(d, P('t0', 3))
    expect(d.paras[0].text).toBe('abcdef')
    expect(d.paras[0].marks).toEqual([
      { start: 0, end: 3, bold: true },
      { start: 3, end: 6, italic: true }
    ])
  })

  it('상속 스타일로 타이핑', () => {
    const d = doc1('ab', [])
    insertTextAt(d, P('t0', 2), 'X', { bold: true })
    expect(d.paras[0].text).toBe('abX')
    expect(d.paras[0].marks).toEqual([{ start: 2, end: 3, bold: true }])
  })
})

describe('인라인 서식: applyStyle / queryStyle', () => {
  const doc1 = (text: string, marks: Mark[] = []): EditorDoc => ({
    paras: [{ id: 't0', text, kind: 'body', marks }]
  })

  it('빈 범위에 bold 적용', () => {
    const d = doc1('abcdef')
    applyStyle(d, { start: P('t0', 1), end: P('t0', 4) }, 'bold')
    expect(d.paras[0].marks).toEqual([{ start: 1, end: 4, bold: true }])
  })

  it('전체 적용된 bold 토글 → 해제', () => {
    const d = doc1('abcdef', [{ start: 1, end: 4, bold: true }])
    applyStyle(d, { start: P('t0', 1), end: P('t0', 4) }, 'bold')
    expect(d.paras[0].marks ?? []).toEqual([])
  })

  it('부분 적용된 bold 토글 → 전체 적용', () => {
    const d = doc1('abcdef', [{ start: 1, end: 2, bold: true }])
    applyStyle(d, { start: P('t0', 1), end: P('t0', 4) }, 'bold')
    expect(normalizeMarks(d.paras[0].marks, 6)).toEqual([{ start: 1, end: 4, bold: true }])
  })

  it('bold 해제 시 중간만 제거(양끝 보존)', () => {
    const d = doc1('abcdef', [{ start: 0, end: 6, bold: true }])
    applyStyle(d, { start: P('t0', 2), end: P('t0', 4) }, 'bold')
    expect(d.paras[0].marks).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 4, end: 6, bold: true }
    ])
  })

  it('다른 스타일은 해제해도 보존 (위치별 서식 정확성)', () => {
    // bold+italic 0~6에서 [2,4) bold 해제 → 모든 위치 italic 유지, bold는 [2,4)만 빠짐
    const d = doc1('abcdef', [{ start: 0, end: 6, bold: true, italic: true }])
    applyStyle(d, { start: P('t0', 2), end: P('t0', 4) }, 'bold')
    const m = normalizeMarks(d.paras[0].marks, 6)
    const has = (pos: number, key: 'bold' | 'italic') =>
      m.some((x) => x[key] && x.start <= pos && x.end > pos)
    // italic은 전 구간 유지
    for (let i = 0; i < 6; i++) expect(has(i, 'italic')).toBe(true)
    // bold는 [2,4)만 빠짐
    expect(has(1, 'bold')).toBe(true)
    expect(has(2, 'bold')).toBe(false)
    expect(has(3, 'bold')).toBe(false)
    expect(has(4, 'bold')).toBe(true)
  })

  it('size 설정', () => {
    const d = doc1('abcdef')
    applyStyle(d, { start: P('t0', 0), end: P('t0', 6) }, 'size', 20)
    expect(d.paras[0].marks).toEqual([{ start: 0, end: 6, size: 20 }])
  })

  it('queryStyle: 전체 bold면 true', () => {
    const d = doc1('abcdef', [{ start: 1, end: 4, bold: true }])
    expect(queryStyle(d, { start: P('t0', 1), end: P('t0', 4) }).bold).toBe(true)
    expect(queryStyle(d, { start: P('t0', 0), end: P('t0', 4) }).bold).toBeUndefined()
  })

  it('queryStyle: 범위가 균일한 size면 그 값, 섞이거나 구멍이면 undefined', () => {
    const d = doc1('abcdef', [{ start: 0, end: 6, size: 24 }])
    // 전체가 24 균일
    expect(queryStyle(d, { start: P('t0', 0), end: P('t0', 6) }).size).toBe(24)
    // 크기 없는 구간을 포함하면 undefined
    const d2 = doc1('abcdef', [{ start: 0, end: 3, size: 24 }])
    expect(queryStyle(d2, { start: P('t0', 0), end: P('t0', 6) }).size).toBeUndefined()
    // 두 크기가 섞이면 undefined
    const d3 = doc1('abcdef', [
      { start: 0, end: 3, size: 24 },
      { start: 3, end: 6, size: 16 }
    ])
    expect(queryStyle(d3, { start: P('t0', 0), end: P('t0', 6) }).size).toBeUndefined()
  })
})

describe('인라인 서식: sliceMarks (렌더 세그먼트)', () => {
  it('서식 없으면 단일 세그먼트', () => {
    expect(sliceMarks('abc', [])).toEqual([{ text: 'abc', style: {} }])
  })
  it('빈 텍스트는 빈 배열', () => {
    expect(sliceMarks('', [])).toEqual([])
  })
  it('중간 bold 세그먼트 분할', () => {
    const segs = sliceMarks('abcdef', [{ start: 2, end: 4, bold: true }])
    expect(segs).toEqual([
      { text: 'ab', style: {} },
      { text: 'cd', style: { bold: true } },
      { text: 'ef', style: {} }
    ])
  })
  it('겹치는 스타일 합집합', () => {
    const segs = sliceMarks('abcdef', [
      { start: 0, end: 4, bold: true },
      { start: 2, end: 6, italic: true }
    ])
    expect(segs[0]).toEqual({ text: 'ab', style: { bold: true } })
    expect(segs[1]).toEqual({ text: 'cd', style: { bold: true, italic: true } })
    expect(segs[2]).toEqual({ text: 'ef', style: { italic: true } })
  })
  it('세그먼트 텍스트 합치면 원본', () => {
    const text = '가나다라마바'
    const segs = sliceMarks(text, [{ start: 1, end: 3, bold: true }, { start: 4, end: 5, size: 20 }])
    expect(segs.map((s) => s.text).join('')).toBe(text)
  })
})

describe('이미지 블록: insertImageAt / removeParaById', () => {
  const img = { src: '/favicon.png', alt: '테스트' }

  it('편집문단 중간에 이미지 삽입 → 앞/이미지/뒤 분할', () => {
    const d: EditorDoc = { paras: [{ id: 't0', text: 'abcdef', kind: 'body' }] }
    const caret = insertImageAt(d, P('t0', 3), img)
    expect(d.paras.map((p) => p.kind)).toEqual(['body', 'image', 'body'])
    expect(d.paras[0].text).toBe('abc')
    expect(d.paras[1].meta).toEqual(img)
    expect(d.paras[2].text).toBe('def')
    expect(caret.paraId).toBe(d.paras[2].id)
    expect(checkInvariants(d)).toBeNull()
  })

  it('이미지 삽입 시 marks도 분할', () => {
    const d: EditorDoc = {
      paras: [{ id: 't0', text: 'abcdef', kind: 'body', marks: [{ start: 1, end: 5, bold: true }] }]
    }
    insertImageAt(d, P('t0', 3), img)
    expect(d.paras[0].marks).toEqual([{ start: 1, end: 3, bold: true }])
    expect(d.paras[2].marks).toEqual([{ start: 0, end: 2, bold: true }])
  })

  it('잠긴 블록(heading) 위에서는 뒤에 삽입', () => {
    const d: EditorDoc = {
      paras: [{ id: 't0', text: '섹션', kind: 'heading' }, { id: 't1', text: 'x', kind: 'body' }]
    }
    insertImageAt(d, P('t0', 1), img)
    expect(d.paras.map((p) => p.kind)).toEqual(['heading', 'image', 'body', 'body'])
    expect(d.paras[0].text).toBe('섹션') // heading 보존
  })

  it('removeParaById로 이미지 삭제', () => {
    const d: EditorDoc = {
      paras: [
        { id: 't0', text: 'a', kind: 'body' },
        { id: 't1', text: '', kind: 'image', meta: img },
        { id: 't2', text: 'b', kind: 'body' }
      ]
    }
    const caret = removeParaById(d, 't1')
    expect(d.paras.map((p) => p.kind)).toEqual(['body', 'body'])
    expect(caret.paraId).toBe('t0')
    expect(checkInvariants(d)).toBeNull()
  })

  it('마지막 문단 삭제 시 빈 body 유지', () => {
    const d: EditorDoc = { paras: [{ id: 't0', text: '', kind: 'image', meta: img }] }
    removeParaById(d, 't0')
    expect(d.paras.length).toBe(1)
    expect(d.paras[0].kind).toBe('body')
    expect(checkInvariants(d)).toBeNull()
  })
})

describe('표 블록: insertTableAt', () => {
  const tbl = { title: '해석', headers: ['분류', '해석'], rows: [['집', 'a'], ['나무', 'b']] }

  it('편집문단 중간에 표 삽입 → 앞/표/뒤 분할', () => {
    const d: EditorDoc = { paras: [{ id: 't0', text: 'abcdef', kind: 'body' }] }
    const caret = insertTableAt(d, P('t0', 3), tbl)
    expect(d.paras.map((p) => p.kind)).toEqual(['body', 'table', 'body'])
    expect(d.paras[0].text).toBe('abc')
    expect(d.paras[1].meta).toEqual(tbl)
    expect(d.paras[2].text).toBe('def')
    expect(caret.paraId).toBe(d.paras[2].id)
    expect(checkInvariants(d)).toBeNull()
  })

  it('표는 잠긴 블록 — 텍스트 편집/삭제 프리미티브가 보존', () => {
    const d: EditorDoc = {
      paras: [
        { id: 't0', text: 'x', kind: 'body' },
        { id: 't1', text: '', kind: 'table', meta: tbl },
        { id: 't2', text: 'y', kind: 'body' }
      ]
    }
    // t0 끝에서 Delete → 다음이 table(잠김)이라 병합 안 됨
    deleteForward(d, P('t0', 1))
    expect(d.paras.map((p) => p.kind)).toEqual(['body', 'table', 'body'])
    // removeParaById로는 삭제 가능
    removeParaById(d, 't1')
    expect(d.paras.map((p) => p.kind)).toEqual(['body', 'body'])
    expect(checkInvariants(d)).toBeNull()
  })
})

describe('리스트: toggleList / indentList', () => {
  const sel = (id: string, off = 0) => ({ start: P(id, off), end: P(id, off) })

  it('단일 문단을 불릿 리스트로 토글 / 재토글로 해제', () => {
    const d = makeDoc(['첫째'])
    toggleList(d, sel('t0'), 'bullet')
    expect(d.paras[0].listType).toBe('bullet')
    expect(d.paras[0].indent).toBe(0)
    // 같은 타입 재토글 → 해제
    toggleList(d, sel('t0'), 'bullet')
    expect(d.paras[0].listType).toBeUndefined()
    expect(d.paras[0].indent).toBeUndefined()
  })

  it('불릿→번호 전환 (다른 타입 토글은 교체)', () => {
    const d = makeDoc(['x'])
    toggleList(d, sel('t0'), 'bullet')
    toggleList(d, sel('t0'), 'number')
    expect(d.paras[0].listType).toBe('number')
  })

  it('여러 문단 선택 → 모두 같은 리스트로', () => {
    const d = makeDoc(['a', 'b', 'c'])
    toggleList(d, { start: P('t0', 0), end: P('t2', 1) }, 'number')
    expect(d.paras.map((p) => p.listType)).toEqual(['number', 'number', 'number'])
  })

  it('리스트 항목에서 엔터 → 새 항목이 같은 listType/indent 상속', () => {
    const d = makeDoc(['항목1'])
    toggleList(d, sel('t0'), 'bullet')
    d.paras[0].indent = 1
    const caret = splitAt(d, P('t0', 3))
    const np = d.paras[1]
    expect(np.listType).toBe('bullet')
    expect(np.indent).toBe(1)
    expect(caret.paraId).toBe(np.id)
  })

  it('빈 리스트 항목에서 엔터 → 리스트 탈출(들여쓰기 해제 후 일반 문단)', () => {
    const d = makeDoc([''])
    toggleList(d, sel('t0'), 'bullet')
    d.paras[0].indent = 1
    // 1단계 들여쓴 빈 항목에서 엔터 → indent 감소, 분할 없음
    splitAt(d, P('t0', 0))
    expect(d.paras.length).toBe(1)
    expect(d.paras[0].indent).toBe(0)
    expect(d.paras[0].listType).toBe('bullet')
    // 한 번 더 → 리스트 자체 해제
    splitAt(d, P('t0', 0))
    expect(d.paras[0].listType).toBeUndefined()
  })

  it('리스트 항목 맨앞 백스페이스 → 병합 대신 리스트 탈출', () => {
    const d = makeDoc(['이전', '항목'])
    toggleList(d, sel('t1'), 'bullet')
    const caret = deleteBackward(d, P('t1', 0))
    // 병합 안 됨: 두 문단 유지, t1은 리스트 해제
    expect(d.paras.length).toBe(2)
    expect(d.paras[1].listType).toBeUndefined()
    expect(caret).toEqual(P('t1', 0))
  })

  it('indentList: Tab 들여쓰기 / Shift+Tab 내어쓰기, 0~5 클램프', () => {
    const d = makeDoc(['x'])
    toggleList(d, sel('t0'), 'bullet')
    indentList(d, sel('t0'), 1)
    expect(d.paras[0].indent).toBe(1)
    indentList(d, sel('t0'), -1)
    expect(d.paras[0].indent).toBeUndefined() // 0이면 필드 제거
    // 하한 클램프
    indentList(d, sel('t0'), -1)
    expect(d.paras[0].indent).toBeUndefined()
    // 상한 클램프(5)
    for (let i = 0; i < 10; i++) indentList(d, sel('t0'), 1)
    expect(d.paras[0].indent).toBe(5)
  })

  it('리스트 아닌 문단은 indentList 무시', () => {
    const d = makeDoc(['일반'])
    indentList(d, sel('t0'), 1)
    expect(d.paras[0].indent).toBeUndefined()
  })
})

describe('블록 서식: toggleBlockStyle / insertDividerAt', () => {
  const sel = (id: string, off = 0) => ({ start: P(id, off), end: P(id, off) })

  it('타이틀 블록 토글 / 재토글 해제', () => {
    const d = makeDoc(['제목'])
    toggleBlockStyle(d, sel('t0'), 'heading')
    expect(d.paras[0].blockStyle).toBe('heading')
    toggleBlockStyle(d, sel('t0'), 'heading')
    expect(d.paras[0].blockStyle).toBeUndefined()
  })

  it('블록 서식과 리스트는 배타적 (블록 설정 시 리스트 제거)', () => {
    const d = makeDoc(['x'])
    toggleList(d, sel('t0'), 'bullet')
    toggleBlockStyle(d, sel('t0'), 'quote')
    expect(d.paras[0].blockStyle).toBe('quote')
    expect(d.paras[0].listType).toBeUndefined()
  })

  it('리스트 설정 시 블록 서식 제거', () => {
    const d = makeDoc(['x'])
    toggleBlockStyle(d, sel('t0'), 'heading')
    toggleList(d, sel('t0'), 'number')
    expect(d.paras[0].listType).toBe('number')
    expect(d.paras[0].blockStyle).toBeUndefined()
  })

  it('구분선 삽입 → divider 잠긴 블록 + 뒤에 빈 body', () => {
    const d = makeDoc(['본문'])
    const caret = insertDividerAt(d, P('t0', 2))
    const kinds = d.paras.map((p) => p.kind ?? 'body')
    expect(kinds).toContain('divider')
    // 커서는 삽입 뒤 편집 가능 문단
    const cp = d.paras.find((p) => p.id === caret.paraId)
    expect(cp?.kind ?? 'body').toBe('body')
    expect(checkInvariants(d)).toBeNull()
  })
})

describe('죽은 문서 방지: 편집 가능 body 최소 1개 불변식', () => {
  it('잠긴 블록 사이 빈 body 포함 전체선택 삭제 → 빈 body 유지, 커서도 그리로', () => {
    const d: EditorDoc = {
      paras: [
        { id: 'img', text: '', kind: 'image', meta: { src: 'x' } },
        { id: 'b', text: '', kind: 'body' },
        { id: 'h', text: '제목', kind: 'heading' }
      ]
    }
    const caret = deleteRange(d, { start: P('img', 0), end: P('h', 2) })
    // 편집 가능한 body가 최소 1개 남아야 한다(죽은 문서 방지)
    expect(checkInvariants(d)).toBeNull()
    // 커서는 편집 가능한 문단을 가리켜야 한다
    const cp = d.paras.find((p) => p.id === caret.paraId)
    expect(cp && (cp.kind ?? 'body') === 'body').toBe(true)
  })

  it('removeParaById로 잠긴 블록만 남으면 빈 body 추가', () => {
    const d: EditorDoc = {
      paras: [
        { id: 'img', text: '', kind: 'image', meta: { src: 'x' } },
        { id: 'div', text: '', kind: 'divider', meta: { divider: true } }
      ]
    }
    const caret = removeParaById(d, 'img')
    expect(checkInvariants(d)).toBeNull()
    const cp = d.paras.find((p) => p.id === caret.paraId)
    expect(cp && (cp.kind ?? 'body') === 'body').toBe(true)
  })

  it('checkInvariants가 편집 가능 body 0개를 죽은 문서로 잡는다', () => {
    const dead: EditorDoc = {
      paras: [{ id: 'div', text: '', kind: 'divider', meta: { divider: true } }]
    }
    expect(checkInvariants(dead)).not.toBeNull()
  })
})
