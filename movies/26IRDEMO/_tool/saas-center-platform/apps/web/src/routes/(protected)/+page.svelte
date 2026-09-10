<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'

  import TabHeader from '$lib/components/home/TabHeader.svelte'
  import StatsCards from '$lib/components/home/StatsCards.svelte'
  import NoticeHeader from '$lib/components/home/NoticeHeader.svelte'
  import DashboardHome from '$lib/components/home/DashboardHome.svelte'
  import LiveStatsCards from '$lib/components/home/LiveStatsCards.svelte'
  import ReservationBoard from '$lib/components/home/ReservationBoard.svelte'
  import ProgramStatusChart from '$lib/components/home/ProgramStatusChart.svelte'
  import ReservationStatusChart from '$lib/components/home/ReservationStatusChart.svelte'

  type TabType = 'schedule' | 'home'

  // URL에서 초기 탭 상태 가져오기
  const getInitialTab = (): TabType => {
    const validTabs: TabType[] = ['schedule', 'home']
    const urlTab = page.url.searchParams.get('tab') as TabType | null
    return urlTab && validTabs.includes(urlTab) ? urlTab : 'schedule'
  }

  // 탭 상태
  let activeTab = $state<TabType>(getInitialTab())

  // 페이지네이션
  let currentPage = $state(1)

  // 예약 데이터
  const reservations = [
    {
      id: 1,
      time: '09:00',
      clientName: '양지원',
      clientCode: '240812',
      program: '놀이치료 2회차',
      room: '상담실 1',
      counselor: '이지연',
      attendance: 'present' as const
    },
    {
      id: 2,
      time: '09:30',
      clientName: '이수진',
      clientCode: '240813',
      program: '인지행동치료 1회차',
      room: '상담실 2',
      counselor: '김민수',
      attendance: 'absent' as const
    },
    {
      id: 3,
      time: '10:00',
      clientName: '박지혜',
      clientCode: '240814',
      program: '놀이치료 3회차',
      room: '상담실 1',
      counselor: '이혜진',
      attendance: 'present' as const
    },
    {
      id: 4,
      time: '10:30',
      clientName: '최형석',
      clientCode: '240815',
      program: '상담',
      room: '상담실 3',
      counselor: '정현우',
      attendance: 'present' as const,
      isFirst: true
    },
    {
      id: 5,
      time: '11:00',
      clientName: '송민아',
      clientCode: '240816',
      program: '심리상담 2회차',
      room: '상담실 2',
      counselor: '오세훈',
      attendance: null
    },
    {
      id: 6,
      time: '11:30',
      clientName: '홍길동',
      clientCode: '240817',
      program: '집단상담 1회차',
      room: '상담실 1',
      counselor: '김서윤',
      attendance: null
    }
  ]

  // 통계 데이터
  const stats = {
    todayReservation: 32,
    attendanceRate: 22,
    inProgress: 3,
    noShow: 1,
    cancelled: 3
  }

  const handleTabChange = (tab: TabType) => {
    activeTab = tab
  }

  const handleActionClick = (tab: TabType) => {
    switch (tab) {
      case 'schedule':
        goto('/schedule/calendar')
        break
    }
  }
</script>

<div in:fade class="xl:h-full flex flex-col bg-gray-50">
  <div class="mx-auto flex xl:h-full w-full">
    <!-- 오른쪽 메인 영역 -->
    <div class="flex xl:min-h-0 flex-1 flex-col gap-4">
      <div class="shrink-0">
        <NoticeHeader />
      </div>
      <div class="shrink-0">
        <TabHeader
          bind:activeTab
          todoCount={2}
          onTabChange={handleTabChange}
          onActionClick={handleActionClick}
        />
      </div>
      <!-- 탭별 콘텐츠 -->
      <div class="flex xl:min-h-0 flex-1 flex-col">
        {#if activeTab === 'home'}
          <div class="flex xl:min-h-0 flex-1 flex-col gap-4">
            <div class="shrink-0">
              <StatsCards {stats} />
            </div>
            <DashboardHome />
          </div>
        {:else if activeTab === 'schedule'}
          <div class="flex xl:min-h-0 flex-1 flex-col gap-6">
            <div class="shrink-0">
              <LiveStatsCards {stats} />
            </div>
            <div class="flex-1 h-full grid grid-cols-2 gap-4">
              <ReservationBoard {reservations} totalItems={32} />
              <div class="grid grid-rows-2 gap-4">
                <ReservationStatusChart />
                <ProgramStatusChart />
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
