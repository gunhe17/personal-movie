/**
 * 에디터 코어 — 순수 모델 편집 프리미티브 (DOM 무관)
 *
 * 문서 = { paras: [{ id, text }] }. 좌표 pos = { paraId, offset },
 * 선택 msel = { start, end }. 모든 함수는 doc을 mutate하고 새 커서 pos를 반환한다.
 *
 * 이 모듈은 DOM/브라우저에 의존하지 않아 단위 테스트가 가능하다.
 * (scratchpad editor-core-test로 20개 엣지케이스 검증 완료)
 */

/**
 * 문단 종류.
 * - body: 일반 편집 문단 (기본값)
 * - heading: 섹션 제목 — 편집·분할·병합·삭제 불가 (고정 서식)
 * - cover: 표지 블록 — 편집·분할·병합·삭제 불가
 * - image: 첨부 이미지 블록 — 텍스트 편집 불가(잠김). 전용 API로 삽입/삭제.
 * - table: 표 블록(해석 표 등) — 텍스트 편집 불가(잠김). 전용 API로 삽입/삭제.
 * - divider: 가로 구분선(hr) — 편집 불가(잠김). 전용 API로 삽입/삭제.
 * 하위호환: kind 없으면 body로 취급한다.
 */
export type ParaKind = 'body' | 'heading' | 'cover' | 'image' | 'table' | 'divider'

/** 인라인 서식 종류 (불리언 토글) */
export interface MarkStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** 글자 크기(px). 없으면 기본. */
  size?: number
}
export type MarkKey = keyof MarkStyle

/**
 * 인라인 서식 범위. [start, end) 문자 오프셋에 style 적용.
 * text와 병행 관리(parallel marks)한다 — 편집 프리미티브가 offset 변화에 맞춰
 * marks를 rebase한다. 겹치는 같은 스타일은 normalizeMarks로 병합한다.
 */
export interface Mark extends MarkStyle {
  start: number
  end: number
}

/**
 * 리스트 종류. body 문단에 부착되는 표시 속성(별도 kind가 아니다).
 * - bullet: 불릿 목록(•)
 * - number: 번호 목록(1. 2. …) — 번호는 렌더 시 자동 계산
 * listType이 있는 문단도 여전히 kind='body'라 자유 편집·서식이 그대로 적용된다.
 */
export type ListType = 'bullet' | 'number'

/**
 * 블록 서식(body 문단에 부착되는 표시 속성). 없으면 일반 문단.
 * - heading: 꾸며진 섹션 제목(연파랑 배경 + 좌측 파란 바) — 기존 보고서 section-title 톤
 * - quote: 인용 블록(좌측 회색 바 + 들여쓰기)
 * heading kind(잠긴 블록)와 달리 이건 편집 가능한 body에 얹는 표시라 내용 수정이 된다.
 */
export type BlockStyle = 'heading' | 'quote'

export interface Para {
  id: string
  text: string
  kind?: ParaKind
  /** 인라인 서식 범위들. 없으면 서식 없음(순수 텍스트). */
  marks?: Mark[]
  /**
   * 리스트 표시(body 문단 전용). 없으면 일반 문단.
   * kind는 body 그대로 — 편집/분할/병합/서식은 기존 코어가 처리하고,
   * 리스트는 렌더 마커 + 엔터/탭/백스페이스 동작 규칙만 얹는다.
   */
  listType?: ListType
  /** 리스트 중첩 깊이(0부터). listType이 있을 때만 의미. */
  indent?: number
  /** 블록 서식(heading/quote). 없으면 일반 문단. listType과 배타적. */
  blockStyle?: BlockStyle
  /**
   * cover 블록 등 구조 데이터(표지/마무리 정보)를 실을 자리. 렌더는 컴포넌트가 처리.
   * 형태는 렌더러(report-cover의 CoverMeta)가 정의한다. 코어는 내용을 해석하지 않는다.
   */
  meta?: unknown
}

/** 리스트 중첩 최대 깊이 */
const MAX_LIST_INDENT = 5

const STYLE_KEYS: MarkKey[] = ['bold', 'italic', 'underline', 'strike', 'size']

/** mark의 스타일 부분만 추출 (start/end 제외) */
function markStyle(m: Mark): MarkStyle {
  const s: MarkStyle = {}
  for (const k of STYLE_KEYS) {
    const v = m[k]
    if (v !== undefined && v !== false) (s as Record<string, unknown>)[k] = v
  }
  return s
}
/** 두 스타일이 동일한가 */
function sameStyle(a: MarkStyle, b: MarkStyle): boolean {
  for (const k of STYLE_KEYS) {
    if (a[k] !== b[k]) return false
  }
  return true
}
/** 스타일이 비었나(적용할 서식 없음) */
function emptyStyle(s: MarkStyle): boolean {
  return STYLE_KEYS.every((k) => s[k] === undefined || s[k] === false)
}

/**
 * marks 정규화: 빈/역전 범위 제거, 오프셋순 정렬, 인접·겹치는 동일 스타일 병합.
 * 편집 프리미티브가 marks를 건드린 뒤 항상 호출해 불변식을 회복한다.
 */
export function normalizeMarks(marks: Mark[] | undefined, textLen: number): Mark[] {
  if (!marks || !marks.length) return []
  const clipped: Mark[] = []
  for (const m of marks) {
    const start = Math.max(0, Math.min(m.start, textLen))
    const end = Math.max(0, Math.min(m.end, textLen))
    if (end <= start) continue
    const style = markStyle(m)
    if (emptyStyle(style)) continue
    clipped.push({ start, end, ...style })
  }
  if (!clipped.length) return []
  clipped.sort((a, b) => a.start - b.start || a.end - b.end)
  // 같은 스타일이면서 겹치거나 맞닿은 것 병합
  const out: Mark[] = []
  for (const m of clipped) {
    const last = out.find(
      (o) => sameStyle(markStyle(o), markStyle(m)) && m.start <= o.end && m.end >= o.start
    )
    if (last) last.end = Math.max(last.end, m.end)
    else out.push({ ...m })
  }
  return out
}

/** 렌더용 세그먼트: 동일 스타일이 연속된 텍스트 조각 */
export interface StyledSegment {
  text: string
  style: MarkStyle
}

/**
 * text를 marks에 따라 스타일이 균일한 세그먼트들로 분할한다(렌더용).
 * 스타일 없는 구간은 style={}. 문자 오프셋 경계마다 스타일 변화를 반영.
 */
export function sliceMarks(text: string, marks: Mark[] | undefined): StyledSegment[] {
  if (!text.length) return []
  const norm = normalizeMarks(marks, text.length)
  if (!norm.length) return [{ text, style: {} }]

  // 스타일 변화 경계 수집
  const bounds = new Set<number>([0, text.length])
  for (const m of norm) {
    bounds.add(m.start)
    bounds.add(m.end)
  }
  const points = [...bounds].sort((a, b) => a - b)

  const segs: StyledSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i],
      e = points[i + 1]
    if (e <= s) continue
    // 이 구간을 덮는 모든 mark의 스타일 합집합
    const style: MarkStyle = {}
    for (const m of norm) {
      if (m.start <= s && m.end >= e) {
        for (const k of STYLE_KEYS) {
          const v = m[k]
          if (v !== undefined && v !== false) (style as Record<string, unknown>)[k] = v
        }
      }
    }
    segs.push({ text: text.slice(s, e), style })
  }
  return segs
}

/**
 * text 편집에 맞춰 marks를 rebase한다.
 * pos 위치에서 delLen 글자 삭제 후 insLen 글자 삽입된 것으로 모델링한다.
 * (순수 삽입: delLen=0 / 순수 삭제: insLen=0)
 * inheritStyle: 삽입된 구간에 입힐 스타일(타이핑 시 인접 서식 상속). 없으면 서식 없음.
 */
export function rebaseMarks(
  marks: Mark[] | undefined,
  pos: number,
  delLen: number,
  insLen: number,
  inheritStyle?: MarkStyle
): Mark[] {
  const delEnd = pos + delLen
  const shift = insLen - delLen
  // 순수 삽입(delLen===0)인가. 이때 경계(=== pos)에서 mark 끝을 밀면
  // 삽입된 새 글자가 앞 mark에 흡수돼 서식이 번진다(예: bold "A" 뒤 타이핑).
  // → 순수 삽입에서는 '커서에서 끝나는' mark(e === pos)는 밀지 않는다.
  const pureInsert = delLen === 0
  const out: Mark[] = []
  for (const m of marks ?? []) {
    // 삭제 구간 반영: [start,end)에서 [pos,delEnd) 제거
    let s = m.start
    let e = m.end
    // 시작점 조정 (삽입 앞에서 시작하는 mark는 밀려야 새 글자를 포함 안 함)
    if (s >= delEnd) s += shift
    else if (s > pos) s = pos // 삭제 구간 안이면 pos로 당김
    // 끝점 조정
    if (pureInsert && e === pos) {
      // 커서에 딱 맞닿아 끝나는 mark: 밀지 않음 → 새 글자는 이 mark 밖.
    } else if (e >= delEnd) {
      e += shift
    } else if (e > pos) {
      e = pos
    }
    if (e > s) out.push({ start: s, end: e, ...markStyle(m) })
  }
  // 삽입 구간에 상속 스타일 적용
  if (insLen > 0 && inheritStyle && !emptyStyle(inheritStyle)) {
    out.push({ start: pos, end: pos + insLen, ...inheritStyle })
  }
  return out
}

/** 편집(입력/분할/병합/삭제) 가능한 문단인가. heading/cover는 잠긴다. */
export function isEditable(p: Para | undefined): boolean {
  return !!p && (p.kind ?? 'body') === 'body'
}
export interface EditorDoc {
  paras: Para[]
}
export interface Pos {
  paraId: string
  offset: number
}
export interface ModelSelection {
  start: Pos
  end: Pos
  collapsed?: boolean
}

let _uid = 0
export function makeUid(): string {
  return 'p' + ++_uid
}
const idIndex = (doc: EditorDoc, id: string): number =>
  doc.paras.findIndex((p) => p.id === id)

/** 서로게이트 페어(이모지 등) 안전한 문자 경계 */
function prevCharOffset(text: string, offset: number): number {
  if (offset <= 0) return 0
  const code = text.charCodeAt(offset - 1)
  if (code >= 0xdc00 && code <= 0xdfff && offset >= 2) return offset - 2
  return offset - 1
}
function nextCharOffset(text: string, offset: number): number {
  if (offset >= text.length) return text.length
  const code = text.charCodeAt(offset)
  if (code >= 0xd800 && code <= 0xdbff && offset + 2 <= text.length) return offset + 2
  return offset + 1
}

/** 두 문단 병합 시 marks 합치기: prev의 marks + next의 marks(prevLen만큼 shift) */
function mergeMarks(
  prevMarks: Mark[] | undefined,
  prevLen: number,
  nextMarks: Mark[] | undefined,
  totalLen: number
): Mark[] {
  const shifted = (nextMarks ?? []).map((m) => ({
    ...m,
    start: m.start + prevLen,
    end: m.end + prevLen
  }))
  return normalizeMarks([...(prevMarks ?? []), ...shifted], totalLen)
}

/** 문서 순서로 start<=end 정렬 */
export function orderSel(doc: EditorDoc, msel: ModelSelection): ModelSelection {
  const si = idIndex(doc, msel.start.paraId),
    ei = idIndex(doc, msel.end.paraId)
  if (si < ei || (si === ei && msel.start.offset <= msel.end.offset)) return msel
  return { start: msel.end, end: msel.start }
}

/**
 * 선택 범위 삭제. 삭제 후 커서 pos 반환.
 *
 * 고정 서식 규칙: 범위 안의 heading/cover(잠긴 블록)는 삭제하지 않는다.
 * - 시작/끝 문단이 잠겨 있으면 그 문단 텍스트는 건드리지 않고 경계만 조정.
 * - 범위가 잠긴 블록을 걸치면 병합하지 않고, 잠긴 블록 앞뒤의 편집 가능 문단만
 *   각자 잘라낸다(문단 구조는 유지). 커서는 첫 편집 지점으로.
 */
export function deleteRange(doc: EditorDoc, msel: ModelSelection): Pos {
  const { start, end } = orderSel(doc, msel)
  const si = idIndex(doc, start.paraId),
    ei = idIndex(doc, end.paraId)
  if (si === -1 || ei === -1) return start

  // 단일 문단: 편집 가능할 때만 자른다.
  if (si === ei) {
    const p = doc.paras[si]
    if (!isEditable(p)) return { paraId: p.id, offset: start.offset }
    const delLen = end.offset - start.offset
    p.marks = normalizeMarks(
      rebaseMarks(p.marks, start.offset, delLen, 0),
      p.text.length - delLen
    )
    p.text = p.text.slice(0, start.offset) + p.text.slice(end.offset)
    return { paraId: p.id, offset: start.offset }
  }

  const first = doc.paras[si],
    last = doc.paras[ei]

  // 범위 안에 잠긴 블록이 하나라도 있으면 병합 금지 경로.
  let hasLocked = false
  for (let i = si; i <= ei; i++) {
    if (!isEditable(doc.paras[i])) {
      hasLocked = true
      break
    }
  }

  if (!hasLocked) {
    // 기존 동작: 첫 문단 꼬리 + 마지막 문단 머리 병합, 사이 제거.
    const newText = first.text.slice(0, start.offset) + last.text.slice(end.offset)
    // 첫 문단 marks: start.offset 이하만 유지
    const keepFirst = (first.marks ?? []).map((m) => ({
      ...m,
      end: Math.min(m.end, start.offset)
    }))
    // 마지막 문단 marks: end.offset 이후를 start.offset 기준으로 당김
    const keepLast = (last.marks ?? [])
      .filter((m) => m.end > end.offset)
      .map((m) => ({
        ...m,
        start: Math.max(0, m.start - end.offset) + start.offset,
        end: m.end - end.offset + start.offset
      }))
    first.marks = normalizeMarks([...keepFirst, ...keepLast], newText.length)
    first.text = newText
    doc.paras.splice(si + 1, ei - si)
    return { paraId: first.id, offset: start.offset }
  }

  // 잠긴 블록 보존 경로: 각 문단을 제자리에서 잘라내되 잠긴 블록은 통째로 남긴다.
  // 편집 가능한 문단 중 완전히 비워진 것(첫/끝 아님)은 제거하지 않는다 — 구조 안정성 우선.
  const removeIds: string[] = []
  for (let i = si; i <= ei; i++) {
    const p = doc.paras[i]
    if (!isEditable(p)) continue
    const from = i === si ? start.offset : 0
    const to = i === ei ? end.offset : p.text.length
    p.marks = normalizeMarks(
      rebaseMarks(p.marks, from, to - from, 0),
      p.text.length - (to - from)
    )
    p.text = p.text.slice(0, from) + p.text.slice(to)
    // 중간(첫/끝이 아닌) 편집 문단이 완전히 비면 제거 대상
    if (i !== si && i !== ei && p.text.length === 0) removeIds.push(p.id)
  }
  if (removeIds.length) {
    doc.paras = doc.paras.filter((p) => !removeIds.includes(p.id))
  }
  // 삭제 결과 편집 가능한 body가 하나도 없으면(잠긴 블록만 남음) 빈 body를 넣어
  // 죽은 문서를 막는다. 삭제 시작 문단(first) 자리에 넣어 커서를 자연스럽게 둔다.
  const filled = ensureEditableBody(doc, idIndex(doc, first.id) + 1)
  if (filled) return { paraId: filled.id, offset: 0 }
  // 커서: 시작 문단이 편집 가능하면 그 자리, 아니면 범위 내 첫 편집 문단 시작.
  if (isEditable(first)) return { paraId: first.id, offset: start.offset }
  for (let i = idIndex(doc, first.id); i < doc.paras.length; i++) {
    if (isEditable(doc.paras[i])) return { paraId: doc.paras[i].id, offset: 0 }
  }
  // 폴백: 문서 어디든 편집 가능한 첫 문단(이제 항상 존재)
  const anyEditable = doc.paras.find((p) => isEditable(p))!
  return { paraId: anyEditable.id, offset: 0 }
}

/**
 * collapsed 커서에 텍스트 삽입. 줄바꿈은 문단 분할.
 * inheritStyle: 삽입 텍스트에 입힐 서식(타이핑 시 인접 mark 상속). 단일 라인에만 적용.
 */
export function insertTextAt(
  doc: EditorDoc,
  pos: Pos,
  text: string,
  inheritStyle?: MarkStyle
): Pos {
  const i = idIndex(doc, pos.paraId)
  if (i === -1) return pos
  const p = doc.paras[i]
  if (!isEditable(p)) return pos // 잠긴 블록엔 입력 불가
  const before = p.text.slice(0, pos.offset)
  const after = p.text.slice(pos.offset)
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  if (lines.length === 1) {
    const insLen = lines[0].length
    p.marks = normalizeMarks(
      rebaseMarks(p.marks, pos.offset, 0, insLen, inheritStyle),
      before.length + insLen + after.length
    )
    p.text = before + lines[0] + after
    return { paraId: p.id, offset: (before + lines[0]).length }
  }

  // 멀티라인: 원 문단은 [before + lines[0]]로, after는 마지막 새 문단 꼬리로.
  // marks는 분할점(pos.offset) 기준으로 앞은 원문단, after 부분은 마지막 문단으로 이동.
  const firstText = before + lines[0]
  const origMarks = p.marks ?? []
  // 원 문단 marks: pos.offset 이하만 유지 (삽입 텍스트는 서식 없음)
  p.marks = normalizeMarks(
    origMarks.map((m) => ({ ...m, end: Math.min(m.end, pos.offset) })),
    firstText.length
  )
  p.text = firstText

  const newParas: Para[] = []
  for (let k = 1; k < lines.length; k++) {
    const isLast = k === lines.length - 1
    const para: Para = {
      id: makeUid(),
      text: isLast ? lines[k] + after : lines[k],
      kind: 'body'
    }
    if (isLast && after.length) {
      // after에 걸쳐 있던 원 marks를 마지막 문단 꼬리 위치로 shift
      const afterStart = lines[k].length // 마지막 문단 내 after 시작 오프셋
      const shifted: Mark[] = origMarks
        .filter((m) => m.end > pos.offset)
        .map((m) => ({
          ...m,
          start: Math.max(0, m.start - pos.offset) + afterStart,
          end: Math.max(0, m.end - pos.offset) + afterStart
        }))
      para.marks = normalizeMarks(shifted, para.text.length)
    }
    newParas.push(para)
  }
  doc.paras.splice(i + 1, 0, ...newParas)
  const lastP = newParas[newParas.length - 1]
  return { paraId: lastP.id, offset: lines[lines.length - 1].length }
}

/** 엔터: 커서에서 문단 분할. 새 문단 시작 pos 반환. marks도 분할점 기준으로 나눈다.
 *  리스트 항목이면 새 문단이 같은 listType/indent를 이어받는다.
 *  단, 빈 리스트 항목에서 엔터를 치면 리스트를 탈출한다(listType 제거, 분할 없음). */
export function splitAt(doc: EditorDoc, pos: Pos): Pos {
  const i = idIndex(doc, pos.paraId)
  if (i === -1) return pos
  const p = doc.paras[i]
  if (!isEditable(p)) return pos // 잠긴 블록은 엔터로 분할 불가

  // 빈 리스트 항목에서 엔터 → 리스트 탈출: 한 단계 내리거나(indent>0) 일반 문단으로.
  if (p.listType && p.text.length === 0) {
    if ((p.indent ?? 0) > 0) {
      p.indent = (p.indent ?? 0) - 1
    } else {
      delete p.listType
      delete p.indent
    }
    return { paraId: p.id, offset: 0 }
  }

  const after = p.text.slice(pos.offset)
  const origMarks = p.marks ?? []

  p.text = p.text.slice(0, pos.offset)
  p.marks = normalizeMarks(
    origMarks.map((m) => ({ ...m, end: Math.min(m.end, pos.offset) })),
    p.text.length
  )

  const np: Para = { id: makeUid(), text: after, kind: 'body' }
  // 리스트 속성 상속 (새 항목도 같은 리스트에 이어짐)
  if (p.listType) {
    np.listType = p.listType
    if (p.indent) np.indent = p.indent
  }
  np.marks = normalizeMarks(
    origMarks
      .filter((m) => m.end > pos.offset)
      .map((m) => ({
        ...m,
        start: Math.max(0, m.start - pos.offset),
        end: m.end - pos.offset
      })),
    after.length
  )
  doc.paras.splice(i + 1, 0, np)
  return { paraId: np.id, offset: 0 }
}

/** 백스페이스 1칸. 문단 맨앞이면 이전 문단과 병합. */
export function deleteBackward(doc: EditorDoc, pos: Pos): Pos {
  const i = idIndex(doc, pos.paraId)
  if (i === -1) return pos
  const p = doc.paras[i]
  if (!isEditable(p)) return pos // 잠긴 블록 안에서는 삭제 불가
  if (pos.offset > 0) {
    const prevOffset = prevCharOffset(p.text, pos.offset)
    const delLen = pos.offset - prevOffset
    p.marks = normalizeMarks(
      rebaseMarks(p.marks, prevOffset, delLen, 0),
      p.text.length - delLen
    )
    p.text = p.text.slice(0, prevOffset) + p.text.slice(pos.offset)
    return { paraId: p.id, offset: prevOffset }
  }
  // 리스트 항목 맨앞에서 백스페이스 → 이전 문단 병합 대신 리스트 탈출(들여쓰기 해제)
  if (p.listType) {
    if ((p.indent ?? 0) > 0) {
      p.indent = (p.indent ?? 0) - 1
    } else {
      delete p.listType
      delete p.indent
    }
    return { paraId: p.id, offset: 0 }
  }
  if (i > 0) {
    const prev = doc.paras[i - 1]
    if (!isEditable(prev)) return pos // 앞이 잠긴 블록(heading 등)이면 병합 금지
    const mergeOffset = prev.text.length
    prev.marks = mergeMarks(prev.marks, prev.text.length, p.marks, prev.text.length + p.text.length)
    prev.text += p.text
    doc.paras.splice(i, 1)
    return { paraId: prev.id, offset: mergeOffset }
  }
  return pos
}

/** Delete(forward) 1칸. 문단 맨끝이면 다음 문단과 병합. */
export function deleteForward(doc: EditorDoc, pos: Pos): Pos {
  const i = idIndex(doc, pos.paraId)
  if (i === -1) return pos
  const p = doc.paras[i]
  if (!isEditable(p)) return pos // 잠긴 블록 안에서는 삭제 불가
  if (pos.offset < p.text.length) {
    const nextOffset = nextCharOffset(p.text, pos.offset)
    const delLen = nextOffset - pos.offset
    p.marks = normalizeMarks(
      rebaseMarks(p.marks, pos.offset, delLen, 0),
      p.text.length - delLen
    )
    p.text = p.text.slice(0, pos.offset) + p.text.slice(nextOffset)
    return { paraId: p.id, offset: pos.offset }
  }
  if (i < doc.paras.length - 1) {
    const next = doc.paras[i + 1]
    if (!isEditable(next)) return pos // 다음이 잠긴 블록(heading 등)이면 병합 금지
    p.marks = mergeMarks(p.marks, p.text.length, next.marks, p.text.length + next.text.length)
    p.text += next.text
    doc.paras.splice(i + 1, 1)
    return { paraId: p.id, offset: pos.offset }
  }
  return pos
}

// ── 인라인 서식 적용 API ──

/** 한 문단의 [from,to) 구간에서 특정 스타일 키가 '전 구간' 적용돼 있는지 */
function paraHasStyleFull(p: Para, from: number, to: number, key: MarkKey): boolean {
  if (to <= from) return false
  // [from,to)의 모든 위치가 key를 가진 mark로 덮여 있어야 true
  let covered = from
  const relevant = (p.marks ?? [])
    .filter((m) => m[key] !== undefined && m[key] !== false && m.end > from && m.start < to)
    .sort((a, b) => a.start - b.start)
  for (const m of relevant) {
    if (m.start > covered) break // 구멍 발견
    covered = Math.max(covered, m.end)
    if (covered >= to) return true
  }
  return covered >= to
}

/**
 * 문서 선택 범위 [start,end)에 스타일을 적용/토글한다.
 * - bold/italic/underline/strike: value 생략 시 토글(범위 전체 적용돼 있으면 해제)
 * - size: value(number)로 설정, value=undefined면 크기 해제
 * 여러 문단에 걸치면 각 문단의 해당 부분에 적용. 잠긴 블록은 건너뛴다.
 */
export function applyStyle(
  doc: EditorDoc,
  msel: ModelSelection,
  key: MarkKey,
  value?: boolean | number
): void {
  const { start, end } = orderSel(doc, msel)
  const si = idIndex(doc, start.paraId),
    ei = idIndex(doc, end.paraId)
  if (si === -1 || ei === -1) return

  // 각 문단의 대상 구간 목록
  const segs: Array<{ p: Para; from: number; to: number }> = []
  for (let i = si; i <= ei; i++) {
    const p = doc.paras[i]
    if (!isEditable(p)) continue
    const from = i === si ? start.offset : 0
    const to = i === ei ? end.offset : p.text.length
    if (to > from) segs.push({ p, from, to })
  }
  if (!segs.length) return

  // 토글 방향 결정 (불리언 스타일만): 모든 세그먼트가 이미 적용돼 있으면 해제
  let turnOn = true
  if (key !== 'size' && value === undefined) {
    turnOn = !segs.every((s) => paraHasStyleFull(s.p, s.from, s.to, key))
  } else if (key !== 'size') {
    turnOn = value === true
  }

  for (const { p, from, to } of segs) {
    const marks = p.marks ?? []
    if (key === 'size') {
      // 기존 size mark를 이 구간에서 걷어내고, value 있으면 새로 적용
      const cleared = clearStyleInRange(marks, from, to, 'size')
      if (value !== undefined) cleared.push({ start: from, end: to, size: value as number })
      p.marks = normalizeMarks(cleared, p.text.length)
    } else if (turnOn) {
      p.marks = normalizeMarks([...marks, { start: from, end: to, [key]: true }], p.text.length)
    } else {
      p.marks = normalizeMarks(clearStyleInRange(marks, from, to, key), p.text.length)
    }
  }
}

/** marks에서 [from,to) 구간에 걸친 특정 스타일 키를 제거(구간 분할). 다른 스타일은 보존. */
function clearStyleInRange(marks: Mark[], from: number, to: number, key: MarkKey): Mark[] {
  const out: Mark[] = []
  for (const m of marks) {
    if (m[key] === undefined || m[key] === false || m.end <= from || m.start >= to) {
      out.push({ ...m }) // 이 키와 무관하거나 범위 밖 → 그대로
      continue
    }
    // key를 가진 mark가 [from,to)와 겹침 → 겹치는 부분에서만 key 제거
    // 왼쪽 잔여
    if (m.start < from) out.push({ ...m, end: from })
    // 오른쪽 잔여
    if (m.end > to) out.push({ ...m, start: to })
    // 겹치는 부분에서 이 key만 뺀 나머지 스타일이 있으면 유지
    const rest = markStyle({ ...m, [key]: undefined } as Mark)
    if (!emptyStyle(rest)) {
      out.push({ start: Math.max(m.start, from), end: Math.min(m.end, to), ...rest })
    }
  }
  return out
}

/**
 * 선택 범위의 서식 상태 조회 (툴바 활성 표시용).
 * 각 불리언 키는 '범위 전체 적용'일 때만 true. size는 범위가 단일 크기면 그 값.
 */
export function queryStyle(doc: EditorDoc, msel: ModelSelection): MarkStyle {
  const { start, end } = orderSel(doc, msel)
  const si = idIndex(doc, start.paraId),
    ei = idIndex(doc, end.paraId)
  const res: MarkStyle = {}
  if (si === -1 || ei === -1) return res

  const segs: Array<{ p: Para; from: number; to: number }> = []
  for (let i = si; i <= ei; i++) {
    const p = doc.paras[i]
    if (!isEditable(p)) continue
    const from = i === si ? start.offset : 0
    const to = i === ei ? end.offset : p.text.length
    // collapsed(빈 범위)는 그 지점 직전 문자의 서식을 본다
    if (to > from) segs.push({ p, from, to })
  }
  if (!segs.length) return res

  for (const key of ['bold', 'italic', 'underline', 'strike'] as MarkKey[]) {
    if (segs.every((s) => paraHasStyleFull(s.p, s.from, s.to, key))) {
      ;(res as Record<string, unknown>)[key] = true
    }
  }
  // size: 범위 전체가 '동일한 하나의 크기'로 균일하면 그 값. 섞였거나
  // 크기 없는 구간이 있으면 undefined(기본 크기)로 남긴다.
  res.size = uniformSize(segs)
  return res
}

/** 세그먼트들이 전부 동일한 단일 size로 덮여 있으면 그 값, 아니면 undefined. */
function uniformSize(
  segs: Array<{ p: Para; from: number; to: number }>
): number | undefined {
  let common: number | undefined
  for (const { p, from, to } of segs) {
    // [from,to) 각 위치를 덮는 size를 훑어 하나로 수렴하는지 확인
    let covered = from
    const sized = (p.marks ?? [])
      .filter((m) => m.size !== undefined && m.end > from && m.start < to)
      .sort((a, b) => a.start - b.start)
    for (const m of sized) {
      if (m.start > covered) return undefined // 크기 없는 구멍 → 균일 아님
      if (common === undefined) common = m.size
      else if (common !== m.size) return undefined // 다른 크기 섞임
      covered = Math.max(covered, m.end)
    }
    if (covered < to) return undefined // 끝까지 안 덮임(기본 크기 구간 존재)
  }
  return common
}

// ── 이미지 블록 API ──

/** 이미지 블록 meta */
export interface ImageMeta {
  src: string
  alt?: string
  caption?: string
  /** 표시 너비(px). 없으면 기본. */
  width?: number
  /**
   * 출처 자료 식별자. 사이드바에서 "이미 첨부된 자료"를 표시하는 데 쓴다.
   * src는 차트처럼 매번 새로 생성되는 data URI일 수 있어 대조에 쓸 수 없다.
   */
  sourceId?: string
}

/** 표 블록 meta: 헤더 + 행들(각 셀은 문자열) */
export interface TableMeta {
  /** 표 제목(캡션) */
  title?: string
  headers: string[]
  rows: string[][]
  /**
   * 출처 자료 식별자. 사이드바에서 "이미 첨부된 자료"를 표시하는 데 쓴다.
   * (ImageMeta.sourceId와 같은 용도)
   */
  sourceId?: string
}

/**
 * 커서 위치(pos)에 잠긴 블록(image/table 등)을 삽입한다.
 * 편집 문단이면 커서에서 분할해 [앞] [블록] [뒤]로, 잠긴 블록 위면 그 '뒤'에 삽입.
 * 블록 다음에 커서를 둘 문단 id를 반환한다.
 */
function insertBlockAt(doc: EditorDoc, pos: Pos, block: Para): Pos {
  const i = idIndex(doc, pos.paraId)
  if (i === -1) return pos
  const p = doc.paras[i]

  if (!isEditable(p)) {
    const tail: Para = { id: makeUid(), text: '', kind: 'body' }
    doc.paras.splice(i + 1, 0, block, tail)
    return { paraId: tail.id, offset: 0 }
  }

  // 편집 문단: 커서에서 분할해 앞/뒤로 나누고 사이에 블록
  const after = p.text.slice(pos.offset)
  const afterMarks = normalizeMarks(
    (p.marks ?? [])
      .filter((m) => m.end > pos.offset)
      .map((m) => ({
        ...m,
        start: Math.max(0, m.start - pos.offset),
        end: m.end - pos.offset
      })),
    after.length
  )
  p.marks = normalizeMarks(
    (p.marks ?? []).map((m) => ({ ...m, end: Math.min(m.end, pos.offset) })),
    pos.offset
  )
  p.text = p.text.slice(0, pos.offset)

  const tail: Para = { id: makeUid(), text: after, kind: 'body', marks: afterMarks }
  doc.paras.splice(i + 1, 0, block, tail)
  return { paraId: tail.id, offset: 0 }
}

/** 커서 위치에 이미지 블록 삽입. 삽입 후 커서 pos 반환. */
export function insertImageAt(doc: EditorDoc, pos: Pos, image: ImageMeta): Pos {
  return insertBlockAt(doc, pos, { id: makeUid(), text: '', kind: 'image', meta: image })
}

/** 커서 위치에 표 블록 삽입. 삽입 후 커서 pos 반환. */
export function insertTableAt(doc: EditorDoc, pos: Pos, table: TableMeta): Pos {
  return insertBlockAt(doc, pos, { id: makeUid(), text: '', kind: 'table', meta: table })
}

/**
 * 편집 가능한 body 문단이 하나도 없으면(잠긴 블록만 남았거나 문서가 빔)
 * insertIdx 위치에 빈 body를 삽입한다. 반환: 삽입했으면 그 문단, 아니면 null.
 * "문서엔 항상 편집 가능한 문단이 최소 1개" 불변식을 강제한다 —
 * 이게 없으면 잠긴 블록만 남아 어떤 입력도 못 받는 죽은 문서가 된다.
 */
function ensureEditableBody(doc: EditorDoc, insertIdx: number): Para | null {
  if (doc.paras.some((p) => isEditable(p))) return null
  const empty: Para = { id: makeUid(), text: '', kind: 'body' }
  const at = Math.max(0, Math.min(insertIdx, doc.paras.length))
  doc.paras.splice(at, 0, empty)
  return empty
}

/** id로 문단(이미지 등)을 제거. 편집가능 body가 사라지면 빈 body 하나 유지.
 *  반환: 삭제 후 커서 pos */
export function removeParaById(doc: EditorDoc, id: string): Pos {
  const i = idIndex(doc, id)
  if (i === -1) return { paraId: doc.paras[0]?.id ?? '', offset: 0 }
  doc.paras.splice(i, 1)
  // 문서가 비었거나 편집 가능한 body가 하나도 안 남으면 빈 body를 넣는다.
  // (잠긴 블록만 남는 죽은 문서 방지 — 지워진 자리 i에 삽입해 위치 자연스럽게)
  const filled = ensureEditableBody(doc, i)
  if (filled) return { paraId: filled.id, offset: 0 }
  // 커서: 이전 문단 끝 또는 다음 문단 앞
  const target = doc.paras[Math.max(0, i - 1)]
  return { paraId: target.id, offset: target.text.length }
}

// ── 리스트 / 블록 서식 API ──

/** 선택 범위가 걸치는 편집 가능(body) 문단들을 반환 */
function selectedBodyParas(doc: EditorDoc, msel: ModelSelection): Para[] {
  const { start, end } = orderSel(doc, msel)
  const si = idIndex(doc, start.paraId),
    ei = idIndex(doc, end.paraId)
  if (si === -1 || ei === -1) return []
  const out: Para[] = []
  for (let i = si; i <= ei; i++) {
    if (isEditable(doc.paras[i])) out.push(doc.paras[i])
  }
  return out
}

/**
 * 선택 문단들을 리스트로 토글한다.
 * - 대상 문단이 모두 같은 type의 리스트면 → 리스트 해제
 * - 아니면 → 모두 해당 type 리스트로 설정(blockStyle은 제거)
 * 커서/선택은 호출측이 유지한다.
 */
export function toggleList(doc: EditorDoc, msel: ModelSelection, type: ListType): void {
  const targets = selectedBodyParas(doc, msel)
  if (!targets.length) return
  const allSame = targets.every((p) => p.listType === type)
  for (const p of targets) {
    if (allSame) {
      delete p.listType
      delete p.indent
    } else {
      p.listType = type
      if (p.indent === undefined) p.indent = 0
      delete p.blockStyle // 리스트와 블록 서식은 배타적
    }
  }
}

/**
 * 선택 리스트 항목들의 들여쓰기를 delta(+1/-1)만큼 조정한다(Tab/Shift+Tab).
 * 리스트가 아닌 문단은 무시. 0..MAX_LIST_INDENT로 클램프.
 */
export function indentList(doc: EditorDoc, msel: ModelSelection, delta: number): void {
  for (const p of selectedBodyParas(doc, msel)) {
    if (!p.listType) continue
    const next = Math.max(0, Math.min(MAX_LIST_INDENT, (p.indent ?? 0) + delta))
    if (next === 0) delete p.indent
    else p.indent = next
  }
}

/**
 * 선택 문단들의 블록 서식(heading/quote)을 토글한다.
 * - 모두 같은 style이면 해제, 아니면 모두 해당 style로 설정(리스트 속성은 제거).
 */
export function toggleBlockStyle(doc: EditorDoc, msel: ModelSelection, style: BlockStyle): void {
  const targets = selectedBodyParas(doc, msel)
  if (!targets.length) return
  const allSame = targets.every((p) => p.blockStyle === style)
  for (const p of targets) {
    if (allSame) {
      delete p.blockStyle
    } else {
      p.blockStyle = style
      delete p.listType
      delete p.indent
    }
  }
}

/** 구분선(hr) 블록 meta */
export interface DividerMeta {
  divider: true
}

/** 커서 위치에 가로 구분선(hr) 블록 삽입. 잠긴 블록으로 삽입. */
export function insertDividerAt(doc: EditorDoc, pos: Pos): Pos {
  return insertBlockAt(doc, pos, {
    id: makeUid(),
    text: '',
    kind: 'divider',
    meta: { divider: true } as DividerMeta
  })
}

/** 불변식 검사. 위반이면 사유 문자열, OK면 null. */
export function checkInvariants(doc: EditorDoc): string | null {
  if (!Array.isArray(doc.paras)) return 'paras가 배열이 아님'
  if (doc.paras.length === 0) return '문단이 0개 (최소 1개 유지 필요)'
  const ids = new Set<string>()
  for (const p of doc.paras) {
    if (typeof p.id !== 'string' || !p.id) return 'id 누락/비문자열'
    if (ids.has(p.id)) return '중복 id: ' + p.id
    ids.add(p.id)
    if (typeof p.text !== 'string') return 'text가 문자열 아님: ' + p.id
    if (p.text.includes('\n')) return 'text에 개행 포함(문단 분할 누락): ' + p.id
  }
  // 편집 가능한 body가 최소 1개 있어야 한다. 없으면 잠긴 블록만 남아
  // 어떤 입력도 못 받는 죽은 문서가 된다.
  if (!doc.paras.some((p) => isEditable(p)))
    return '편집 가능한 문단이 0개 (죽은 문서)'
  return null
}
