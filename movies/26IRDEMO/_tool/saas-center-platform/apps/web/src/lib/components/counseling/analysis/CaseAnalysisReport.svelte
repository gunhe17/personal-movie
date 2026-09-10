<script lang="ts">
  // ─────────────────────────────────────────────────────────────
  // AI 상담 경과 분석 리포트 — 플로우시트 + 판단 레일
  // ─────────────────────────────────────────────────────────────
  //
  // 화면을 두 성격으로 가른다:
  //   본문 = 계획 → 요약 → 근거 → 맥락 (상담사가 묻는 순서, 아래 배치 주석)
  //   레일 = 요지와 위험 — AI 한 줄 정리 · 지켜볼 점 (스크롤해도 잃으면 안 되는 둘)
  //
  // ── 한 값은 한 자리에서만 (2026-09-03 정리) ─────────────────────────
  // 같은 사실이 두 군데 그려지고 있던 곳을 전부 한 쪽으로 몰았다:
  //   현재 상태     배너 `현재` + AI 한 줄 정리 → **AI 카드**만 (프롬프트상 headline의
  //                뒷절이 곧 current_state다 — "무엇이 남았는지")
  //   지켜볼 점     배너 지표 'N건' + 목록      → **목록**만 (보이는 걸 세지 않는다)
  //   국면          표 위 스트립 + 표 안 밴드행 → **밴드 행**만 (시간축을 두 번 안 그린다)
  //   회기 수·출석  지표 값 + 그 밑 설명문      → **값**만 (값이 없을 때만 이유를 댄다)
  //   섹션 부제     제목 밑 부제 + 자식 라벨    → **자식 라벨**만
  //   국면 기분     스트립 문장 + 회기별 기분 열 → **회기별 열**만
  //
  // 병원 차트에서 경과기록과 문제목록/처방이 갈려 있는 것과 같은 이유다. 근거를 훑는
  // 동안에도 "그래서 무엇을 해야 하나"가 시야에서 사라지지 않고, 사실↔해석의 구분이
  // 자리로 드러난다.
  //
  // 🔴 레일은 **컨테이너 폭**으로 갈린다(뷰포트 아님). 이 리포트는 케이스 상세의 우측
  // 도크(폭 800) 안에 살아서, 뷰포트가 아무리 넓어도 컨테이너는 800이다.
  // 뷰포트 breakpoint를 쓰면 넓은 모니터에서 레일이 본문을 눌러 표가 찌그러진다.
  // 폭이 모자라면 레일을 **숨기는 게 아니라 배너 아래 가로 스트립으로 눕힌다** —
  // 숨기기만 하면 화면이 좁다는 이유로 한 줄 정리·지켜볼 점이 통째로 사라진다.
  // 임계 1080 = 레일 320 + 플로우시트 최소폭 760. 도크 800에서는 스트립으로 눕고,
  // 도크가 더 넓어지거나 이 리포트가 넓은 컨테이너로 옮겨가면 그때 레일이 선다.
  //
  // ── 타이포 규약 (이 리포트 전체) ──────────────────────────────────────
  // 크기는 "얼마나 중요한가"가 아니라 **무엇인가**를 말한다:
  //   18 SemiBold  이름·제목 — 섹션 제목, 표의 회기 번호
  //   24 SemiBold  배너 지표값 하나뿐 (§반복 패턴 상단 요약 스트립)
  //   16           본문 데이터 · 결론 문장 · 배너의 주호소/현재
  //   15           라벨(Medium) · 표의 부속 값 · 카드 실행 항목
  //   14           캡션 · 근거 · 카드 안 설명문
  //   13           배지
  // 굵기: Regular=사실 · Medium=판정과 행동 · SemiBold=이름과 제목. **Bold 없음.**
  // 색:  gray-900 읽어야 할 내용 · gray-700 데이터 · gray-600 라벨 · gray-500 설명
  //      gray-400 **없음·비활성 전용**(설명문에 쓰지 않는다)
  //      상태색=판정(나아짐·힘들어짐·지켜볼 점) · primary-500=누를 수 있는 것(근거 회기)
  //      ai-500=AI가 쓴 문장
  //
  // 카드를 두르지 않는다 — 섹션은 헤어라인으로만 가른다. 같은 무게의 카드를 쌓으면
  // 독립된 물건 여럿으로 읽혀 어디부터 볼지 신호가 사라진다.
  //
  // ── 어휘 기준 (2026-09-03 재교정) ────────────────────────────────────
  // **현장 전문어는 쓰고, 번역투 조어는 쓰지 않는다.** 두 부류를 가르는 선이다:
  //   쓴다     개입 · 정서 · 호전/유지/악화 · 강점 · 주제 · 주호소 · 회기 · 과제 ·
  //            슈퍼비전 · 라포 — 상담사가 슈퍼비전에서 매일 입에 올리는 말
  //   안 쓴다  치료적 동맹 · 정서 추세 · 치료적 관계 · 개입의 효과성 —
  //            영어 논문을 그대로 옮긴 조어. 현장에서 아무도 이렇게 말하지 않는다
  // 한때 전자까지 풀어 썼다(개입→'써본 방법', 호전→'나아짐', 강점→'잘 되고 있는 것').
  // 과교정이었다 — 전문가용 도구가 전문어를 풀어 쓰면 친절해지는 게 아니라 정확도를
  // 잃는다('방법'은 개입보다 넓고 흐릿하다). 서버 프롬프트의 말투 규칙도 같은 선이다.
  //
  // 출결 어휘(참석/취소/노쇼)는 이 리포트가 정하지 않는다 — 앱 정본을 따른다.
  //
  // 🔴 일지 **필드를 가리키는 라벨**도 마찬가지다. 정본은 상담사가 그 값을 실제로
  // 보는 화면의 라벨 맵(`AiDraftHistory` FIELD_LABELS)이다:
  //   mood=정서 상태 · main_topic=주요 주제 · **intervention=개입 기법** · homework=과제
  // 그래서 표 헤더·섹션 제목처럼 **필드를 이름 부르는 자리**는 `개입 기법`을 쓴다.
  // 문장 속에서는 `개입`으로 줄여도 된다 — 앱도 라벨만 전체 이름을 쓴다
  // ("개입 기법을 했어요"라고 말하는 사람은 없다).

  import Button from '$lib/components/Button.svelte'
  import CaseBanner from './CaseBanner.svelte'
  import Coverage from './Coverage.svelte'
  import Direction from './Direction.svelte'
  import Flowsheet from './Flowsheet.svelte'
  import Interventions from './Interventions.svelte'
  import JudgementBlocks from './JudgementBlocks.svelte'
  import Themes from './Themes.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    canRerun = false,
    onRerun,
    onSelectSession
  }: {
    report: CaseReportVM
    canRerun?: boolean
    onRerun?: () => void
    onSelectSession?: (session: number) => void
  } = $props()
</script>

<!-- 섹션 제목은 **제목만**이다 (2026-09-03).
     옛 부제는 예외 없이 바로 아래 자식들의 라벨을 다시 읽는 줄이었다 —
     '자주 나온 이야기 / 계속 나오는 것 · 새로 나온 것 · 이제 안 나오는 것'의
     세 조각은 그 아래 세 칸의 제목(계속 나와요 · 새로 나왔어요 · 이제 안 나와요)과
     같은 말이다. 다섯 섹션 전부 같은 구조였다. 설명이 필요한 자리는 자식이 갖는다. -->
{#snippet head(title: string)}
  <h3 class="mb-4 text-title-01-normal-semibold text-title-default">{title}</h3>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  <div class="shrink-0">
    <CaseBanner {report} />
  </div>

  <div class="@container flex min-h-0 flex-1 overflow-y-auto">
    <!-- ── 본문 — 상담사가 묻는 순서대로 ──
         요지 → 분석 → 근거 → 계획. 상담·의료 기록의 관례(SOAP의 S/O → A → P)와 같다.
           (스트립) 요약·지켜볼 점·강점   지금 무슨 상황인가   (요지)
           개입과 반응                    뭐가 통했나         ┐ 전 회기를
           주제 흐름                      뭐가 계속 나오나     ┘ 가로지른 분석
           회기별 기록                    정말 그런가         (근거)
           앞으로                         그래서 다음에        (계획)

         🔴 '앞으로'는 **맨 뒤**다 (2026-09-03 교정). 한때 맨 앞에 뒀는데, 그건
         "요약을 먼저"와 "계획을 먼저"를 뒤섞은 판단이었다. 결론 먼저의 몫은 상단
         AI 요약이 이미 지고 있고, **계획은 근거를 읽고 난 뒤라야 평가할 수 있다.**
         읽고 나서 들고 나가는 것도 '다음에 뭘 할까'라, 마지막에 있어야 그 자리에서
         바로 이어진다.
         12행짜리 회기표는 두 분석 사이가 아니라 그 아래에 둔다 — 같은 성격의
         분석 둘을 표가 갈라놓으면 층이 무너진다. -->
    <div class="min-w-0 flex-1">
      <!-- 레일이 설 폭이 없을 때 요지·위험이 여기로 눕는다 -->
      <div class="border-b border-border-default @[1080px]:hidden">
        <JudgementBlocks {report} variant="strip" {onSelectSession} />
      </div>

      <section class="py-6">
        <div class="px-6">{@render head('개입 기법과 반응')}</div>
        <Interventions {report} {onSelectSession} />
      </section>

      <section class="border-t border-border-default px-6 py-6">
        <!-- '반복 주제'가 아니다 — 이 섹션은 지속·새로 등장·사라짐 셋을 담으므로
             '반복'은 그중 하나만 가리킨다. 셋을 아우르는 건 흐름이다. -->
        {@render head('주제 흐름')}
        <Themes {report} {onSelectSession} />
      </section>

      {#if report.sessionTrack.length > 0}
        <section class="border-t border-border-default py-6">
          <div class="px-6">{@render head('회기별 기록')}</div>
          <!-- 상담에 임하는 모습(참여도)은 **이 표의 한 줄 요약**이다 — 근거가
               출석·과제·발화이고, 그 출석·과제가 바로 아래 표의 컬럼이다.
               예전엔 맨 아래 독립 섹션이라, 한 문장짜리 내용에 섹션 하나를 쓰면서
               정작 그 근거가 되는 표와는 멀리 떨어져 있었다. -->
          {#if report.engagement || report.alliance}
            <p class="px-6 pb-4 text-body-02-reading-regular text-body-default">
              {#if report.engagement}
                <span class="text-body-02-normal-medium text-body-strong"
                  >참여도 {report.engagement}</span
                >
              {/if}{#if report.alliance}{report.engagement
                  ? ' — '
                  : ''}{report.alliance}{/if}
            </p>
          {/if}
          <!-- 국면은 이 표의 밴드 행이 소유한다 — 표 위 스트립은 같은 값을
               두 번 그려서 없앴다(Flowsheet 상단 주석 참조) -->
          <Flowsheet {report} {onSelectSession} />
        </section>
      {/if}

      <section class="border-t border-border-default px-6 py-6">
        {@render head('앞으로')}
        <Direction {report} />
      </section>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border-default px-6 py-4"
      >
        <Coverage {report} />
        {#if canRerun}
          <!-- 중립 액션 = 공용 Button의 white-action(§button-white).
               손으로 만들었을 땐 좌우 패딩 16(Title 사이즈는 20)에 hover도
               '회색 면 위 예외'(보더로 표시)를 흰 면에서 쓰고 있었다. -->
          <Button
            color="white-action"
            size="title"
            content="다시 분석"
            onclick={onRerun}
          />
        {/if}
      </div>
    </div>

    <!-- ── 레일: 판단과 행동 (폭이 있을 때만) ── -->
    <aside
      class="hidden w-80 shrink-0 border-l border-border-default bg-gray-50 @[1080px]:block"
    >
      <div class="sticky top-0">
        <JudgementBlocks {report} variant="rail" {onSelectSession} />
      </div>
    </aside>
  </div>
</div>
