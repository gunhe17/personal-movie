<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'

  import { pageToolRegistry } from '$lib/features/agent/page-tools/registry'
  import { registerCenterInfoEditTools } from '$lib/features/agent/page-tools/center-info-edit'
  import Typography from '@common/components/Typography.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import CenterProfileCard from '$lib/components/center/CenterProfileCard.svelte'
  import CenterOperatingPanel from '$lib/components/center/CenterOperatingPanel.svelte'
  import { CENTER_PAGE_ACCESS_RULE } from '$lib/features/center/permissions'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import {
    getCenterDetail,
    getOperatingTimes,
    getNonOperatingTimes,
    type CenterDetailResponse,
    type OperatingTimeSummary,
    type NonOperatingTimeResponse
  } from '$lib/hooks/actions/center.action'

  import {
    WEEKDAY_ORDER,
    type EditableOperatingTime,
    type EditableHoliday,
    parsePhone,
    trimTime,
    toSortedOperatingTimes,
    toRegularHolidayLabels,
    filterCenterRegularHolidays,
    createCenterInfoService,
    buildCenterDetailInput,
    buildOperatingTimesInput,
    buildNonOperatingTimesInput
  } from '$lib/features/center/info'

  // ─── 서비스 ───

  const queryClient = useQueryClient()
  const centerInfoService = createCenterInfoService({ queryClient })

  // ─── 쿼리 ───

  const centerQuery = $derived(
    queryBuilder(getCenterDetail, () => buildCenterDetailInput($centerId!), {
      enabled: !!$centerId
    })
  )

  const operatingTimesQuery = $derived(
    queryBuilder(
      getOperatingTimes,
      () => buildOperatingTimesInput($centerId!),
      {
        enabled: !!$centerId
      }
    )
  )

  const nonOperatingTimesQuery = $derived(
    queryBuilder(
      getNonOperatingTimes,
      () => buildNonOperatingTimesInput($centerId!),
      {
        enabled: !!$centerId
      }
    )
  )

  // ─── 반응형 데이터 ───

  let centerData = $state<CenterDetailResponse | null>(null)
  let operatingTimesData = $state<OperatingTimeSummary[]>([])
  let nonOperatingTimesData = $state<NonOperatingTimeResponse[]>([])

  $effect(() => {
    if (centerQuery.data && centerQuery.isSuccess) {
      centerData = centerQuery.data as CenterDetailResponse
    }
  })

  $effect(() => {
    if (operatingTimesQuery.data && operatingTimesQuery.isSuccess) {
      operatingTimesData = operatingTimesQuery.data as OperatingTimeSummary[]
    }
  })

  $effect(() => {
    if (nonOperatingTimesQuery.data && nonOperatingTimesQuery.isSuccess) {
      nonOperatingTimesData =
        nonOperatingTimesQuery.data as NonOperatingTimeResponse[]
    }
  })

  // ─── 표시용 파생 데이터 ───

  const sortedOperatingTimes = $derived(
    toSortedOperatingTimes(operatingTimesData)
  )
  const centerRegularHolidays = $derived(
    filterCenterRegularHolidays(nonOperatingTimesData)
  )
  const regularHolidayLabels = $derived(
    toRegularHolidayLabels(nonOperatingTimesData)
  )

  // ─── 기본 정보 수정 ───

  /**
   * 모달과 공유하는 폼 상태 — 에이전트 page-tool이 같은 객체에 쓰기 때문에
   * 페이지가 소유하고 모달에 프록시째 넘긴다(사본 금지).
   */
  let form = $state({
    centerName: '',
    ownerName: '',
    businessNumber: '',
    zipCode: '',
    address: '',
    addressDetail: '',
    phonePrefix: '02',
    phoneBody: '',
    description: ''
  })

  let isProfileModalOpen = $state(false)

  const openProfileEdit = () => {
    if (!centerData || isProfileModalOpen) return

    const parsed = parsePhone(centerData.phone)
    form.centerName = centerData.name || ''
    form.ownerName = centerData.representative_name || ''
    form.businessNumber = centerData.business_registration_number || ''
    form.zipCode = centerData.address?.zip_code || ''
    form.address = centerData.address?.address || ''
    form.addressDetail = centerData.address?.detail || ''
    form.phonePrefix = parsed.prefix
    form.phoneBody = parsed.body
    form.description = centerData.description || ''

    isProfileModalOpen = true
    centerInfoService.openProfileEdit({
      centerData,
      form,
      onClose: () => {
        isProfileModalOpen = false
      }
    })
  }

  // ─── 운영시간 수정 ───

  const openOperatingHoursEdit = () => {
    const operatingTimes: EditableOperatingTime[] = WEEKDAY_ORDER.map(
      (weekday) => {
        const found = operatingTimesData.find((ot) => ot.weekday === weekday)
        if (found && found.open_time) {
          return {
            weekday,
            isOpen: true,
            openTime: trimTime(found.open_time),
            closeTime: trimTime(found.close_time)
          }
        }
        return { weekday, isOpen: false, openTime: '09:00', closeTime: '18:00' }
      }
    )

    const holidays: EditableHoliday[] = centerRegularHolidays.map((h) => ({
      id: h.id,
      monthWeek: String(h.month_week),
      weekday: h.weekday!
    }))

    centerInfoService.openOperatingHoursEdit({ operatingTimes, holidays })
  }

  // ─── 로딩 상태 ───

  const isLoading = $derived(
    centerQuery.isLoading ||
      operatingTimesQuery.isLoading ||
      nonOperatingTimesQuery.isLoading
  )

  // ─── Agent Page Tool 등록 ───

  onMount(() => {
    registerCenterInfoEditTools({
      getState: () => ({ ...form }),
      // 모달이 곧 편집 모드 — 열려 있어야 폼 필드가 화면에 있다
      getMode: () => (isProfileModalOpen ? 'edit' : 'view'),
      enterEditMode: openProfileEdit,
      setCenterName: (v) => {
        form.centerName = v
      },
      setOwnerName: (v) => {
        form.ownerName = v
      },
      setBusinessNumber: (v) => {
        form.businessNumber = v
      },
      setZipCode: (v) => {
        form.zipCode = v
      },
      setAddress: (v) => {
        form.address = v
      },
      setAddressDetail: (v) => {
        form.addressDetail = v
      },
      setPhonePrefix: (v) => {
        form.phonePrefix = v
      },
      setPhoneBody: (v) => {
        form.phoneBody = v
      }
    })
  })

  onDestroy(() => {
    if (browser) pageToolRegistry.unregisterAll()
  })
</script>

<PermissionGuard rule={CENTER_PAGE_ACCESS_RULE} showError>
  <div in:fade class="xl:h-full flex flex-col xl:max-h-dvh bg-gray-50">
    <!-- 타이틀은 /center/+layout.svelte가 소유. 수정은 각 패널의 수정 버튼 → 모달 -->
    {#if isLoading}
      <div class="flex items-center justify-center py-20">
        <Typography variant="body-01-reading-regular" color="text-gray-400">
          로딩 중...
        </Typography>
      </div>
    {:else if centerData}
      <div
        in:fade
        class="grow min-h-0 grid grid-cols-1 xl:grid-cols-[var(--spacing-detail-side)_1fr] gap-4"
      >
        <CenterProfileCard center={centerData} onEdit={openProfileEdit} />
        <CenterOperatingPanel
          operatingTimes={sortedOperatingTimes}
          {regularHolidayLabels}
          nonOperatingTimes={nonOperatingTimesData}
          onEdit={openOperatingHoursEdit}
        />
      </div>
    {/if}
  </div>
</PermissionGuard>
