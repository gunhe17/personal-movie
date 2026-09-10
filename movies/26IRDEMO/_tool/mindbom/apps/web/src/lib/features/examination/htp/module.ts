import type { ExamModule } from '../core/module'
import { isConfirmed } from '../core/status'

export const htpModule: ExamModule = {
  type: 'htp',
  title: 'HTP 검사',
  subtitle: '집-나무-사람 그림검사',
  shortLabel: 'HTP',
  fullName: '집-나무-사람',
  pillClass: 'text-blue-700 bg-blue-50 border-blue-200',
  symbolColor: '#012396',
  steps: [
    {
      key: 'collect',
      label: '이미지 분석',
      icon: 'image',
      component: () => import('./steps/Collect.svelte'),
      /**
       * 확정 후에도 열어 둔다 — 화면 자체가 읽기 전용으로 바뀐다.
       *
       * 원래는 여기를 잠갔다. 이 화면의 입력이 전부 자동저장이라 들어가는
       * 것만으로 확정본이 바뀔 수 있었기 때문이다(SaMD 데이터 무결성).
       * 그런데 HTP는 탐지 결과(BBox)를 이 화면에서만 볼 수 있어서, 결과를
       * 확정하고 나면 "이 해석이 어느 부위에서 나왔는지" 확인할 방법이
       * 사라졌다. 잠그는 대신 Collect.svelte가 쓰기 경로 네 개를 전부 막고
       * 편집 UI를 잠근다(isReadOnly) — 볼 수는 있고 바꿀 수는 없다.
       *
       * SCT·로르샤하는 원자료가 곧 응답/녹취라 사정이 다르다. 그쪽은 계속 잠근다.
       */
      done: (g) => Boolean(g.progress?.collect_done)
    },
    {
      key: 'results',
      label: '결과 보기',
      icon: 'assessment',
      component: () => import('./steps/Results.svelte'),
      /**
       * 결과는 AI 해석이 만들어진 뒤에 열린다.
       *
       * 이 가드는 status 기반(isReviewable)이라 이미지 업로드만 끝난
       * 시점을 막지 못해 주석 처리돼 있었다. 업로드는 어떤 상태 전이도
       * 일으키지 않아 status로는 진행을 알 수 없기 때문이다.
       * 이제 해석 존재 여부(progress.has_result)로 판정한다.
       */
      enabled: (g) => Boolean(g.progress?.has_result),
      /**
       * '완료'는 임상가가 확정했을 때다 — AI 결과가 생긴 것과 다른 축이다.
       *
       * 예전에는 done이 enabled와 똑같이 has_result를 봤다. 그래서 결과 화면이
       * 열리는 순간 이미 '완료' 뱃지가 떴다. 임상가가 아무것도 하지 않았는데도
       * "이 단계는 끝났다"고 말한 셈이고, AI 초안을 임상가가 확인한다는
       * CDSS 원칙과 정면으로 어긋난다. 이 화면에도 '확인 완료' 버튼이 있어
       * confirmed로 전이시키는데 뱃지만 그걸 보지 않았다.
       *
       * SCT·로르샤하의 results도 같은 기준이다.
       */
      done: (g) => isConfirmed(g.status),
      lockedHint: 'AI 분석이 끝난 뒤 결과를 볼 수 있습니다.'
    }
  ],
  // 보고서 코드는 지연 로딩한다 — 목록·상세 화면은 이걸 쓰지 않는다.
  downloadReport: (instId, examId) =>
    import('./report').then((m) => m.downloadHtpReport(instId, examId)),
  loadReportAssets: (instId, examId) =>
    import('./report').then((m) => m.loadHtpReportAssets(instId, examId))
}
