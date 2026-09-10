<script lang="ts">
  // 이 분석이 읽은 기록 — 조건부 렌더링의 짝.
  // 사라진 섹션의 이유를 여기서 대지 않으면, 빈 자리가 "분석이 부실하다"로 읽힌다.
  //
  // 회기 수는 빼놓았다 — 배너의 '진행' 지표가 이미 말하고 있다. 여기서는 배너가
  // 말하지 않는 것(**언제부터 언제까지의** 일지가 몇 건이고 어디서 왔는지)만 말한다.
  //
  // 기간이 여기로 온 이유(2026-09-03) — 배너 이름 줄에 이름·코드·기간 셋이 얹혀
  // 무엇이 이 상담의 이름인지 흐려졌다. 기간은 신원이 아니라 "무엇을 읽었나"라
  // 이 줄이 제 주인이다.
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let { report }: { report: CaseReportVM } = $props()
  const c = $derived(report.coverage)
  const isPartial = $derived(c.analyzedSessions !== c.completedSessions)
</script>

<div class="flex flex-col gap-1">
  <span class="text-body-03-normal-regular text-body-subtle">
    {#if report.isLegacy}
      예전 방식으로 저장된 분석이에요 · {report.createdAt} 분석
    {:else}
      읽은 기록 —{#if isPartial}&nbsp;최근 {c.analyzedSessions}회기{/if}{#if report.period}&nbsp;{report.period}의{:else}&nbsp;{/if}
      상담일지 {c.noteCount}건 (상담사가 쓴 것 {c.manualNotes}, 녹음으로 만든 것
      {c.aiNotes}) · 정서와 개입까지 적힌 일지 {c.interventionNotes}건 · {report.createdAt}
      분석
    {/if}
  </span>
  {#if report.isGroup}
    <!-- 그룹에서만 필요한 두 고지.
         ① 참석률 분모(회기 × 인원) — 라벨이 '내담자'까지는 말하지만 셈법까진 못 말한다.
            개인은 회기 단위(12회기 중 11회), 그룹은 내담자 단위(12회기 × 5명 중 52칸).
         ② 이 리포트가 **집단 단위**라는 전제 — 개인별로 읽으면 안 된다는 게
            그룹 케이스에서 가장 중요한 고지다. -->
    <span class="text-body-03-normal-regular text-body-subtle">
      내담자 {report.clientCount}명의 그룹이에요 — 참석률은 회기 × 인원 칸 중
      참석한 비율이고, 나머지 분석은 개인이 아니라 집단 전체 기준이에요.
    </span>
  {/if}
  {#if c.truncatedNotes > 0 && c.perSessionChars}
    <span class="text-body-03-normal-regular text-body-subtle">
      일지 {c.truncatedNotes}건은 내용이 길어 회기당 {c.perSessionChars.toLocaleString()}자까지만
      읽었어요. 특정 시기를 자세히 보려면 범위를 좁혀 다시 분석해 보세요.
    </span>
  {/if}
</div>
