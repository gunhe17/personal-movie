import type { ExamModule } from '../core/module'
import { isConfirmed } from '../core/status'

/**
 * 스텝 3개, 벽 없음, 게이트는 결과 하나뿐 (문서 §3-1, §14-1).
 *
 * **자유반응과 질문을 한 화면으로 합쳤다(v5).** 반응은 채점지의 한 줄이고
 * 그 줄의 칸(텍스트·질문 답변·위치·채점)은 아무 순서로나 채울 수 있다 —
 * 두 화면으로 나누면 "지금은 이 칸만 채울 수 있다"가 되어 그 전제와 모순된다.
 * §3-1의 "벽 없음"이 스텝 사이에서 반응 내부로 내려온 것이다.
 *
 * **되돌아가기 잠금을 폐기했다.** 예전에는 자유반응(collect_done)과 채점을
 * 순서로 잠갔는데, 그 근거였던 "region을 고치면 채점된 transcript 매핑이
 * 어긋난다"가 관계 역전으로 소멸했다 — 이제 조각은 반응에 매달리고,
 * 반응이 시간을 갖는다.
 *
 * 더 중요한 이유: **실제 검사는 순서대로 가지만 기록은 순차적이지 않다.**
 * 임상가는 계속 되돌아간다(아날로그에선 그냥 종이를 고친다). 순서를 강제하면
 * 종이보다 불편해진다.
 *
 * 진행은 잠금이 아니라 완성도로 보여준다 — 각 스텝의 done이 그 역할이다.
 */
export const rorschachModule: ExamModule = {
  type: 'rorschach',
  title: '로샤 검사',
  subtitle: '잉크반점 검사',
  shortLabel: '로샤',
  fullName: '로르샤하',
  pillClass: 'text-purple-700 bg-purple-50 border-purple-200',
  symbolColor: '#3b82f6',
  steps: [
    {
      /**
       * key는 'collect'를 유지한다 — progress(collect_done)와 URL이 이미
       * 이 어휘를 쓴다. 뜻만 "자유반응"에서 "실시 전체"로 넓어진다.
       *
       * 자유반응과 질문이 한 화면이다(§14-1). 표준 절차의 "두 바퀴"는
       * 유지되지만 화면이 순서를 강제하지 않는다 — 1바퀴에는 텍스트만 채우고
       * 지나가고, 2바퀴에 같은 줄로 돌아와 영역과 질문 답변을 채운다.
       *
       * `done`의 뜻이 넓어졌다: "완료 버튼을 눌렀다"가 아니라 **10장 전부
       * 실시/거부 + 모든 정식 반응이 영역·질문 보유**다. 서버
       * `completion.administration_done`이 판정한다(§14-11).
       */
      key: 'collect',
      label: '실시',
      icon: 'record_voice_over',
      component: () => import('./steps/FreeAssociation.svelte'),
      // 벽 없음 — 언제든 되돌아와 고칠 수 있다.
      done: (g) => Boolean(g.progress?.collect_done)
    },
    {
      key: 'review',
      // URL은 공통 어휘(review)지만 화면 표기는 검사 고유 어감을 유지한다.
      label: '채점하기',
      icon: 'edit',
      component: () => import('./steps/Review.svelte'),
      done: (g) => isConfirmed(g.status)
    },
    {
      key: 'results',
      label: '결과 보기',
      icon: 'assessment',
      component: () => import('./steps/Results.svelte'),
      // progress가 아직 없는 동안 열리지 않게 막는 일은 코어가 한다
      // ([step]/+page.svelte의 세 가드가 전부 progress를 기다린다).
      // 여기서 다시 덧대면 이 검사만 규칙이 달라진다.
      enabled: (g) => isConfirmed(g.status),
      done: (g) => isConfirmed(g.status),
      lockedHint: '채점이 확정된 후 결과를 볼 수 있습니다.'
    }
  ],
  // 보고서 코드는 지연 로딩한다 — 목록·상세 화면은 이걸 쓰지 않는다.
  downloadReport: (instId, examId) =>
    import('./report').then((m) => m.downloadRorschachReport(instId, examId)),
  loadReportAssets: (instId, examId) =>
    import('./report').then((m) => m.loadRorschachReportAssets(instId, examId))
}
