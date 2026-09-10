<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import AssessmentStack from '../../assets/AssessmentStack.svelte'
  import Center24Icon from '../../assets/Center24Icon.svelte'
  import Counsel24Icon from '../../assets/Counsel24Icon.svelte'
  import { queryBuilder } from '../../hooks/queries/builder'
  import {
    getScheduleDetail,
    type MappedSchedule
  } from '../../hooks/actions/schedule.action'
  import ArrowRightIcon16 from '../../assets/ArrowRightIcon16.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import ScheduleDetailAssessmentBody from './ScheduleDetailAssessmentBody.svelte'
  import ScheduleDetailCounselingBody from './ScheduleDetailCounselingBody.svelte'
  import { openScheduleDetailModal } from './openScheduleDetailModal'
  import { modalStore } from '../../stores/modal'
  import ModifyScheduleForm from './ModifyScheduleForm.svelte'
  import ModifyAssessmentScheduleForm from './ModifyAssessmentScheduleForm.svelte'
  import ModifyCounselingScheduleForm from './ModifyCounselingScheduleForm.svelte'
  import { goto } from '$app/navigation'
  import { centerId } from '../../stores/center.store'
  import TrashIcon24 from '../../assets/TrashIcon24.svelte'
  import BillsIconCurrent20 from '../../assets/BillsIconCurrent20.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { getBillableByRelated } from '$lib/hooks/actions/billable.action'
  import BillableCreateModal from '$lib/features/billing/components/create/BillableCreateModal.svelte'
  import SessionBillingModal from '$lib/features/billing/components/create/SessionBillingModal.svelte'
  import BillableDetailModal from '../../../routes/(protected)/billing/components/BillableDetailModal.svelte'
  import { hasPermission } from '$lib/stores/permission.view'
  import { formatUtcToKst } from '../../utils/date'
  import { createSessionCancelService } from '$lib/features/schedule/calendar/session-cancel-service'
  import { createScheduleBillingService } from '$lib/features/schedule/calendar/schedule-billing-service'
  import { createScheduleService } from '$lib/features/schedule/calendar/calendar-service'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'

  interface Props {
    modalId?: string
    schedule?: MappedSchedule
    closeModal?: () => void
    /** 열자마자 수정 모드로 들어갈지 (기본 상세) */
    initialMode?: 'detail' | 'edit'
  }

  let {
    modalId = '',
    schedule,
    closeModal = () => {},
    initialMode = 'detail'
  }: Props = $props()

  // ── 서비스 초기화 ──
  const queryClient = useQueryClient()
  const sessionCancelService = createSessionCancelService({ queryClient })
  const scheduleBillingService = createScheduleBillingService({ queryClient })
  const scheduleService = createScheduleService({ queryClient })

  // ── 권한 ──
  const canWriteSchedule = $derived($hasPermission('write:schedule'))
  const canDeleteSchedule = $derived($hasPermission('delete:schedule'))
  const canWriteBilling = $derived($hasPermission('write:billing'))
  const canReadBilling = $derived($hasPermission('read:billing'))

  // ── 데이터 조회 ──
  const detailQuery = $derived(
    queryBuilder(getScheduleDetail, () => ({
      center_id: $centerId!,
      schedule_id: schedule?.id
    }))
  )
  const scheduleData = $derived(detailQuery.data)

  // ── 청구 조회 (세션 기반) ──
  const relatedInfo = $derived.by(() => {
    if (!scheduleData) return null
    const scheduleType = scheduleData.schedule_type
    if (scheduleType === 'meeting' || scheduleType === 'block') return null
    const session = scheduleData.sessions?.[0]
    if (!session?.session_id) return null
    return {
      // 청구는 session 또는 case 단위로 묶일 수 있어 두 타입 모두 조회
      relatedType: [`${scheduleType}_session`, `${scheduleType}_case`],
      relatedCaseId: session.case_id,
      relatedSessionId: session.session_id
    }
  })

  const existingBillableQuery = $derived(
    relatedInfo && $centerId
      ? queryBuilder(getBillableByRelated, () => ({
          centerId: $centerId!,
          relatedType: relatedInfo.relatedType,
          relatedSessionId: relatedInfo.relatedSessionId
        }))
      : null
  )
  const existingBillables = $derived(existingBillableQuery?.data ?? [])

  const billingState = $derived.by(() => {
    if (!existingBillables || existingBillables.length === 0)
      return 'none' as const
    const hasDraftOrIssued = existingBillables.some(
      (b: any) => b.status === 'draft' || b.status === 'issued'
    )
    if (hasDraftOrIssued) return 'pending' as const
    return 'completed' as const
  })

  // ── 파생값 ──
  const isSessionFinished = $derived(
    schedule?.session_status === 'completed' ||
      schedule?.session_status === 'attended' ||
      schedule?.session_status === 'cancelled' ||
      schedule?.session_status === 'no_show'
  )
  const isCancelled = $derived(schedule?.session_status === 'cancelled')
  const isNoShow = $derived(schedule?.session_status === 'no_show')
  const isAssessment = $derived(scheduleData?.schedule_type === 'assessment')
  const isGroupSession = $derived(() => {
    const clients = scheduleData?.sessions?.[0]?.clients ?? []
    return clients.length > 1
  })

  // 타이틀 = 일정을 구분하는 최소단위(내담자). 같은 프로그램을 여러 내담자가 진행해
  // 프로그램명으로는 구분이 안 된다. 내담자가 없는 운영 일정만 제목으로 대체한다.
  const clientTitle = $derived.by(() => {
    const sessionClients = scheduleData?.sessions?.[0]?.clients ?? []
    const names = sessionClients.length
      ? sessionClients.map((c) => c.client_name)
      : (schedule?.client || '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
    if (!names.length) return scheduleData?.title || schedule?.title || '-'
    return names.map((n) => ($isSecretMode ? maskName(n) : n)).join(', ')
  })

  // 일정(회기) 상태 — 타이틀 옆 배지 하나로 표기한다(STATUS_BADGE).
  const sessionStatus = $derived.by<
    'scheduled' | 'completed' | 'cancelled' | 'no_show'
  >(() => {
    const status = schedule?.session_status
    if (status === 'completed' || status === 'attended') return 'completed'
    if (status === 'cancelled') return 'cancelled'
    if (status === 'no_show') return 'no_show'
    return 'scheduled'
  })

  // 회기(케이스) 상세 진입 — 타이틀이 내담자로 바뀌면서 링크가 없어져 바디 하단 버튼이 정본
  const caseDetailPath = $derived.by(() => {
    const caseId = scheduleData?.sessions?.[0]?.case_id
    if (!caseId || !scheduleData || scheduleData.schedule_type === 'meeting')
      return null
    return isAssessment
      ? `/assessment/status/${caseId}`
      : `/counseling/status/${caseId}`
  })

  const goToCaseDetail = () => {
    if (!caseDetailPath) return
    goto(caseDetailPath)
    closeModal()
  }

  // ── 핸들러 (서비스 위임) ──
  const reopenScheduleDetail = () => {
    if (schedule) openScheduleDetailModal(schedule, queryClient)
  }

  const openDeleteScheduleModal = () => {
    scheduleService.openDeleteScheduleModal(schedule?.id ?? '', {
      isAssessment,
      onSuccess: closeModal
    })
  }

  const openCancelScheduleModal = () => {
    sessionCancelService.openCancelModal((cancelReason) => {
      const sessionId = scheduleData?.sessions?.[0]?.session_id
      if (!sessionId) return
      sessionCancelService.cancelSession(
        {
          sessionId,
          scheduleType: scheduleData?.schedule_type ?? '',
          cancelReason
        },
        { onSuccess: closeModal }
      )
    })
  }

  const openRevertCancelModal = () => {
    sessionCancelService.openRevertCancelModal(() => {
      const sessionId = scheduleData?.sessions?.[0]?.session_id
      if (!sessionId) return
      sessionCancelService.revertCancelSession(
        { sessionId, scheduleType: scheduleData?.schedule_type ?? '' },
        { onSuccess: closeModal }
      )
    })
  }

  const handleCreateBilling = () => {
    scheduleBillingService.openCreateBilling({
      scheduleData,
      schedule,
      closeModal,
      SessionBillingModal,
      BillableCreateModal
    })
  }

  const handleViewBilling = () => {
    scheduleBillingService.openViewBilling({
      existingBillables,
      canWriteBilling,
      closeModal,
      BillableDetailModal
    })
  }

  const handleGroupBilling = () => {
    scheduleBillingService.openGroupBilling({
      scheduleData,
      schedule,
      existingBillables,
      canWriteBilling,
      reopenScheduleDetail,
      closeModal,
      BillableDetailModal
    })
  }

  /* ============================================
   * 모드 전환 (상세 ↔ 수정)
   * ============================================ */

  // 수정 화면에서 상담 정보에 다녀온 뒤 복귀할 때는 곧장 수정 모드로 연다
  let mode = $state<'detail' | 'edit'>(initialMode)

  // 일정 상태 배지 — 자리·형태는 하나, 색만 다르다(취소=red 기존 규격 유지)
  const STATUS_BADGE: Record<
    string,
    { label: string; color: 'blue' | 'indigo' | 'green' | 'red' | 'orange' }
  > = {
    scheduled: { label: '예정', color: 'blue' },
    in_progress: { label: '진행중', color: 'indigo' },
    completed: { label: '완료', color: 'green' },
    cancelled: { label: '취소', color: 'red' },
    no_show: { label: '노쇼', color: 'orange' }
  }

  let editCanSubmit = $state(false)
  let editHasConflict = $state(false)
  let editDoSubmit = $state<() => void>(() => {})
  let editIsSubmitting = $state(false)

  // 폭 — 상세 640, 수정 740. 740단은 "달력 + 선택된 날짜" 좌우 2단 전용
  // (Web_Design.md §Components>modal). ModalContainer 의 customWidth 가
  // BaseModal size 보다 우선하므로 모드 전환 때 여기서 같이 갱신한다.
  const handleOpenScheduleModify = (e: MouseEvent) => {
    e.stopPropagation()
    mode = 'edit'
    modalStore.updateModalOptions(modalId, { customWidth: 740 })
  }

  const handleBackToDetail = () => {
    mode = 'detail'
    editCanSubmit = false
    editHasConflict = false
    editIsSubmitting = false
    modalStore.updateModalOptions(modalId, { customWidth: 640 })
  }

  const handleEditSuccess = () => {
    closeModal()
  }

  const editHeaderTitle = $derived.by(() => {
    if (!scheduleData) return ''
    const dateStr = formatUtcToKst(scheduleData.start, 'YYYY-MM-DD (d) HH:mm')
    if (isAssessment) return `${dateStr} 검사 일정을 변경할게요`
    if (scheduleData.schedule_type === 'counseling')
      return `${dateStr} 상담 일정을 변경할게요`
    return `${dateStr} 일정 변경하기`
  })

  const editHeaderSubtitle = $derived.by(() => {
    if (!scheduleData) return ''
    if (scheduleData.schedule_type === 'counseling')
      return '변경사항은 해당 회기에만 적용돼요'
    if (!isAssessment) return '해당 일정의 정보를 수정할게요'
    return ''
  })

  // 헤더 패딩 = 좌우 20 / 상하 16 (전 모달 공통 규격)
  const dynamicHeaderClass = $derived.by(() => {
    if (mode === 'edit') return 'px-5 py-4 items-start!'
    return 'px-5! py-4! items-start!'
  })

  // 폭 — 상세는 표준 640(lg), 수정은 740(xl).
  // xl(740)단은 "달력 + 선택된 날짜 목록" 좌우 2단 모달 전용으로 신설된 단이다
  // (Web_Design.md §Components>modal). lg(640)에서는 좌측 달력 324 고정 탓에
  // 우측 단이 276까지 눌려 시간 텍스트가 삭제 버튼과 겹친다.
  const dynamicSize = $derived<'lg' | 'xl'>(mode === 'edit' ? 'xl' : 'lg')
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size={dynamicSize}
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  headerClass={dynamicHeaderClass}
>
  {#snippet header()}
    {#if mode === 'detail'}
      <div class="w-full">
        {#if !scheduleData}
          <!-- 스켈레톤: 헤더 -->
          <div class="animate-pulse flex items-center gap-2">
            <div class="w-6 h-6 bg-gray-200 rounded"></div>
            <div class="h-5 bg-gray-200 rounded w-48"></div>
          </div>
        {:else}
          <!-- 타이틀 = 내담자, 좌측 아이콘으로 상담·검사·운영 구분 (칩 호버 팝오버와 동일 구조) -->
          <div class="space-y-2">
            <!-- 상태는 전부 같은 자리·같은 배지(Rectangle S)로, 색만 다르게.
                 타이틀 위 텍스트/옆 배지로 표기가 갈리면 같은 정보가 두 형태로 읽힌다. -->
            <div class="flex min-w-0 items-start gap-2">
              <span class="mt-0.5 shrink-0">
                {#if scheduleData.schedule_type === 'meeting'}
                  <Center24Icon />
                {:else if scheduleData.schedule_type === 'counseling'}
                  <Counsel24Icon />
                {:else}
                  <AssessmentStack />
                {/if}
              </span>
              <Typography
                variant="headline-02-reading-semibold"
                color="text-gray-800"
                className="min-w-0 wrap-break-word"
              >
                {clientTitle}
              </Typography>
              {#if STATUS_BADGE[sessionStatus]}
                <!-- 타이틀 첫 줄 상자(headline-02-reading = 20 × 150% = 30) 안에서 세로 가운데.
                     배지에 직접 self-center를 주면 컨테이너가 items-start라도 타이틀이
                     2줄일 때 전체 높이 중앙으로 내려간다 -->
                <span class="flex h-[30px] shrink-0 items-center">
                  <BadgeRectangle
                    label={STATUS_BADGE[sessionStatus].label}
                    color={STATUS_BADGE[sessionStatus].color}
                    size="sm"
                  />
                </span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- 수정 모드 헤더 -->
      <!-- 2줄 헤더 규격: 타이틀↔부제 8 · 부제 body-02-normal-regular/gray-500 (Web_Design.md §modal) -->
      <div class="w-full space-y-2">
        <Typography
          variant="headline-02-normal-semibold"
          color="text-body-strong"
        >
          {editHeaderTitle}
        </Typography>
        {#if editHeaderSubtitle}
          <Typography variant="body-02-normal-regular" color="text-gray-500">
            {editHeaderSubtitle}
          </Typography>
        {/if}
      </div>
    {/if}
  {/snippet}
  {#snippet body()}
    {#if mode === 'detail'}
      <div class="p-5 pb-7">
        {#if !scheduleData}
          <!-- 스켈레톤: 바디 -->
          <div class="animate-pulse space-y-5">
            <div class="bg-gray-100 rounded-lg p-5 space-y-4">
              {#each Array(4) as _}
                <div class="grid grid-cols-[80px_1fr] gap-4">
                  <div class="h-4 bg-gray-200 rounded w-12"></div>
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              {/each}
            </div>
            <div class="space-y-4">
              {#each Array(2) as _}
                <div class="grid grid-cols-[80px_1fr] gap-4">
                  <div class="h-4 bg-gray-200 rounded w-10"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              {/each}
            </div>
          </div>
        {:else if schedule}
          {#if isAssessment}
            <ScheduleDetailAssessmentBody
              {scheduleData}
              {schedule}
              {existingBillables}
              {isSessionFinished}
              onEditClick={canWriteSchedule
                ? handleOpenScheduleModify
                : undefined}
            />
          {:else}
            <ScheduleDetailCounselingBody
              {scheduleData}
              {schedule}
              {existingBillables}
              {isSessionFinished}
              onEditClick={canWriteSchedule
                ? handleOpenScheduleModify
                : undefined}
            />
          {/if}
          <!-- 회기 상세 진입점 (타이틀이 내담자로 바뀌어 링크가 없어진 자리를 대신한다) -->
          {#if caseDetailPath}
            <button
              onclick={goToCaseDetail}
              class="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white ring-1 ring-inset ring-gray-200 transition-colors hover:bg-gray-50"
            >
              <Typography variant="body-01-normal-medium" color="text-gray-600">
                회기 자세히 보기
              </Typography>
              <ArrowRightIcon16 />
            </button>
          {/if}
        {/if}
      </div>
    {:else if scheduleData && schedule}
      <!-- 수정 모드 바디 -->
      <div class="p-5 pb-7">
        {#if isAssessment}
          <ModifyAssessmentScheduleForm
            {schedule}
            {scheduleData}
            bind:canSubmit={editCanSubmit}
            bind:doSubmit={editDoSubmit}
            bind:isSubmitting={editIsSubmitting}
            onSuccess={handleEditSuccess}
          />
        {:else if scheduleData.schedule_type === 'counseling'}
          <ModifyCounselingScheduleForm
            {schedule}
            {scheduleData}
            bind:canSubmit={editCanSubmit}
            bind:doSubmit={editDoSubmit}
            onSuccess={handleEditSuccess}
          />
        {:else}
          <ModifyScheduleForm
            {schedule}
            {scheduleData}
            bind:canSubmit={editCanSubmit}
            bind:hasConflict={editHasConflict}
            bind:doSubmit={editDoSubmit}
            onSuccess={handleEditSuccess}
          />
        {/if}
      </div>
    {/if}
  {/snippet}
  {#snippet footer()}
    {#if mode === 'detail'}
      <div class="flex w-full justify-between items-center">
        {#if !scheduleData}
          <!-- 스켈레톤: 푸터 -->
          <div class="animate-pulse flex w-full justify-between items-center">
            <div class="w-13 h-13 bg-gray-100 rounded-full"></div>
            <div class="flex gap-2">
              <div class="h-13 w-28 bg-gray-100 rounded-lg"></div>
              <div class="h-13 w-24 bg-gray-100 rounded-lg"></div>
            </div>
          </div>
        {:else}
          {#if canDeleteSchedule}
            <button
              onclick={openDeleteScheduleModal}
              class="w-13 h-11 flex-center rounded-full hover:bg-gray-50 text-gray-500 duration-200"
            >
              <TrashIcon24 />
            </button>
          {:else}
            <div></div>
          {/if}
          <div class="flex items-center gap-2">
            <!-- 청구 버튼 (일정 취소 좌측) -->
            {#if isGroupSession()}
              {#if billingState === 'completed'}
                <button
                  onclick={handleGroupBilling}
                  class="h-11 px-5 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover flex items-center gap-1.5"
                >
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-current"
                  >
                    청구 완료
                  </Typography>
                </button>
              {:else if billingState === 'pending' && canReadBilling}
                <button
                  onclick={handleGroupBilling}
                  class="h-11 px-5 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover flex items-center gap-2"
                >
                  <BillsIconCurrent20 />
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-current"
                  >
                    청구 확인
                  </Typography>
                </button>
              {:else if billingState === 'none' && canWriteBilling}
                <button
                  onclick={handleGroupBilling}
                  class="h-11 px-6 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover flex items-center gap-2"
                >
                  <BillsIconCurrent20 />
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-current"
                  >
                    청구
                  </Typography>
                </button>
              {/if}
            {:else if billingState === 'completed'}
              <button
                onclick={handleViewBilling}
                class="h-11 px-5 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover flex items-center gap-1.5"
              >
                <Typography
                  variant="body-01-normal-medium"
                  color="text-current"
                >
                  청구 완료
                </Typography>
              </button>
            {:else if billingState === 'pending' && canReadBilling}
              <button
                onclick={handleViewBilling}
                class="h-11 px-5 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover flex items-center gap-2"
              >
                <BillsIconCurrent20 />
                <Typography
                  variant="body-01-normal-medium"
                  color="text-current"
                >
                  청구 확인
                </Typography>
              </button>
            {:else if billingState === 'none' && canWriteBilling}
              <button
                onclick={handleCreateBilling}
                class="h-11 px-6 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover flex items-center gap-2"
              >
                <BillsIconCurrent20 />
                <Typography
                  variant="body-01-normal-medium"
                  color="text-current"
                >
                  청구
                </Typography>
              </button>
            {/if}
            <!-- 일정 취소하기 (검사/상담 공통) -->
            {#if canWriteSchedule && !isSessionFinished && (isAssessment || schedule?.schedule_type === 'counseling')}
              <button
                onclick={openCancelScheduleModal}
                class="h-11 px-6 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Typography
                  variant="body-01-normal-medium"
                  color="text-[#EF4967]"
                >
                  일정 취소
                </Typography>
              </button>
            {/if}
            <!-- 취소 되돌리기 (취소된 검사/상담) -->
            {#if canWriteSchedule && isCancelled && (isAssessment || schedule?.schedule_type === 'counseling')}
              <button
                onclick={openRevertCancelModal}
                class="h-11 px-6 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Typography
                  variant="body-01-normal-medium"
                  color="text-gray-600"
                >
                  취소 되돌리기
                </Typography>
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <!-- 수정 모드 푸터 -->
      <div class="flex w-full justify-end items-center">
        <div class="flex gap-2">
          <button
            onclick={handleBackToDetail}
            class="h-11 w-30 rounded-lg flex-center bg-gray-100 hover:bg-gray-200 duration-200"
          >
            <Typography variant="body-01-normal-medium" color="text-gray-600">
              취소
            </Typography>
          </button>

          <button
            onclick={editDoSubmit}
            disabled={!editCanSubmit || editIsSubmitting}
            class={twMerge(
              'w-35 h-11 rounded-lg flex-center transition',
              !editCanSubmit || editIsSubmitting
                ? 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-400'
            )}
          >
            <Typography variant="body-01-normal-medium" color="text-white">
              {isAssessment || scheduleData?.schedule_type === 'counseling'
                ? '수정'
                : '변경'}
            </Typography>
          </button>
        </div>
      </div>
    {/if}
  {/snippet}
</BaseModal>
