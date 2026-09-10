<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { twMerge } from 'tailwind-merge'

  import BaseModal from './BaseModal.svelte'
  import Center24Icon from '../../assets/Center24Icon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import WarningCircleIcon16 from '$lib/assets/WarningCircleIcon16.svelte'
  import Counsel24Icon from '../../assets/Counsel24Icon.svelte'
  import AssessmentStack from '../../assets/AssessmentStack.svelte'
  import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isTimeOutsideOperatingHours,
    formatOperatingHoursRange
  } from '$lib/features/schedule/operating-hours'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getOperatingTimes } from '$lib/hooks/actions/center.action'
  import { centerId } from '$lib/stores/center.store'
  import ClientIcon24 from '../../assets/ClientIcon24.svelte'
  import { RETURN_TO_PARAM } from '$lib/utils/return-to'

  interface Props {
    modalId?: string
    selectedDate?: Date
    selectedTime?: string
    selectedRoomId?: string
    selectedRoomName?: string
    /** 필터에서 선택된 담당자 ID 목록 */
    selectedMemberIds?: string[] | null
    closeModal?: () => void
  }

  const buildSearchParams = () => {
    const params = new URLSearchParams()
    if (selectedDate) {
      params.set(
        'date',
        `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`
      )
    }
    if (selectedTime) {
      params.set('time', selectedTime)
    }
    if (selectedRoomId) {
      params.set('room_id', selectedRoomId)
    }
    if (selectedRoomName) {
      params.set('room_name', selectedRoomName)
    }
    if (selectedMemberIds && selectedMemberIds.length > 0) {
      params.set('member_ids', selectedMemberIds.join(','))
    }
    // 완료 후 하던 화면(일정)으로 돌아오게 복귀 경로를 넘긴다 — 필터·뷰 상태가 담긴
    // 현재 URL 그대로. 착지 날짜는 등록 폼이 실제 등록한 날짜로 덧붙인다(withLandingDate).
    params.set(RETURN_TO_PARAM, `${page.url.pathname}${page.url.search}`)
    const query = params.toString()
    return query ? `?${query}` : ''
  }

  let {
    modalId = '',
    closeModal = () => {},
    selectedDate,
    selectedTime,
    selectedRoomId,
    selectedRoomName,
    selectedMemberIds = null
  }: Props = $props()

  let selected = $state<'client' | 'counsel' | 'assessment' | null>(null)

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      staleTime: 5 * 60 * 1000
    })
  )
  const operatingTimesData = $derived(operatingTimesQuery.data ?? [])

  const dayHours = $derived(
    selectedDate
      ? getOperatingHoursForDate(operatingTimesData, selectedDate)
      : getOperatingHoursForDate(operatingTimesData, new Date())
  )

  const isOutsideOperatingHours = $derived.by(() => {
    if (!selectedTime) return false
    return isTimeOutsideOperatingHours(selectedTime, dayHours)
  })

  const handleConfirm = () => {
    const search = buildSearchParams()
    switch (selected) {
      case 'client':
        goto(`/clients/register${search}`)
        break
      case 'counsel':
        goto(`/counseling/receive${search}`)
        break
      case 'assessment':
        goto(`/assessment/receive${search}`)
        break
    }
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="어떤걸 새로 등록할까요?"
>
  {#snippet body()}
    <div class="space-y-2">
      <!-- 경고 배너 — §Colors Semantic alias의 경고 한 쌍만 쓴다:
           면 {color.status-warning-bg}(orange-050) · 글자·아이콘 {color.status-warning}(orange-500).
           아이콘은 currentColor라 컨테이너 색을 따라오므로 따로 칠하지 않는다.
           보더는 두르지 않는다(면이 이미 영역을 세운다). -->
      {#if isOutsideOperatingHours}
        <div
          class="flex items-center gap-2 rounded-lg bg-status-warning-bg px-3 py-3 text-status-warning"
        >
          <WarningCircleIcon16 />
          <Typography variant="body-02-normal-regular" color="text-current">
            선택한 시간은 운영시간({formatOperatingHoursRange(dayHours)})
            밖이에요
          </Typography>
        </div>
      {/if}
      <button
        class={twMerge(
          'px-4 py-4 flex gap-3 rounded-lg border duration-200 w-full',
          selected === 'client'
            ? 'border-primary-400 bg-primary-50'
            : 'border-transparent hover:bg-gray-50'
        )}
        onclick={() => (selected = 'client')}
      >
        <ClientIcon24 />
        <div class="grow">
          <Typography
            variant="title-01-semibold"
            color="text-gray-800"
            className="text-left mb-1.5"
          >
            내담자
          </Typography>
          <Typography
            variant="body-02-regular"
            color="text-gray-500"
            className="text-left"
          >
            새로운 내담자를 등록해요
          </Typography>
        </div>
      </button>
      <button
        class={twMerge(
          'px-4 py-4 flex gap-3 rounded-lg border duration-200 w-full',
          selected === 'counsel'
            ? 'border-primary-400 bg-primary-50'
            : 'border-transparent hover:bg-gray-50'
        )}
        onclick={() => (selected = 'counsel')}
      >
        <Counsel24Icon />
        <div class="grow">
          <Typography
            variant="title-01-semibold"
            color="text-gray-800"
            className="text-left mb-1.5"
          >
            상담 · 프로그램 일정
          </Typography>
          <Typography
            variant="body-02-regular"
            color="text-gray-500"
            className="text-left"
          >
            내담자와 진행하는 상담, 프로그램 일정을 등록해요
          </Typography>
        </div>
      </button>
      <button
        class={twMerge(
          'px-4 py-4 flex gap-3 rounded-lg border duration-200 w-full',
          selected === 'assessment'
            ? 'border-primary-400 bg-primary-50'
            : 'border-transparent hover:bg-gray-50'
        )}
        onclick={() => (selected = 'assessment')}
      >
        <AssessmentStack />
        <div class="grow">
          <Typography
            variant="title-01-semibold"
            color="text-gray-800"
            className="text-left mb-1.5"
          >
            검사 일정
          </Typography>
          <Typography
            variant="body-02-regular"
            color="text-gray-500"
            className="text-left"
          >
            내담자와의 검사 일정을 등록해요
          </Typography>
        </div>
      </button>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        disabled={!selected}
        class={twMerge(
          'flex-center h-11 px-6 rounded-lg bg-primary-500',
          'text-white transition-colors hover:bg-primary-400 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg disabled:cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          등록
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
