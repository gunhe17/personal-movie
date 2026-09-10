<!--
  CenterOperatingHoursModal
  요일별 운영시간 + 정기휴일 수정 모달.
  기존/신규 휴일을 한 배열로 다루고, 저장 시 서비스가 초기값과 비교해 삭제·생성으로 환산한다.
-->
<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import { timeOptions } from '$lib/utils/date'
  import {
    WEEKDAY_KO,
    MONTH_WEEK_OPTIONS,
    WEEKDAY_OPTIONS,
    type EditableOperatingTime,
    type EditableHoliday
  } from '$lib/features/center/info'

  interface Props {
    modalId?: string
    initialOperatingTimes: EditableOperatingTime[]
    initialHolidays: EditableHoliday[]
    onSubmit: (payload: {
      operatingTimes: EditableOperatingTime[]
      holidays: EditableHoliday[]
    }) => Promise<boolean>
    closeModal?: () => void
  }

  let {
    modalId = '',
    initialOperatingTimes,
    initialHolidays,
    onSubmit,
    closeModal = () => {}
  }: Props = $props()

  // 초기값은 페이지 데이터라 사본을 떠서 편집한다 (취소 시 원본 보존)
  let operatingTimes = $state<EditableOperatingTime[]>(
    initialOperatingTimes.map((ot) => ({ ...ot }))
  )
  let holidays = $state<EditableHoliday[]>(
    initialHolidays.map((h) => ({ ...h }))
  )
  let isSubmitting = $state(false)

  const addHoliday = () => {
    holidays = [...holidays, { id: null, monthWeek: '1', weekday: 'MON' }]
  }

  const removeHoliday = (index: number) => {
    holidays = holidays.filter((_, i) => i !== index)
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    isSubmitting = true
    try {
      const success = await onSubmit({ operatingTimes, holidays })
      if (success) closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  size="xl"
  title="운영시간을 수정할게요"
  headerClass="px-5 py-4"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="space-y-6">
      <!-- 요일별 운영시간 -->
      <div class="space-y-3">
        {#each operatingTimes as day, idx (day.weekday)}
          <!--
            한 행 = 요일 · 상태 · 시간 인풋 · 토글(오른쪽 끝) 한 줄.
            컬럼을 명시하고 자동 배치에 맡긴다 — col-start로 토글을 고정하면
            배치 커서가 마지막 열로 넘어가 뒤따르는 인풋이 다음 줄로 떨어진다.
            휴무일 때도 마지막 auto 열은 남아 토글 위치가 그대로 유지된다.
            행 높이는 '운영'(Select h-11) 기준 고정 — 휴무 행이 짧아지면 목록이 들쭉날쭉해진다.
          -->
          <div
            class="grid min-h-11 items-center gap-2"
            style="grid-template-columns: auto auto {day.isOpen
              ? '1fr auto 1fr auto'
              : '1fr'} auto;"
          >
            <Typography
              variant="body-01-reading-regular"
              className="w-10"
              color="text-gray-600"
            >
              {WEEKDAY_KO[day.weekday]}
            </Typography>
            <Typography
              variant="body-01-normal-regular"
              className="w-8"
              color={day.isOpen ? 'text-primary-500' : 'text-gray-500'}
            >
              {day.isOpen ? '운영' : '휴무'}
            </Typography>
            {#if day.isOpen}
              <Select
                class="w-full min-w-0"
                bind:selected={operatingTimes[idx].openTime}
                options={timeOptions}
              />
              <Typography
                variant="body-02-medium"
                color="text-gray-800"
                className="shrink-0"
              >
                부터
              </Typography>
              <Select
                class="w-full min-w-0"
                bind:selected={operatingTimes[idx].closeTime}
                options={timeOptions}
              />
              <Typography
                variant="body-02-medium"
                color="text-gray-800"
                className="shrink-0"
              >
                까지
              </Typography>
            {/if}
            <span class="justify-self-end">
              <Switch bind:checked={operatingTimes[idx].isOpen} />
            </span>
          </div>
        {/each}
      </div>

      <!-- 정기 휴일 -->
      <div class="space-y-3 border-t border-gray-100 pt-6">
        <div class="flex items-center gap-2">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
          >
            정기 휴일
          </Typography>
          <Typography variant="body-03-normal-medium" color="text-gray-500">
            (공휴일 또는 특정 날짜 휴무는 스케줄에서 ‘운영일정 등록’을 통해
            설정할 수 있어요)
          </Typography>
        </div>

        {#each holidays as holiday, idx (holiday.id ?? `new-${idx}`)}
          <div
            class="grid grid-cols-[1fr_auto] items-center gap-2 xl:grid-cols-[1fr_1fr_auto]"
          >
            <Select
              class="col-span-2 w-full xl:col-span-1"
              bind:selected={holidays[idx].monthWeek}
              options={MONTH_WEEK_OPTIONS}
            />
            <Select
              class="w-full"
              bind:selected={holidays[idx].weekday}
              options={WEEKDAY_OPTIONS}
            />
            <Tooltip text="정기휴일 삭제">
              <button
                type="button"
                onclick={() => removeHoliday(idx)}
                aria-label="정기휴일 삭제"
                class="h-6 w-6 rounded-md duration-200 hover:bg-gray-100"
              >
                <TrashIcon class="h-full w-auto" />
              </button>
            </Tooltip>
          </div>
        {/each}

        <button
          type="button"
          onclick={addHoliday}
          class="text-body-02-normal-medium mx-auto flex items-center gap-2 text-action-primary"
        >
          <PlusIcon20 />
          추가
        </button>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={closeModal}
        class="text-body-01-normal-medium flex h-11 w-30 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
      >
        취소
      </button>
      <button
        type="button"
        onclick={handleSubmit}
        disabled={isSubmitting}
        class="text-body-01-normal-medium flex h-11 w-35 items-center justify-center rounded-lg bg-primary-500 text-white hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        {#if isSubmitting}
          <div
            class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white"
          ></div>
        {/if}
        저장
      </button>
    </div>
  {/snippet}
</BaseModal>
