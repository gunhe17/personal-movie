/**
 * 검사 타입 → 모듈.
 *
 * 새 검사는 여기에 한 줄만 추가하면 라우팅·사이드바·단계 잠금이 따라온다.
 * 모듈 선언 자체는 가볍고(문자열 + 함수 참조), 실제 화면 컴포넌트는
 * ExamStep.component의 동적 import로 지연 로딩된다.
 */
import type { ExamModule } from './module'
import { htpModule } from '../htp/module'
import { sctModule } from '../sct/module'
import { rorschachModule } from '../rorschach/module'

/**
 * 지원 검사 목록 — **검사 타입의 단일 출처**.
 *
 * 예전에는 `common/constants.ts`에 `ExamType` 유니온이 손으로 적혀 있고
 * 여기 Record가 그걸 다시 만족시켜야 했다. 새 검사를 붙이려면 두 곳(+ 사본이
 * 있던 stores/exam.store.ts까지 세 곳)을 맞춰야 했고, 확장성 테스트조차
 * 새 타입을 선언하지 못해 `type: 'htp'`로 우회하고 있었다.
 *
 * 이제 이 객체에 한 줄 추가하면 ExamType이 따라온다.
 */
const MODULES = {
  htp: htpModule,
  sct: sctModule,
  rorschach: rorschachModule
} satisfies Record<string, ExamModule>

/** 등록된 검사 타입 — MODULES에서 파생된다 */
export type ExamType = keyof typeof MODULES

export function getExamModule(type: ExamType): ExamModule {
  return MODULES[type]
}

/** 지원하는 검사 타입인지 — 라우트 가드용 */
export function isSupportedExamType(type: string): type is ExamType {
  return type in MODULES
}

/** 등록된 검사 타입 전체 — 필터·생성 목록이 레지스트리에서 파생되도록 */
export const EXAM_TYPES = Object.keys(MODULES) as ExamType[]
