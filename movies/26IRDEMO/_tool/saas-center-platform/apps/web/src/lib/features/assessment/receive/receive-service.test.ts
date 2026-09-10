import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInstitutionList, postCreateInstitution } from '$lib/hooks/actions/institution.action'
import { postCreateClient } from '$lib/hooks/actions/client.action'
import { createBatchAssessmentCase } from '$lib/hooks/actions/case.action'
import { createReceiveService } from './receive-service'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
vi.mock('$app/environment', () => ({ browser: false }))
vi.mock('$lib/stores/center.store', () => ({ requireCenterId: () => 'CENTER' }))
vi.mock('$lib/hooks/actions/institution.action', () => ({
  getInstitutionList: vi.fn(),
  postCreateInstitution: vi.fn()
}))
vi.mock('$lib/hooks/actions/client.action', () => ({ postCreateClient: vi.fn() }))
vi.mock('$lib/hooks/actions/case.action', () => ({
  createBatchAssessmentCase: vi.fn(),
  createIndividualAssessmentCase: vi.fn(),
  getCaseById: vi.fn(),
  updateCase: vi.fn()
}))

const UUID = '260abc30-bb17-4e6a-8456-a806804ac96e'

function action(fn: ReturnType<typeof vi.fn>) {
  return { key: [], request: fn }
}

let batch: ReturnType<typeof vi.fn>
let listInstitutions: ReturnType<typeof vi.fn>
let createInstitution: ReturnType<typeof vi.fn>

function submit() {
  const service = createReceiveService({
    queryClient: { invalidateQueries: vi.fn() } as never
  })
  const groupMembers = [
    { id: 'new-0-김민준', name: '김민준', birthDate: '', gender: '' as const, guardianPhone: '' }
  ]
  return service
    .submitReceive({
      clientType: 'group',
      visitCenter: false,
      selectedDate: null,
      selectedTime: null,
      selectedMember: [{ id: 'M1' }] as never,
      selectedRoom: null,
      selectedAssessmentItems: ['SAS'],
      excludedAssessmentItems: [],
      selectedPackageIds: [],
      comprehensiveReport: '미작성',
      clientMemo: '',
      assessmentsData: [{ eng_name: 'SAS', assessment_id: 'A1' }] as never,
      packagesData: [],
      selectedClients: [],
      selectedOrganization: { id: 'new-햇살어린이집', name: '햇살어린이집', address: '', phone: '' },
      groupMembers
    })
    .then((ok) => ({ ok, groupMembers }))
}

beforeEach(() => {
  batch = vi.fn().mockResolvedValue({})
  listInstitutions = vi.fn().mockResolvedValue({ items: [], total: 0 })
  createInstitution = vi.fn().mockResolvedValue({ id: UUID, name: '햇살어린이집' })
  vi.mocked(createBatchAssessmentCase).mockReturnValue(action(batch) as never)
  vi.mocked(getInstitutionList).mockReturnValue(action(listInstitutions) as never)
  vi.mocked(postCreateInstitution).mockReturnValue(action(createInstitution) as never)
  vi.mocked(postCreateClient).mockReturnValue(
    action(vi.fn().mockResolvedValue({ id: 'CLIENT-1' })) as never
  )
})

describe('단체 접수 — 기관 id 확정', () => {
  it('prefill이 얹은 new- 스텁 기관은 생성 후 그 UUID로 접수한다', async () => {
    const { ok } = await submit()
    expect(ok).toBe(true)
    expect(createInstitution).toHaveBeenCalledOnce()
    expect(batch.mock.calls[0][0].payload.institution_id).toBe(UUID)
  })

  it('같은 이름의 기관이 이미 있으면 재사용하고 새로 만들지 않는다', async () => {
    listInstitutions.mockResolvedValue({ items: [{ id: UUID, name: '햇살어린이집' }], total: 1 })
    const { ok } = await submit()
    expect(ok).toBe(true)
    expect(createInstitution).not.toHaveBeenCalled()
    expect(batch.mock.calls[0][0].payload.institution_id).toBe(UUID)
  })

  it('케이스 생성이 실패하면 실패로 알리고, 만든 내담자 id를 폼에 되돌려 재접수 시 중복 생성을 막는다', async () => {
    batch.mockRejectedValue(new Error('boom'))
    const { ok, groupMembers } = await submit()
    expect(ok).toBe(false)
    expect(groupMembers[0].id).toBe('CLIENT-1')
  })
})
