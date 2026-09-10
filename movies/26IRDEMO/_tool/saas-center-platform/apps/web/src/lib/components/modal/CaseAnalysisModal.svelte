<script lang="ts">
  // AI 경과 분석 모달 — 옛 우측 컨테이너 탭(회기 목록 ↔ 경과 분석)을 대체한다.
  //
  // 경과 분석은 회기 목록의 형제가 아니다. 회기 목록은 케이스의 한 구획이고, 경과 분석은
  // 케이스 전체를 다른 렌즈로 보는 것이라, 형제가 아닌 둘을 탭으로 묶으면 "탭을 눌렀는데
  // 화면 전체가 바뀌는" 어긋남이 생긴다. 좌측 패널 하단의 문(AI 경과 분석)에서 겹쳐 열고,
  // 닫으면 보던 회기 목록 자리로 그대로 돌아온다.
  //
  // 폭은 §modal 4단 중 1000(넓음) · 높이 상한 940. 리포트의 판단 레일은 컨테이너 1080
  // 미만에서 배너 아래 가로 스트립으로 눕는다(CaseAnalysisReport가 소유한 폴백) —
  // 모달에서는 항상 눕는 형태로 읽힌다.
  //
  // 리포트가 자기 스크롤을 소유하므로(CaseAnalysisReport 내부 overflow-y-auto)
  // 본문 스크롤은 끄고 높이만 잡아준다 — 켜두면 스크롤이 두 겹이 된다.
  //
  // 높이는 §modal 상한(940)으로 **고정**한다(여는 쪽에서 customHeight로 지정).
  // 콘텐츠에 맡기면 리포트가 있을 때와 없을 때(빈 상태) 판 크기가 달라져,
  // 실행 후 모달이 갑자기 커진다. 높이는 BaseModal이 아니라 모달 래퍼가 소유한다.
  import BaseModal from './BaseModal.svelte'
  import CaseAnalysisPanel from '../counseling/analysis/CaseAnalysisPanel.svelte'
  import type { CounselingCaseBaseDetail } from '$lib/types/counseling'

  let {
    modalId = '',
    closeModal = () => {},
    caseDetail,
    completedSessionCount,
    canWrite = false,
    onSelectSession
  }: {
    modalId?: string
    closeModal?: () => void
    caseDetail: CounselingCaseBaseDetail
    completedSessionCount: number
    canWrite?: boolean
    onSelectSession?: (sessionNumber: number) => void
  } = $props()

  // 근거 회기로 이동 = 이 리포트를 떠나는 행동이라 모달을 먼저 닫는다
  // (열어둔 채 뒤에서 회기만 바뀌면 무엇이 눌렸는지 보이지 않는다).
  function handleSelectSession(sessionNumber: number) {
    closeModal()
    onSelectSession?.(sessionNumber)
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  title="AI 경과 분석"
  bodyScrollable={false}
  bodyClass="flex min-h-0 flex-col"
>
  {#snippet body()}
    <CaseAnalysisPanel
      {caseDetail}
      {completedSessionCount}
      {canWrite}
      onSelectSession={handleSelectSession}
    />
  {/snippet}
</BaseModal>
