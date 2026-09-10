import { writable, get } from 'svelte/store'
import type { Organization } from '$lib/types/organization'
import type { RoomItemType } from '../hooks/actions/room.action'
import type { ProgramListItem, ProgramType } from '../hooks/actions/program.action'
import type { MemberListItem as MemberItem } from '../hooks/actions/member.action'

// Extended Client type for the receive form
export interface ExtendedClient {
  uid: string
  role: string
  name: string
  gender: '남자' | '여자'
  birth_date: Date | null
  guardian_relationship: string
  guardian_name: string
  guardian_phone: string
  guardian_email?: string
  organization?: string
  address?: string
  memo: string
  created_at: string
  updated_at: string
}

// Group member type
export interface GroupMember {
  id: string
  name: string
  birthDate: string
  gender: 'male' | 'female' | ''
  guardianPhone: string
}

// Receive form state interface
export interface ReceiveFormState {
  // Client type
  clientType: 'individual' | 'group'

  // Individual mode
  searchQuery: string
  selectedClient: ExtendedClient | null // @deprecated - use selectedClients
  selectedClients: ExtendedClient[]

  // Group mode
  groupSearchQuery: string
  selectedOrganization: Organization | null
  groupMembers: GroupMember[]

  // Common fields
  selectedPackageIds: string[]
  selectedAssessmentItems: string[]
  excludedAssessmentItems: string[]
  selectedDate: Date | null
  selectedDates: Date[]
  startTime: string | null
  endTime: string | null
  selectedRoom: RoomItemType | null
  selectedMember: MemberItem[]
  selectedProgram: ProgramListItem | null
  selectedProgramType: ProgramType | null
  sendNotification: boolean
  clientMemo: string
}

const initialState: ReceiveFormState = {
  clientType: 'individual',
  searchQuery: '',
  selectedClient: null,
  selectedClients: [],
  groupSearchQuery: '',
  selectedOrganization: null,
  groupMembers: [],
  selectedPackageIds: [],
  selectedAssessmentItems: [],
  excludedAssessmentItems: [],
  selectedDate: null,
  selectedDates: [],
  startTime: null,
  endTime: null,
  selectedRoom: null,
  selectedMember: [],
  selectedProgram: null,
  selectedProgramType: null,
  sendNotification: false,
  clientMemo: ''
}

function createReceiveFormStore() {
  const { subscribe, set, update } = writable<ReceiveFormState>(initialState)

  return {
    subscribe,

    // Update specific fields
    update: (data: Partial<ReceiveFormState>) => {
      update((state) => ({ ...state, ...data }))
    },

    // Set entire state
    set: (state: ReceiveFormState) => {
      set(state)
    },

    // Get current state
    get: () => get({ subscribe }),

    // Save current form state (snapshot)
    saveState: () => {
      const currentState = get({ subscribe })
      return { ...currentState }
    },

    // Restore form state
    restoreState: (state: ReceiveFormState) => {
      set(state)
    },

    // Add group members (from excel)
    addGroupMembers: (members: GroupMember[]) => {
      update((state) => ({
        ...state,
        clientType: 'group',
        groupMembers: [...state.groupMembers, ...members]
      }))
    },

    // Clear entire form (for submit/close)
    clear: () => {
      set(initialState)
    },

    // Reset only client-related fields (when switching client type)
    resetClientFields: () => {
      update((state) => ({
        ...state,
        searchQuery: '',
        selectedClient: null,
        selectedClients: [],
        groupSearchQuery: '',
        selectedOrganization: null,
        groupMembers: [],
        selectedPackageIds: [],
        selectedAssessmentItems: [],
        excludedAssessmentItems: [],
        selectedDate: null,
        startTime: null,
        endTime: null,
        selectedRoom: null,
        selectedProgram: null,
        selectedProgramType: null,
        selectedMember: []
      }))
    }
  }
}

export const receiveFormStore = createReceiveFormStore()
