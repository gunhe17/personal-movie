/**
 * Schedule Counsel Hooks
 * 상담 일정 접수 폼 상태 관리 (Svelte 5 Runes)
 */

import { goto } from '$app/navigation'
import {
  receiveFormStore,
  type ExtendedClient,
  type GroupMember
} from '$lib/stores/receiveForm'
import { excelUploadStore } from '$lib/stores/excelUpload'
import { snackbarStore } from '$lib/stores/snackbar'
import { tick } from 'svelte'
import type { Client } from '$lib/types/client'
import type { Organization } from '$lib/types/organization'
import type { ClientType } from './constants'
import type { RoomItemType } from '$root/src/lib/hooks/actions/room.action'
import type {
  ProgramListItem,
  ProgramType
} from '$root/src/lib/hooks/actions/program.action'
import type { MemberListItem } from '$root/src/lib/hooks/actions/member.action'

// 내담자 등록 폼 데이터 타입
export interface ClientRegisterData {
  name: string
  birthDate: string
  gender: 'male' | 'female'
  guardianPhone: string
  organization: string
  guardianName: string
  guardianRelationship: string
  guardianEmail: string
  address: string
}

// 기관 등록 폼 데이터 타입
export interface OrganizationRegisterData {
  name: string
  address: string
  phone: string
}

export function useCounselForm() {
  // ============ 기본 상태 ============
  let clientType = $state<ClientType>('individual')
  let isSidePanelOpen = $state(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)

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
  let selectedClients = $state<ExtendedClient[]>([])
  let isDropdownOpen = $state(false)
  let isRegisterFormOpen = $state(false)

  // ============ 단체(기관) 상태 ============
  let groupSearchQuery = $state('')
  let selectedOrganization = $state<Organization | null>(null)
  let isGroupDropdownOpen = $state(false)
  let isGroupRegisterFormOpen = $state(false)
  let isOrganizationEditMode = $state(false)
  let groupMembers = $state<GroupMember[]>([])

  // ============ 상담 항목 상태 ============
  let selectedProgram = $state<ProgramListItem | null>(null)
  let selectedProgramType = $state<ProgramType | null>(null)

  // ============ 일정 상태 (멀티 날짜) ============
  let selectedDates = $state<Date[]>([])
  let startTime = $state<string | null>(null)
  let endTime = $state<string | null>(null)
  let selectedRoom = $state<RoomItemType | null>(null)
  let selectedMember = $state<MemberListItem[]>([])
  // 대표 담당자 ID. selectedMember 안에 있는 member 중 하나여야 함.
  // 기존 consumer (일정 탭 등) 가 이 필드를 무시해도 동작에 영향 없음 — backward compat.
  let primaryMemberId = $state<string | null>(null)

  // ============ 필드별 인라인 유효성 검증 ============
  let validationErrors = $state<Record<string, string>>({})

  function validate(): boolean {
    const errors: Record<string, string> = {}

    if (!selectedProgram) {
      errors.program = '프로그램을 선택해주세요'
    }

    if (clientType === 'individual' && selectedClients.length === 0) {
      errors.client = '내담자를 선택해주세요'
    }
    if (clientType === 'group' && groupMembers.length === 0) {
      errors.client = '내담자를 등록해주세요'
    }

    if (selectedMember.length === 0) {
      errors.counselor = '담당자를 선택해주세요'
    }

    if (!selectedRoom) {
      errors.room = '장소를 선택해주세요'
    }

    if (selectedDates.length === 0 || !startTime || !endTime) {
      errors.schedule = '일정을 선택해주세요'
    }

    validationErrors = errors

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
  $effect(() => { if (selectedProgram) clearValidationError('program') })
  $effect(() => { if (selectedClients.length > 0 || groupMembers.length > 0) clearValidationError('client') })
  $effect(() => { if (selectedMember.length > 0) clearValidationError('counselor') })
  $effect(() => { if (selectedRoom) clearValidationError('room') })
  $effect(() => { if (selectedDates.length > 0 && startTime && endTime) clearValidationError('schedule') })

  // ============ 접수 버튼 활성화 조건 ============
  const commonConditions = $derived(selectedMember.length > 0)

  const scheduleConditions = $derived(
    selectedDates.length > 0 && !!startTime && !!endTime
  )

  const canSubmit = $derived(
    scheduleConditions &&
      !!selectedRoom &&
      (selectedProgram && clientType === 'individual'
        ? selectedClients.length > 0 && commonConditions
        : groupMembers.length > 0 && commonConditions)
  )

  // ============ 생년월일 파싱 헬퍼 ============
  function parseBirthDate(birthDateStr: string): Date | null {
    if (!birthDateStr || birthDateStr.length < 8) return null
    const cleanDate = birthDateStr.replace(/-/g, '')
    const year = cleanDate.slice(0, 4)
    const month = cleanDate.slice(4, 6)
    const day = cleanDate.slice(6, 8)
    const parsed = new Date(`${year}-${month}-${day}`)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  // ============ 개인 내담자 핸들러 ============
  function handleClientSelect(client: Client) {
    const extendedClient = client as ExtendedClient
    // 이미 선택된 내담자인지 확인
    if (selectedClients.some((c) => c.uid === extendedClient.uid)) {
      return
    }
    selectedClients = [...selectedClients, extendedClient]
    searchQuery = ''
    isDropdownOpen = false
    isRegisterFormOpen = false
  }

  function handleRemoveClient(clientUid: string) {
    selectedClients = selectedClients.filter((c) => c.uid !== clientUid)
  }

  function handleClearClients() {
    selectedClients = []
    searchQuery = ''
  }

  function handleInputChange() {
    isDropdownOpen = true
  }

  function handleInputFocus() {
    isDropdownOpen = true
  }

  function handleRegisterFormChange(isOpen: boolean) {
    isRegisterFormOpen = isOpen
  }

  function handleRegisterSubmit(data: ClientRegisterData) {
    const birthDate = parseBirthDate(data.birthDate)

    const newClient: ExtendedClient = {
      uid: `NLI${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      role: 'client',
      name: data.name,
      gender: data.gender === 'male' ? '남자' : '여자',
      birth_date: birthDate,
      guardian_relationship: data.guardianRelationship,
      guardian_name: data.guardianName,
      guardian_phone: data.guardianPhone,
      guardian_email: data.guardianEmail,
      organization: data.organization,
      address: data.address,
      memo: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    selectedClients = [...selectedClients, newClient]
    searchQuery = ''
    isDropdownOpen = false
    isRegisterFormOpen = false
    snackbarStore.success('새로운 내담자가 추가되었어요.')
  }

  // ============ 기관 핸들러 ============
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

  function handleEditOrganization() {
    isOrganizationEditMode = true
    isGroupDropdownOpen = true
  }

  function handleDeleteOrganization() {
    handleClearOrganization()
    isGroupDropdownOpen = true
  }

  function handleOrganizationEditCancel() {
    isOrganizationEditMode = false
    isGroupDropdownOpen = false
  }

  function handleGroupInputFocus() {
    isGroupDropdownOpen = true
  }

  function handleGroupRegisterFormChange(isOpen: boolean) {
    isGroupRegisterFormOpen = isOpen
  }

  function handleGroupRegisterSubmit(data: OrganizationRegisterData) {
    if (isOrganizationEditMode && selectedOrganization) {
      selectedOrganization = {
        ...selectedOrganization,
        name: data.name,
        address: data.address,
        phone: data.phone
      }
      isOrganizationEditMode = false
    } else {
      handleOrganizationCreated({
        id: `NEW_${Date.now()}`,
        name: data.name,
        address: data.address,
        phone: data.phone
      })
    }

    isGroupDropdownOpen = false
    isGroupRegisterFormOpen = false
  }

  // ============ 그룹 멤버 관리 ============
  function clearGroupMembers() {
    groupMembers = []
  }

  function addGroupMembers(members: GroupMember[]) {
    groupMembers = [...groupMembers, ...members]
  }

  // ============ 상태 변경 헬퍼 ============
  function setSearchQuery(value: string) {
    searchQuery = value
  }

  function setIsDropdownOpen(value: boolean) {
    isDropdownOpen = value
  }

  function setGroupSearchQuery(value: string) {
    groupSearchQuery = value
  }

  function setIsGroupDropdownOpen(value: boolean) {
    isGroupDropdownOpen = value
  }

  // ============ 타입 전환 ============
  function handleTypeChange(newType: ClientType) {
    if (newType !== clientType) {
      // 개인 폼 초기화
      searchQuery = ''
      selectedClients = []
      isDropdownOpen = false
      isRegisterFormOpen = false

      // 단체 폼 초기화
      groupSearchQuery = ''
      selectedOrganization = null
      isGroupDropdownOpen = false
      isGroupRegisterFormOpen = false

      // 일정 상태 초기화
      selectedDates = []
      startTime = null
      endTime = null
      selectedRoom = null
      selectedMember = []

      clientType = newType
    }
  }

  function handleProgramSelect(program: ProgramListItem) {
    selectedProgram = program
    selectedProgramType = program.program_type
  }

  // ============ 담당자/장소 ============
  function toggleMember(member: MemberListItem) {
    if (selectedMember.find((m) => m.id === member.id)) {
      // 선택 해제
      const next = selectedMember.filter((s) => s.id !== member.id)
      selectedMember = next
      // 해제 대상이 대표였으면 남은 담당자 중 첫 번째로 자동 승계
      if (primaryMemberId === member.id) {
        primaryMemberId = next[0]?.id ?? null
      }
    } else {
      selectedMember = [...selectedMember, member]
      // 대표가 없었으면 자동으로 대표로 지정 (최초 선택 케이스)
      if (primaryMemberId === null) {
        primaryMemberId = member.id
      }
    }
  }

  function setPrimaryMember(member: MemberListItem) {
    // 선택된 상태에서만 대표 토글 가능
    if (selectedMember.find((m) => m.id === member.id)) {
      primaryMemberId = primaryMemberId === member.id ? null : member.id
    }
  }

  function selectRoom(room: RoomItemType) {
    selectedRoom = room
  }

  // ============ 폼 상태 빌드 ============
  function buildFormState() {
    return {
      clientType,
      searchQuery,
      selectedClients,
      groupSearchQuery,
      selectedOrganization,
      groupMembers,
      selectedDates,
      startTime,
      endTime,
      selectedRoom,
      selectedMember,
      selectedProgram,
      selectedProgramType,
      sendNotification,
      clientMemo
    }
  }

  // ============ 폼 상태 복원 ============
  function restoreFormState() {
    const formState = receiveFormStore.get()

    clientType = formState.clientType
    searchQuery = formState.searchQuery
    selectedClients =
      formState.selectedClients ??
      (formState.selectedClient ? [formState.selectedClient] : [])
    groupSearchQuery = formState.groupSearchQuery
    selectedOrganization = formState.selectedOrganization
    groupMembers = [...formState.groupMembers]
    selectedDates = formState.selectedDates ?? []
    startTime = formState.startTime
    endTime = formState.endTime
    selectedRoom = formState.selectedRoom
    selectedMember = formState.selectedMember
    selectedProgram = formState.selectedProgram || null
    selectedProgramType = formState.selectedProgramType || null
    sendNotification = formState.sendNotification
    clientMemo = formState.clientMemo
  }

  // ============ 엑셀 플로우 초기화 ============
  function initFromExcel(url: URL) {
    const fromParam = url.searchParams.get('from')
    const fromExcel = fromParam === 'excel'
    const fromExcelChange = fromParam === 'excel-change'

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

            groupMembers = [...groupMembers, ...newMembers]
            snackbarStore.success('내담자 목록을 추가했어요!')
            excelUploadStore.clear()
          }
        })
        unsubscribe()
      }

      goto('/counseling/receive', { replaceState: true })
    }
  }

  return {
    // ============ 상태 (getters) ============
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
    get selectedProgram() {
      return selectedProgram
    },
    get selectedProgramType() {
      return selectedProgramType
    },
    get selectedDates() {
      return selectedDates
    },
    get startTime() {
      return startTime
    },
    get endTime() {
      return endTime
    },
    get selectedRoom() {
      return selectedRoom
    },
    get selectedMember() {
      return selectedMember
    },
    get primaryMemberId() {
      return primaryMemberId
    },
    get canSubmit() {
      return canSubmit
    },
    get validationErrors() {
      return validationErrors
    },

    // 메서드
    validate,
    clearValidationError,

    // ============ 상태 (setters) ============
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
    set selectedClients(v: ExtendedClient[]) {
      selectedClients = v
    },
    set selectedMember(v: MemberListItem[]) {
      selectedMember = [...v]
      // primary 가 없거나 목록에서 사라졌으면 첫 번째로 설정 (초기 로드 호환성 포함).
      // 일정 탭 등 primary UI 를 쓰지 않는 consumer 도 selectedMember[0] ===
      // primaryMemberId 불변식을 유지할 수 있음.
      if (!primaryMemberId || !v.find((m) => m.id === primaryMemberId)) {
        primaryMemberId = v[0]?.id ?? null
      }
    },
    set primaryMemberId(v: string | null) {
      primaryMemberId = v
    },
    set selectedRoom(v: RoomItemType | null) {
      selectedRoom = v
    },
    set selectedProgramType(v: ProgramType | null) {
      selectedProgramType = v
    },
    set selectedProgram(v: ProgramListItem | null) {
      selectedProgram = v
    },
    set searchQuery(v: string) {
      searchQuery = v
    },
    set groupSearchQuery(v: string) {
      groupSearchQuery = v
    },
    set groupMembers(v: GroupMember[]) {
      groupMembers = v
    },
    set selectedDates(v: Date[]) {
      selectedDates = v
    },
    set startTime(v: string | null) {
      startTime = v
    },
    set endTime(v: string | null) {
      endTime = v
    },
    set isDropdownOpen(v: boolean) {
      isDropdownOpen = v
    },
    set isGroupDropdownOpen(v: boolean) {
      isGroupDropdownOpen = v
    },

    // ============ 상태 변경 헬퍼 ============
    setSearchQuery,
    setIsDropdownOpen,
    setGroupSearchQuery,
    setIsGroupDropdownOpen,
    // ============ 개인 내담자 핸들러 ============
    handleClientSelect,
    handleRemoveClient,
    handleClearClients,
    handleRegisterSubmit,
    handleInputChange,
    handleInputFocus,
    handleRegisterFormChange,

    // ============ 기관 핸들러 ============
    handleOrganizationSelect,
    handleEditOrganization,
    handleDeleteOrganization,
    handleOrganizationEditCancel,
    handleGroupRegisterSubmit,
    handleGroupInputChange,
    handleGroupInputFocus,
    handleGroupRegisterFormChange,

    // ============ 그룹 멤버 ============
    clearGroupMembers,
    addGroupMembers,

    // ============ 폼 제어 ============
    handleTypeChange,
    handleProgramSelect,
    toggleMember,
    setPrimaryMember,
    selectRoom,
    buildFormState,
    initFromExcel
  }
}

export type CounselFormModel = ReturnType<typeof useCounselForm>
