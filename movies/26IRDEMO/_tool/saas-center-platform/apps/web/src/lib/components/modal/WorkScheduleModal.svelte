<script lang="ts">
  import { timeOptions } from '../../utils/date'
  import Select from '../Select.svelte'
  import Switch from '../Switch.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { slide, fade } from 'svelte/transition'

  type WorkDay = {
    id: string
    day: string
    start: string
    end: string
  }

  interface BreakTime {
    start: string
    end: string
  }

  interface Props {
    modalId?: string
    schedules?: Omit<WorkDay, 'id'>[]
    initialBreakTime?: BreakTime | null
    onConfirm?: (
      schedules: Omit<WorkDay, 'id'>[],
      breakTime: BreakTime | null
    ) => void | Promise<void>
    closeModal?: () => void
  }

  let {
    modalId = '',
    schedules: initialSchedules = [],
    initialBreakTime = null,
    onConfirm,
    closeModal = () => {}
  }: Props = $props()

  // 요일 순서 (dayOptions와 동일)
  const WEEKDAYS_ORDER = ['월', '화', '수', '목', '금', '토', '일'] as const

  // 이미 사용 중인 요일 중 첫 번째로 비어 있는 요일 반환
  const getFirstUnusedDay = (usedDays: string[]): string =>
    WEEKDAYS_ORDER.find((d) => !usedDays.includes(d)) ?? '월'

  // 고유 ID 생성
  let idCounter = 0
  const generateId = () => `schedule-${++idCounter}`

  // Select에서 선택된 값 추출 (객체면 value, 문자열이면 그대로)
  const extractValue = (
    val: string | { value: string; title: string }
  ): string => (typeof val === 'object' && val !== null ? val.value : val)

  // 기본 일정 템플릿 (usedDays: 이미 리스트에 있는 요일이면 그 다음 빈 요일이 기본값)
  const createDefaultSchedule = (usedDays: string[] = []): WorkDay => ({
    id: generateId(),
    day: getFirstUnusedDay(usedDays),
    start: '09:00',
    end: '18:00'
  })

  // 빈 배열이면 기본 일정 하나 추가
  let schedules = $derived<WorkDay[]>(
    initialSchedules.length > 0
      ? initialSchedules.map((s) => ({ ...s, id: generateId() }))
      : [createDefaultSchedule()]
  )

  // svelte-ignore state_referenced_locally
  let useBreakTime = $state<boolean>(initialBreakTime != null)
  // svelte-ignore state_referenced_locally
  let breakTime = $state<BreakTime>(
    initialBreakTime ?? {
      start: '12:00',
      end: '13:00'
    }
  )

  const toggleUseBreakTime = () => {
    useBreakTime = !useBreakTime
  }

  const dayOptions = [
    { title: '월', value: '월' },
    { title: '화', value: '화' },
    { title: '수', value: '수' },
    { title: '목', value: '목' },
    { title: '금', value: '금' },
    { title: '토', value: '토' },
    { title: '일', value: '일' }
  ]

  let scheduleListEl: HTMLDivElement

  // 현재 리스트가 사용 중인 요일
  const usedDays = $derived(schedules.map((s) => extractValue(s.day)))
  // 모든 요일(7개)이 채워졌으면 더 추가 불가
  const allDaysUsed = $derived(usedDays.length >= WEEKDAYS_ORDER.length)

  // 특정 row의 요일 Select 옵션: 다른 row가 이미 쓰는 요일은 제외 (자기 자신은 유지)
  const optionsForRow = (currentDay: string) =>
    dayOptions.filter(
      (o) => o.value === currentDay || !usedDays.includes(o.value)
    )

  const addSchedule = () => {
    if (allDaysUsed) return
    schedules = [...schedules, createDefaultSchedule(usedDays)]
  }

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) return // 최소 1개는 유지
    schedules = schedules.filter((_, i) => i !== index)
  }

  const handleConfirm = async () => {
    // id를 제거하고 값만 추출하여 onConfirm에 전달
    const schedulesWithoutId = schedules.map(({ day, start, end }) => ({
      day: extractValue(day),
      start: extractValue(start),
      end: extractValue(end)
    }))
    const normalizedBreakTime: BreakTime | null = useBreakTime
      ? {
          start: extractValue(breakTime.start),
          end: extractValue(breakTime.end)
        }
      : null
    await onConfirm?.(schedulesWithoutId, normalizedBreakTime)
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  showCloseButton={true}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="근무 일정을 추가할게요"
>
  {#snippet body()}
    <div class="w-full rounded-lg bg-white">
      <!-- 테이블 헤더 -->
      <!-- 컬럼 폭·gap을 아래 row 그리드와 동일하게 유지해야 라벨이 인풋과 정렬된다
           (gap-3 누락 시 두 번째 컬럼 라벨이 12px 왼쪽으로 밀려 보임) -->
      <div
        class="grid gap-3 mb-2 {schedules.length > 1
          ? 'grid-cols-[1fr_2fr_20px]'
          : 'grid-cols-[1fr_2fr]'}"
      >
        <span class="field-label">요일</span>
        <span class="field-label">근무 시간</span>
        {#if schedules.length > 1}
          <!-- svelte-ignore element_invalid_self_closing_tag -->
          <span />
        {/if}
      </div>
      <!-- 근무 일정 rows (요일 최대 7개라 스크롤 불필요) -->
      <div bind:this={scheduleListEl} class="space-y-3 mb-4">
        {#each schedules as schedule, index (schedule.id)}
          <div
            class="grid gap-3 items-center {schedules.length > 1
              ? 'grid-cols-[1fr_2fr_20px]'
              : 'grid-cols-[1fr_2fr]'}"
            in:slide={{ duration: 200 }}
            out:slide={{ duration: 150 }}
          >
            <!-- 요일 (다른 행이 쓰는 요일은 제외) -->
            <Select
              bind:selected={schedule.day}
              options={optionsForRow(extractValue(schedule.day))}
            />
            <!-- 시간 -->
            <!-- Select의 class는 내부 트리거 button에만 병합된다 — 래퍼 div는
                 그대로라 flex 안에서 콘텐츠 폭으로 남는다. 래퍼를 flex-1로 감싸야
                 두 드롭다운이 남는 폭을 반씩 채운다. -->
            <div class="flex items-center gap-2">
              <div class="min-w-0 flex-1">
                <Select
                  class="w-full"
                  bind:selected={schedule.start}
                  options={timeOptions}
                  initialScrollValue="09:00"
                  initialScrollAlign="start"
                />
              </div>
              <span class="shrink-0 text-gray-400">~</span>
              <div class="min-w-0 flex-1">
                <Select
                  class="w-full"
                  bind:selected={schedule.end}
                  options={timeOptions}
                  initialScrollValue="17:00"
                  initialScrollAlign="center"
                />
              </div>
            </div>

            <!-- 삭제 (2개 이상일 때만 표시) -->
            {#if schedules.length > 1}
              <!-- svelte-ignore a11y_consider_explicit_label -->
              <button
                class="hover:scale-110 duration-200 cursor-pointer"
                onclick={() => removeSchedule(index)}
                in:fade={{ duration: 150 }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="20" height="20" rx="10" fill="#F1F0F4" />
                  <path
                    d="M14.2087 10.7937H5.79083C5.35407 10.7937 5 10.4396 5 10.0029V9.99702C5 9.56026 5.35407 9.20619 5.79083 9.20619H14.2087C14.6455 9.20619 14.9996 9.56026 14.9996 9.99702V10.0029C14.9996 10.4396 14.6455 10.7937 14.2087 10.7937Z"
                    fill="#6D7882"
                  />
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- 추가 버튼 (모든 요일이 채워지면 숨김) -->
      {#if !allDaysUsed}
        <button
          transition:fade
          class="mb-6 flex mx-auto items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          onclick={addSchedule}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="20" height="20" rx="10" fill="#F1F0F4" />
            <path
              d="M5 9.99512L15 9.99512"
              stroke="#6D7882"
              stroke-width="1.66667"
              stroke-linecap="round"
            />
            <path
              d="M10.0039 5L10.0039 15"
              stroke="#6D7882"
              stroke-width="1.66667"
              stroke-linecap="round"
            />
          </svg>
          추가
        </button>
      {/if}

      <!-- 휴식 시간 -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="field-label">휴식 시간</span>
          <Switch
            checked={useBreakTime}
            onclick={toggleUseBreakTime}
            ariaLabel="휴식시간 사용"
          />
        </div>
        {#if useBreakTime}
          <div class="flex items-center gap-2" in:slide={{ duration: 150 }}>
            <div class="min-w-0 flex-1">
              <Select
                class="w-full"
                bind:selected={breakTime.start}
                options={timeOptions}
                initialScrollValue="11:00"
                initialScrollAlign="start"
              />
            </div>
            <span class="shrink-0 text-gray-400">~</span>
            <div class="min-w-0 flex-1">
              <Select
                class="w-full"
                bind:selected={breakTime.end}
                options={timeOptions}
                initialScrollValue="11:00"
                initialScrollAlign="start"
              />
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        class="flex h-11 w-40 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-500"
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >등록</Typography
        >
      </button>
    </div>
  {/snippet}
</BaseModal>
