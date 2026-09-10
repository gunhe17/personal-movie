/**
 * 단계 진입 판정 회귀 테스트.
 *
 * 여기서 지키려는 불변식은 하나다 — **진입 경로가 항상 열린 단계를 가리킨다.**
 * 이게 깨지면 사용자는 "클릭했는데 되돌아오는" 화면을 보게 된다. 그게 바로
 * progress 축을 도입하기 전에 있던 버그다.
 *
 * status만으로는 판정할 수 없다는 사실을 표로 고정해 둔다. 세 검사 모두
 * "수집 완료"를 status에 남기지 않기 때문에, 같은 status라도 progress에 따라
 * 갈 수 있는 단계가 달라진다.
 */
import { describe, it, expect } from 'vitest'
import { htpModule } from '../htp/module'
import { rorschachModule } from '../rorschach/module'
import { sctModule } from '../sct/module'
import { gateFrom, resolveActiveStep } from './module'
import type { ExamModule, ExamProgress } from './module'
import type { ExamStatus } from '../common/constants'

const ALL_STATUSES: ExamStatus[] = [
  'created',
  'in_progress',
  'ai_draft_ready',
  'under_review',
  'confirmed',
  'report_generated',
  'completed'
]

const MODULES: ExamModule[] = [htpModule, rorschachModule, sctModule]

/** progress의 가능한 조합 — 실제로 나올 수 있는 것만 */
const PROGRESSES: { name: string; value: ExamProgress | null }[] = [
  { name: 'null(로드 전)', value: null },
  { name: '아무것도 안 함', value: { collect_done: false, has_result: false } },
  { name: '수집 완료', value: { collect_done: true, has_result: false } },
  { name: '결과 있음', value: { collect_done: true, has_result: true } }
]

function openSteps(module: ExamModule, status: ExamStatus, progress: ExamProgress | null) {
  const g = gateFrom(status, progress)
  return module.steps.filter((s) => !s.enabled || s.enabled(g)).map((s) => s.key)
}

describe('진입 경로는 항상 열린 단계를 가리킨다', () => {
  // 8 status × 4 progress × 3 모듈 = 96조합 전수
  for (const module of MODULES) {
    for (const status of ALL_STATUSES) {
      for (const { name, value } of PROGRESSES) {
        it(`${module.type} / ${status} / ${name}`, () => {
          const gate = gateFrom(status, value)
          const landing = resolveActiveStep(module, gate)
          const open = openSteps(module, status, value)

          // 열린 단계가 하나도 없으면 첫 단계로 폴백한다(그 자체는 허용).
          // 열린 단계가 있다면 진입 대상은 반드시 그중 하나여야 한다.
          if (open.length > 0) {
            expect(open).toContain(landing.key)
          } else {
            expect(landing.key).toBe(module.steps[0].key)
          }
        })
      }
    }
  }
})

describe('첫 단계는 항상 열려 있다', () => {
  // 첫 단계가 잠기면 갓 만든 검사에 들어갈 수 없다.
  for (const module of MODULES) {
    it(`${module.type}`, () => {
      const fresh = gateFrom('created', { collect_done: false, has_result: false })
      const first = module.steps[0]
      expect(first.enabled ? first.enabled(fresh) : true).toBe(true)
    })
  }
})

describe('progress를 모르면 뒤 단계를 열지 않는다', () => {
  // exam 로드 전(progress=null)에 결과 화면을 열어 주면, 데이터가 오기 전에
  // 빈 화면을 그리게 된다. 가드는 exam이 채워질 때까지 기다려야 한다.
  for (const module of MODULES) {
    it(`${module.type}`, () => {
      const unknown = gateFrom('confirmed', null)
      const landing = resolveActiveStep(module, unknown)
      expect(landing.key).toBe(module.steps[0].key)
    })
  }

  /**
   * 위 세 건은 모듈 선언이 우연히 안전해도 통과한다 — 실제로 HTP·SCT는
   * 규칙을 지켜서가 아니라 판정식이 progress를 참조해서(`progress?.has_result`는
   * progress가 null이면 저절로 false) 통과하고 있었다. 로르샤하처럼 status 축으로
   * 판정하는 검사에는 그 우연이 통하지 않아 모듈에 손으로 가드를 덧대야 했다.
   *
   * 이 보장은 코어가 해야 한다. progress를 전혀 보지 않는 모듈을 넣어
   * resolveActiveStep 자체가 막는지 확인한다.
   */
  it('모듈이 progress를 보지 않아도 코어가 막는다', () => {
    const statusOnly: ExamModule = {
      type: 'fake',
      title: '가상 검사',
      subtitle: '테스트용',
      shortLabel: '가상',
      fullName: '가상',
      pillClass: '',
      symbolColor: '',
      steps: [
        { key: 'collect', label: '수집', icon: 'edit', component: null as never },
        {
          key: 'results',
          label: '결과',
          icon: 'assessment',
          component: null as never,
          // status만 보는 판정 — progress가 null이어도 true가 된다.
          enabled: (g) => g.status === 'confirmed',
          lockedHint: '확정 후 열립니다.'
        }
      ]
    }
    const landing = resolveActiveStep(statusOnly, gateFrom('confirmed', null))
    expect(landing.key).toBe('collect')
  })
})

describe('status가 같아도 progress가 다르면 단계가 갈린다', () => {
  it('로르샤하: 실시 중 vs 실시 완료 (둘 다 in_progress)', () => {
    const recording = gateFrom('in_progress', { collect_done: false, has_result: false })
    const finished = gateFrom('in_progress', { collect_done: true, has_result: false })

    expect(resolveActiveStep(rorschachModule, recording).key).toBe('collect')
    // 실시가 끝나면 채점이다. `collect_done`은 "완료 버튼을 눌렀다"가 아니라
    // **10장 전부 실시/거부 + 모든 정식 반응이 영역·질문 보유**를 뜻한다(§14-11).
    // (자유반응/질문이 별도 스텝이던 때는 여기가 'inquiry'였다)
    expect(resolveActiveStep(rorschachModule, finished).key).toBe('review')
  })

  it('SCT: 작성 중 vs 응답 완료 (둘 다 in_progress)', () => {
    const writing = gateFrom('in_progress', { collect_done: false, has_result: false })
    const submitted = gateFrom('in_progress', { collect_done: true, has_result: false })

    expect(resolveActiveStep(sctModule, writing).key).toBe('collect')
    // 응답만 제출한 시점엔 아직 채점이 없다 — 결과가 아니라 검토로 간다.
    // (검토·결과를 한 단계에 묶었던 때는 여기가 'results'였다)
    expect(resolveActiveStep(sctModule, submitted).key).toBe('review')
  })

  it('SCT: 채점 결과가 있어야 결과 단계가 열린다', () => {
    const submitted = gateFrom('in_progress', { collect_done: true, has_result: false })
    const scored = gateFrom('ai_draft_ready', { collect_done: true, has_result: true })

    expect(resolveActiveStep(sctModule, submitted).key).toBe('review')
    expect(resolveActiveStep(sctModule, scored).key).toBe('results')
  })

  it('HTP: 업로드만 함 vs 해석 있음', () => {
    const uploaded = gateFrom('in_progress', { collect_done: true, has_result: false })
    const analyzed = gateFrom('in_progress', { collect_done: true, has_result: true })

    expect(resolveActiveStep(htpModule, uploaded).key).toBe('collect')
    expect(resolveActiveStep(htpModule, analyzed).key).toBe('results')
  })
})

describe('되돌아갈 수 없는 단계', () => {
  /**
   * 예전에는 로르샤하 기록이 완료 후 잠겼다 — "region을 고치면 채점된
   * transcript 매핑이 어긋난다"가 근거였다. 관계 역전으로 조각이 반응에
   * 매달리면서 그 근거가 소멸했고, 문서 §3-1이 잠금을 폐기했다.
   *
   * 실제 검사는 순서대로 가지만 기록은 순차적이지 않다 — 임상가는 계속
   * 되돌아간다(아날로그에선 그냥 종이를 고친다).
   */
  it('로르샤하는 실시·채점을 언제든 오간다 — 게이트는 결과 하나뿐', () => {
    const done = gateFrom('in_progress', { collect_done: true, has_result: false })
    const openable = (key: string) => {
      const step = rorschachModule.steps.find((s) => s.key === key)!
      return step.enabled?.(done) ?? true
    }

    expect(openable('collect')).toBe(true)
    expect(openable('review')).toBe(true)
    // 확정 전에는 결과만 잠긴다 — 미완성 프로토콜이 구조요약을 내면 R이 틀린다.
    expect(openable('results')).toBe(false)
  })
})

describe('잠긴 단계에는 사유가 붙어 있다', () => {
  // 사유 없이 되돌려 보내면 사용자는 왜 튕겼는지 알 수 없다.
  for (const module of MODULES) {
    for (const step of module.steps) {
      if (!step.enabled) continue
      it(`${module.type}/${step.key}`, () => {
        expect(step.lockedHint, `${module.type}/${step.key}에 lockedHint가 없다`).toBeTruthy()
      })
    }
  }
})

describe('모듈 선언 자체의 정합성', () => {
  for (const module of MODULES) {
    it(`${module.type}: step key가 중복되지 않는다`, () => {
      const keys = module.steps.map((s) => s.key)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it(`${module.type}: 판정 함수가 gate 객체를 받는다`, () => {
      // status 문자열을 받던 옛 시그니처가 남아 있으면 진행 축이 무시된다.
      // gate를 넘겼을 때 예외 없이 boolean이 나오는지로 확인한다.
      const g = gateFrom('in_progress', { collect_done: true, has_result: true })
      for (const step of module.steps) {
        if (step.enabled) expect(typeof step.enabled(g)).toBe('boolean')
        if (step.done) expect(typeof step.done(g)).toBe('boolean')
      }
    })
  }
})
