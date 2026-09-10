<script lang="ts">
  // 판단 블록 — **요약 · 지켜볼 점 · 강점**, 셋이다.
  //
  // 라벨은 '강점'이다. 한때 '강점과 자원'이라고 붙였는데, **'자원'은 프롬프트가
  // 금지어로 못박아 둔 번역 조어**(자아강도·내적 자원·심리적 유연성)라 자기모순이었다.
  //
  // 🔴 2026-09-03 — '강점'을 여기로 올렸다.
  // 지켜볼 점(위험)과 강점은 **같은 질문의 반대 부호**다 —
  // "지금 무엇이 눈에 띄나". 예전엔 위험이 맨 위, 강점이 맨 아래(네 섹션 건너)에
  // 있어서, 걱정거리를 읽고 그 무게를 재줄 정보를 보려면 리포트 끝까지 스크롤해야 했다.
  // 그러면 판단이 한쪽으로 기운다. 둘은 나란히 있어야 저울이 된다.
  //
  // 레일의 존재 이유는 "근거를 훑는 동안 잃으면 안 되는 것"을 붙잡아 두는 것이다.
  // 요지 · 위험 · 강점이 거기 해당한다. 다음 할 일(앞으로)은 본문에 자기 섹션이 있다.
  //
  // 같은 내용을 두 형태로 낸다:
  //   rail  — 넓을 때. 우측에 세로로 붙어 스크롤해도 남는다.
  //   strip — 좁을 때. 배너 바로 아래 가로로 눕는다.
  // 레일을 숨기기만 하면 화면이 좁다는 이유로 셋이 통째로 사라진다.
  //
  // strip에서 요약은 **한 줄 전체**를 쓰고 위험·강점이 그 아래 두 칸으로 마주 본다
  // (도크 폭 800에서 세 장을 세로로 쌓으면 첫 섹션이 화면 밖으로 밀린다).
  //
  // 숫자 지표(기분 흐름·진행·출석)는 여기 없다 — 배너가 들고 있다.
  // 배너는 사실(숫자), 여기는 그 숫자가 무슨 뜻인지(해석).

  import Evidence from './Evidence.svelte'
  import Verdict from './Verdict.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    variant = 'rail',
    onSelectSession
  }: {
    report: CaseReportVM
    variant?: 'rail' | 'strip'
    onSelectSession?: (session: number) => void
  } = $props()

  const isRail = $derived(variant === 'rail')
</script>

{#snippet block(
  title: string,
  titleClass: string,
  items: { text: string; sessions: number[] }[],
  empty: string
)}
  <!-- 외곽선 단계는 **깔린 배경**이 정한다(§Colors 카드 외곽선) —
       레일은 gray-50 면 위라 subtle, 스트립은 흰 면 위라 default.
       레일에서 default를 두르면 선이 카드보다 먼저 읽힌다. -->
  <div
    class="rounded-xl border bg-white p-4 {isRail
      ? 'border-border-subtle'
      : 'border-border-default'}"
  >
    <p class="text-body-02-normal-medium {titleClass}">{title}</p>
    <ul class="mt-3 flex flex-col gap-3">
      {#each items as f}
        <li>
          <p class="text-body-03-reading-regular text-body-default">{f.text}</p>
          <div class="mt-1">
            <Evidence sessions={f.sessions} onSelect={onSelectSession} />
          </div>
        </li>
      {:else}
        <li class="text-body-03-normal-regular text-body-subtle">{empty}</li>
      {/each}
    </ul>
  </div>
{/snippet}

<div
  class={isRail ? 'flex flex-col gap-5 p-5' : 'flex flex-col gap-4 px-6 py-5'}
>
  {#if report.headline}
    <Verdict text={report.headline} dense />
  {/if}

  <div
    class={isRail ? 'flex flex-col gap-5' : 'grid gap-4 @[720px]:grid-cols-2'}
  >
    {@render block(
      '지켜볼 점',
      'text-status-danger',
      report.risks,
      '지금은 걱정할 만한 신호가 안 보여요'
    )}
    {@render block(
      '강점',
      'text-status-success',
      report.strengths,
      '일지에서 찾은 게 없어요'
    )}
  </div>
</div>
