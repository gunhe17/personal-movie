import { writable, derived, get } from 'svelte/store'

export interface MockClient {
  id: string
  name: string
  code: string
  phone: string
  birth: Date | null
  memo: string
  status: 'ACTIVE' | 'INACTIVE'
  personCreatedAt: Date
  gender: 'MALE' | 'FEMALE'
  avatarUrl: string | null
  isGuardian: boolean
}

export interface GuardianRelation {
  id: string
  clientId: string // 내담자
  guardianId: string // 보호자 (Client)
  relation: string // 엄마, 아빠 등
}

export interface GuardianForm {
  id: string
  name: string
  relation: string
  birth: Date | null
  phone: string
}

export interface ClientWithGuardians {
  client: MockClient
  guardians: Array<{
    relationId: string
    relation: string
    guardian: MockClient
  }>
}

export interface ClientWithFamily {
  client: MockClient
  family: {
    relationId: string
    relation: string
    member: MockClient
    role: 'SELF' | 'GUARDIAN'
  }[]
}

export interface FamilyGroup {
  representative: MockClient
  members: {
    client: MockClient
    relation?: string
  }[]
}

export interface GuardianWithRelations {
  guardian: MockClient
  relations: {
    clientId: string
    relation: string
  }[]
}

export const clientStore = writable<MockClient[]>([
  {
    id: 'client-001',
    name: '김민준',
    code: 'C-0001',
    phone: '01012345678',
    birth: new Date('2015-03-12'),
    memo: '주의력 검사 예정',
    status: 'ACTIVE',
    personCreatedAt: new Date(),
    gender: 'MALE',
    avatarUrl: null,
    isGuardian: false
  },
  {
    id: 'client-002',
    name: '김영희',
    code: 'C-0002',
    phone: '01098765432',
    birth: new Date('1985-06-21'),
    memo: '',
    status: 'ACTIVE',
    personCreatedAt: new Date(),
    gender: 'FEMALE',
    avatarUrl: null,
    isGuardian: true
  },
  {
    id: 'client-003',
    name: '이철수',
    code: 'C-0003',
    phone: '01022223333',
    birth: new Date('1980-02-14'),
    memo: '',
    status: 'ACTIVE',
    personCreatedAt: new Date(),
    gender: 'MALE',
    avatarUrl: null,
    isGuardian: true
  }
])

export const guardianRelationStore = writable<GuardianRelation[]>([
  {
    id: 'rel-001',
    clientId: 'client-001',
    guardianId: 'client-002',
    relation: '엄마'
  },
  {
    id: 'rel-002',
    clientId: 'client-001',
    guardianId: 'client-003',
    relation: '아빠'
  }
])

export const createClient = (client: MockClient) => {
  clientStore.update((clients) => [...clients, client])
}

export const updateClient = (id: string, payload: Partial<MockClient>) => {
  clientStore.update((clients) =>
    clients.map((c) => (c.id === id ? { ...c, ...payload } : c))
  )
}

export const deleteClient = (id: string) => {
  clientStore.update((clients) => clients.filter((c) => c.id !== id))

  guardianRelationStore.update((relations) =>
    relations.filter((r) => r.clientId !== id && r.guardianId !== id)
  )
}

export const addGuardianRelation = (params: {
  clientId: string
  guardian: MockClient
  relation: string
}) => {
  const { clientId, guardian, relation } = params

  // 보호자 Client 등록 or 업데이트
  clientStore.update((clients) => {
    const exists = clients.find((c) => c.id === guardian.id)

    if (exists) {
      return clients.map((c) =>
        c.id === guardian.id ? { ...c, isGuardian: true } : c
      )
    }

    return [...clients, { ...guardian, isGuardian: true }]
  })

  // 관계 추가
  guardianRelationStore.update((relations) => [
    ...relations,
    {
      id: Date.now().toString(),
      clientId,
      guardianId: guardian.id,
      relation
    }
  ])
}

export const updateGuardianRelation = (
  relationId: string,
  newRelation: string
) => {
  guardianRelationStore.update((relations) =>
    relations.map((r) =>
      r.id === relationId ? { ...r, relation: newRelation } : r
    )
  )
}

export const getAllGuardiansWithRelations = (): GuardianWithRelations[] => {
  const clients = get(clientStore)
  const relations = get(guardianRelationStore)

  const guardians = clients.filter((c) => c.isGuardian)

  return guardians.map((guardian) => {
    const related = relations.filter((r) => r.guardianId === guardian.id)

    return {
      guardian,
      relations: related.map((r) => ({
        clientId: r.clientId,
        relation: r.relation
      }))
    }
  })
}

export const removeGuardianRelation = (relationId: string) => {
  guardianRelationStore.update((relations) =>
    relations.filter((r) => r.id !== relationId)
  )
}

export const getClientDetailWithGuardians = (clientId: string) =>
  derived([clientStore, guardianRelationStore], ([$clients, $relations]) => {
    const client = $clients.find((c) => c.id === clientId)
    if (!client) return

    const guardians = $relations
      .filter((r) => r.clientId === clientId)
      .map((r) => {
        const guardian = $clients.find((c) => c.id === r.guardianId)
        if (!guardian) return null

        return {
          relationId: r.id,
          relation: r.relation,
          guardian
        }
      })
      .filter(Boolean) as ClientWithGuardians['guardians']

    return {
      client,
      guardians
    }
  })

export const getClientDetailWithFamily = (personId: string) =>
  derived(
    [clientStore, guardianRelationStore],
    ([$clients, $relations]): ClientWithFamily | undefined => {
      const me = $clients.find((c) => c.id === personId)
      if (!me) return

      // 🔑 가족 기준 clientId 찾기
      const ownRelation = $relations.find(
        (r) => r.clientId === personId || r.guardianId === personId
      )

      const familyClientId = ownRelation ? ownRelation.clientId : personId

      const client = $clients.find((c) => c.id === familyClientId)
      if (!client) return

      const familyRelations = $relations.filter(
        (r) => r.clientId === familyClientId
      )

      const family = [
        {
          relationId: 'self',
          relation: '본인',
          member: client,
          role: 'SELF' as const
        },
        ...familyRelations.map((r) => {
          const guardian = $clients.find((c) => c.id === r.guardianId)!
          return {
            relationId: r.id,
            relation: r.relation,
            member: guardian,
            role: 'GUARDIAN' as const
          }
        })
      ]

      return { client, family }
    }
  )

export const getAllFamilyGroups = derived(
  [clientStore, guardianRelationStore],
  ([$clients, $relations]) => {
    const visited = new Set<string>()
    const families: FamilyGroup[] = []

    // clientId → 연결된 모든 clientId 찾기 (DFS)
    const findFamily = (startId: string, group: Set<string>) => {
      if (group.has(startId)) return
      group.add(startId)
      $relations.forEach((r) => {
        if (r.clientId === startId) {
          findFamily(r.guardianId, group)
        }
        if (r.guardianId === startId) {
          findFamily(r.clientId, group)
        }
      })
    }
    // 모든 관계 순회
    $relations.forEach((relation) => {
      if (visited.has(relation.clientId)) return
      const groupIds = new Set<string>()
      findFamily(relation.clientId, groupIds)
      groupIds.forEach((id) => visited.add(id))
      const members = Array.from(groupIds)
        .map((id) => $clients.find((c) => c.id === id))
        .filter(Boolean) as MockClient[]
      // 대표 보호자 선정
      const representative = members.find((m) => m.isGuardian) ?? members[0]
      families.push({
        representative,
        members: members.map((m) => {
          const relation = $relations.find(
            (r) =>
              (r.clientId === m.id && r.guardianId === representative.id) ||
              (r.guardianId === m.id && r.clientId === representative.id)
          )
          return {
            client: m,
            relation: relation?.relation
          }
        })
      })
    })

    return families
  }
)
