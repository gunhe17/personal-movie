<script lang="ts">
  import { slide } from 'svelte/transition'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getRoomList } from '$lib/hooks/actions/room.action'
  import { getProgramList } from '$lib/hooks/actions/program.action'
  import { getMemberList } from '$lib/hooks/actions/member.action'
  import { centerId } from '$lib/stores/center.store'
  import { createSetupChecklistService } from '$lib/features/dashboard/setup-checklist-service'

  const setupService = createSetupChecklistService({
    queryClient: useQueryClient()
  })

  let dismissed = $state(false)
  const storageKey = $derived(`setup-checklist-dismissed:${$centerId}`)
  $effect(() => {
    if (browser && $centerId) {
      dismissed = localStorage.getItem(storageKey) === '1'
    }
  })

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => ({ center_id: $centerId! }))
  )
  const programsQuery = $derived(
    queryBuilder(getProgramList, () => ({ centerId: $centerId!, size: 1 }))
  )
  const membersQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId!, size: 1 }))
  )

  const loaded = $derived(
    roomsQuery.data !== undefined &&
      programsQuery.data !== undefined &&
      membersQuery.data !== undefined
  )

  const items = $derived([
    {
      label: '상담실 등록',
      desc: '상담이 이뤄질 공간을 등록해요',
      open: setupService.openRoomRegister,
      done: (roomsQuery.data?.length ?? 0) > 0
    },
    {
      label: '프로그램 등록',
      desc: '상담 프로그램과 담당자·금액을 정해요',
      open: setupService.openProgramRegister,
      done: (programsQuery.data?.total ?? 0) > 0
    },
    {
      label: '구성원 초대',
      desc: '함께 일할 전문가를 초대해요',
      open: setupService.openMemberInvite,
      done: (membersQuery.data?.total ?? 0) >= 2
    }
  ])

  const doneCount = $derived(items.filter((i) => i.done).length)
  const allDone = $derived(doneCount === items.length)
  const show = $derived(loaded && !allDone && !dismissed)

  const remaining = $derived(items.length - doneCount)
  const nextItem = $derived(items.find((i) => !i.done))
  // 남은 개수에 따라 말투가 바뀐다 — 히어로 회기의 속삭임과 같은 어시스턴트 톤
  const whisper = $derived(
    remaining === items.length
      ? '여기부터 시작해요'
      : remaining === 2
        ? '좋아요, 두 걸음 남았어요'
        : '마지막 하나예요'
  )

  // 진행 링 — viewBox 48 기준 반지름, 둘레만큼 dash 를 밀어 진행률 표현
  const RADIUS = 20
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  function dismiss() {
    if (browser && $centerId) localStorage.setItem(storageKey, '1')
    dismissed = true
  }
</script>

{#snippet checkIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <path
      d="M2.5 6.5L5 9L9.5 3.5"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#if show}
  <div transition:slide={{ duration: 150 }} class="relative mt-10">
    <!-- 속삭임 — 히어로 회기 카드와 같은 말풍선 패턴 -->
    <div class="absolute -top-3.5 left-6 z-20">
      <div class="relative rounded-lg bg-gray-900 px-3 py-1.5 shadow-md">
        <span class="text-body-03-normal-medium text-white">{whisper}</span>
        <span
          class="absolute -bottom-1 left-5 h-2 w-2 rotate-45 bg-gray-900"
          aria-hidden="true"
        ></span>
      </div>
    </div>

    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex items-center gap-5">
        <div class="relative h-14 w-14 shrink-0">
          <svg
            class="h-14 w-14 -rotate-90"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <circle
              cx="24"
              cy="24"
              r={RADIUS}
              fill="none"
              stroke="var(--color-gray-200)"
              stroke-width="4"
            />
            <circle
              cx="24"
              cy="24"
              r={RADIUS}
              fill="none"
              stroke="var(--color-primary-500)"
              stroke-width="4"
              stroke-linecap="round"
              stroke-dasharray={CIRCUMFERENCE}
              stroke-dashoffset={CIRCUMFERENCE * (1 - doneCount / items.length)}
              style="transition: stroke-dashoffset 500ms cubic-bezier(0.2,0.8,0.2,1)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-body-02-normal-bold text-gray-900">
              {doneCount}<span
                class="text-label-02-normal-regular text-gray-400"
                >/{items.length}</span
              >
            </span>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <Typography variant="body-01-normal-semibold" color="text-gray-800">
            센터 첫 세팅
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="mt-1 block"
          >
            다음은 <span class="text-gray-800">{nextItem?.label}</span>이에요
          </Typography>
        </div>

        <button
          type="button"
          class="shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
          aria-label="세팅 안내 닫기"
          onclick={dismiss}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <hr class="my-4 border-gray-100" />

      <div class="flex flex-col">
        {#each items as item (item.label)}
          {#if item.done}
            <div class="-mx-2 flex items-center gap-3 px-2 py-2.5">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
                aria-label="완료"
              >
                {@render checkIcon()}
              </span>
              <span
                class="min-w-0 flex-1 truncate-safe text-body-02-normal-medium text-gray-400"
              >
                {item.label}
              </span>
            </div>
          {:else}
            <button
              type="button"
              class="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-50"
              onclick={item.open}
            >
              <span
                class="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-gray-300"
                aria-hidden="true"
              ></span>
              <span
                class="min-w-0 flex-1 truncate-safe text-body-02-normal-medium text-gray-800"
              >
                {item.label}
              </span>
              <span
                class="shrink-0 text-gray-300 transition-colors group-hover:text-primary-500"
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3.5L10.5 8L6 12.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}
