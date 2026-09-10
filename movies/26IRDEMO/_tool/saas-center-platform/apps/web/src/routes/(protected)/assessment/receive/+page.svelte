<script lang="ts">
  // 검사 접수 폼 (Progress-Stepper)
  // 공통 ReceiveStepperLayout(헤더/스텝퍼/메모/버튼/인터랙션) 위에 검사 도메인 폼만 주입.
  // 상담 접수와 동일 패턴. 단, 센터 방문(visitCenter) OFF 시 장소·일정 스텝이 빠지는 동적 스텝.
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { t, josa } from '$lib/ontology/terms'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { readReturnTo, withLandingDate } from '$lib/utils/return-to'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import type { ExtendedClient } from '$lib/stores/receiveForm'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalUtils } from '$lib/stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import { buildClientListInput, DEFAULT_FILTERS } from '$lib/features/clients'
  import type { ClientListItem } from '$lib/hooks/actions/client.action'

  // Action imports
  import {
    getCenterAssessments,
    type CenterAssessment
  } from '$lib/hooks/actions/assessment.action'
  import { getAssessmentSetList } from '$lib/hooks/actions/assessmentSet.action'
  import {
    getMemberList,
    getMeMember,
    type MemberListItem as MemberItem
  } from '$lib/hooks/actions/member.action'
  import { getRoomList } from '$lib/hooks/actions/room.action'
  import { getClientList } from '$lib/hooks/actions/client.action'

  // Feature module imports
  import {
    useReceiveForm,
    createReceiveService,
    buildAssessmentsQueryInput,
    buildPackagesQueryInput,
    buildMembersQueryInput,
    buildRoomsQueryInput,
    mapAssessmentSetItemsToPackages,
    mapMemberOptions,
    mapRoomOptions,
    meMemberToMemberItem,
    mapClientSummaryToExtendedClient,
    mapCaseCounselorToMemberItem,
    mapCaseTasksToAssessmentItemNames
  } from '$lib/features/assessment/receive'
  import { centerId } from '$lib/stores/center.store'
  import { getOperatingTimes } from '$lib/hooks/actions/center.action'
  import { postCreateInstitution } from '$lib/hooks/actions/institution.action'
  import { permissionContext, isCounselor } from '$lib/stores/permission.view'

  // Component imports
  import {
    AssessmentSelector,
    SelectableButtonGroup,
    ClientMultiSelect
  } from '$lib/components/assessment/receive'
  import GroupClientSearchInput from '$lib/components/assessment/receive/GroupClientSearchInput.svelte'
  import OrganizationSearchDropdown from '$lib/components/OrganizationSearchDropdown.svelte'
  import MemberChip from '$lib/components/common/MemberChip.svelte'
  import MultiDateSchedulePicker from '$lib/components/schedule/MultiDateSchedulePicker.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import ExcelPreviewOverlay from '$lib/components/assessment/receive/ExcelPreviewOverlay.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import InfoCircleIcon20 from '$lib/assets/InfoCircleIcon20.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import ReceiveStepperLayout, {
    type StepItem
  } from '$lib/components/common/ReceiveStepperLayout.svelte'

  import { registerAssessmentReceiveTools } from '$lib/features/agent/page-tools/assessment-receive'
  import { pageToolRegistry } from '$lib/features/agent/page-tools'

  // ============ QueryClient & Form/Service ============
  const queryClient = useQueryClient()
  const form = useReceiveForm()
  const receiveService = createReceiveService({ queryClient })

  // ============ 엑셀 프리뷰 오버레이 ============
  let showExcelPreview = $state(false)

  // ============ API Queries ============
  const assessmentsQuery = $derived(
    queryBuilder<CenterAssessment[], CenterAssessment[]>(
      getCenterAssessments,
      () => ({ centerId: $centerId!, ...buildAssessmentsQueryInput() }),
      { enabled: browser && !!$centerId }
    )
  )
  const packagesQuery = $derived(
    queryBuilder(
      getAssessmentSetList,
      () => buildPackagesQueryInput($centerId!),
      {
        enabled: browser && !!$centerId
      }
    )
  )
  const membersQuery = $derived(
    queryBuilder(getMemberList, () => buildMembersQueryInput($centerId!), {
      enabled: browser && !!$centerId && !$isCounselor
    })
  )
  const meMemberQuery = $derived(
    queryBuilder(getMeMember, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId && $isCounselor
    })
  )
  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const clientsQuery = $derived(
    queryBuilder(
      getClientList,
      () => buildClientListInput($centerId!, DEFAULT_FILTERS),
      { enabled: browser && !!$centerId }
    )
  )

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      staleTime: 5 * 60 * 1000
    })
  )
  const operatingTimes = $derived(operatingTimesQuery.data ?? [])

  // 운영시간 기반 기본 시간 적용
  $effect(() => {
    if (operatingTimes.length > 0) {
      form.applyDefaultTimes(operatingTimes)
    }
  })

  // 인라인 등록 후 쿼리 갱신 전까지 로컬에 보관할 내담자
  let locallyAddedClients = $state<ClientListItem[]>([])

  // ============ Derived Data (VM 매핑) ============
  const assessmentsData = $derived(assessmentsQuery.data ?? [])
  const clientsData = $derived.by(() => {
    const queryItems = clientsQuery.data?.items ?? []
    if (locallyAddedClients.length === 0) return queryItems
    const existingIds = new Set(queryItems.map((c) => c.id))
    const newOnly = locallyAddedClients.filter((c) => !existingIds.has(c.id))
    return [...newOnly, ...queryItems]
  })
  const assessmentOptions = $derived(assessmentsData.map((a) => a.eng_name))
  const assessmentKorNameMap = $derived<Record<string, string>>(
    Object.fromEntries(
      assessmentsData.map((a) => [a.eng_name, a.kor_name ?? ''])
    )
  )
  const packagesData = $derived(
    mapAssessmentSetItemsToPackages(packagesQuery.data?.items ?? [], $centerId)
  )
  const membersData = $derived(
    $isCounselor
      ? meMemberQuery.data
        ? [meMemberToMemberItem(meMemberQuery.data)]
        : []
      : (membersQuery.data?.items ?? [])
  )
  const memberOptions = $derived(mapMemberOptions(membersData))
  const roomsData = $derived(roomsQuery.data ?? [])
  const roomOptions = $derived(mapRoomOptions(roomsData))
  const membersLoading = $derived(
    $isCounselor ? meMemberQuery.isLoading : membersQuery.isLoading
  )
  const membersEmpty = $derived(!membersLoading && memberOptions.length === 0)
  const roomsEmpty = $derived(!roomsQuery.isLoading && roomOptions.length === 0)
  const assessmentsInSelectedPackages = $derived(
    form.getAssessmentsInPackages(packagesData)
  )
  const RECEIVE_RETURN_TO = '/assessment/receive'

  // 단체 모드: groupMembers ID 목록 (검색 드롭다운 체크 상태 표시용)
  const groupSelectedIds = $derived(form.groupMembers.map((m) => m.id))

  // ============ $effects ============
  // 편집 모드: CaseDetail 로드 시 폼 pre-fill (1회)
  $effect(() => {
    const caseData = form.caseDetailForEdit
    const id = form.editCaseId
    const loading = assessmentsQuery.isLoading
    if (!id || !caseData || form.editCasePreFilled) return
    if (loading) return
    const asData = assessmentsData
    const roomData = roomsData
    form.clientType = 'individual'
    if (caseData.clients?.length) {
      form.selectedClients = [
        mapClientSummaryToExtendedClient(caseData.clients[0])
      ]
    }
    if (caseData.counselor) {
      form.selectedMember = [mapCaseCounselorToMemberItem(caseData.counselor)]
    }
    // 세트 복원
    if (caseData.set_id) {
      const matchedPkg = packagesData.find((p) => p.uid === caseData.set_id)
      if (matchedPkg) {
        form.selectedPackageIds = [matchedPkg.uid]
      }
    }
    form.selectedAssessmentItems = mapCaseTasksToAssessmentItemNames(
      caseData.tasks,
      asData
    )
    form.comprehensiveReport = caseData.is_final_report_required
      ? '작성'
      : '미작성'
    if (caseData.schedule) {
      form.visitCenter = true
      // API의 schedule.start/end는 UTC naive → 'Z' 붙여서 UTC로 파싱 후 로컬 시간 추출
      const startRaw = caseData.schedule.start
      const endRaw = caseData.schedule.end
      const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z')
      if (!isNaN(start.getTime())) {
        form.selectedDate = start
        form.selectedDates = [start]
        const hours = start.getHours()
        const minutes = start.getMinutes()
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        form.selectedTime = timeStr
        form.scheduleStartTime = timeStr
      }
      if (endRaw) {
        const end = new Date(endRaw.endsWith('Z') ? endRaw : endRaw + 'Z')
        if (!isNaN(end.getTime())) {
          const endTimeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
          form.scheduleEndTime = endTimeStr
        }
      }
      if (caseData.schedule.room_id && roomData.length) {
        const room = roomData.find((r) => r.id === caseData.schedule!.room_id)
        if (room) form.selectedRoom = room
      }
    }
    form.editCasePreFilled = true
  })

  // 상담사일 때 담당자 기본값을 본인으로 설정
  $effect(() => {
    if (!browser || !$centerId || !$isCounselor) return
    if (form.isEditCaseMode) return
    if (form.selectedMember.length > 0) return
    if (membersData.length === 0) return
    const memberId = $permissionContext.memberId
    const self = memberId
      ? membersData.find((m: MemberItem) => m.id === memberId)
      : membersData[0]
    if (self) form.selectedMember = [self]
  })

  // 편집 모드: 새로고침 시 $centerId가 늦게 채워져도 한 번만 케이스 조회
  $effect(() => {
    const eid = form.editCaseId
    if (!eid) {
      form.setEditCaseIdFromUrl('')
      return
    }
    if (!form.shouldFetchCaseForEdit($centerId)) return
    receiveService
      .loadCaseForEdit(eid)
      .then((detail) => {
        if (detail) form.setCaseDetailForEdit(detail)
        else
          snackbarStore.error(
            '케이스 정보를 불러오지 못했어요. 새로고침해 주세요.'
          )
      })
      .catch(() => snackbarStore.error('검사 케이스를 불러오지 못했어요.'))
  })

  // 선택된 세트 범위 밖의 제외 항목은 자동 정리
  $effect(() => {
    const cleaned = form.excludedAssessmentItems.filter((item) =>
      assessmentsInSelectedPackages.includes(item)
    )
    if (cleaned.length !== form.excludedAssessmentItems.length) {
      form.excludedAssessmentItems = cleaned
    }
  })

  // URL member_ids 파라미터로 담당자 자동 선택 (membersData 로드 후 매칭)
  const urlMemberIdsParam = page.url.searchParams.get('member_ids')
  let memberInitialized = false
  $effect(() => {
    if (memberInitialized || !urlMemberIdsParam || !membersData.length) return
    const ids = urlMemberIdsParam.split(',')
    const matched = membersData.filter((m) => ids.includes(m.id))
    if (matched.length) {
      form.selectedMember = matched
      memberInitialized = true
    }
  })

  // URL room_id 파라미터로 장소 자동 선택 (roomsData 로드 후 매칭)
  let roomInitialized = false
  $effect(() => {
    if (roomInitialized || !form.urlRoomId || !roomsData.length) return
    const matched = roomsData.find((r) => r.id === form.urlRoomId)
    if (matched) {
      form.selectedRoom = matched
      roomInitialized = true
    }
  })

  // ============ Lifecycle ============
  onMount(() => {
    form.initFromExcel(page.url)
    registerAssessmentReceiveTools(
      form,
      () => membersData,
      () => roomsData,
      handleConfirm
    )
  })

  onDestroy(() => {
    if (browser) pageToolRegistry.unregisterAll()
  })

  // ============ Handlers ============
  function handleOpenClientRegisterModal() {
    receiveService.openClientRegisterModal((client) => {
      const newExtendedClient: ExtendedClient = {
        uid: client.id,
        role: 'client',
        name: client.name,
        gender: client.gender === 'female' ? '여자' : '남자',
        birth_date: client.birthDate ? new Date(client.birthDate) : null,
        guardian_relationship: '',
        guardian_name: '',
        guardian_phone: '',
        memo: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      form.selectedClients = [...form.selectedClients, newExtendedClient]
      locallyAddedClients = [
        {
          id: client.id,
          name: client.name,
          role: 'client',
          gender: client.gender,
          birth_date: client.birthDate
        },
        ...locallyAddedClients
      ]
      queryClient.invalidateQueries({
        queryKey: ['getClientList'],
        exact: false
      })
    })
  }

  function handleMemberSelect(id: string) {
    const member = membersData.find((m: MemberItem) => m.id === id)
    if (!member) return
    if (form.selectedMember.some((m: MemberItem) => m.id === id)) {
      form.selectedMember = form.selectedMember.filter(
        (m: MemberItem) => m.id !== id
      )
    } else {
      form.selectedMember = [...form.selectedMember, member]
    }
  }

  function handleSetPrimary(id: string) {
    const m = membersData.find((m) => m.id === id)
    if (m) form.setPrimaryMember(m)
  }

  function handleRoomSelect(roomId: string) {
    form.selectedRoom =
      form.selectedRoom?.id === roomId
        ? null
        : roomsData.find((r) => r.id === roomId) || null
  }

  function handleRoomAdd() {
    receiveService.openRoomRegisterModal((created) => {
      if (created?.id) {
        form.selectedRoom = {
          id: created.id,
          name: created.name,
          is_active: created.is_active ?? true
        } as any
      }
    })
  }

  async function handleOrganizationRegister(data: {
    name: string
    address: string
    phone: string
  }) {
    try {
      const created = await postCreateInstitution().request({
        name: data.name,
        address: data.address ? { address: data.address } : undefined,
        phone: data.phone || undefined
      })
      form.handleOrganizationCreated({
        id: created.id,
        name: created.name,
        address: created.address?.address || '',
        phone: created.phone || ''
      })
    } catch {
      snackbarStore.error('기관 등록 중 오류가 발생했어요.')
    }
  }

  function handleExcelUpload() {
    receiveService.openExcelUploadModal((clients, fileName) => {
      receiveService.saveExcelAndNavigate(
        clients,
        fileName,
        form.buildFormState(),
        () => {
          showExcelPreview = true
        }
      )
    })
  }

  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)

  async function handleConfirm() {
    if (!form.validate()) return

    // 장소/담당자 충돌이 있으면 confirm 모달 (reason별 문구 분기)
    if (conflictReason && form.visitCenter) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            conflictRoomName,
            conflictReason,
            '등록'
          ),
          confirmText: '등록'
        }
      )
      if (!confirmed) return
    }

    receiveService
      .submitReceive({
        visitCenter: form.visitCenter,
        clientType: form.clientType,
        selectedDate: form.summaryDate,
        selectedTime: form.summaryTime,
        selectedEndTime: form.visitCenter ? form.scheduleEndTime : null,
        selectedMember: form.selectedMember,
        selectedRoom: form.selectedRoom,
        selectedAssessmentItems: form.selectedAssessmentItems,
        excludedAssessmentItems: form.excludedAssessmentItems,
        selectedPackageIds: form.selectedPackageIds,
        comprehensiveReport: form.comprehensiveReport,
        clientMemo: form.clientMemo,
        assessmentsData,
        packagesData,
        selectedClients: form.selectedClients,
        selectedOrganization: form.selectedOrganization,
        groupMembers: form.groupMembers,
        editCaseId: form.isEditCaseMode ? form.editCaseId : undefined
      })
      .then((success) => {
        if (!success) return
        // 일정에서 들어왔으면 그 화면으로 복귀(returnTo) — 등록한 날짜로 열어 방금 접수한 검사가 바로 보이게 한다.
        // 그 밖의 진입은 검사 현황 목록으로 (상담 접수와 동일 패턴).
        // 수정 모드는 진입한 상세로 복귀가 자연스러우니 back 유지.
        // replaceState — 제출 끝난 폼을 history에서 지워 뒤로가기가 접수 이전 화면(에이전트 등)으로 바로 가게 함
        const returnTo = readReturnTo(page.url)
        if (form.isEditCaseMode) history.back()
        else if (returnTo)
          goto(withLandingDate(returnTo, form.selectedDates[0]), {
            replaceState: true
          })
        else goto('/assessment/status', { replaceState: true })
      })
  }

  // ============ 스텝퍼 프리뷰 포맷터 ============
  function fmtAssessment(): string {
    const items = form.selectedAssessmentItems
    const pkgNames = form.selectedPackageIds
      .map((id) => packagesData.find((p) => p.uid === id)?.name)
      .filter(Boolean) as string[]
    if (pkgNames.length > 0) {
      const head = pkgNames[0]
      const extra = items.length
      return extra > 0 ? `${head} 세트 외 ${extra}개` : `${head} 세트`
    }
    if (items.length === 0) return '검사 항목을 선택해주세요'
    return items.length > 1 ? `${items[0]} 외 ${items.length - 1}개` : items[0]
  }
  /**
   * 우측 접수 진행의 이름 미리보기는 **앞 3명까지 적고 나머지를 세운다** —
   * 한 명만 적고 "외 N명"으로 접으면 누가 들어갔는지 확인하려고 좌측 폼으로
   * 되돌아가야 한다. 상담 접수와 같은 규칙.
   */
  const PREVIEW_NAME_MAX = 3

  function joinNamesWithRest(names: string[]): string {
    const head = names.slice(0, PREVIEW_NAME_MAX).join(', ')
    const rest = names.length - PREVIEW_NAME_MAX
    return rest > 0 ? `${head} 외 ${rest}명` : head
  }

  function fmtClients(): string {
    if (form.clientType === 'group') {
      const cnt = form.groupMembers.length
      if (cnt === 0) return `${josa(t('subject'), '을/를')} 선택해주세요`
      const org = form.selectedOrganization?.name
      return org ? `${org} · ${cnt}명` : `${cnt}명`
    }
    if (!form.selectedClients.length)
      return `${josa(t('subject'), '을/를')} 선택해주세요`
    return joinNamesWithRest(form.selectedClients.map((c) => c.name))
  }
  function fmtMembers(): string {
    if (!form.selectedMember.length) return '담당자를 선택해주세요'
    // 대표는 항상 맨 앞 — 3명까지 적을 때도 대표가 잘리지 않는다.
    // 제외는 id로 한다(동명이인이 있으면 이름 비교로는 한 명이 사라진다)
    const primary =
      form.selectedMember.find((m) => m.id === form.primaryMemberId) ??
      form.selectedMember[0]
    const names = [
      `${primary.person?.name ?? ''}(대표)`,
      ...form.selectedMember
        .filter((m) => m.id !== primary.id)
        .map((m) => m.person?.name ?? '')
    ]
    return joinNamesWithRest(names)
  }
  function fmtSchedule(): string {
    if (!form.visitCenter) return '센터 방문 안 함'
    if (!form.selectedDates.length || !form.scheduleStartTime)
      return '일정을 선택해주세요'
    const d = form.selectedDates[0]
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}월 ${d.getDate()}일(${dayNames[d.getDay()]}) · ${form.scheduleStartTime}`
  }

  const scheduleWarning = $derived.by(() => {
    if (!form.visitCenter || !conflictReason) return null
    if (conflictReason === 'room') return '같은 시간 장소 일정이 있어요'
    if (conflictReason === 'member') return '같은 시간 담당자 일정이 있어요'
    return '같은 시간 장소·담당자 일정이 있어요'
  })

  // visitCenter OFF면 장소·일정 스텝을 동적으로 제외
  const steps = $derived<StepItem[]>([
    {
      key: 'assessment',
      field: 'assessment',
      label: '검사 항목',
      done:
        form.selectedAssessmentItems.length > 0 ||
        form.selectedPackageIds.length > 0,
      warning: null,
      preview: fmtAssessment()
    },
    {
      key: 'client',
      field: 'client',
      label: t('subject'),
      done:
        form.clientType === 'group'
          ? form.groupMembers.length > 0
          : form.selectedClients.length > 0,
      warning: null,
      preview: fmtClients(),
      deferAutoAdvance: true
    },
    {
      key: 'counselor',
      field: 'counselor',
      label: '담당자',
      done: form.selectedMember.length > 0,
      warning: null,
      preview: fmtMembers()
    },
    ...(form.visitCenter
      ? [
          {
            key: 'room',
            field: 'room',
            label: '장소',
            done: !!form.selectedRoom,
            warning: null,
            preview: form.selectedRoom?.name ?? '장소를 선택해주세요'
          },
          {
            key: 'schedule',
            field: 'schedule',
            label: '일정',
            done: form.selectedDates.length > 0 && !!form.scheduleStartTime,
            warning: scheduleWarning,
            preview: fmtSchedule()
          }
        ]
      : [])
  ])

  let activeField = $state<string | null>('assessment')
  let flashField = $state<string | null>(null)
  let goToNextUndone = $state<() => void>(() => {})

  // 드롭다운이 닫혀도 다음 단계로 자동 스크롤하지 않는다 —
  // 화면이 제멋대로 튀어 사용자가 위치를 잃는다. 이동은 우측 접수 진행에서 직접 누를 때만.
  function handleClientDropdownClose() {}
</script>

<!-- 엑셀 프리뷰 오버레이 -->
{#if showExcelPreview}
  <ExcelPreviewOverlay
    onDone={() => {
      form.loadGroupMembersFromExcel()
      showExcelPreview = false
    }}
    onClose={() => {
      showExcelPreview = false
    }}
  />
{/if}

<ReceiveStepperLayout
  title={form.isEditCaseMode ? '검사 정보 수정' : '검사 접수'}
  {steps}
  bind:activeField
  bind:flashField
  bind:memo={form.clientMemo}
  memoPlaceholder={`해당 ${t('subject')}에 필요한 메모나 문의내역을 남겨주세요.`}
  submitLabel={form.isEditCaseMode ? '수정' : '등록'}
  canSubmit={form.canSubmitFinal}
  onSubmit={handleConfirm}
  onCancel={() => history.back()}
  bind:goToNextUndone
  form={formContent}
/>

{#snippet formContent()}
  <!-- 행 간격은 gap이 소유한다 — 각 행에 상하 패딩을 주면 여백이 두 군데(행·컨테이너)에서
       생겨 바깥 패딩만으로 조절이 안 된다. 여백은 카드 컨테이너 패딩 + 이 gap 둘뿐. -->
  <div class="flex flex-col gap-8">
    {@render formRow('assessment', '검사 항목')}
    {@render formRow('client', t('subject'))}
    {@render formRow('counselor', '담당자')}
    {@render formRow('schedule-block', '장소 및 일정')}
  </div>
{/snippet}

<!-- 좌측 폼 행: 라벨 + 섹션. 포커스 시 하이라이트(flash). -->
{#snippet formRow(field: string, label: string)}
  <!-- 라벨 위 / 입력 아래 세로 배치(전 해상도 동일). 구분선 없이 여백으로 섹션을 나눈다.
       라벨↔데이터 간격 12(gap-3). 담당자 행만 4 — 바로 아래가 입력이 아니라
       타이틀에 딸린 서브문구라 더 붙인다(§Components>modal 2줄 헤더는 8을 규정하지만
       이 자리는 시안 판단으로 4를 쓴다). 행 자체 패딩 없음 — 바깥 컨테이너와 gap이 여백을 소유. -->
  <div
    class="flex flex-col {field === 'counselor'
      ? 'gap-1'
      : 'gap-3'} {flashField === field ? 'field-flash' : ''}"
    data-field={field}
    onfocusin={() => (activeField = field)}
    onclickcapture={() => (activeField = field)}
  >
    <!-- 라벨 행 — 섹션 토글은 **타이틀과 같은 선**에 선다(선택 섹션 토글 규격).
         폭을 아래 콘텐츠와 같은 772로 묶어야 토글 우측 끝이 입력 우측 끝과 맞는다. -->
    <div
      class="flex min-h-8 w-full max-w-[772px] shrink-0 items-center justify-between gap-3"
    >
      <Typography variant="body-01-normal-medium" color="text-body-default"
        >{label} <span class="field-required">*</span></Typography
      >
      {#if field === 'client' && !form.isEditCaseMode}
        {@render clientTypeToggle()}
      {:else if field === 'schedule-block'}
        {@render visitCenterToggle()}
      {/if}
    </div>
    <!-- 폭 상한 772 = 일정(MultiDateSchedulePicker) 컨테이너 폭.
         모든 항목의 우측 끝을 이 컨테이너에 맞춘다. -->
    <div class="min-w-0 max-w-[772px] flex-1">
      {#if field === 'assessment'}
        <AssessmentSelector
          packages={packagesData}
          {assessmentOptions}
          korNameMap={assessmentKorNameMap}
          selectedPackageIds={form.selectedPackageIds}
          selectedAssessmentItems={form.selectedAssessmentItems}
          excludedAssessmentItems={form.excludedAssessmentItems}
          {assessmentsInSelectedPackages}
          onTogglePackage={(pkg) => form.togglePackage(pkg)}
          onToggleAssessment={(item) =>
            form.toggleAssessmentItem(
              item,
              assessmentsInSelectedPackages,
              packagesData
            )}
          onAddSet={() => receiveService.openAddSetModal()}
          showTitle={false}
        />
        {#if form.validationErrors.assessment}<p
            class="mt-1 field-help is-error"
          >
            {form.validationErrors.assessment}
          </p>{/if}
      {:else if field === 'client'}
        {@render clientSection()}
        {#if form.validationErrors.client}<p class="mt-1 field-help is-error">
            {form.validationErrors.client}
          </p>{/if}
      {:else if field === 'counselor'}
        {@render counselorSection()}
        {#if form.validationErrors.counselor}<p
            class="mt-1 field-help is-error"
          >
            {form.validationErrors.counselor}
          </p>{/if}
      {:else if field === 'schedule-block'}
        {@render scheduleBlock()}
      {/if}
    </div>
  </div>
{/snippet}

<!-- 내담자: 개인(검색) / 단체(엑셀+기관) 분기 -->
<!-- 개인/단체 전환 — 라벨 행 우측에 세운다(formRow) -->
{#snippet clientTypeToggle()}
  <div class="flex shrink-0 items-center gap-2">
    <Typography
      variant="body-02-normal-medium"
      color={form.clientType === 'group'
        ? 'text-action-primary'
        : 'text-body-default'}
    >
      {form.clientType === 'group'
        ? '기관/단체로 접수할래요'
        : '개인으로 접수할래요'}
    </Typography>
    <Switch
      checked={form.clientType === 'group'}
      onclick={() =>
        form.handleTypeChange(
          form.clientType === 'group' ? 'individual' : 'group'
        )}
      ariaLabel="개인/단체 접수 전환"
    />
  </div>
{/snippet}

{#snippet clientSection()}
  {#if form.clientType === 'individual'}
    <!-- 상한은 바깥 래퍼(772)가 소유 — 여기서 따로 좁히면(옛 max-w-xl 576)
         검사 항목·담당자·일정과 우측 끝이 어긋난다. 상담 접수와 동일. -->
    <div class="bg-white">
      <ClientMultiSelect
        label=""
        options={clientsData}
        bind:selected={form.selectedClients}
        placeholder={`${t('subject')} 이름을 검색해주세요`}
        searchInputTextClass="text-body-01-normal-regular"
        readOnly={form.isEditCaseMode}
        showRegisterOption={!form.isEditCaseMode}
        onRegisterClick={handleOpenClientRegisterModal}
        onOpen={() =>
          queryClient.invalidateQueries({
            queryKey: ['getClientList'],
            exact: false
          })}
        onClose={handleClientDropdownClose}
        disableBottomMargin
      />
    </div>
  {:else}
    <!-- 단체 모드: 엑셀 업로드 + 검색 + 기관 -->
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={handleExcelUpload}
          class="text-body-01-normal-medium flex h-12 items-center gap-2 rounded-lg border border-border-default bg-white px-5 text-title-subtitle transition-colors hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect width="20" height="20" rx="3" class="fill-brand-excel" />
            <path
              d="M6 6L10 10M10 10L14 14M10 10L14 6M10 10L6 14"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          엑셀로 {t('subject')} 등록
        </button>
      </div>

      <GroupClientSearchInput
        options={clientsData}
        selectedIds={groupSelectedIds}
        onOpen={() =>
          queryClient.invalidateQueries({
            queryKey: ['getClientList'],
            exact: false
          })}
        onToggle={(item, isSelected) => {
          if (isSelected) {
            form.removeGroupMember(item.id)
          } else {
            form.addGroupMembers([
              {
                id: item.id,
                name: item.name,
                birthDate: item.birth_date ?? '',
                gender:
                  item.gender === '여자' || item.gender === 'female'
                    ? 'female'
                    : 'male',
                guardianPhone: item.phone ?? ''
              }
            ])
          }
        }}
      />

      {#if form.groupMembers.length > 0}
        <div>
          <div class="mb-2 flex items-center justify-between">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
            >
              총 {form.groupMembers.length}명
            </Typography>
          </div>
          <div
            class="max-h-48 overflow-y-auto rounded-lg border border-gray-200"
          >
            {#each form.groupMembers as member (member.id)}
              <div
                class="flex items-center justify-between border-b border-border-subtle px-4 py-3 last:border-b-0"
              >
                <div
                  class="flex items-center gap-x-2 text-body-02-normal-regular"
                >
                  <span
                    class="shrink-0 text-body-02-normal-medium text-body-strong"
                    >{member.name}</span
                  >
                  <ClientBirthGender
                    birthDate={member.birthDate}
                    gender={member.gender}
                  />
                </div>
                <Tooltip text="삭제">
                  <button
                    type="button"
                    onclick={() => form.removeGroupMember(member.id)}
                    class="p-1 text-icon-tertiary transition-colors hover:text-caption-default"
                    aria-label="삭제"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M15 5L5 15M5 5L15 15"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-body-default"
          className="mb-2"
        >
          기관/단체
        </Typography>
        <OrganizationSearchDropdown
          selectedOrganization={form.selectedOrganization}
          onOrganizationSelect={form.handleOrganizationSelect}
          onRegisterSubmit={handleOrganizationRegister}
          onClear={form.handleClearOrganization}
        />
      </div>
    </div>
  {/if}
{/snippet}

<!-- 담당자: 빈 상태 / 칩 멀티선택 (대표 지정) -->
{#snippet counselorSection()}
  {#if membersEmpty}
    <div class="flex flex-col items-center gap-2 rounded-lg bg-gray-50 py-8">
      <Typography variant="body-02-normal-regular" color="text-title-subtitle">
        등록된 담당자가 없어요
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-caption-subtle">
        검사를 진행할 담당자를 먼저 추가해주세요
      </Typography>
      <a
        href="/member/invite?returnTo={encodeURIComponent(RECEIVE_RETURN_TO)}"
        class="mt-1 flex items-center gap-2 text-body-02-normal-medium text-action-primary hover:text-action-primary-hover"
      >
        <PlusIcon20 />
        추가
      </a>
    </div>
  {:else}
    <!-- 타이틀 아래 서브문구 — 다른 섹션과 같은 규격(Body_02/Regular 15 ·
         text-body-subtle). 14/Reading은 라인박스가 커서 같은 gap-2(8)인데도
         타이틀과의 간격이 다른 섹션보다 벌어져 보였다. -->
    <Typography
      variant="body-02-normal-regular"
      color="text-body-subtle"
      className="mb-4 block"
    >
      처음 선택한 담당자가 대표 검사자로 지정돼요. 왕관 아이콘을 눌러 대표
      검사자를 변경할 수 있어요.
    </Typography>
    <div class="flex flex-wrap gap-2">
      {#each memberOptions as option}
        {@const value = typeof option === 'string' ? option : option.value}
        {@const label = typeof option === 'string' ? option : option.label}
        {@const isSelected = form.selectedMember.some((m) => m.id === value)}
        {@const isPrimary = form.primaryMemberId === value}
        <MemberChip
          name={label}
          selected={isSelected && !isPrimary}
          primary={isPrimary}
          onclick={() => handleMemberSelect(value)}
          oncrownclick={() => handleSetPrimary(value)}
          primaryLabel="대표(주 검사자)"
          selectedLabel="보조 검사자"
        />
      {/each}
    </div>
  {/if}
{/snippet}

<!-- 장소 및 일정: 센터 방문 토글 → ON이면 장소+일정, OFF면 안내 -->
<!-- 센터 방문 전환 — 라벨 행 우측에 세운다(formRow) -->
{#snippet visitCenterToggle()}
  <div class="flex shrink-0 items-center gap-2">
    <Typography
      variant="body-02-normal-medium"
      color={form.visitCenter ? 'text-action-primary' : 'text-body-default'}
    >
      {form.visitCenter ? '센터에 방문해요' : '센터에 방문하지 않아요'}
    </Typography>
    <Switch bind:checked={form.visitCenter} ariaLabel="센터 방문 여부" />
  </div>
{/snippet}

{#snippet scheduleBlock()}
  {#if form.visitCenter}
    <div class="space-y-5">
      <!-- 장소 -->
      <div data-field="room">
        <Typography
          variant="body-01-normal-medium"
          color="text-body-default"
          className="mb-2"
        >
          장소 <span class="field-required">*</span>
        </Typography>
        {#if roomsEmpty}
          <div
            class="flex flex-col items-center gap-2 rounded-lg bg-gray-50 py-8"
          >
            <Typography
              variant="body-02-normal-regular"
              color="text-title-subtitle"
            >
              등록된 상담실이 없어요
            </Typography>
            <Typography
              variant="body-02-normal-regular"
              color="text-caption-subtle"
            >
              검사에 사용될 상담실을 먼저 추가해주세요
            </Typography>
            <button
              type="button"
              onclick={handleRoomAdd}
              class="mt-1 flex items-center gap-2 text-body-02-normal-medium text-action-primary hover:text-action-primary-hover"
            >
              <PlusIcon20 />
              추가
            </button>
          </div>
        {:else}
          <SelectableButtonGroup
            label="상담실"
            showLabel={false}
            options={roomOptions}
            selected={form.selectedRoom?.id ?? ''}
            onSelect={handleRoomSelect}
            addButtonLabel="추가"
            onAdd={handleRoomAdd}
          />
        {/if}
      </div>
      <!-- 일정 -->
      <div data-field="schedule">
        <Typography
          variant="body-01-normal-medium"
          color="text-body-default"
          className="mb-2"
        >
          일정 <span class="field-required">*</span>
        </Typography>
        <MultiDateSchedulePicker
          bind:selectedDates={form.selectedDates}
          bind:startTime={form.scheduleStartTime}
          bind:endTime={form.scheduleEndTime}
          bind:conflictRoomName
          bind:conflictReason
          {operatingTimes}
          centerId={$centerId}
          roomId={form.selectedRoom?.id}
          memberId={form.selectedMember[0]?.id ?? null}
          showTitle={false}
          singleDate={true}
          calendarSize="page"
        />
      </div>
    </div>
  {:else}
    <!-- 일정 없이 등록 시 가이드 안내 -->
    <div class="rounded-xl bg-gray-50 p-4">
      <!-- 타이틀 + 서브문구 — §Typography Title system: 서브는 Body_02/Regular(15) ·
           text-body-subtle, 타이틀↔서브 간격 8(4는 붙어 보이고 12는 남남으로 벌어진다) -->
      <div class="flex flex-col justify-center gap-2">
        <div class="flex items-center gap-2">
          <InfoCircleIcon20 />
          <Typography variant="body-02-normal-medium" color="text-body-default">
            일정 없이 접수할게요
          </Typography>
        </div>
        <Typography variant="body-02-normal-regular" color="text-body-subtle">
          접수 후 검사 상세 페이지에서 일정을 등록할 수 있어요.
        </Typography>
      </div>
    </div>
  {/if}
{/snippet}
