<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import {
    getMemberDetail,
    getMemberWorkingTimes,
    updateMyMember,
    bulkUpdateMemberWorkingTimes
  } from '$lib/hooks/actions/member.action'
  import type {
    MemberDetailResponse,
    MemberWorkingTimeItem,
    MemberWorkingTimeCreateItem
  } from '$lib/hooks/actions/member.action'
  import {
    getMyCounselingLogs,
    type MyCounselingResponse
  } from '$lib/hooks/actions/counseling.action'
  import type { MyInfoModifyFormData } from '$lib/components/modal/MyInfoModifyModal.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { centerId } from '$lib/stores/center.store'
  import { requireCenterId } from '$lib/stores/center.store'
  import { permissionStore } from '$lib/stores/permission.store'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { fade } from 'svelte/transition'
  import counselorMaleAvatar from '$lib/assets/counselor_male.png'
  import counselorFemaleAvatar from '$lib/assets/counselor_female.png'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import SettingIcon from '$lib/assets/sidebar/SettingOff24.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import EmptyDataIcon40 from '$lib/assets/EmptyDataIcon40.svelte'
  import Typography from '@common/components/Typography.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import MyInfoModifyModal from '$lib/components/modal/MyInfoModifyModal.svelte'
  import WorkScheduleModal from '$lib/components/modal/WorkScheduleModal.svelte'
  import CareerModal from '$lib/components/modal/CareerModal.svelte'
  import {
    WEEKDAYS,
    WEEKDAY_API_TO_KR,
    WEEKDAY_KR_TO_API,
    MEMBER_EMPLOYMENT_TYPE_MAP,
    MODAL_SIZES,
    type WeeklySchedule,
    type BreakTime,
    type WorkDay
  } from '$lib/features/members/constants'
  import { extractErrorMessage } from '$lib/utils/errorHandler'
  import { dateToString } from '$root/src/lib/utils/date'
  import { goto } from '$app/navigation'
  import MyCredentialsSection from './components/MyCredentialsSection.svelte'
  import CounselingLogsTable from './components/CounselingLogsTable.svelte'
  import CertifiedExpertBadge from '$lib/features/credentials/components/CertifiedExpertBadge.svelte'
  import PlanSummaryCard from '$lib/features/subscription/components/PlanSummaryCard.svelte'
  import { isManager, isSuperAdmin } from '$lib/stores/permission.view'
  import {
    listMyCredentials,
    type CredentialListResponse
  } from '$lib/hooks/actions/credential.action'

  import { page } from '$app/state'
  import { showSubscription } from '$lib/config/environment'

  const queryClient = useQueryClient()

  // permissionStore에서 memberId 가져오기
  const memberId = $derived($permissionStore.context?.memberId ?? null)

  // 구독 섹션은 관리자(매니저/슈퍼관리자)에게만 노출 + 리빙랩·운영 숨김 (D5)
  const canSeeSubscription = $derived(
    ($isManager || $isSuperAdmin) && showSubscription(page.url.hostname)
  )

  // ── 우측 탭 ──
  let activeTab = $state('credentials')

  // 탭 패널이 스크롤 컨테이너(xl 이상) — 내려간 만큼에서만 '최상단 이동' 노출
  let tabPanelEl = $state<HTMLDivElement | null>(null)
  let showScrollTop = $state(false)
  const SCROLL_TOP_THRESHOLD = 200

  function handleTabPanelScroll() {
    showScrollTop = (tabPanelEl?.scrollTop ?? 0) > SCROLL_TOP_THRESHOLD
  }

  function scrollTabPanelToTop() {
    tabPanelEl?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 탭을 바꾸면 이전 탭의 스크롤 위치가 남지 않게 초기화
  $effect(() => {
    activeTab
    if (tabPanelEl) tabPanelEl.scrollTop = 0
    showScrollTop = false
  })
  const tabs = $derived([
    { value: 'credentials', label: '학력·경력·자격' },
    { value: 'schedule', label: '근무일정' },
    { value: 'counseling', label: '상담이력' },
    ...(canSeeSubscription ? [{ value: 'subscription', label: '구독' }] : [])
  ])

  // 쿼리 초기화
  const memberDetailQuery = $derived(
    memberId
      ? queryBuilder(getMemberDetail, () => ({
          centerId: $centerId!,
          memberId: memberId!
        }))
      : null
  )
  const member = $derived(
    memberDetailQuery?.data as MemberDetailResponse | undefined
  )

  const workingTimesQuery = $derived(
    memberId
      ? queryBuilder(getMemberWorkingTimes, () => ({
          centerId: $centerId!,
          memberId: memberId!
        }))
      : null
  )
  const workingTimes = $derived(
    workingTimesQuery?.data as MemberWorkingTimeItem[] | undefined
  )

  // API 응답 → WeeklySchedule + BreakTime 변환
  function toWeeklyScheduleAndBreak(
    items: MemberWorkingTimeItem[] | undefined
  ): {
    weeklySchedule: WeeklySchedule | undefined
    breakTime: BreakTime | null
  } {
    if (!items || items.length === 0) {
      return { weeklySchedule: undefined, breakTime: null }
    }
    const schedule: WeeklySchedule = {}
    let breakTime: BreakTime | null = null
    for (const d of WEEKDAYS) {
      schedule[d] = null
    }
    for (const item of items) {
      const day = WEEKDAY_API_TO_KR[item.weekday]
      if (!day) continue
      const start = item.start_time ? item.start_time.slice(0, 5) : null
      const end = item.end_time ? item.end_time.slice(0, 5) : null
      if (start && end) {
        schedule[day] = { start, end }
        if (item.break_start_time && item.break_end_time) {
          breakTime = {
            start: item.break_start_time.slice(0, 5),
            end: item.break_end_time.slice(0, 5)
          }
        }
      } else {
        schedule[day] = null
      }
    }
    return { weeklySchedule: schedule, breakTime }
  }

  const { weeklySchedule, breakTime } = $derived(
    toWeeklyScheduleAndBreak(workingTimes)
  )

  // 상담 이력 쿼리
  const counselingLogsQuery = $derived(
    $centerId
      ? queryBuilder(getMyCounselingLogs, () => ({
          centerId: $centerId!
        }))
      : null
  )
  const counselingLogs = $derived(
    counselingLogsQuery?.data as MyCounselingResponse | undefined
  )
  const hasCounselingLogs = $derived(
    !!counselingLogs?.items && counselingLogs.items.length > 0
  )

  // 인증 배지용 — MyCredentialsSection과 동일 쿼리 (TanStack Query가 캐싱)
  const myCredentialsQuery = $derived(
    queryBuilder(listMyCredentials, () => ({}))
  )
  const isCertified = $derived(
    (myCredentialsQuery.data as CredentialListResponse | undefined)?.stats
      ?.is_certified ?? false
  )

  // ── 아바타 (구성원 상세 MemberProfileCard와 동일 규칙) ──
  let imgError = $state(false)
  $effect(() => {
    member?.profile_image_url
    imgError = false
  })
  const avatarInitial = $derived(
    (member?.person.name ?? '').trim().charAt(0) || '?'
  )
  // 성별 정규화 (male/MALE/M/남/남자 등 다양한 형식 포용)
  const genderNorm = $derived.by<'male' | 'female' | null>(() => {
    const g = (member?.person.gender ?? '').toLowerCase()
    if (['male', 'm', '남', '남자'].includes(g)) return 'male'
    if (['female', 'f', '여', '여자'].includes(g)) return 'female'
    return null
  })
  const avatarBg = $derived(
    genderNorm === 'male'
      ? 'bg-blue-50'
      : genderNorm === 'female'
        ? 'bg-status-danger-bg'
        : 'bg-gray-100'
  )
  const avatarFg = $derived(
    genderNorm === 'male'
      ? 'text-blue-500'
      : genderNorm === 'female'
        ? 'text-status-danger'
        : 'text-gray-500'
  )
  // 프로필 사진이 없을 때 성별에 맞는 기본 상담사 일러스트(원형)로 폴백
  const counselorAvatar = $derived(
    genderNorm === 'male'
      ? counselorMaleAvatar
      : genderNorm === 'female'
        ? counselorFemaleAvatar
        : null
  )
  // 이미지(사진·일러스트)로 박스를 채울 땐 배경색을 두지 않는다.
  const showInitialAvatar = $derived(
    !(member?.profile_image_url && !imgError) && !counselorAvatar
  )

  const careerData = $derived(
    member
      ? {
          educations: member.educations ?? [],
          careers: member.careers ?? [],
          certifications: member.certifications ?? []
        }
      : undefined
  )

  // 근무일 개수
  const workDayCount = $derived(
    weeklySchedule
      ? Object.values(weeklySchedule).filter((v) => v !== null).length
      : 0
  )
  const hasSchedule = $derived(!!weeklySchedule && workDayCount > 0)

  const hasCareerData = $derived(
    careerData &&
      (careerData.educations.length > 0 ||
        careerData.careers.length > 0 ||
        careerData.certifications.length > 0)
  )

  // 좌측 프로필 카드 기본 정보 행 (구성원 상세 톤과 동일한 라벨-값 레시피)
  const infoRows = $derived(
    member
      ? [
          { label: '생년월일', value: member.person.birth || '' },
          {
            label: '성별',
            value:
              member.person.gender === 'male'
                ? '남자'
                : member.person.gender === 'female'
                  ? '여자'
                  : ''
          },
          { label: '이메일', value: member.person.email || '' },
          { label: '연락처', value: member.person.phone || '' },
          {
            label: '계약형태',
            value:
              MEMBER_EMPLOYMENT_TYPE_MAP[
                member.employment_type as keyof typeof MEMBER_EMPLOYMENT_TYPE_MAP
              ] ||
              member.employment_type ||
              ''
          },
          {
            label: '입사일',
            value: dateToString(member.created_at, 'YYYY-MM-DD') || ''
          }
        ]
      : []
  )

  // Query invalidation
  const invalidateMemberDetail = () =>
    queryClient.invalidateQueries({
      queryKey: ['getMemberDetail'],
      exact: false
    })

  const invalidateWorkingTimes = () =>
    queryClient.invalidateQueries({
      queryKey: ['getMemberWorkingTimes'],
      exact: false
    })

  // WeeklySchedule → WorkDay[] (모달용)
  function weeklyScheduleToArray(ws?: WeeklySchedule): Omit<WorkDay, 'id'>[] {
    if (!ws) return []
    return WEEKDAYS.filter((day) => ws[day] !== null).map((day) => ({
      day,
      start: ws[day]!.start,
      end: ws[day]!.end
    }))
  }

  // WorkDay[] → WeeklySchedule
  function arrayToWeeklySchedule(
    schedules: Omit<WorkDay, 'id'>[]
  ): WeeklySchedule {
    const result: WeeklySchedule = {}
    WEEKDAYS.forEach((day) => {
      result[day] = null
    })
    schedules.forEach(({ day, start, end }) => {
      result[day] = { start, end }
    })
    return result
  }

  // 기본 정보 수정 모달 (권한 체크 없이 직접 열기)
  function handleModify() {
    if (!member || !memberId) return
    modalStore.open({
      component: MyInfoModifyModal,
      props: {
        member,
        onConfirm: async (data: MyInfoModifyFormData) => {
          try {
            await updateMyMember().request({
              centerId: requireCenterId(),
              ...data
            })
            snackbarStore.success('내 정보가 수정되었습니다')
            invalidateMemberDetail()
          } catch (error) {
            console.error('[updateMember] failed', error)
            snackbarStore.error('정보 수정에 실패했습니다')
            throw error
          }
        }
      },
      options: MODAL_SIZES.modify
    })
  }

  // 근무일정 수정 모달
  function handleEditSchedule() {
    if (!memberId) return
    const cId = requireCenterId()
    modalStore.open({
      component: WorkScheduleModal,
      props: {
        schedules: weeklyScheduleToArray(weeklySchedule),
        initialBreakTime: breakTime ?? null,
        onConfirm: async (
          scheduleArray: Omit<WorkDay, 'id'>[],
          newBreakTime: BreakTime | null
        ) => {
          const newWeeklySchedule = arrayToWeeklySchedule(scheduleArray)
          const items: MemberWorkingTimeCreateItem[] = WEEKDAYS.map((day) => {
            const slot = newWeeklySchedule[day]
            const apiDay = WEEKDAY_KR_TO_API[day]
            if (slot) {
              return {
                weekday: apiDay as MemberWorkingTimeCreateItem['weekday'],
                start_time: slot.start,
                end_time: slot.end,
                break_start_time: newBreakTime?.start ?? null,
                break_end_time: newBreakTime?.end ?? null
              }
            }
            return {
              weekday: apiDay as MemberWorkingTimeCreateItem['weekday'],
              start_time: null,
              end_time: null,
              break_start_time: null,
              break_end_time: null
            }
          })
          try {
            await bulkUpdateMemberWorkingTimes().request({
              centerId: cId,
              memberId: memberId!,
              items
            })
            await invalidateWorkingTimes()
            await invalidateMemberDetail()
            snackbarStore.success('근무 일정을 저장했어요')
          } catch (error: unknown) {
            snackbarStore.error(
              extractErrorMessage(error) ?? '근무 일정 저장에 실패했어요'
            )
          }
        }
      },
      options: MODAL_SIZES.workSchedule
    })
  }

  // 학력/경력/자격증 수정 모달
  function handleEditCareer() {
    if (!memberId) return
    const cId = requireCenterId()
    modalStore.open({
      component: CareerModal,
      props: {
        initialData: careerData,
        onConfirm: async (
          educations: string[],
          careers: string[],
          certifications: string[]
        ) => {
          try {
            await updateMyMember().request({
              centerId: cId,
              careers,
              educations,
              certifications
            })
            invalidateMemberDetail()
            snackbarStore.success(
              hasCareerData
                ? '학력/경력을 수정했어요'
                : '학력/경력을 추가했어요'
            )
          } catch (error: unknown) {
            snackbarStore.error(
              extractErrorMessage(error) ?? '학력/경력 저장에 실패했어요'
            )
          }
        }
      },
      options: MODAL_SIZES.career
    })
  }

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

<div in:fade class="flex xl:h-full xl:min-h-0 flex-col bg-gray-50 xl:pb-10">
  {#if member}
    <!-- 페이지 헤더 (표준 PageTitleSection과 동일: min-h-11 · 세로 중앙 · mb-4) -->
    <div class="mb-4 flex min-h-11 shrink-0 items-center gap-2">
      {#if TitleIcon}<TitleIcon />{/if}
      <Typography variant="headline-01-normal-semibold">내 정보</Typography>
    </div>

    <!-- 2단 레이아웃 (좌 프로필 / 우 탭) — 남은 높이를 채우고 각 영역이 내부에서만 스크롤 -->
    <div
      class="grid grid-cols-1 items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[var(--spacing-detail-side)_1fr] xl:items-stretch"
    >
      <!-- 좌측: 프로필 카드 — 높이를 채우고 넘치면 내부 스크롤 -->
      <section
        class="flex flex-col rounded-2xl border border-gray-200 bg-white xl:min-h-0"
      >
        <div class="p-6 pt-8 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <!-- 아바타 + 이름 (구성원 상세 프로필 헤더와 동일: 세로 중앙 정렬) -->
          <div class="flex flex-col items-center gap-4">
            <div
              class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg {showInitialAvatar
                ? avatarBg
                : ''}"
            >
              {#if member.profile_image_url && !imgError}
                <img
                  src={member.profile_image_url}
                  alt=""
                  class="h-full w-full object-cover"
                  onerror={() => (imgError = true)}
                />
              {:else if counselorAvatar}
                <img
                  src={counselorAvatar}
                  alt=""
                  class="h-full w-full object-cover"
                />
              {:else}
                <Typography variant="headline-02-normal-bold" color={avatarFg}>
                  {avatarInitial}
                </Typography>
              {/if}
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <Typography
                variant="headline-02-normal-semibold"
                color="text-gray-900"
              >
                {member.person.name}
              </Typography>
              {#if isCertified}
                <CertifiedExpertBadge size="sm" iconOnly />
              {/if}
              <Typography
                variant="body-01-normal-regular"
                color="text-gray-500"
              >
                {member.role_name}
              </Typography>
            </div>

            <!-- 계정 설정 (solid-tertiary, 아이콘 20 · gap 8) -->
            <button
              onclick={() => goto('/settings/account-info')}
              class="flex-center h-10 gap-2 rounded-lg bg-gray-100 px-6 transition-colors hover:bg-gray-200"
            >
              <span class="[&>svg]:h-5 [&>svg]:w-5 [&_path]:fill-icon-primary">
                <SettingIcon />
              </span>
              <Typography variant="body-02-normal-medium" color="text-gray-600">
                계정 설정
              </Typography>
            </button>
          </div>

          <!-- 기본 정보 -->
          <div class="mt-6 border-t border-gray-100 pt-6">
            <div class="mb-4 flex items-center justify-between">
              <Typography variant="title-01-semibold">기본 정보</Typography>

              <button
                onclick={handleModify}
                aria-label="수정"
                class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
              >
                <EditIcon />
                <span class="text-body-02-normal-medium">수정</span>
              </button>
            </div>
            <!-- 데이터 행: 센터정보·구성원상세 프로필 카드와 동일 레시피 (행높이 20 · gap-y 12) -->
            <dl
              class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-3"
            >
              {#each infoRows as row (row.label)}
                <Typography
                  variant="body-01-normal-regular"
                  color="text-gray-600"
                >
                  {row.label}
                </Typography>
                <Typography
                  variant="body-01-normal-regular"
                  color={row.value ? 'text-gray-900' : 'text-gray-400'}
                >
                  {row.value || '-'}
                </Typography>
              {/each}
            </dl>
          </div>
        </div>
      </section>

      <!-- 우측: 탭 패널 — 탭 바 고정, 콘텐츠만 내부 스크롤 -->
      <section
        class="relative flex flex-col rounded-2xl border border-gray-200 bg-white xl:min-h-0"
      >
        <div class="shrink-0 px-6 pt-3">
          <TabBar {tabs} bind:activeTab />
        </div>

        <div
          bind:this={tabPanelEl}
          onscroll={handleTabPanelScroll}
          class="px-6 pb-6 pt-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto"
        >
          {#if activeTab === 'credentials'}
            <MyCredentialsSection bare />

            <!-- 이전에 입력한 학력/경력/자격 (legacy, 데이터 있을 때만) -->
            {#if hasCareerData && careerData}
              <div class="mt-6 border-t border-gray-100 pt-6">
                <div class="mb-2 flex items-center justify-between">
                  <Typography variant="body-01-semibold" color="text-gray-600">
                    이전에 입력하신 정보
                  </Typography>

                  <button
                    onclick={handleEditCareer}
                    aria-label="수정"
                    class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
                  >
                    <EditIcon />
                    <span class="text-body-02-normal-medium">수정</span>
                  </button>
                </div>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                  className="mb-4 block"
                >
                  이전 형식으로 등록된 정보예요. 위 영역에서 새 형식으로 다시
                  등록하실 수 있어요.
                </Typography>

                <div class="space-y-4 opacity-80">
                  {#if careerData.educations.length > 0}
                    <div>
                      <p class="mb-1 text-xs font-medium text-gray-500">학력</p>
                      {#each careerData.educations as edu}
                        <p class="text-sm text-gray-700">{edu}</p>
                      {/each}
                    </div>
                  {/if}
                  {#if careerData.careers.length > 0}
                    <div>
                      <p class="mb-1 text-xs font-medium text-gray-500">경력</p>
                      {#each careerData.careers as career}
                        <p class="text-sm text-gray-700">{career}</p>
                      {/each}
                    </div>
                  {/if}
                  {#if careerData.certifications.length > 0}
                    <div>
                      <p class="mb-1 text-xs font-medium text-gray-500">
                        자격증
                      </p>
                      {#each careerData.certifications as cert}
                        <p class="text-sm text-gray-700">{cert}</p>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          {:else if activeTab === 'schedule'}
            <div class="mb-3 flex items-center justify-between">
              <Typography variant="body-01-semibold" color="text-gray-800">
                근무 일정
              </Typography>
              <!-- 수정 액션은 고칠 대상이 있을 때만. 없을 땐 빈 상태의 '추가'가 유일한 진입점 -->
              {#if hasSchedule && weeklySchedule}
                <button
                  onclick={handleEditSchedule}
                  aria-label="수정"
                  class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
                >
                  <EditIcon />
                  <span class="text-body-02-normal-medium">수정</span>
                </button>
              {/if}
            </div>

            {#if hasSchedule && weeklySchedule}
              <div class="flex flex-col gap-4">
                <div class="overflow-hidden rounded-lg border border-gray-200">
                  <table class="w-full table-fixed">
                    <thead class="bg-gray-50">
                      <tr>
                        {#each WEEKDAYS as day}
                          <th
                            class="border-r border-gray-200 px-4 py-3 text-center text-body-03-normal-medium text-gray-600 last:border-r-0"
                          >
                            {day}
                          </th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {#each WEEKDAYS as day}
                          <td
                            class="border-r border-gray-100 px-4 py-4 text-center text-body-03-normal-regular last:border-r-0"
                          >
                            {#if weeklySchedule[day]}
                              <span class="text-gray-800">
                                {weeklySchedule[day]?.start} ~ {weeklySchedule[
                                  day
                                ]?.end}
                              </span>
                            {:else}
                              <span class="text-gray-400">휴무</span>
                            {/if}
                          </td>
                        {/each}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {#if breakTime}
                  <div class="flex items-center gap-2">
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-500"
                    >
                      휴식시간
                    </Typography>
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-700"
                    >
                      {breakTime.start} ~ {breakTime.end}
                    </Typography>
                  </div>
                {/if}
              </div>
            {:else}
              <div
                class="flex-center min-h-40 flex-col gap-3 rounded-lg bg-gray-50"
              >
                <EmptyDataIcon40 />
                <Typography
                  variant="body-01-normal-medium"
                  color="text-gray-500"
                >
                  근무 일정을 추가해주세요
                </Typography>
                <!-- button-white · Medium(40): 높이 40 · 좌우 24 · 아이콘 20 · 레이블 15 -->
                <button
                  onclick={handleEditSchedule}
                  class="flex-center h-10 gap-2 rounded-lg bg-white px-6 text-title-subtitle ring-1 ring-inset ring-transparent transition-colors hover:text-body-strong hover:ring-gray-200"
                >
                  <PlusIcon20 />
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-gray-600"
                  >
                    추가
                  </Typography>
                </button>
              </div>
            {/if}
          {:else if activeTab === 'counseling'}
            {#if hasCounselingLogs && counselingLogs}
              <!-- 요약 4종: 한 줄 가로 정렬 (좁은 폭에서만 2열로 접힘) -->
              <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
                <!-- 총 상담 이력 = 이 영역의 앵커 → 브랜드 틴트(bg/brand-subtle) -->
                <div class="rounded-lg bg-brand-subtle p-4">
                  <Typography
                    variant="body-03-normal-regular"
                    color="text-gray-500"
                    className="mb-4 block"
                  >
                    총 상담 이력
                  </Typography>
                  <Typography
                    variant="title-01-normal-semibold"
                    color="text-primary-500"
                  >
                    {counselingLogs.summary.total_completed}회
                  </Typography>
                </div>
                <div class="rounded-lg bg-gray-50 p-4">
                  <Typography
                    variant="body-03-normal-regular"
                    color="text-gray-500"
                    className="mb-4 block"
                  >
                    개별 상담
                  </Typography>
                  <Typography
                    variant="title-01-normal-semibold"
                    color="text-gray-900"
                  >
                    {counselingLogs.summary.individual_completed}회
                  </Typography>
                </div>
                <div class="rounded-lg bg-gray-50 p-4">
                  <Typography
                    variant="body-03-normal-regular"
                    color="text-gray-500"
                    className="mb-4 block"
                  >
                    그룹 상담
                  </Typography>
                  <Typography
                    variant="title-01-normal-semibold"
                    color="text-gray-900"
                  >
                    {counselingLogs.summary.group_completed}회
                  </Typography>
                </div>
                <div class="rounded-lg bg-gray-50 p-4">
                  <Typography
                    variant="body-03-normal-regular"
                    color="text-gray-500"
                    className="mb-4 block"
                  >
                    최근 상담일
                  </Typography>
                  <Typography
                    variant="title-01-normal-semibold"
                    color="text-gray-900"
                  >
                    {counselingLogs.summary.last_session_date ?? '-'}
                  </Typography>
                </div>
              </div>

              <!-- 진행한 상담 목록 (자세히 페이지와 동일 데이터) -->
              <div class="mt-8">
                <div class="mb-3 flex h-6 items-center">
                  <Typography variant="body-01-semibold" color="text-gray-800">
                    진행한 상담
                  </Typography>
                  <span class="ml-2 text-sm font-normal text-gray-500">
                    {counselingLogs.items?.length ?? 0}
                  </span>
                </div>
                <CounselingLogsTable items={counselingLogs.items ?? []} />
              </div>
            {:else}
              <!-- 빈 상태 규격 정본 = FieldNoteEmpty:
                   아이콘 → 12 → 제목 Title_01/Reading SemiBold(18, gray-800)
                   → 8 → 설명 Body_01/Reading Regular(16, gray-600).
                   제목·설명을 한 줄에 \n으로 묶으면 Normal(행간 100%)이라 두 줄이
                   붙어 보이고 위계도 사라진다 → 반드시 두 요소로 나눈다. -->
              <div
                class="flex-center min-h-40 flex-col rounded-lg bg-gray-50 py-10 text-center"
              >
                <EmptyDataIcon40 />
                <Typography
                  variant="title-01-reading-semibold"
                  color="text-gray-800"
                  className="mt-3"
                >
                  아직 기록된 상담이 없어요
                </Typography>
                <Typography
                  variant="body-01-reading-regular"
                  color="text-gray-600"
                  className="mt-2"
                >
                  상담이 완료되면 이력이 자동으로 쌓여요
                </Typography>
              </div>
            {/if}
          {:else if activeTab === 'subscription'}
            <PlanSummaryCard bare />
          {/if}
        </div>

        <!-- 최상단 이동 — 스크롤된 상태에서만. 규격은 FloatingFilterBar와 동일(44 원형) -->
        <button
          type="button"
          onclick={scrollTabPanelToTop}
          aria-label="최상단으로 이동"
          class="absolute bottom-6 right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 {showScrollTop
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'}"
        >
          <span class="block rotate-180"><ArrowDownIcon20 /></span>
        </button>
      </section>
    </div>
  {:else if !memberId}
    <div class="flex h-full items-center justify-center">
      <Typography variant="body-01-medium" color="text-gray-500">
        멤버 정보를 불러올 수 없습니다.
      </Typography>
    </div>
  {:else}
    <div class="flex h-full items-center justify-center">
      <Typography variant="body-01-medium" color="text-gray-500">
        로딩 중...
      </Typography>
    </div>
  {/if}
</div>
