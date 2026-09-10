<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import DailyCalendar from '../calendar/DailyCalendar.svelte'
  import ManagementAlert from './ManagementAlert.svelte'

  type Room = {
    id: number
    name: string
  }

  export let dateLabel = '2026년 1월 9일 (금)'

  let currentSchedules: any[] = []
  let selectedDate: Date | null = new Date()

  const rooms: Room[] = [
    { id: 1, name: '1번 놀이치료실' },
    { id: 2, name: '2번 언어치료실' },
    { id: 3, name: '3번 상담실' },
    { id: 4, name: '4번 검사실' },
    { id: 5, name: '5번 작업치료실' }
  ]
</script>

<div class="grid grid-cols-[1fr_350px] gap-4">
  <div
    class="flex flex-col h-full overflow-hidden shadow-sm border border-gray-200 rounded-2xl p-6 pl-0"
  >
    <Typography variant="title-01-semibold" className="pl-10 mb-4">
      {dateLabel} 일정
    </Typography>
    <div class="max-h-130">
      <DailyCalendar managerList={[]} bind:selectedDate bind:currentSchedules />
    </div>
  </div>
  <div
    class="flex flex-col h-full overflow-hidden shadow-sm border border-gray-200 rounded-2xl p-6"
  >
    <ManagementAlert
      urgentAlerts={[
        {
          title: '임예은 노쇼 위약금',
          description: '오전 11시 언어치료 · -30,000원',
          time: '9시간 전',
          type: 'danger',
          actions: [
            { label: '위약금 청구', variant: 'primary' },
            { label: '면제' }
          ]
        }
      ]}
      todayAlerts={[
        {
          title: '신규 문의 배정',
          description: '5세 남아 · 언어발달 지연 의심',
          time: '9시간 전',
          actions: [{ label: '상담사 찾기', variant: 'primary' }]
        }
      ]}
      infoAlerts={[
        {
          title: '양지연 휴가 요청',
          description: '1/15~1/17 (3일)',
          time: '9시간 전',
          actions: [{ label: '승인', variant: 'primary' }, { label: '반려' }]
        }
      ]}
    />
  </div>
</div>
