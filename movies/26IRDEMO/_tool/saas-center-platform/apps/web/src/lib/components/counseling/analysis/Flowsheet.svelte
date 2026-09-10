<script lang="ts">
  // 플로우시트 — 이 리포트의 척추.
  //
  // 병원 차트의 플로우시트와 같은 일을 한다: 시간축 하나에 관측치를 걸어, 세로로
  // 훑으면 추세가 가로로 훑으면 그날 상태가 보이게 한다. 국면을 별도 카드로 두지
  // 않고 표 안의 밴드 행으로 흡수하는 것도 같은 이유다 — 시간축을 두 번 그리지 않는다.
  //
  // 컬럼은 데이터가 있을 때만 선다. 기분·방법·과제는 녹음 기반 일지에서만 나오므로
  // 손 작성만 있는 케이스에서는 컬럼째 사라진다(빈 칸이 늘어선 표 = 분석 부실로 읽힘).
  //
  // 🔴 국면은 **이 표의 밴드 행이 유일한 자리**다 (2026-09-03). 표 위에 따로 서 있던
  // 국면 스트립(카드 3장)을 없앴다 — label·range·focus를 스트립과 밴드가 나란히 두 번
  // 그리고 있었다. 스트립이 더 갖고 있던 두 값은 이렇게 처리한다:
  //   · trend  → 밴드 행 우측의 화살표로 흡수
  //   · turning→ 밴드 행 둘째 줄로 흡수. 회기 행의 '전환점' 배지가 **어느 회기인지**를
  //              찍고, 밴드의 문장이 **무엇이 바뀌었는지**를 말한다(같은 표 안에서 짝).
  //   · mood   → 버린다. 회기별 '기분' 컬럼이 같은 것을 회기 단위로 이미 말한다.
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import type {
    Attendance,
    CaseReportVM,
    SessionRowVM,
    Trend
  } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    onSelectSession
  }: { report: CaseReportVM; onSelectSession?: (session: number) => void } =
    $props()

  const TREND: Record<Trend, { mark: string; cls: string; label: string }> = {
    up: { mark: '↑', cls: 'text-status-success', label: '호전' },
    flat: { mark: '→', cls: 'text-body-subtle', label: '유지' },
    down: { mark: '↓', cls: 'text-status-danger', label: '악화' },
    // 그룹 전용 — 좋고 나쁨이 아니라 '갈렸다'는 사실이라 상태색을 쓰지 않는다
    mixed: { mark: '↕', cls: 'text-body-default', label: '갈림' }
  }
  // 어휘는 앱 정본을 따른다 — 출결 값은 이 제품 전체에서 **참석 / 취소 / 노쇼**다
  // (회기 상세의 출결 토글·확인 모달·스낵바가 전부 이 말을 쓴다).
  // 이 리포트만 '출석'이라고 부르고 있었다 — 같은 것을 다른 말로 부르면 다른 것이 된다.
  const ATTENDANCE: Record<Attendance, { label: string; cls: string }> = {
    attended: { label: '참석', cls: 'text-body-subtle' },
    absent: { label: '취소', cls: 'text-caption-subtle' },
    no_show: { label: '노쇼', cls: 'text-status-danger' }
  }
  const HOMEWORK: Record<string, string> = {
    done: '함',
    partial: '일부',
    none: '안 함'
  }

  const hasMood = $derived(report.sessionTrack.some((s) => !!s.mood))
  const hasIntervention = $derived(
    report.sessionTrack.some((s) => !!s.intervention)
  )
  const hasHomework = $derived(report.sessionTrack.some((s) => !!s.homework))
  const hasChange = $derived(report.sessionTrack.some((s) => !!s.change))
  const hasAttendance = $derived(
    report.sessionTrack.some((s) => !!s.attendance)
  )

  const columns = $derived([
    { label: '회기', w: 'w-28' },
    ...(hasAttendance
      ? [{ label: report.isGroup ? '참석 인원' : '출결', w: 'w-24' }]
      : []),
    { label: '다룬 주제', w: '' },
    ...(hasMood ? [{ label: '정서', w: 'w-28' }] : []),
    ...(hasIntervention ? [{ label: '개입 기법', w: 'w-44' }] : []),
    ...(hasChange ? [{ label: '변화', w: 'w-24' }] : []),
    ...(hasHomework ? [{ label: '과제', w: 'w-20' }] : [])
  ])

  type Line =
    | {
        kind: 'band'
        label: string
        range: string
        focus: string | null
        trend: Trend | null
        turning: string | null
      }
    | { kind: 'row'; row: SessionRowVM }

  const lines = $derived.by((): Line[] => {
    if (report.phases.length === 0)
      return report.sessionTrack.map((row) => ({ kind: 'row' as const, row }))
    const out: Line[] = []
    const seen = new Set<number>()
    for (const p of report.phases) {
      out.push({
        kind: 'band',
        label: p.label,
        range: p.range,
        focus: p.focus,
        trend: p.trend,
        turning: p.turning
      })
      for (const row of report.sessionTrack) {
        if (row.session >= p.from && row.session <= p.to) {
          out.push({ kind: 'row', row })
          seen.add(row.session)
        }
      }
    }
    // 어느 국면에도 안 걸린 회기는 버리지 않는다 — 표가 곧 회기 전체 목록이다
    for (const row of report.sessionTrack) {
      if (!seen.has(row.session)) out.push({ kind: 'row', row })
    }
    return out
  })

  function emptyMark(s: SessionRowVM) {
    return s.noteSource === 'none' ? '일지 없음' : '기록 없음'
  }
</script>

<div class="overflow-x-auto">
  <table class="w-full min-w-[760px] border-collapse">
    <thead>
      <tr class="border-b border-border-default">
        {#each columns as col}
          <th
            class="h-11 pr-3 pl-6 text-left text-body-02-normal-medium text-title-subtitle {col.w}"
          >
            {col.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each lines as line}
        {#if line.kind === 'band'}
          <tr class="bg-gray-50">
            <td colspan={columns.length} class="py-2.5 pr-3 pl-6">
              <span class="flex items-baseline gap-2">
                <span class="text-body-02-normal-medium text-title-subtitle">
                  {line.label}
                </span>
                <span
                  class="min-w-0 text-body-03-normal-regular text-body-subtle"
                >
                  {line.range}{line.focus ? ` · ${line.focus}` : ''}
                </span>
                {#if line.trend}
                  <span
                    class="ml-auto shrink-0 text-body-02-normal-medium {TREND[
                      line.trend
                    ].cls}"
                  >
                    {TREND[line.trend].mark}
                    {TREND[line.trend].label}
                  </span>
                {/if}
              </span>
              {#if line.turning}
                <!-- 무엇이 바뀌었는지. 어느 회기인지는 아래 회기 행의 배지가 찍는다 -->
                <span
                  class="mt-1 block text-body-03-reading-regular text-body-default"
                >
                  {line.turning}
                </span>
              {/if}
            </td>
          </tr>
        {:else}
          {@const s = line.row}
          <tr
            class="h-18 border-b border-border-subtle transition-colors hover:bg-gray-50 {onSelectSession
              ? 'cursor-pointer'
              : ''}"
            onclick={() => onSelectSession?.(s.session)}
          >
            <td class="pr-3 pl-6">
              <span class="flex items-center gap-2">
                <span class="text-title-01-normal-semibold text-body-strong">
                  {s.session}
                </span>
                {#if s.date}
                  <span class="text-body-02-normal-regular text-body-subtle"
                    >{s.date}</span
                  >
                {/if}
                {#if s.turning}
                  <BadgeRectangle label={s.turning} color="amber" />
                {/if}
              </span>
            </td>
            {#if hasAttendance}
              <!-- 🔴 그룹은 상태 한 값이 아니라 **인원**을 보여준다.
                   서버의 출결 축약이 "한 명이라도 오면 참석"이라, 5명 중 3명만 온
                   회기와 전원이 온 회기가 똑같이 '참석'으로 찍힌다. 그룹에서는
                   빠진 사람이 있다는 사실 자체가 읽혀야 할 정보다.
                   전원 참석이 아닌 회기는 색으로도 눈에 걸리게 한다. -->
              {#if report.isGroup && s.participantCount}
                {@const full = s.attendedCount === s.participantCount}
                <td
                  class="pr-3 pl-6 text-body-02-normal-regular {full
                    ? 'text-body-subtle'
                    : 'text-status-danger'}"
                >
                  {s.attendedCount}/{s.participantCount}
                </td>
              {:else}
                <td
                  class="pr-3 pl-6 text-body-02-normal-regular {s.attendance
                    ? ATTENDANCE[s.attendance].cls
                    : 'text-caption-subtle'}"
                >
                  {s.attendance ? ATTENDANCE[s.attendance].label : '-'}
                </td>
              {/if}
            {/if}
            <td class="pr-3 pl-6 text-body-01-normal-regular text-body-default">
              {#if s.topic}
                {s.topic}
              {:else}
                <span class="text-body-02-normal-regular text-caption-subtle">
                  {emptyMark(s)}
                </span>
              {/if}
            </td>
            {#if hasMood}
              <td
                class="pr-3 pl-6 text-body-02-normal-regular text-body-subtle"
              >
                {s.mood ?? '-'}
              </td>
            {/if}
            {#if hasIntervention}
              <td
                class="pr-3 pl-6 text-body-02-normal-regular text-body-subtle"
              >
                {s.intervention ?? '-'}
              </td>
            {/if}
            {#if hasChange}
              <td class="pr-3 pl-6">
                {#if s.change}
                  <span
                    class="text-body-01-normal-medium {TREND[s.change].cls}"
                  >
                    {TREND[s.change].mark}
                    {TREND[s.change].label}
                  </span>
                {:else}
                  <span class="text-body-02-normal-regular text-caption-subtle"
                    >-</span
                  >
                {/if}
              </td>
            {/if}
            {#if hasHomework}
              <td
                class="pr-3 pl-6 text-body-02-normal-regular text-body-subtle"
              >
                {s.homework ? HOMEWORK[s.homework] : '-'}
              </td>
            {/if}
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
