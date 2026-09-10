/**
 * 상태 술어 재구현 금지 — 정본을 우회하는 코드를 소스에서 잡는다.
 *
 * 왜 테스트인가
 * -------------
 * 상태 문자열 자체는 금지할 수 없다. `patchStatus(id, 'confirmed')`처럼
 * 단일 값을 쓰는 건 정상이고, modal.ts의 `result === 'confirmed'`는
 * 아예 다른 의미(모달 결과)다. 문제는 **여러 상태를 모아 판정을
 * 재구현하는 것**이다 — 그 패턴만 잡는다.
 *
 * 실제 사고 이력
 * --------------
 * SCT 결과 화면이 ['confirmed','report_generated']를 인라인으로 재구현하며
 * completed를 빠뜨려, 완료된 검사에 '검사 확정' 버튼이 다시 뜬 적이 있다.
 * 고친 뒤에도 로르샤하 Results·Review에 같은 코드가 남아 있었다(2026-08-18 정리).
 *
 * 이 테스트가 깨지면 코드를 고쳐라 — 목록에 추가하지 말고.
 * core/status.ts의 술어(isConfirmed·isCollecting·isReviewable)를 쓰면 된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../../..') // core/ → examination/ → features/ → lib/ → src/

/** 술어의 정본이 사는 곳 — 여기서는 집합을 적는 게 당연하다 */
const ALLOWED_FILES = [
  'lib/features/examination/core/status.ts',
  'lib/features/examination/core/status-guard.spec.ts',
  'lib/features/examination/core/state-contract.spec.ts',
  'lib/features/report/constants.ts',
  'lib/features/examination/common/exam-visual.ts' // 표시 설정 — 상태를 키로 쓴다
]

const EXTENSIONS = ['.ts', '.svelte']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full)
  }
  return out
}

/** 워크플로 상태 중 "확정 이후" 구간에 속하는 것들 */
const CONFIRMED_MEMBERS = ['confirmed', 'report_generated', 'completed']
const MEMBER_RE = `['"\`](?:${CONFIRMED_MEMBERS.join('|')})['"\`]`

/**
 * 재구현으로 판정하는 패턴 — **조건 판정 문맥**에 상태가 모여 있을 때만이다.
 *
 * 상태를 나열하는 것 자체는 문제가 아니다. 타입 유니온·라벨 맵·테스트
 * 픽스처는 열거이지 판정이 아니며, 그것까지 막으면 정의를 쓸 수 없다.
 * 잡아야 하는 건 "이 상태들 중 하나인가"를 **다시 계산**하는 코드다.
 */
const REIMPL_PATTERNS: { name: string; re: RegExp }[] = [
  {
    // ['confirmed','report_generated',...].includes(x)  /  new Set([...]).has(x)
    name: '배열·Set 리터럴 멤버십',
    re: new RegExp(`\\[[^\\]]*${MEMBER_RE}[^\\]]*${MEMBER_RE}[^\\]]*\\]\\s*(?:as const\\s*)?\\)?\\s*\\.(?:includes|has)\\b`)
  },
  {
    // x === 'confirmed' || x === 'report_generated'   (같은 줄에 2개 이상)
    name: '=== 연쇄 비교',
    re: new RegExp(`===\\s*${MEMBER_RE}[\\s\\S]{0,80}?===\\s*${MEMBER_RE}`)
  },
  {
    // x !== 'confirmed' && x !== 'completed'
    name: '!== 연쇄 비교',
    re: new RegExp(`!==\\s*${MEMBER_RE}[\\s\\S]{0,80}?!==\\s*${MEMBER_RE}`)
  },
  {
    // status in ('confirmed', 'completed')  — 파이썬식이 프론트에 섞인 경우
    name: 'in 튜플',
    re: new RegExp(`\\bin\\s*\\([^)]*${MEMBER_RE}[^)]*${MEMBER_RE}`)
  }
]

function findReimplementations(
  text: string
): { line: number; kind: string; snippet: string }[] {
  const lines = text.split('\n')
  const hits: { line: number; kind: string; snippet: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    // 주석 줄은 제외 — 사고 이력을 설명하는 주석이 실제로 있다
    if (/^\s*(\/\/|\*|\/\*|#)/.test(lines[i])) continue

    // 조건은 줄바꿈으로 갈리므로 2줄까지 이어 본다
    const window = lines.slice(i, i + 2).join(' ')
    const matched = REIMPL_PATTERNS.find((p) => p.re.test(window))
    if (matched) {
      hits.push({ line: i + 1, kind: matched.name, snippet: lines[i].trim().slice(0, 80) })
      i += 1
    }
  }
  return hits
}

describe('상태 술어 재구현 금지', () => {
  it('확정 구간 판정을 인라인으로 다시 적은 곳이 없다', () => {
    const violations: string[] = []

    for (const file of walk(SRC)) {
      const rel = relative(SRC, file)
      if (ALLOWED_FILES.some((a) => rel.endsWith(a) || rel === a)) continue

      for (const hit of findReimplementations(readFileSync(file, 'utf-8'))) {
        violations.push(`${rel}:${hit.line}  [${hit.kind}]  ${hit.snippet}`)
      }
    }

    expect(
      violations,
      '확정 구간(confirmed·report_generated·completed)을 인라인으로 판정하고 있다.\n' +
        'core/status.ts의 isConfirmed()를 쓸 것 — 목록에 추가하지 말고 코드를 고쳐라.\n\n' +
        violations.join('\n')
    ).toEqual([])
  })
})
