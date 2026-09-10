import { t, josa } from '$lib/ontology/terms'
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

type ClientType = 'individual' | 'group'

export type GroupClientState = Pick<
  ClientRegisterFormModel,
  | 'groupSearchQuery'
  | 'selectedOrganization'
  | 'isOrganizationEditMode'
  | 'isGroupDropdownOpen'
  | 'isGroupRegisterFormOpen'
  | 'groupMembers'
  | 'organizationEditData'
>

export type GroupClientActions = Pick<
  ClientRegisterFormModel,
  | 'setGroupSearchQuery'
  | 'setIsGroupDropdownOpen'
  | 'handleGroupInputChange'
  | 'handleGroupInputFocus'
  | 'handleOrganizationSelect'
  | 'handleGroupRegisterSubmit'
  | 'handleGroupRegisterFormChange'
  | 'handleEditOrganization'
  | 'handleDeleteOrganization'
  | 'handleOrganizationEditCancel'
  | 'clearGroupMembers'
> & {
  onExcelUploadClick: () => void
  onEditGroupMembers: () => void
}

// 내담자 등록 폼 데이터 타입
interface ClientRegisterData {
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
interface OrganizationRegisterData {
  name: string
  address: string
  phone: string
}

export function useClientRegisterForm() {
  let clientType = $state<ClientType>('individual')

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
    snackbarStore.success(`새로운 ${josa(t('subject'), '이/가')} 추가되었어요.`)
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

      clientType = newType
    }
  }

  // ============ 폼 상태 빌드 ============
  function buildFormState() {
    return {
      searchQuery,
      selectedClients,
      groupSearchQuery,
      selectedOrganization,
      groupMembers
    }
  }

  // ============ 폼 상태 복원 ============
  function restoreFormState() {
    const formState = receiveFormStore.get()
    searchQuery = formState.searchQuery
    selectedClients =
      formState.selectedClients ??
      (formState.selectedClient ? [formState.selectedClient] : [])
    groupSearchQuery = formState.groupSearchQuery
    selectedOrganization = formState.selectedOrganization
    groupMembers = [...formState.groupMembers]
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
            snackbarStore.success(`${t('subject')} 목록을 추가했어요!`)
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
    get organizationEditData() {
      return organizationEditData
    },
    // ============ 상태 (setters) ============
    set clientType(v: ClientType) {
      clientType = v
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
    buildFormState,
    initFromExcel
  }
}

export type ClientRegisterFormModel = ReturnType<typeof useClientRegisterForm>
