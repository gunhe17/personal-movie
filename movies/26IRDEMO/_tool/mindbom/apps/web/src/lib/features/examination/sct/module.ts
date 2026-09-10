import type { ExamModule } from '../core/module'
import { isConfirmed } from '../core/status'

export const sctModule: ExamModule = {
  type: 'sct',
  title: 'SCT 검사',
  subtitle: '문장완성 검사',
  shortLabel: 'SCT',
  fullName: '문장완성',
  pillClass: 'text-teal-700 bg-teal-50 border-teal-200',
  symbolColor: '#69168c',
  steps: [
    {
      key: 'collect',
      label: '문장 완성',
      icon: 'edit_note',
      component: () => import('./steps/Collect.svelte'),
      /**
       * 확정된 검사의 원자료는 열지 않는다 — 응답 입력이 자동저장이라
       * 들어가는 것만으로 확정본이 바뀔 수 있다(SaMD 데이터 무결성).
       */
      enabled: (g) => !isConfirmed(g.status),
      /**
       * done이 없으면 응답을 다 제출하고 검사가 확정돼도 이 단계 뱃지가
       * 영원히 '대기'로 남는다(HTP·로르샤하는 진작 갖고 있었다).
       * 판정 근거는 아래 review의 enabled와 같다 — 문항이 다 채워졌는지.
       */
      done: (g) => Boolean(g.progress?.collect_done),
      lockedHint: '확정된 검사의 원자료는 수정할 수 없습니다.'
    },
    {
      key: 'review',
      label: '응답 검토',
      icon: 'fact_check',
      component: () => import('./steps/Review.svelte'),
      /**
       * 검토 화면은 AI 분석 '전'에도 열려야 한다 — 분석은 이 화면에서
       * 임상가가 직접 실행하기 때문이다. status는 응답을 제출해도
       * in_progress에 머물러 제출 여부를 알려주지 않으므로, 문항이 모두
       * 채워졌는지(progress.collect_done)로 판정한다.
       */
      enabled: (g) => Boolean(g.progress?.collect_done),
      /** 채점 결과가 생겼다 = 이 단계에서 할 일(AI 분석 실행)이 끝났다. */
      done: (g) => Boolean(g.progress?.has_result),
      lockedHint: '응답을 먼저 제출해주세요.'
    },
    {
      key: 'results',
      label: '결과 보기',
      icon: 'assessment',
      component: () => import('./steps/Results.svelte'),
      /**
       * 채점 결과가 있어야 열린다(HTP와 같은 기준).
       * 예전에는 검토와 결과가 한 단계에 묶여 있어서, 화면 안에서 phase로
       * 갈랐다 — 단계와 화면이 1:1이 아니라 사이드바가 실제 흐름과 어긋났다.
       */
      enabled: (g) => Boolean(g.progress?.has_result),
      done: (g) => isConfirmed(g.status),
      lockedHint: 'AI 분석이 끝난 뒤 결과를 볼 수 있습니다.'
    }
  ],
  // 보고서 코드는 지연 로딩한다 — 목록·상세 화면은 이걸 쓰지 않는다.
  downloadReport: (instId, examId) =>
    import('./report').then((m) => m.downloadSctReport(instId, examId)),
  loadReportAssets: (instId, examId) =>
    import('./report').then((m) => m.loadSctReportAssets(instId, examId))
}
