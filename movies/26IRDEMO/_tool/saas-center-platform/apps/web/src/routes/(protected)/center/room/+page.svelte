<script lang="ts">
  import { fade } from 'svelte/transition'

  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { getRoomList } from '$root/src/lib/hooks/actions/room.action'

  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import {
    CENTER_MANAGE_ROOM_RULE,
    CENTER_PAGE_ACCESS_RULE
  } from '$lib/features/center/permissions'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import { modalStore } from '$root/src/lib/stores/modal'
  import { centerId } from '$root/src/lib/stores/center.store'
  import RoomCard from '$root/src/lib/components/RoomCard.svelte'
  import NoDataSection from '$root/src/lib/components/NoDataSection.svelte'
  import Typography from '@common/components/Typography.svelte'
  import RoomRegisterModal from '$root/src/lib/components/modal/RoomRegisterModal.svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import { afterNavigate, goto } from '$app/navigation'
  import { onMount, untrack } from 'svelte'

  import {
    getScheduleList,
    buildWeekScheduleInput
  } from '$lib/features/center/room/query-builders'
  import {
    aggregateRoomSchedules,
    mapToRoomCardVMs
  } from '$lib/features/center/room/view-model'

  // 집계 기준 시각: 클라이언트에서 1회 고정 (SSR/reactivity 안전)
  let now = $state<Date | null>(null)
  onMount(() => {
    now = new Date()
  })

  const REDIRECT_DELAY_MS = 1500

  // 상위 뎁스 = 센터 정보. history.back()은 다른 경로로 들어온 경우 엉뚱한 곳으로 가므로
  // 브레드크럼은 상위 경로를 명시적으로 지정한다.
  const goToCenterInfo = () => goto('/center/info')

  const handleRegisterRoom = () => {
    const returnTo = page.url.searchParams.get('returnTo')
    modalStore.open({
      component: RoomRegisterModal,
      props: {
        ...(returnTo
          ? {
              onSuccessAfterCreate: () =>
                setTimeout(() => goto(returnTo), REDIRECT_DELAY_MS)
            }
          : {})
      },
      options: {
        customWidth: 540
      }
    })
  }

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => ({ center_id: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )

  const roomsData = $derived(roomsQuery.data ?? [])

  // 이번 주 일정 (room_name 기준 집계용)
  const scheduleQuery = $derived(
    queryBuilder(
      getScheduleList,
      () => buildWeekScheduleInput($centerId!, now!),
      {
        enabled: browser && !!$centerId && !!now
      }
    )
  )

  const scheduleData = $derived(scheduleQuery.data ?? [])

  const roomCounts = $derived(
    now ? aggregateRoomSchedules(scheduleData, now) : new Map()
  )

  // 정렬 기준이 되는 '사용가능 여부' 스냅샷 — 이 페이지에 머무는 동안 고정된다.
  // 토글해도 카드가 제자리에 남아 사용자가 무엇이 바뀌었는지 볼 시간을 갖고,
  // 새로고침·재진입하면 스냅샷이 다시 떠지며 그때 사용불가가 맨 뒤로 간다.
  let activeSnapshot = $state<Map<string, boolean>>(new Map())

  $effect(() => {
    const rooms = roomsData
    if (!rooms.length) return
    // 방이 추가·삭제된 경우에만 항목을 넣고 뺀다. 토글(is_active 변경)로는 갱신하지 않는다.
    // untrack: 아래에서 activeSnapshot에 쓰므로 읽기까지 추적하면 자기 자신을 다시 트리거한다.
    untrack(() => {
      const next = new Map(activeSnapshot)
      const ids = new Set(rooms.map((r: any) => r.id))
      let changed = false
      for (const room of rooms) {
        if (next.has(room.id)) continue
        next.set(room.id, room.is_active)
        changed = true
      }
      for (const id of [...next.keys()]) {
        if (ids.has(id)) continue
        next.delete(id)
        changed = true
      }
      if (changed) activeSnapshot = next
    })
  })

  const roomCards = $derived(
    mapToRoomCardVMs(roomsData, roomCounts, activeSnapshot)
  )

  // 첫 조회 전에는 빈 상태('등록된 상담실이 없어요')를 띄우지 않는다 —
  // 데이터 도착 전 한 프레임 스쳐 지나가면 상담실이 지워진 것처럼 보인다.
  // ($centerId는 클라이언트 초기화 후에 채워지므로 SSR 구간도 여기서 함께 걸린다)
  const isRoomsLoading = $derived(
    !roomsData.length &&
      (!$centerId || roomsQuery.isLoading || roomsQuery.isFetching)
  )

  // Agent page.navigate에 의한 자동 모달 오픈 + pre-fill
  // afterNavigate 사용 — $effect는 page.url을 읽으면서 goto로 page.url을 쓰면
  // self-loop(effect_update_depth_exceeded)가 발생하므로 reactivity 외부에서 처리.
  // edit은 상담실 목록 로드가 필요해 파라미터만 캡처하고, 아래 $effect가 로드 후 연다.
  let pendingEdit = $state<{
    roomId: string | null
    roomName: string | null
    newName: string | null
  } | null>(null)

  afterNavigate(() => {
    const params = page.url.searchParams
    const action = params.get('action')

    if (action === 'create') {
      const props: Record<string, any> = {}
      if (params.get('name')) props.name = params.get('name')
      if (params.get('description'))
        props.description = params.get('description')
      if (params.get('memo')) props.memo = params.get('memo')

      modalStore.open({
        component: RoomRegisterModal,
        props,
        options: { customWidth: 540 }
      })
      goto('/center/room', { replaceState: true })
    }

    if (action === 'edit') {
      pendingEdit = {
        roomId: params.get('room_id'),
        roomName: params.get('room_name'),
        newName: params.get('name')
      }
      goto('/center/room', { replaceState: true })
    }
  })

  $effect(() => {
    if (!pendingEdit || roomsData.length === 0) return
    const target = pendingEdit
    pendingEdit = null
    const room =
      roomsData.find((r: any) => r.id === target.roomId) ??
      roomsData.find((r: any) => r.name === target.roomName)
    if (!room) return
    modalStore.open({
      component: RoomRegisterModal,
      props: {
        id: room.id,
        name: target.newName ?? room.name,
        description: room.description,
        memo: room.memo,
        thumbnail_url: room.thumbnail_url
      },
      options: { customWidth: 540 }
    })
  })
</script>

<PermissionGuard rule={CENTER_PAGE_ACCESS_RULE} showError>
  <div in:fade class="flex h-full flex-col overflow-hidden bg-gray-50">
    <!-- 센터 정보의 하위 화면 — 최상단 타이틀(XL)이 아니라 브레드크럼으로 뎁스를 보인다
         (상담 상세와 동일 규격: 뒤로가기 + 상위 / 현재, 행 높이 44 · 아래 8) -->
    <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          onclick={goToCenterInfo}
          aria-label="뒤로가기"
          class="rounded-lg p-1 transition-colors hover:bg-gray-100"
        >
          <ArrowBackIcon />
        </button>
        <button
          onclick={goToCenterInfo}
          class="transition-colors hover:text-body-default"
        >
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-subtle"
          >
            센터 정보
          </Typography>
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-gray-300"
        >
          /
        </Typography>
        <Typography
          variant="body-02-normal-medium"
          tag="span"
          color="text-body-default"
        >
          공간 관리
        </Typography>
      </div>
      <PermissionGuard rule={CENTER_MANAGE_ROOM_RULE}>
        <PageActionButton label="상담실 등록" onclick={handleRegisterRoom} />
      </PermissionGuard>
    </div>

    <div class="mb-1 flex h-11 shrink-0 items-center">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {roomsData?.length ?? 0}개
      </Typography>
    </div>
    {#if isRoomsLoading}
      <div class="flex flex-1 items-center justify-center py-20">
        <Typography variant="body-01-reading-regular" color="text-gray-400">
          로딩 중...
        </Typography>
      </div>
    {:else if roomsData?.length}
      <!-- 상담실 카드 그리드. 루트의 in:fade는 데이터가 오기 전에 이미 끝나므로
           실제로 눈에 보이는 건 여기 — 카드가 도착하는 순간에 페이드를 건다
           (내담자 목록·필드노트와 같은 방식) -->
      <section in:fade class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div
            class="grid gap-4 pb-1"
            style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));"
          >
            <!-- 키 필수: RoomCard가 토글 상태를 로컬로 들고 있어, 새로고침 후
                 순서가 바뀔 때 인덱스로 재사용되면 다른 방의 상태가 섞여 보인다 -->
            {#each roomCards as room (room.id)}
              {@const {
                name,
                id,
                thumbnail_url,
                description,
                is_active,
                memo,
                todayCount,
                weekCount
              } = room}
              <RoomCard
                {name}
                {id}
                {thumbnail_url}
                {memo}
                {description}
                {is_active}
                {todayCount}
                {weekCount}
              />
            {/each}
          </div>
        </div>
      </section>
    {:else}
      <NoDataSection description="등록된 상담실이 없어요" />
    {/if}
  </div>
</PermissionGuard>
