<script lang="ts">
  // 케이스 배너 — 병원 차트의 환자 배너와 같은 역할.
  // 어느 섹션을 보고 있든 "무슨 케이스 · 누가 · 무슨 문제 · 어디까지"가 늘 같은 자리에 있다.
  //
  // 🔴 여기 있는 건 **변하지 않는 틀**뿐이다 (2026-09-03). 옛 `현재` 줄
  // (current_state)은 뺐다 — 같은 화면의 AI 카드 「한 줄 정리」가 같은 말을 더 길게
  // 하고 있었다("시험 주간에 다시 힘들어짐"이 두 곳에 그대로 있었다). 지금 상태의
  // 서술은 AI 카드 하나가 소유한다. 배너는 신원·주호소와 그 옆 숫자 지표까지다.
  //
  // 🔴 주체는 **케이스**다 (2026-09-03). 예전엔 첫 줄이 `내담자 김하은`이었다.
  // 분석 단위는 처음부터 케이스였고(회기 일지를 케이스로 묶어 돌린다), 그룹 케이스에서
  // `clients[0]`만 세우면 다섯 명이 참여한 상담이 한 사람의 리포트처럼 보인다.
  // 그래서 첫 줄은 케이스(프로그램명 + 그룹 여부)이고, 사람은 그 아래 한 줄이다.
  // 표기는 페이지 breadcrumb·좌측 정보 패널과 같다 — 개인은 프로그램명만, 그룹만 ' - 그룹'.
  //
  // 🔴 내담자 줄은 **개인이면 이름, 그룹이면 인원수**다. 전원을 나열하지 않는 이유 셋:
  //   ① 명단의 주인은 좌측 상담 정보 패널이다 — 거기서 이름·회기 진행·청구까지 함께
  //      본다(도크가 좌측을 접는 폭에서도 헤더 `상담 정보` 버튼으로 열린다).
  //      여기 또 나열하면 "한 값은 한 자리에서만"을 이 리포트 스스로 어긴다.
  //   ② **이 리포트는 사람을 구분하지 않는다.** 일지를 케이스 단위로 묶어 한 덩어리로
  //      분석하므로 "3회기에 불안이 낮아졌다"가 누구 얘기인지 리포트는 모른다.
  //      이름을 여덟 개 늘어놓으면 개인별로 읽어냈다는 약속을 하는 셈인데, 지키지 못한다.
  //   ③ 그룹이 커질수록 이름 줄이 접혀 주호소를 밀어낸다 — 배너는 고정 틀이어야 한다.
  // 개인 케이스에서 이름 하나는 남긴다: 상담사는 그 케이스를 이름으로 기억하고,
  // 한 단어라 위 셋 중 어디에도 걸리지 않는다. 시크릿 모드에서는 마스킹한다.
  //
  // 🔴 정렬 — 배너 전체가 **하나의 라벨 열**로 선다.
  // 라벨 열이 갈리면 값의 시작 x가 어긋나 두 개의 격자처럼 보인다.
  //
  // 좌측 라벨(15 Medium)과 우측 지표 라벨(15 Medium)이 같은 첫 줄에서 시작하므로,
  // 두 블록은 `items-start`만으로 첫 줄 기준선이 맞는다(지표를 세로 중앙 정렬하면
  // 좌측이 길어질 때마다 어긋난다).
  //
  // 라벨↔값은 §반복 패턴 '레이블+데이터 가로형' — 같은 크기(16), 위계는 색으로만.
  // 라벨 색은 §Typography 라벨 정본의 `text-title-subtitle`이다(옛 `text-label-default`는
  // 값은 같은 gray-600이지만, 같은 리포트 안에서 두 토큰이 갈려 있었다).
  // 케이스명만 예외로 18 SemiBold다(이 화면의 주 식별자).
  import Metrics from './Metrics.svelte'
  // 시크릿 모드는 전역 스토어다(스토어 주석: "컴포넌트에서 $isSecretMode로 바로 사용").
  // 페이지→도크→패널→리포트→배너로 4단을 내려보내지 않는다.
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let { report }: { report: CaseReportVM } = $props()

  // 이름 옆 메타는 **상담 코드 하나**다.
  // 기간(첫 회기~마지막 회기)은 「읽은 기록」이 가져갔다 — 그건 신원이 아니라
  // "무엇을 읽었나"에 속하고, 이름 한 줄에 이름·코드·기간 셋을 얹으면
  // 무엇이 이 상담의 이름인지가 흐려진다.
  const meta = $derived(report.caseCode)

  // 개인은 이름, 그룹은 인원수 (위 주석의 근거 참고)
  const who = $derived.by(() => {
    const names = report.clientNames
    if (report.isGroup || names.length > 1) return `${report.clientCount}명`
    if (names.length === 0) return null
    return $isSecretMode ? maskName(names[0]) : names[0]
  })
</script>

<div class="border-b border-border-default bg-white px-6 py-5">
  <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
    <div
      class="grid min-w-[280px] flex-1 grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2"
    >
      <!-- 라벨은 '상담'이다. '케이스'는 개발·논문에서 쓰는 말이고, 이 제품은
           브레드크럼(상담 / 놀이치료 - 그룹)부터 좌측 패널(상담 코드)까지
           전부 '상담'으로 부른다 — 화면마다 다른 이름을 쓰면 다른 것이 된다. -->
      <span class="text-body-02-normal-medium text-title-subtitle">상담</span>
      <span class="flex flex-wrap items-baseline gap-x-2">
        <span class="text-title-01-normal-semibold text-title-default">
          {report.caseTitle}
        </span>
        {#if meta}
          <span class="text-body-02-normal-regular text-body-subtle"
            >{meta}</span
          >
        {/if}
      </span>

      {#if who}
        <span class="text-body-02-normal-medium text-title-subtitle"
          >내담자</span
        >
        <span class="text-body-01-reading-regular text-body-strong">
          {who}
        </span>
      {/if}

      <span class="text-body-02-normal-medium text-title-subtitle">주호소</span>
      <span class="text-body-01-reading-regular text-body-strong">
        {report.chiefComplaint}
      </span>
    </div>

    <Metrics {report} />
  </div>
</div>
