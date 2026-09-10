<script lang="ts">
  import type { Component } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import Counsel24Icon from '$lib/assets/Counsel24Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { openScheduleDetailModal } from '$lib/components/modal/openScheduleDetailModal'
  import {
    RESERVATION_TYPE_META,
    type RoomWeekTimeline,
    type TimelineBar,
    type ReservationType
  } from '$lib/features/center/room/view-model'

  interface Props {
    data: RoomWeekTimeline
  }

  let { data }: Props = $props()

  const queryClient = useQueryClient()

  const TYPE_ORDER: ReservationType[] = ['counseling', 'assessment']

  // 타입별 전용 아이콘 (캘린더와 동일: 상담=Counsel, 검사=AssessmentStack)
  const TYPE_ICON: Record<ReservationType, Component> = {
    counseling: Counsel24Icon,
    assessment: AssessmentStack
  }

  const rangeMin = $derived(data.startHour * 60)
  const totalMin = $derived((data.endHour - data.startHour) * 60 || 1)

  function barStyle(bar: TimelineBar): string {
    const left = ((bar.startMin - rangeMin) / totalMin) * 100
    const width = ((bar.endMin - bar.startMin) / totalMin) * 100
    const color = RESERVATION_TYPE_META[bar.type].color
    return `left: ${left}%; width: ${width}%; background-color: ${color};`
  }

  // 막대 배경색 대비에 맞춘 글자색 (노랑 계열은 어둡게)
  function barTextColor(bar: TimelineBar): string {
    return bar.type === 'counseling' ? '#7A5B00' : '#FFFFFF'
  }

  function tickLeft(hour: number): string {
    return `${((hour * 60 - rangeMin) / totalMin) * 100}%`
  }

  // 막대 본문 라벨: 내담자명 (ScheduleLine과 동일, 비밀모드 시 마스킹)
  function barLabel(bar: TimelineBar): string {
    return $isSecretMode ? maskName(bar.clientName) : bar.clientName
  }
</script>

<section
  class="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-5"
>
  <!-- 헤더 (고정): 방 이름 + 범례 -->
  <div class="mb-4 flex shrink-0 items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-2">
      <Typography variant="title-02-semibold" color="text-gray-900">
        주간 활용 현황
      </Typography>
      {#if data.roomName}
        <span class="flex items-center gap-1.5 truncate-safe">
          <span class="text-gray-300">·</span>
          <Typography
            variant="body-01-semibold"
            color={data.is_active ? 'text-primary-500' : 'text-gray-400'}
            className="truncate-safe"
          >
            {data.roomName}
          </Typography>
        </span>
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-3">
      {#each TYPE_ORDER as type}
        {@const Icon = TYPE_ICON[type]}
        <div class="flex items-center gap-1 [&_svg]:h-4 [&_svg]:w-4">
          <Icon />
          <Typography
            variant="body-03-medium"
            color="text-gray-500"
            className="text-[14px]!"
          >
            {RESERVATION_TYPE_META[type].label}
          </Typography>
        </div>
      {/each}
    </div>
  </div>

  {#if !data.hasAny}
    <div class="flex flex-1 items-center justify-center">
      <Typography variant="body-02-regular" color="text-gray-400">
        이번 주 예약된 일정이 없어요
      </Typography>
    </div>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- 시간 눈금 헤더 (고정) -->
        <div class="flex shrink-0 items-end pb-1">
          <div class="w-10 shrink-0"></div>
          <div class="relative h-5 flex-1">
            {#each data.ticks as hour}
              <span
                class="absolute -translate-x-1/2 whitespace-nowrap"
                style="left: {tickLeft(hour)}"
              >
                <Typography
                  variant="body-03-medium"
                  color="text-gray-400"
                  className="text-[15px]"
                >
                  {hour}시
                </Typography>
              </span>
            {/each}
          </div>
        </div>

        <!-- 요일별 트랙 (세로 스크롤 + 화살표) -->
        <ScrollFadeArea deps={data} fadeHeight={28}>
          <div class="flex flex-col gap-1.5">
            {#each data.rows as row}
              <div class="flex items-center">
                <!-- 요일 -->
                <div class="w-10 shrink-0 pr-2 text-center">
                  <Typography
                    variant="body-02-medium"
                    color={row.isToday ? 'text-primary-600' : 'text-gray-500'}
                    className="text-[16px]"
                  >
                    {row.label}
                  </Typography>
                </div>

                <!-- 타임 트랙 -->
                <div
                  class="relative h-8 flex-1 overflow-hidden rounded-md {row.isToday
                    ? 'bg-primary-50'
                    : 'bg-gray-50'}"
                >
                  <!-- 정각 그리드 라인 -->
                  {#each data.ticks as hour}
                    <div
                      class="absolute top-0 bottom-0 w-px bg-gray-100"
                      style="left: {tickLeft(hour)}"
                    ></div>
                  {/each}

                  <!-- 예약 막대 (ScheduleLine과 동일 구성: 시각·유형아이콘·이름) -->
                  {#each row.bars as bar}
                    {@const Icon = TYPE_ICON[bar.type]}
                    <button
                      type="button"
                      onclick={() =>
                        openScheduleDetailModal(bar.schedule, queryClient)}
                      class="absolute top-1 bottom-1 flex items-center gap-1 overflow-hidden rounded px-1.5 transition-opacity hover:opacity-90 {bar.isCancelled
                        ? 'opacity-60'
                        : ''}"
                      style={barStyle(bar)}
                      title="{bar.startLabel} · {RESERVATION_TYPE_META[bar.type]
                        .label} · {barLabel(bar)} ({bar.timeLabel})"
                    >
                      <span
                        class="shrink-0 text-[13px] font-medium leading-none"
                        class:line-through={bar.isCancelled}
                        style="color: {barTextColor(bar)}"
                      >
                        {bar.startLabel}
                      </span>
                      <span
                        class="inline-flex shrink-0 items-center justify-center rounded bg-white/90 p-0.5 [&_svg]:h-3.5 [&_svg]:w-3.5"
                      >
                        <Icon />
                      </span>
                      <span
                        class="truncate-safe text-[13px] font-medium leading-none"
                        class:line-through={bar.isCancelled}
                        style="color: {barTextColor(bar)}"
                      >
                        {barLabel(bar)}
                      </span>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </ScrollFadeArea>
      </div>
    </div>
  {/if}
</section>
