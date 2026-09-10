/**
 * 확장성 회귀 테스트 — 새 검사가 코어를 건드리지 않고 붙는가.
 *
 * 앞으로 15종이 더 붙는데(검사 등록 모달에 목록이 있다), 그중 다수는
 * AI 채점이 없는 표준화 검사(MMPI, 웩슬러, TCI, K-CBCL 등)다.
 * 여기서는 그런 검사를 가짜로 선언해 코어(resolveActiveStep/gate)가
 * 그대로 동작하는지 확인한다.
 *
 * 이 파일이 깨지면 "새 검사를 붙이려면 코어를 고쳐야 한다"는 뜻이다.
 */
import { describe, it, expect } from 'vitest'
import { gateFrom, resolveActiveStep } from './module'
import type { ExamModule, ExamProgress } from './module'

const noop = () => Promise.resolve({ default: (() => null) as never })

/**
 * AI 없는 표준화 검사(예: MMPI-2) — 문항 응답 → 규준 환산 → 결과.
 * 상태가 ai_draft_ready 같은 AI 단계를 거치지 않는다고 가정한다.
 */
const autoScoredModule: ExamModule = {
  // 등록되지 않은 검사 이름을 그대로 쓸 수 있다 — ExamType은 레지스트리에서
  // 파생되고, ExamModule.type은 선언만 받는다. 예전에는 유니온이 3종 고정이라
  // 'htp'로 우회해야 했다(확장성 테스트가 확장 불가를 증언하던 자리).
  type: 'mmpi2',
  title: 'MMPI-2 (가상)',
  subtitle: '다면적 인성검사',
  shortLabel: 'MMPI-2',
  fullName: '다면적 인성검사 II',
  pillClass: 'text-slate-700 bg-slate-50 border-slate-200',
  symbolColor: '#475569',
  steps: [
    { key: 'collect', label: '문항 응답', icon: 'edit_note', component: noop },
    {
      key: 'score',
      label: '규준 환산',
      icon: 'calculate',
      component: noop,
      enabled: (g) => Boolean(g.progress?.collect_done),
      lockedHint: '문항 응답을 먼저 마쳐주세요.'
    },
    {
      key: 'results',
      label: '결과',
      icon: 'assessment',
      component: noop,
      enabled: (g) => Boolean(g.progress?.has_result),
      lockedHint: '채점이 끝난 뒤 결과를 볼 수 있습니다.'
    }
  ]
}

/** 4단계 검사(예: 웩슬러) — setup/record까지 쓰는 경우 */
const fourStepModule: ExamModule = {
  type: 'kwisc5',
  title: 'K-WISC-V (가상)',
  subtitle: '아동 지능검사',
  shortLabel: 'K-WISC-V',
  fullName: '한국 웩슬러 아동지능',
  pillClass: 'text-amber-700 bg-amber-50 border-amber-200',
  symbolColor: '#b45309',
  steps: [
    { key: 'setup', label: '소검사 구성', icon: 'tune', component: noop },
    {
      key: 'record',
      label: '실시 기록',
      icon: 'assignment',
      component: noop,
      enabled: (g) => g.progress !== null,
      lockedHint: '검사 구성을 먼저 정해주세요.'
    },
    {
      key: 'score',
      label: '환산',
      icon: 'calculate',
      component: noop,
      enabled: (g) => Boolean(g.progress?.collect_done),
      lockedHint: '실시를 먼저 마쳐주세요.'
    },
    {
      key: 'results',
      label: '결과',
      icon: 'assessment',
      component: noop,
      enabled: (g) => Boolean(g.progress?.has_result),
      lockedHint: '환산이 끝난 뒤 결과를 볼 수 있습니다.'
    }
  ]
}

const P = {
  none: { collect_done: false, has_result: false } as ExamProgress,
  collected: { collect_done: true, has_result: false } as ExamProgress,
  scored: { collect_done: true, has_result: true } as ExamProgress
}

describe('AI 없는 표준화 검사 (규칙 기반 자동채점)', () => {
  it('AI 단계를 거치지 않고도 단계가 진행된다', () => {
    // status는 in_progress에 머무는데(표준화 검사는 AI 전이가 없다)
    // 진행 축만으로 단계가 열린다 — 이게 status 기반 gate였다면 막혔다.
    expect(resolveActiveStep(autoScoredModule, gateFrom('in_progress', P.none)).key).toBe(
      'collect'
    )
    expect(
      resolveActiveStep(autoScoredModule, gateFrom('in_progress', P.collected)).key
    ).toBe('score')
    expect(resolveActiveStep(autoScoredModule, gateFrom('in_progress', P.scored)).key).toBe(
      'results'
    )
  })

  it('created 상태에서도 첫 단계는 열린다', () => {
    const first = autoScoredModule.steps[0]
    expect(first.enabled?.(gateFrom('created', P.none)) ?? true).toBe(true)
  })
})

describe('4단계 검사 (setup/record/score/results)', () => {
  it('StepKey 어휘가 3단계를 넘어도 동작한다', () => {
    expect(resolveActiveStep(fourStepModule, gateFrom('created', null)).key).toBe('setup')
    expect(resolveActiveStep(fourStepModule, gateFrom('in_progress', P.none)).key).toBe(
      'record'
    )
    expect(resolveActiveStep(fourStepModule, gateFrom('in_progress', P.collected)).key).toBe(
      'score'
    )
    expect(resolveActiveStep(fourStepModule, gateFrom('in_progress', P.scored)).key).toBe(
      'results'
    )
  })
})

describe('불변식은 새 검사에도 적용된다', () => {
  const STATUSES = ['created', 'in_progress', 'ai_draft_ready', 'confirmed'] as const
  const PROGS = [null, P.none, P.collected, P.scored]

  for (const module of [autoScoredModule, fourStepModule]) {
    it(`${module.title}: 진입 경로가 항상 열린 단계를 가리킨다`, () => {
      for (const status of STATUSES) {
        for (const progress of PROGS) {
          const g = gateFrom(status, progress)
          const open = module.steps.filter((s) => !s.enabled || s.enabled(g)).map((s) => s.key)
          const landing = resolveActiveStep(module, g).key
          if (open.length > 0) {
            expect(open, `${status}/${JSON.stringify(progress)}`).toContain(landing)
          } else {
            expect(landing).toBe(module.steps[0].key)
          }
        }
      }
    })
  }
})
