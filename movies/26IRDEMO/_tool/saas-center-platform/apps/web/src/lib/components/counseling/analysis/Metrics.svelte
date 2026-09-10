<script lang="ts">
  // 케이스 지표 — 슬롯 고정, 그리고 **전부 사실**만 둔다.
  //
  // 값이 없어도 칸을 지우지 않는다(차트의 N/A). 매번 같은 자리에서 같은 순서로
  // 읽히는 게 값 자체보다 중요하고, 칸 수가 케이스마다 달라지면 자리를 학습할 수 없다.
  // ↔ 큰 섹션(방법 표)은 반대로 조건부다 — 빈 표는 분석 부실로만 읽힌다.
  //
  // 🔴 2026-09-03 정리 — 네 칸에서 세 칸으로.
  //   · 옛 '지켜볼 점 N건' 삭제: 그 N건의 **목록 자체**가 같은 화면에(넓으면 우측
  //     레일, 좁으면 배너 바로 아래) 늘 떠 있다. 보이는 목록을 세어 숫자로 다시
  //     말하는 건 정보가 아니라 소음이다.
  //   · 값 밑 설명문은 **값이 없을 때만** 남긴다. "12/16회기" 밑의 "계획한 16회기 중"은
  //     16을 두 번, "출석 92%" 밑의 "회기 12개 기준"은 12를 두 번 말한다. 숫자가 있으면
  //     숫자가 스스로 말하고, 없을 때만 왜 없는지를 댄다.
  //   · '기분이 적힌 일지 N건 기준' 같은 출처 고지는 맨 아래 「읽은 기록」이 소유한다.
  //
  // 타이포 — §반복 패턴 '레이블+데이터 지표 변형': 레이블 15 Medium → gap 8 → 값
  // 24 SemiBold(상단 요약 스트립 규격) + gap 4 단위 15. 값의 색이 곧 의미다:
  // 사실은 gray-900, 판정(기분 흐름)은 상태색.

  import type {
    CaseReportVM,
    Trend
  } from '$lib/features/counseling/analysis/view-model'

  let { report }: { report: CaseReportVM } = $props()

  const TREND: Record<Trend, { mark: string; cls: string; label: string }> = {
    up: { mark: '↑', cls: 'text-status-success', label: '호전' },
    flat: { mark: '→', cls: 'text-body-subtle', label: '유지' },
    down: { mark: '↓', cls: 'text-status-danger', label: '악화' },
    // 그룹 전용 — 좋고 나쁨이 아니라 '갈렸다'는 사실이라 상태색을 쓰지 않는다
    mixed: { mark: '↕', cls: 'text-body-default', label: '갈림' }
  }

  // 순서 = 방향(나아지나) → 경과(어디까지 왔나).
  //
  // 그룹이면 정서의 **단위를 라벨이 밝힌다**. 그룹 케이스에서 값 하나가 집단 전반인지
  // 두드러진 한 사람인지 구분되지 않으면, 상담사가 이 화살표를 개인 판단에 쓴다
  // (서버 프롬프트도 그룹에서는 '집단 전반의 분위기'로만 답하도록 못박아 두었다).
  const slots = $derived([
    {
      label: report.isGroup ? '집단 정서 흐름' : '정서 흐름',
      value: report.moodTrend
        ? `${TREND[report.moodTrend].mark} ${TREND[report.moodTrend].label}`
        : null,
      unit: '',
      cls: report.moodTrend ? TREND[report.moodTrend].cls : '',
      empty: report.isGroup
        ? '내담자들 일지에 정서가 적혀 있지 않아요'
        : '일지에 정서가 적혀 있지 않아요',
      // '갈림'만 예외로 값 밑에 설명을 단다 — 숫자·화살표는 스스로 말하지만
      // "내담자마다 다르다"는 두 글자로 전달되지 않는다.
      note: report.moodTrend === 'mixed' ? '내담자마다 방향이 달라요' : null
    },
    {
      label: '진행',
      value: report.planned
        ? `${report.coverage.completedSessions}/${report.planned}`
        : `${report.coverage.completedSessions}`,
      unit: '회기',
      cls: 'text-title-default',
      empty: '',
      note: null
    },
    {
      label: '참석률',
      value:
        report.coverage.attendanceRate != null
          ? `${report.coverage.attendanceRate}%`
          : null,
      unit: '',
      cls: 'text-title-default',
      empty: '출결이 기록되지 않았어요',
      // 그룹은 분모가 다르다 — 개인은 회기 단위, 그룹은 회기 × 인원.
      // 라벨을 '내담자 참석률'로 늘리는 대신 값 밑에서 기준을 밝힌다
      // (라벨은 개인·그룹이 같은 자리에 있어야 자리를 학습할 수 있다).
      note: report.isGroup ? `내담자 ${report.clientCount}명 기준이에요` : null
    }
  ])
</script>

<div class="flex items-stretch">
  {#each slots as s, i}
    <div
      class="flex flex-col px-6 {i > 0
        ? 'border-l border-border-subtle'
        : 'pl-0'}"
    >
      <span class="text-body-02-normal-medium text-title-subtitle"
        >{s.label}</span
      >
      <span class="mt-2 flex min-h-8 items-baseline gap-1">
        {#if s.value}
          <span class="text-headline-01-normal-semibold {s.cls}">{s.value}</span
          >
          {#if s.unit}
            <span class="text-body-02-normal-regular text-body-subtle"
              >{s.unit}</span
            >
          {/if}
        {:else}
          <!-- 값이 없는 상태 = 비활성 — gray-400을 쓰는 몇 안 되는 자리 -->
          <span class="text-body-01-normal-regular text-caption-subtle"
            >기록 없음</span
          >
        {/if}
      </span>
      <!-- 설명문은 값이 없을 때만 — 있으면 숫자가 스스로 말한다.
           예외는 '갈림'뿐이다(위 note 주석 참고). -->
      {#if !s.value && s.empty}
        <span class="mt-1 text-body-03-normal-regular text-body-subtle"
          >{s.empty}</span
        >
      {:else if s.value && s.note}
        <span class="mt-1 text-body-03-normal-regular text-body-subtle"
          >{s.note}</span
        >
      {/if}
    </div>
  {/each}
</div>
