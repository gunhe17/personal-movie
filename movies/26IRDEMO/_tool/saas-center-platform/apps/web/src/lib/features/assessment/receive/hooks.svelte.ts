/**
 * Assessment Receive Hooks
 * 검사 접수 폼 상태 관리 (Svelte 5 Runes)
 */

import { tick } from 'svelte'
import { goto } from '$app/navigation'
import {
  receiveFormStore,
  type ExtendedClient,
  type GroupMember
} from '$lib/stores/receiveForm'
import { excelUploadStore } from '$lib/stores/excelUpload'
import { snackbarStore } from '$lib/stores/snackbar'
import type { Client } from '$lib/types/client'
import type { Organization } from '$lib/types/organization'
import type { PackageType } from '$lib/hooks/actions/package.action'
import type { ClientType, ReportStatus } from './constants'
import { MORNING_TIMES, AFTERNOON_TIMES } from './constants'
import type { RoomItemType } from '$lib/hooks/actions/room.action'
import type { MemberListItem as MemberItem } from '$lib/hooks/actions/member.action'
import type { CaseDetail } from '$lib/hooks/actions/case.action'
import { parseDateParam, nextHalfHourSlot } from '$lib/utils/date'

export function useReceiveForm() {
  function getReceiveBasePath(url?: URL): string {
    const pathname =
      url?.pathname ||
      (typeof window !== 'undefined'
        ? window.location.pathname
        : '/assessment/receive')
    return pathname.startsWith('/assessment-flow/receive')
      ? '/assessment-flow/receive'
      : '/assessment/receive'
  }

  // ============ 기본 상태 ============
  let clientType = $state<ClientType>('individual')
  let isSidePanelOpen = $state(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  )

  // 화면 크기 변경 시 패널 자동 닫기/열기
  if (typeof window !== 'undefined') {
    const mql = window.matchMedia('(min-width: 1024px)')
    mql.addEventListener('change', (e) => {
      isSidePanelOpen = e.matches
    })
  }
  let sendNotification = $state(false)
  let clientMemo = $state('')

  // ============ 개인 내담자 상태 ============
  let searchQuery = $state('')
  /** 선택된 내담자 (ClientMultiSelect와 바인딩, 개인 모드에서는 1명) */
  let selectedClients = $state<ExtendedClient[]>([])
  let isNewlyCreatedClient = $state(false)
  let isDropdownOpen = $state(false)
  let isRegisterFormOpen = $state(false)

  // ============ 단체(기관) 상태 ============
  let groupSearchQuery = $state('')
  let selectedOrganization = $state<Organization | null>(null)
  let isGroupDropdownOpen = $state(false)
  let isGroupRegisterFormOpen = $state(false)
  let isOrganizationEditMode = $state(false)
  let groupMembers = $state<GroupMember[]>([])

  // ============ 검사 항목 상태 ============
  let selectedAssessmentItems = $state<string[]>([])
  let selectedPackageIds = $state<string[]>([])
  let excludedAssessmentItems = $state<string[]>([])
  let comprehensiveReport = $state<ReportStatus>('미작성')

  // ============ 일정 상태 (기본: 오늘만, 시간은 미선택) ============
  let selectedDate = $state<Date | null>(new Date())
  let selectedTime = $state<string | null>(null)
  let selectedRoom = $state<RoomItemType | null>(null)
  let urlRoomId = $state<string | null>(null)
  let selectedMember = $state<MemberItem[]>([])
  let primaryMemberId = $state<string | null>(null)

  // ============ 시간 옵션 (readonly) ============
  const morningTimes = MORNING_TIMES
  const afternoonTimes = AFTERNOON_TIMES

  // ============ 기관 수정 데이터 (파생) ============
  const organizationEditData = $derived(
    selectedOrganization
      ? {
          name: selectedOrganization.name,
          address: selectedOrganization.address || '',
          phone: selectedOrganization.phone || ''
        }
      : undefined
  )

  // ============ 필드별 인라인 유효성 검증 ============
  let validationErrors = $state<Record<string, string>>({})

  function validate(): boolean {
    const errors: Record<string, string> = {}

    if (clientType === 'individual' && selectedClients.length === 0) {
      errors.client = '내담자를 선택해주세요'
    }
    if (clientType === 'group' && groupMembers.length === 0) {
      errors.client = '내담자를 등록해주세요'
    }

    if (
      selectedAssessmentItems.length === 0 &&
      selectedPackageIds.length === 0
    ) {
      errors.assessment = '검사 항목을 선택해주세요'
    }

    if (selectedMember.length === 0) {
      errors.counselor = '담당자를 선택해주세요'
    }

    if (visitCenter) {
      if (!selectedRoom) {
        errors.room = '장소를 선택해주세요'
      }
      if (selectedDates.length === 0 || !scheduleStartTime) {
        errors.schedule = '일정을 선택해주세요'
      }
    }

    validationErrors = errors

    // 첫 번째 에러 필드로 스크롤
    if (Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0]
      tick().then(() => {
        const el = document.querySelector(`[data-field="${firstErrorField}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }

    return Object.keys(errors).length === 0
  }

  function clearValidationError(field: string) {
    if (validationErrors[field]) {
      const { [field]: _, ...rest } = validationErrors
      validationErrors = rest
    }
  }

  // 필드값 변경 시 해당 에러 자동 클리어
  $effect(() => {
    if (selectedClients.length > 0 || groupMembers.length > 0)
      clearValidationError('client')
  })
  $effect(() => {
    if (selectedAssessmentItems.length > 0 || selectedPackageIds.length > 0)
      clearValidationError('assessment')
  })
  $effect(() => {
    if (selectedMember.length > 0) clearValidationError('counselor')
  })
  $effect(() => {
    if (selectedRoom) clearValidationError('room')
  })
  $effect(() => {
    if (selectedDates.length > 0 && scheduleStartTime)
      clearValidationError('schedule')
  })

  // ============ 접수 버튼 활성화 조건 ============
  const commonConditions = $derived(
    (selectedAssessmentItems.length > 0 || selectedPackageIds.length > 0) &&
      selectedMember.length > 0
  )

  const canSubmit = $derived(
    clientType === 'individual'
      ? selectedClients.length > 0 && commonConditions
      : groupMembers.length > 0 && commonConditions
  )

  // ============ 편집 모드 상태 ============
  let editCaseId = $state('')
  let caseDetailForEdit = $state<CaseDetail | null>(null)
  let editCasePreFilled = $state(false)
  const isEditCaseMode = $derived(!!editCaseId)
  /** 이미 요청을 보낸 editCaseId (반응형 아님 → effect 재실행 유발 안 함, 중복 요청 방지) */
  let fetchAttemptedForEditCaseId: string | null = null

  // ============ 센터 방문 & 멀티 날짜 일정 상태 ============
  let visitCenter = $state(false)
  let selectedDates = $state<Date[]>([])
  let scheduleStartTime = $state('10:00')
  let scheduleEndTime = $state('11:00')
  let defaultTimeApplied = false
  let prevVisitCenter = $state(false)
  /** URL 파라미터로 visitCenter가 초기화된 경우 첫 스크롤 건너뛰기 */
  let skipInitialScroll = $state(false)

  // ============ 엑셀 오버레이 상태 ============
  let showExcelOverlay = $state(false)
  let isGroupExcelDragging = $state(false)

  // ============ 파생값 ============
  const summaryDate = $derived(
    selectedDates.length > 0 ? selectedDates[0] : (selectedDate ?? null)
  )
  const summaryTime = $derived(
    visitCenter ? scheduleStartTime : (selectedTime ?? null)
  )
  const canSubmitFinal = $derived(
    canSubmit &&
      (!visitCenter ||
        (selectedDates.length > 0 && !!scheduleStartTime && !!selectedRoom))
  )

  // 센터 방문 ON 시 검사 일정 영역으로 스크롤
  function scrollToSchedule(ref: HTMLDivElement | null) {
    if (visitCenter && !prevVisitCenter) {
      prevVisitCenter = true
      if (skipInitialScroll) {
        skipInitialScroll = false
        return
      }
      tick().then(() => {
        ref?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else if (!visitCenter) {
      prevVisitCenter = false
    }
  }

  // ============ 편집 모드 상태 관리 ============
  function setEditCaseIdFromUrl(id: string) {
    editCaseId = id
    if (!id) {
      caseDetailForEdit = null
      fetchAttemptedForEditCaseId = null
    }
  }

  function shouldFetchCaseForEdit(centerId: string | null): boolean {
    if (!editCaseId || !centerId) return false
    if (fetchAttemptedForEditCaseId === editCaseId) return false
    fetchAttemptedForEditCaseId = editCaseId
    return true
  }

  function setCaseDetailForEdit(detail: CaseDetail | null) {
    caseDetailForEdit = detail
  }

  // ============ 토글 함수들 ============
  function toggleAssessmentItem(
    item: string,
    assessmentsInSelectedPackages: string[] = [],
    packagesData: PackageType[] = []
  ) {
    const isInSelectedPackage = assessmentsInSelectedPackages.includes(item)

    if (isInSelectedPackage) {
      if (excludedAssessmentItems.includes(item)) {
        excludedAssessmentItems = excludedAssessmentItems.filter(
          (i) => i !== item
        )
      } else {
        excludedAssessmentItems = [...excludedAssessmentItems, item]
      }

      // 세트의 모든 검사가 제외되면 세트 자체를 해제
      if (packagesData.length > 0) {
        const packagesToRemove: string[] = []
        for (const pkgId of selectedPackageIds) {
          const pkg = packagesData.find((p) => p.uid === pkgId)
          if (!pkg?.assessments?.length) continue
          const pkgAssessmentNames = pkg.assessments.map(
            (a) => a.eng_name || a.kor_name
          )
          const allExcluded = pkgAssessmentNames.every((name) =>
            excludedAssessmentItems.includes(name)
          )
          if (allExcluded) packagesToRemove.push(pkgId)
        }
        if (packagesToRemove.length > 0) {
          selectedPackageIds = selectedPackageIds.filter(
            (id) => !packagesToRemove.includes(id)
          )
          // 해제된 세트의 제외 항목도 정리
          const removedAssessments = packagesToRemove.flatMap((pkgId) => {
            const pkg = packagesData.find((p) => p.uid === pkgId)
            return pkg?.assessments?.map((a) => a.eng_name || a.kor_name) ?? []
          })
          excludedAssessmentItems = excludedAssessmentItems.filter(
            (i) => !removedAssessments.includes(i)
          )
        }
      }
      return
    }

    if (selectedAssessmentItems.includes(item)) {
      selectedAssessmentItems = selectedAssessmentItems.filter(
        (i) => i !== item
      )
    } else {
      selectedAssessmentItems = [...selectedAssessmentItems, item]
    }
  }

  function togglePackage(pkg: PackageType) {
    if (selectedPackageIds.includes(pkg.uid)) {
      selectedPackageIds = []
    } else {
      selectedPackageIds = [pkg.uid]
    }
  }

  function toggleMember(member: MemberItem) {
    if (selectedMember.find((m) => m.id === member.id)) {
      const next = selectedMember.filter((s) => s.id !== member.id)
      selectedMember = next
      // 대표가 해제되면 첫 번째 멤버로 재지정
      if (primaryMemberId === member.id) {
        primaryMemberId = next[0]?.id ?? null
      }
    } else {
      selectedMember = [...selectedMember, member]
      // 첫 선택 시 자동 대표 지정
      if (primaryMemberId === null) {
        primaryMemberId = member.id
      }
    }
  }

  function setPrimaryMember(member: MemberItem) {
    if (selectedMember.find((m) => m.id === member.id)) {
      primaryMemberId = primaryMemberId === member.id ? null : member.id
    }
  }

  // ============ 내담자 선택/해제 ============
  function handleClientSelect(client: Client) {
    selectedClients = [client as ExtendedClient]
    searchQuery = ''
    isDropdownOpen = false
    isRegisterFormOpen = false
  }

  function handleClientCreated(client: ExtendedClient) {
    selectedClients = [client]
    isNewlyCreatedClient = true
    isDropdownOpen = false
    isRegisterFormOpen = false
    snackbarStore.success('새로운 내담자가 추가되었어요.')
  }

  function handleClearClient() {
    selectedClients = []
    searchQuery = ''
    isNewlyCreatedClient = false
  }

  function handleInputChange() {
    selectedClients = []
    isDropdownOpen = true
  }

  // ============ 기관 선택/해제 ============
  function handleOrganizationSelect(org: Organization) {
    selectedOrganization = org
    isGroupDropdownOpen = false
    isGroupRegisterFormOpen = false
  }

  function handleOrganizationCreated(org: Organization) {
    selectedOrganization = org
    isGroupDropdownOpen = false
    isGroupRegisterFormOpen = false
    snackbarStore.success('새로운 기관이 추가되었어요.')
  }

  function handleClearOrganization() {
    selectedOrganization = null
    groupSearchQuery = ''
    isOrganizationEditMode = false
  }

  function handleGroupInputChange() {
    selectedOrganization = null
    isGroupDropdownOpen = true
  }

  // ============ 그룹 멤버 관리 ============
  function loadGroupMembersFromExcel() {
    const unsubscribe = excelUploadStore.subscribe((state) => {
      if (state.clients.length > 0) {
        groupMembers = state.clients.map((client) => ({
          id: client.id,
          name: client.name,
          birthDate: client.birthDate,
          gender: client.gender,
          guardianPhone: client.guardianPhone
        }))
        excelUploadStore.clear()
      }
    })
    unsubscribe()
  }

  function removeGroupMember(id: string) {
    groupMembers = groupMembers.filter((m) => m.id !== id)
  }

  function clearGroupMembers() {
    groupMembers = []
  }

  function addGroupMembers(members: GroupMember[]) {
    groupMembers = [...groupMembers, ...members]
  }

  // ============ 타입 전환 ============
  function handleTypeChange(newType: ClientType) {
    if (newType !== clientType) {
      // 개인 폼 초기화
      searchQuery = ''
      selectedClients = []
      isNewlyCreatedClient = false
      isDropdownOpen = false
      isRegisterFormOpen = false

      // 단체 폼 초기화
      groupSearchQuery = ''
      selectedOrganization = null
      isGroupDropdownOpen = false
      isGroupRegisterFormOpen = false
      groupMembers = []

      // 공통 상태 초기화
      selectedAssessmentItems = []
      selectedPackageIds = []
      excludedAssessmentItems = []
      comprehensiveReport = '미작성'
      selectedDate = null
      selectedTime = null
      selectedRoom = null
      selectedMember = []

      clientType = newType
    }
  }

  // ============ 폼 상태 빌드 ============
  function buildFormState() {
    return {
      clientType,
      searchQuery,
      selectedClient: selectedClients[0] ?? null,
      selectedClients,
      groupSearchQuery,
      selectedOrganization,
      groupMembers,
      selectedPackageIds,
      selectedAssessmentItems,
      excludedAssessmentItems,
      selectedDate,
      selectedTime,
      selectedRoom,
      selectedMember,
      sendNotification,
      clientMemo
    }
  }

  // ============ 폼 상태 복원 (엑셀에서 돌아올 때) ============
  function restoreFormState() {
    const formState = receiveFormStore.get()

    clientType = formState.clientType
    searchQuery = formState.searchQuery
    selectedClients =
      Array.isArray(formState.selectedClients) &&
      formState.selectedClients.length > 0
        ? [...formState.selectedClients]
        : formState.selectedClient
          ? [formState.selectedClient]
          : []
    groupSearchQuery = formState.groupSearchQuery
    selectedOrganization = formState.selectedOrganization
    groupMembers = [...formState.groupMembers]
    selectedPackageIds = [...(formState.selectedPackageIds || [])]
    selectedAssessmentItems = [...formState.selectedAssessmentItems]
    excludedAssessmentItems = [...(formState.excludedAssessmentItems || [])]
    selectedDate = formState.selectedDate
    selectedTime = formState.startTime ?? null
    selectedRoom = formState.selectedRoom
    selectedMember = [...formState.selectedMember]
    sendNotification = formState.sendNotification
    clientMemo = formState.clientMemo
  }

  // ============ URL 파라미터 초기화 ============
  function initFromUrl(url: URL) {
    const receiveBasePath = getReceiveBasePath(url)
    const fromParam = url.searchParams.get('from')
    const typeParam = url.searchParams.get('type')
    const fromExcel = fromParam === 'excel'
    const fromExcelChange = fromParam === 'excel-change'

    // 엑셀 프리뷰에서 돌아온 경우: 폼 복원 먼저 (수정 후 취소 시 groupMembers 유지)
    if (fromExcel || fromExcelChange) {
      restoreFormState()

      if (fromExcel) {
        const unsubscribe = excelUploadStore.subscribe((state) => {
          if (state.clients.length > 0) {
            const newMembers: GroupMember[] = state.clients.map((client) => ({
              id: client.id,
              name: client.name,
              birthDate: client.birthDate,
              gender: client.gender,
              guardianPhone: client.guardianPhone
            }))
            groupMembers = newMembers
            snackbarStore.success('내담자 목록을 추가했어요!')
            excelUploadStore.clear()
          }
        })
        unsubscribe()
      }

      const targetUrl =
        typeParam === 'group'
          ? `${receiveBasePath}?type=group`
          : receiveBasePath
      goto(targetUrl, { replaceState: true })
      return
    }

    // type=group이면 단체 모드로 시작 (URL 유지 → 새로고침 시에도 단체 유지)
    if (typeParam === 'group') {
      clientType = 'group'
    }

    // date/time/room/editCase/visitCenter 파라미터 처리
    const editCase = url.searchParams.get('editCase')
    const dateParam = url.searchParams.get('date')
    const timeParam = url.searchParams.get('time')
    const roomIdParam = url.searchParams.get('room_id')
    if (roomIdParam) urlRoomId = roomIdParam

    if (editCase) {
      editCaseId = editCase
      // 편집 모드: date/time은 케이스 로드 후 $effect에서 채움. 여기서 덮어쓰지 않음.
      if (dateParam) {
        const date = parseDateParam(dateParam)
        if (!isNaN(date.getTime())) {
          selectedDate = date
          selectedDates = [date]
        }
      }
      if (timeParam) {
        selectedTime = timeParam
        scheduleStartTime = timeParam
        const [h, m] = timeParam.split(':').map(Number)
        const end = new Date()
        end.setHours(h + 2, m, 0, 0)
        scheduleEndTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      }
    } else {
      if (dateParam || timeParam || roomIdParam) {
        skipInitialScroll = true
        visitCenter = true
      }
      if (dateParam) {
        const date = parseDateParam(dateParam)
        if (!isNaN(date.getTime())) {
          selectedDate = date
          selectedDates = [date]
        }
      } else {
        selectedDate = new Date()
      }
      if (timeParam) {
        selectedTime = timeParam
        scheduleStartTime = timeParam
        const [h, m] = timeParam.split(':').map(Number)
        const end = new Date()
        end.setHours(h + 2, m, 0, 0)
        scheduleEndTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      } else {
        selectedTime = null
      }
    }
  }

  // 하위 호환성을 위한 alias
  const initFromExcel = initFromUrl

  // ============ 세트에 포함된 검사 (파생) ============
  function getAssessmentsInPackages(packagesData: PackageType[]) {
    const names: string[] = []
    selectedPackageIds.forEach((pkgId) => {
      const pkg = packagesData.find((p) => p.uid === pkgId)
      if (pkg?.assessments) {
        pkg.assessments.forEach((a) => {
          const name = a.eng_name || a.kor_name
          if (!names.includes(name)) {
            names.push(name)
          }
        })
      }
    })
    return names
  }

  // ============ 검사 이름으로 UID 변환 ============
  function getAssessmentUids(
    assessmentsData: {
      eng_name: string
      kor_name: string
      uid?: string
      assessment_id?: string
      assessment_uid?: string
      id?: string
    }[],
    packagesData: PackageType[]
  ) {
    const uids = new Set<string>()

    // 개별 선택된 검사 UID (영어/한국어 이름 모두 검색)
    selectedAssessmentItems.forEach((name) => {
      const assessment = assessmentsData.find(
        (a) => a.eng_name === name || a.kor_name === name
      )
      const uid =
        assessment?.uid ||
        assessment?.assessment_id ||
        assessment?.assessment_uid ||
        assessment?.id
      if (uid) uids.add(uid)
    })

    // 세트에 포함된 검사 UID
    selectedPackageIds.forEach((pkgId) => {
      const pkg = packagesData.find((p) => p.uid === pkgId)
      pkg?.assessments?.forEach((a) => {
        if (a.uid) uids.add(a.uid)
      })
    })

    return Array.from(uids)
  }

  return {
    // 상태 (getters)
    get clientType() {
      return clientType
    },
    get isSidePanelOpen() {
      return isSidePanelOpen
    },
    get sendNotification() {
      return sendNotification
    },
    get clientMemo() {
      return clientMemo
    },
    get searchQuery() {
      return searchQuery
    },
    get selectedClients() {
      return selectedClients
    },
    get selectedClient() {
      return selectedClients[0] ?? null
    },
    get isNewlyCreatedClient() {
      return isNewlyCreatedClient
    },
    get isDropdownOpen() {
      return isDropdownOpen
    },
    get isRegisterFormOpen() {
      return isRegisterFormOpen
    },
    get groupSearchQuery() {
      return groupSearchQuery
    },
    get selectedOrganization() {
      return selectedOrganization
    },
    get isGroupDropdownOpen() {
      return isGroupDropdownOpen
    },
    get isGroupRegisterFormOpen() {
      return isGroupRegisterFormOpen
    },
    get isOrganizationEditMode() {
      return isOrganizationEditMode
    },
    get groupMembers() {
      return groupMembers
    },
    get selectedAssessmentItems() {
      return selectedAssessmentItems
    },
    get selectedPackageIds() {
      return selectedPackageIds
    },
    get excludedAssessmentItems() {
      return excludedAssessmentItems
    },
    get comprehensiveReport() {
      return comprehensiveReport
    },
    get selectedDate() {
      return selectedDate
    },
    get selectedTime() {
      return selectedTime
    },
    get selectedRoom() {
      return selectedRoom
    },
    get urlRoomId() {
      return urlRoomId
    },
    get selectedMember() {
      return selectedMember
    },
    get primaryMemberId() {
      return primaryMemberId
    },
    get organizationEditData() {
      return organizationEditData
    },
    get canSubmit() {
      return canSubmit
    },
    get editCaseId() {
      return editCaseId
    },
    get caseDetailForEdit() {
      return caseDetailForEdit
    },
    get editCasePreFilled() {
      return editCasePreFilled
    },
    get isEditCaseMode() {
      return isEditCaseMode
    },
    get visitCenter() {
      return visitCenter
    },
    get selectedDates() {
      return selectedDates
    },
    get scheduleStartTime() {
      return scheduleStartTime
    },
    get scheduleEndTime() {
      return scheduleEndTime
    },
    get showExcelOverlay() {
      return showExcelOverlay
    },
    get isGroupExcelDragging() {
      return isGroupExcelDragging
    },
    get summaryDate() {
      return summaryDate
    },
    get summaryTime() {
      return summaryTime
    },
    get canSubmitFinal() {
      return canSubmitFinal
    },
    get validationErrors() {
      return validationErrors
    },
    morningTimes,
    afternoonTimes,

    // 상태 (setters)
    set clientType(v: ClientType) {
      clientType = v
    },
    set isSidePanelOpen(v: boolean) {
      isSidePanelOpen = v
    },
    set sendNotification(v: boolean) {
      sendNotification = v
    },
    set clientMemo(v: string) {
      clientMemo = v
    },
    set searchQuery(v: string) {
      searchQuery = v
    },
    set selectedClients(v: ExtendedClient[]) {
      selectedClients = v
    },
    set selectedClient(v: ExtendedClient | null) {
      selectedClients = v ? [v] : []
    },
    set isDropdownOpen(v: boolean) {
      isDropdownOpen = v
    },
    set isRegisterFormOpen(v: boolean) {
      isRegisterFormOpen = v
    },
    set groupSearchQuery(v: string) {
      groupSearchQuery = v
    },
    set selectedOrganization(v: Organization | null) {
      selectedOrganization = v
    },
    set isGroupDropdownOpen(v: boolean) {
      isGroupDropdownOpen = v
    },
    set isGroupRegisterFormOpen(v: boolean) {
      isGroupRegisterFormOpen = v
    },
    set isOrganizationEditMode(v: boolean) {
      isOrganizationEditMode = v
    },
    set groupMembers(v: GroupMember[]) {
      groupMembers = v
    },
    set selectedAssessmentItems(v: string[]) {
      selectedAssessmentItems = v
    },
    set selectedPackageIds(v: string[]) {
      selectedPackageIds = v
    },
    set excludedAssessmentItems(v: string[]) {
      excludedAssessmentItems = v
    },
    set comprehensiveReport(v: ReportStatus) {
      comprehensiveReport = v
    },
    set selectedDate(v: Date | null) {
      selectedDate = v
    },
    set selectedTime(v: string | null) {
      selectedTime = v
    },
    set selectedRoom(v: RoomItemType | null) {
      selectedRoom = v
    },
    set selectedMember(v: MemberItem[]) {
      selectedMember = v
      if (!primaryMemberId || !v.find((m) => m.id === primaryMemberId)) {
        primaryMemberId = v[0]?.id ?? null
      }
    },
    set primaryMemberId(v: string | null) {
      primaryMemberId = v
    },
    set editCasePreFilled(v: boolean) {
      editCasePreFilled = v
    },
    set visitCenter(v: boolean) {
      visitCenter = v
    },
    set selectedDates(v: Date[]) {
      selectedDates = v
    },
    set scheduleStartTime(v: string) {
      scheduleStartTime = v
    },
    set scheduleEndTime(v: string) {
      scheduleEndTime = v
    },
    set showExcelOverlay(v: boolean) {
      showExcelOverlay = v
    },
    set isGroupExcelDragging(v: boolean) {
      isGroupExcelDragging = v
    },

    // 메서드
    validate,
    clearValidationError,
    toggleAssessmentItem,
    togglePackage,
    toggleMember,
    setPrimaryMember,
    handleClientSelect,
    handleClientCreated,
    handleClearClient,
    handleInputChange,
    handleOrganizationSelect,
    handleOrganizationCreated,
    handleClearOrganization,
    handleGroupInputChange,
    loadGroupMembersFromExcel,
    removeGroupMember,
    clearGroupMembers,
    addGroupMembers,
    handleTypeChange,
    buildFormState,
    restoreFormState,
    initFromExcel,
    getAssessmentsInPackages,
    getAssessmentUids,
    scrollToSchedule,
    setEditCaseIdFromUrl,
    shouldFetchCaseForEdit,
    setCaseDetailForEdit,
    /** 운영시간 기반 기본 시간 적용 (URL time 파라미터 없고 편집 모드가 아닐 때만) */
    applyDefaultTimes(
      operatingTimes: { weekday: string; open_time: string | null }[]
    ) {
      if (defaultTimeApplied) return
      // URL time 파라미터가 있었거나 편집 모드면 스킵
      if (selectedTime || isEditCaseMode) return
      if (!operatingTimes.length) return
      defaultTimeApplied = true
      const todayWeekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
        new Date().getDay()
      ]
      const todayOp = operatingTimes.find(
        (t) => t.weekday === todayWeekday && t.open_time
      )
      const firstOp = operatingTimes.find((t) => t.open_time)
      const op = todayOp ?? firstOp
      if (!op?.open_time) return
      const openTime = op.open_time.slice(0, 5)
      // 운영 시작시간이 이미 지났으면(오늘 접수) 현재 이후 가장 가까운 정시/30분
      const nextSlot = nextHalfHourSlot()
      const startTime = nextSlot > openTime ? nextSlot : openTime
      const [h, m] = startTime.split(':').map(Number)
      const endDate = new Date()
      endDate.setHours(h + 2, m, 0, 0)
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
      scheduleStartTime = startTime
      scheduleEndTime = endTime
    }
  }
}
