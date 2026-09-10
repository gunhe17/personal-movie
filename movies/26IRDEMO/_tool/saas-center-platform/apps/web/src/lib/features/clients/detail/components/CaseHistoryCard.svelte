<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import { formatUtcToKst } from '$lib/utils/date'
  import type { CaseHistoryItem } from '$lib/features/clients/detail/case-history'

  interface Props {
    item: CaseHistoryItem
    /** 카드 클릭 시 케이스 상세로 이동 */
    onNavigate: (item: CaseHistoryItem) => void
  }

  let { item, onNavigate }: Props = $props()

  // 제목: 세트가 아닌 다건 검사는 "첫 검사명 외 N건"으로 축약
  const displayTitle = $derived(
    item.kind === 'assessment' && !item.isSet && item.assessmentNames.length > 1
      ? `${item.assessmentNames[0]} 외 ${item.assessmentNames.length - 1}건`
      : item.title
  )

  // 진행률: 상담은 '회기', 검사는 '개'
  const progressUnit = $derived(item.kind === 'counseling' ? '회기' : '개')

  // 상담 케이스의 '완료'는 종결 — 상담 카드·필터 탭과 용어를 맞춘다(검사는 '완료' 그대로)
  const statusText = $derived(
    item.kind === 'counseling' && item.statusText === '완료'
      ? '종결'
      : item.statusText
  )

  // 다음 진행일 — 상담은 다음 회기, 검사는 검사 일정. 없으면 행을 감춘다.
  const nextDateLabel = $derived(
    item.nextStart ? formatUtcToKst(item.nextStart, 'YYYY. MM. DD (d)') : null
  )
  const nextDateFieldLabel = $derived(
    item.kind === 'counseling' ? '다음 상담일' : '검사 일정'
  )

  // 타이틀 하위 보조 정보 — "담당자 김상담". 상담·검사에서 역할명(상담사/검사자)이
  // 갈리면 같은 자리의 같은 정보가 두 어휘로 읽힌다 → '담당자'로 통일한다.
  const counselorRoleLabel = $derived(
    item.counselorLabel === '담당자 미지정'
      ? item.counselorLabel
      : `담당자 ${item.counselorLabel}`
  )
</script>

<!-- 카드 전체가 케이스 상세로 가는 링크 (상담·검사 공통) -->
<button
  type="button"
  onclick={() => onNavigate(item)}
  class="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
>
  <!-- ① 타이틀 영역: [세트]+제목·담당자(좌) / 케이스 상태 배지(우, 영역 기준 세로 가운데).
       케이스 코드는 노출하지 않는다 — 이 탭은 이미 한 내담자의 케이스 목록이라
       식별자가 필요 없다. 코드는 상담·검사 카드 리스트에서만 보여준다. -->
  <div class="flex min-w-0 items-center justify-between gap-3">
    <!-- 타이틀 그룹: 제목 + 담당자. 그룹 내부 간격 12 -->
    <div class="flex min-w-0 flex-col gap-3">
      <!-- 제목 줄 높이 24 고정 — 세트 배지(24)가 있는 검사와 없는 상담(제목 line-height 18)이
           6px 어긋나 구분선·데이터 블록 위치가 카드마다 달라진다 -->
      <div class="flex min-h-6 min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {#if item.isSet}
          <!-- 검사 세트 배지 = 검사 케이스 카드와 동일 규격 (흰 배경 + 중립 테두리 + 주황 텍스트) -->
          <BadgeRectangle
            label="세트"
            color="orange"
            outlined
            size="sm"
            class="border-border-default"
          />
        {/if}
        <Typography
          variant="title-01-normal-semibold"
          color="text-title-default"
          className="min-w-0 truncate-safe"
        >
          {displayTitle}
        </Typography>
      </div>
      <!-- 타이틀보다 한 단계 연한 body-default -->
      <Typography
        variant="body-01-normal-regular"
        color="text-body-default"
        className="min-w-0 truncate-safe"
      >
        {counselorRoleLabel}
      </Typography>
    </div>
    <span
      class="inline-flex h-8 min-w-[63px] shrink-0 items-center justify-center rounded-[100px] px-3 text-body-03-normal-regular {item.statusClass}"
    >
      {statusText}
    </span>
  </div>

  <!-- 타이틀 영역 ↔ 데이터 구분선 (구성원 상세 카드와 동일 규격) -->
  <hr class="my-4 border-gray-100" />

  <!-- ② 장소 · 진행률 · 다음 진행일(검사는 검사 일정) — 레이블+데이터 가로형.
       담당자는 타이틀 그룹으로 올라가 여기서 빠진다.
       카드 안이므로 행 간 8 (Web_Design.md §Layout > 레이블+데이터) -->
  <!-- 레이블 열은 카드마다 auto로 재계산돼 상담('다음 상담일')과 검사('검사 일정')의
       값 시작점이 어긋난다 → 폭을 고정해 두 종류가 같은 자리에서 값을 연다.
       고정값 68 = 가장 긴 레이블 '다음 상담일' 실측 66.13(body-02 15/400, letter-spacing -0.41)의
       4px 그리드 올림. 옛 76은 최장 레이블보다 10 큰 임의값이라 레이블↔값이 규격 24가 아니라
       34~50으로 벌어졌다(2026-08-19 실측 교정). 레이블이 추가되면 이 값을 다시 잰다 -->
  <div
    class="grid grid-cols-[68px_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-2"
  >
    <!-- 장소: 상담은 상담실, 검사는 검사 일정에 배정된 상담실 -->
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      장소
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color={item.roomName ? 'text-gray-900' : 'text-gray-400'}
      className="min-w-0 truncate-safe"
    >
      {item.roomName || '-'}
    </Typography>

    <!-- 진행률은 값이 없어도 행을 유지한다 — 조건부로 감추면 상담(3행)과 검사(2행)의
         데이터 블록 높이가 달라져 카드가 서로 다른 규격으로 보인다 -->
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      진행률
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color={item.total > 0 ? 'text-gray-900' : 'text-gray-400'}
    >
      {item.total > 0 ? `${item.completed}/${item.total} ${progressUnit}` : '-'}
    </Typography>

    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      {nextDateFieldLabel}
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color={nextDateLabel ? 'text-gray-900' : 'text-gray-400'}
      className="min-w-0 truncate-safe"
    >
      {nextDateLabel || '-'}
    </Typography>
  </div>
</button>
