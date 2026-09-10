import type { AssessmentSetItem } from '$lib/hooks/actions/assessmentSet.action'
import type {
  MemberListItem,
  MeMemberResponse
} from '$lib/hooks/actions/member.action'
import type { PackageType } from '$lib/hooks/actions/package.action'
import type { RoomItemType } from '$lib/hooks/actions/room.action'
import type { ExtendedClient } from '$lib/stores/receiveForm'
import type { ClientSummaryForCase } from '$lib/types/assessmentStatus'
import type { CaseDetail } from '$lib/hooks/actions/case.action'
import type { CenterAssessment } from '$lib/hooks/actions/assessment.action'

export interface SelectOption {
  value: string
  label: string
}

export function mapAssessmentSetItemsToPackages(
  items: AssessmentSetItem[],
  centerId: string | null
): PackageType[] {
  return items.map((setItem) => ({
    uid: setItem.id,
    center_uid: centerId || '',
    name: setItem.name,
    description: setItem.description ?? null,
    assessments: setItem.assessments.map((assessment) => ({
      uid: assessment.id,
      code: assessment.code,
      eng_name: assessment.eng_name,
      kor_name: assessment.kor_name,
      assessment_type: assessment.assessment_type,
      is_online_available: false,
      duration: assessment.duration ?? null
    })),
    package_price: null,
    is_active: true,
    created_at: setItem.created_at,
    updated_at: setItem.created_at,
    modified_by_account: null,
    modified_by_person: null
  }))
}

export function mapMemberOptions(members: MemberListItem[]): SelectOption[] {
  return members
    .filter((member) => member.is_active)
    .map((member) => ({
      value: member.id,
      label: member.person?.name || member.id
    }))
}

export function mapRoomOptions(rooms: RoomItemType[]): SelectOption[] {
  return rooms.map((room) => ({
    value: room.id,
    label: room.name || room.id
  }))
}

export function getDuplicateAssessmentNames(
  packages: PackageType[],
  selectedPackageIds: string[],
  selectedAssessmentItems: string[]
): string[] {
  const packageAssessmentNames = packages
    .filter((pkg) => selectedPackageIds.includes(pkg.uid))
    .flatMap((pkg) => pkg.assessments.map((assessment) => assessment.eng_name))

  return selectedAssessmentItems.filter((item) =>
    packageAssessmentNames.includes(item)
  )
}

/** 편집 모드: CaseDetail 내담자 요약 → 접수 폼용 ExtendedClient (나머지 필드는 빈값) */
export function mapClientSummaryToExtendedClient(c: ClientSummaryForCase): ExtendedClient {
  let birth_date: Date | null = null
  if (c.birth_date) {
    const d = new Date(c.birth_date)
    if (!isNaN(d.getTime())) birth_date = d
  }
  const gender = c.gender === 'F' || c.gender === '여자' ? '여자' : '남자'
  return {
    uid: c.client_id,
    role: 'client',
    name: c.name ?? '',
    gender,
    birth_date,
    guardian_relationship: '',
    guardian_name: '',
    guardian_phone: '',
    memo: '',
    created_at: '',
    updated_at: ''
  }
}

/** GET /me/member 응답 → 접수 폼용 MemberListItem (상담사 접수 시) */
export function meMemberToMemberItem(me: MeMemberResponse): MemberListItem {
  return {
    id: me.id,
    role_code: '',
    role_name: '',
    employment_type: '',
    color: null,
    memo: null,
    is_active: true,
    person: { name: me.name, phone: null, email: null },
    created_at: ''
  }
}

/** 편집 모드: 케이스 담당자 → 접수 폼용 MemberListItem (최소 필드) */
export function mapCaseCounselorToMemberItem(counselor: {
  member_id: string
  name: string
}): MemberListItem {
  return {
    id: counselor.member_id,
    role_code: '',
    role_name: '',
    employment_type: '',
    color: null,
    memo: null,
    is_active: true,
    person: { name: counselor.name, phone: null, email: null },
    created_at: ''
  }
}

/**
 * 편집 모드: case.tasks의 assessment_name(kor)을 assessmentsData와 매칭해 eng_name 목록 반환.
 * 접수 폼의 selectedAssessmentItems는 eng_name 기준.
 */
export function mapCaseTasksToAssessmentItemNames(
  tasks: CaseDetail['tasks'],
  assessmentsData: CenterAssessment[]
): string[] {
  const names: string[] = []
  for (const t of tasks) {
    const a = assessmentsData.find(
      (x) => x.assessment_id === t.assessment_id || x.kor_name === t.assessment_name || x.eng_name === t.assessment_name
    )
    if (a?.eng_name && !names.includes(a.eng_name)) names.push(a.eng_name)
  }
  return names
}
