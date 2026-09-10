<script lang="ts">
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import Button from '$lib/components/Button.svelte'
  import SegmentTab from '$lib/components/SegmentTab.svelte'
  import DatePickerInput from '$lib/components/DatePickerInput.svelte'
  import {
    StatsSummaryCard,
    BarChart,
    DonutChart
  } from '$lib/components/assessment/statistics'
  import {
    PERIOD_OPTIONS,
    type PeriodType
  } from '$lib/features/assessment/statistics/constants'
  import type {
    StatsSummary,
    BarChartItem,
    DonutChartItem
  } from '$lib/features/assessment/statistics/types'
  import Typography from '@common/components/Typography.svelte'

  // 필터 상태
  let period = $state<PeriodType>('daily')
  let startDate = $state('')
  let endDate = $state('')

  // 통계 카드 데이터 (더미)
  const statsData: StatsSummary[] = [
    { label: '완료된 검사', value: 86, trendValue: 3 },
    { label: '진행중 검사', value: 86, trendValue: 3 },
    { label: '취소된 검사', value: 86, percentageValue: 9 },
    { label: '거부된 검사', value: 86, percentageValue: 2 }
  ]

  // 검사별 진행 현황 데이터 (더미)
  const assessmentChartData: BarChartItem[] = [
    { label: '스마트 바디체커', value: 23 },
    { label: '스마트폰 이용습관', value: 23 },
    { label: '로르샤흐', value: 32 },
    { label: 'BGT', value: 24 },
    { label: 'CBCL', value: 14 },
    { label: 'BGT', value: 12 },
    { label: 'BGT', value: 31 },
    { label: 'BGT', value: 3 },
    { label: 'BGT', value: 24 },
    { label: 'BGT', value: 20 },
    { label: 'BGT', value: 6 },
    { label: 'BGT', value: 30 }
  ]

  // 상담사별 현황 데이터 (도넛 차트용)
  const counselorDonutData: DonutChartItem[] = [
    { label: '김은서', value: 42 },
    { label: '박수현', value: 18 },
    { label: '김은서', value: 15 },
    { label: '김은서', value: 13 },
    { label: '김은서', value: 12 }
  ]

  // 패키지별 현황 데이터 (도넛 차트용)
  const packageDonutData: DonutChartItem[] = [
    { label: '풀배터리 검사', value: 42 },
    { label: '종합 심리 검사', value: 20 },
    { label: '정서·인지 종합 검사', value: 15 },
    { label: '주의·집중력 검사', value: 13 },
    { label: '충동성·행동 조절 검사', value: 10 }
  ]

  // 기간 탭 변경 핸들러
  const handlePeriodChange = (value: string) => {
    period = value as PeriodType
  }

  // 조회 핸들러
  const handleSearch = () => {
    // TODO: API 호출
    console.log('조회:', { period, startDate, endDate })
  }

  // 다운로드 핸들러
  const handleDownload = () => {
    // TODO: 통계 다운로드 구현
    console.log('다운로드')
  }
</script>

<div class="min-h-screen bg-gray-50 p-8">
  <!-- 헤더 -->
  <PageTitleSection title="검사 통계" className="mb-4">
    <button
      slot="extraBtn"
      onclick={handleDownload}
      class="flex h-12 items-center gap-2 rounded-lg border border-primary-400 bg-white px-5 text-body-01-normal-medium text-primary-500 transition-colors hover:bg-primary-50"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 3.33334V13.3333M10 13.3333L14.1667 9.16668M10 13.3333L5.83333 9.16668"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M3.33333 16.6667H16.6667"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      통계 다운로드
    </button>
  </PageTitleSection>

  <!-- 필터 영역 -->
  <div class="h-22 flex items-center gap-4 rounded-2xl bg-white px-5">
    <!-- 기간 라벨 -->
    <Typography variant="title-01-semibold" color="text-gray-600"
      >기간</Typography
    >

    <!-- 기간 탭 -->
    <SegmentTab
      items={[...PERIOD_OPTIONS]}
      selected={period}
      onChange={handlePeriodChange}
      class="w-[258px]"
    />

    <!-- 날짜 범위 -->
    <div class="ml-auto flex items-center gap-2">
      <DatePickerInput bind:value={startDate} class="w-[180px]" />
      <span class="text-gray-400">~</span>
      <DatePickerInput bind:value={endDate} class="w-[180px]" />
      <Button
        class="h-12 w-[76px] rounded-[8px] bg-gray-100 hover:bg-gray-200"
        size="lg"
        onclick={handleSearch}
      >
        <Typography variant="body-01-medium" color="text-gray-600">
          조회
        </Typography>
      </Button>
    </div>
  </div>

  <!-- 통계 카드 -->
  <div class="mt-6 grid grid-cols-4 gap-4">
    {#each statsData as stat}
      <StatsSummaryCard data={stat} />
    {/each}
  </div>

  <!-- 검사별 현황 차트 -->
  <div class="mt-6">
    <BarChart
      title="검사별 현황"
      data={assessmentChartData}
      containerHeight={307}
    />
  </div>

  <!-- 상담사별/패키지별 현황 (도넛 차트 2열) -->
  <div class="mt-6 grid grid-cols-2 gap-6">
    <DonutChart title="상담사별 현황" data={counselorDonutData} />
    <DonutChart title="패키지별 현황" data={packageDonutData} />
  </div>
</div>
