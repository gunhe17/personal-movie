import type {
  Assessment,
  GetAssessmentsQueryParams
} from '$lib/hooks/actions/assessment.action'
import type {
  CreatePackageRequest,
  CreatePackageResponse,
  DeletePackageRequest,
  GetPackageListRequest,
  PackageAssessment,
  PackageType,
  UpdatePackageRequest,
  UpdatePackageResponse
} from '$lib/hooks/actions/package.action'
import type { ApiResponse, PaginationRes } from '$lib/types/apiResponse'

const now = () => new Date().toISOString()
// crypto.randomUUID가 브라우저/빌드 환경마다 다를 수 있어 단순 난수 사용
const genId = () => `mock-${Math.random().toString(36).slice(2, 10)}`

let assessments: Assessment[] = [
  {
    uid: 'asm-dev-001',
    code: 'DEV-001',
    kor_name: '베일리 영유아 발달검사 3판',
    eng_name: 'K-Bayley-III',
    description: '영유아 전반 발달 수준 평가',
    assessment_type: 'developmental',
    target_age_group: 'infant',
    estimated_duration_minutes: 60,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-cog-001',
    code: 'COG-001',
    kor_name: '한국 웩슬러 아동지능검사 5판',
    eng_name: 'K-WISC-V',
    description: '아동 인지능력 종합 검사',
    assessment_type: 'cognitive',
    target_age_group: 'child',
    estimated_duration_minutes: 70,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-cog-002',
    code: 'COG-002',
    kor_name: '한국 웩슬러 유아지능검사 4판',
    eng_name: 'K-WPPSI-IV',
    description: '유아 인지능력 종합 검사',
    assessment_type: 'cognitive',
    target_age_group: 'preschool',
    estimated_duration_minutes: 45,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-cog-003',
    code: 'COG-003',
    kor_name: '레이븐 지능발달검사',
    eng_name: 'RAVEN SPM',
    description: '비언어적 추론 능력 평가',
    assessment_type: 'cognitive',
    target_age_group: 'child',
    estimated_duration_minutes: 40,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'private',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-per-001',
    code: 'PER-001',
    kor_name: '벤더게슈탈트검사',
    eng_name: 'BGT',
    description: '시지각 및 시공간 구성능력 평가',
    assessment_type: 'perceptual',
    target_age_group: 'child',
    estimated_duration_minutes: 20,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-pro-001',
    code: 'PRO-001',
    kor_name: '로르샤흐 잉크 반점 검사',
    eng_name: 'Rorschach',
    description: '투사적 성격 평가',
    assessment_type: 'projective',
    target_age_group: 'adolescent',
    estimated_duration_minutes: 60,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: false,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-pro-002',
    code: 'PRO-002',
    kor_name: '집-나무-사람 그림 검사',
    eng_name: 'HTP',
    description: '투사적 성격 및 정서 평가',
    assessment_type: 'projective',
    target_age_group: 'child',
    estimated_duration_minutes: 30,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: false,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'private',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-pro-003',
    code: 'PRO-003',
    kor_name: '동적 가족화 그림검사',
    eng_name: 'KFD',
    description: '가족 관계 및 정서 역동 평가',
    assessment_type: 'projective',
    target_age_group: 'child',
    estimated_duration_minutes: 25,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: false,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-pro-004',
    code: 'PRO-004',
    kor_name: '문장완성검사',
    eng_name: 'SCT',
    description: '투사적 사고 및 정서 평가',
    assessment_type: 'projective',
    target_age_group: 'adolescent',
    estimated_duration_minutes: 20,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: false,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'private',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-att-001',
    code: 'ATT-001',
    kor_name: '종합주의력검사',
    eng_name: 'Comprehensive Attention Test',
    description: '주의력 및 실행기능 검사',
    assessment_type: 'attention',
    target_age_group: 'child',
    estimated_duration_minutes: 30,
    is_online_available: true,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-001',
    code: 'OBJ-001',
    kor_name: '미네소타 다면적 성격 검사',
    eng_name: 'MMPI-2',
    description: '성인용 다면적 성격 검사',
    assessment_type: 'objective',
    target_age_group: 'adult',
    estimated_duration_minutes: 90,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: true,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-002',
    code: 'OBJ-002',
    kor_name: '미네소타 다면적 성격 검사',
    eng_name: 'MMPI-A',
    description: '청소년용 다면적 성격 검사',
    assessment_type: 'objective',
    target_age_group: 'adolescent',
    estimated_duration_minutes: 80,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: true,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-003',
    code: 'OBJ-003',
    kor_name: '기질 및 성격검사',
    eng_name: 'TCI',
    description: '성격 기질 및 성향 평가',
    assessment_type: 'objective',
    target_age_group: 'adult',
    estimated_duration_minutes: 40,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-004',
    code: 'OBJ-004',
    kor_name: '기질 및 성격검사',
    eng_name: 'JTCI 7-11',
    description: '아동용 기질 및 성격 검사',
    assessment_type: 'objective',
    target_age_group: 'child',
    estimated_duration_minutes: 35,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-005',
    code: 'OBJ-005',
    kor_name: '기질 및 성격검사',
    eng_name: 'JTCI 3-6',
    description: '유아·아동 기질 성격 검사',
    assessment_type: 'objective',
    target_age_group: 'preschool',
    estimated_duration_minutes: 35,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-006',
    code: 'OBJ-006',
    kor_name: '기질 및 성격검사',
    eng_name: 'JTCI 12-18',
    description: '청소년 기질 및 성격 검사',
    assessment_type: 'objective',
    target_age_group: 'adolescent',
    estimated_duration_minutes: 35,
    is_online_available: false,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: false,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-007',
    code: 'OBJ-007',
    kor_name: '부모양육태도검사 1판',
    eng_name: 'PAT-1',
    description: '부모 양육 태도 평가 (1판)',
    assessment_type: 'objective',
    target_age_group: 'parent',
    estimated_duration_minutes: 25,
    is_online_available: true,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: true,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-008',
    code: 'OBJ-008',
    kor_name: '부모양육태도검사 2판',
    eng_name: 'PAT-2',
    description: '부모 양육 태도 평가 (2판)',
    assessment_type: 'objective',
    target_age_group: 'parent',
    estimated_duration_minutes: 25,
    is_online_available: true,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: true,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-obj-009',
    code: 'OBJ-009',
    kor_name: '아동 청소년 행동평가척도',
    eng_name: 'CBCL 6-18',
    description: '아동·청소년 행동 종합 평가',
    assessment_type: 'objective',
    target_age_group: 'adolescent',
    estimated_duration_minutes: 30,
    is_online_available: true,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: true,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-bhv-001',
    code: 'BHV-001',
    kor_name: '스마트폰 이용습관',
    eng_name: 'Smartphone Usage Habit',
    description: '스마트폰 사용 습관 및 중독 위험도 평가',
    assessment_type: 'behavioral',
    target_age_group: 'adolescent',
    estimated_duration_minutes: 15,
    is_online_available: true,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: true,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  },
  {
    uid: 'asm-bhv-002',
    code: 'BHV-002',
    kor_name: '스마트 바디체커',
    eng_name: 'Smart Body Checker',
    description: '신체 밸런스 및 자세 평가',
    assessment_type: 'behavioral',
    target_age_group: 'all',
    estimated_duration_minutes: 10,
    is_online_available: true,
    is_ai_supported: false,
    has_standard_report: true,
    supports_report_upload: false,
    supports_self_scoring: true,
    status: 'public',
    created_at: now(),
    updated_at: now(),
    modified_by_account: 'mock'
  }
]

const toPackageAssessment = (src: Assessment): PackageAssessment => ({
  uid: src.uid,
  code: src.code,
  eng_name: src.eng_name,
  kor_name: src.kor_name,
  assessment_type: src.assessment_type,
  is_online_available: src.is_online_available,
  duration: src.estimated_duration_minutes ?? null
})

const toPackageAssessments = (uids: string[]): PackageAssessment[] =>
  uids
    .map((id) => assessments.find((a) => a.uid === id))
    .filter(Boolean)
    .map((a) => (a ? toPackageAssessment(a) : null))
    .filter(Boolean) as PackageAssessment[]

let packages: PackageType[] = []

function paginate<T>(list: T[], page = 1, page_size = 12): PaginationRes<T> {
  const start = (page - 1) * page_size
  const sliced = list.slice(start, start + page_size)
  return {
    data: sliced,
    pagination: {
      page,
      page_size,
      total: list.length,
      total_pages: Math.max(1, Math.ceil(list.length / page_size))
    }
  }
}

export function mockListAssessments(
  queryParams: GetAssessmentsQueryParams = {}
): PaginationRes<Assessment> {
  let list = [...assessments]

  if (queryParams.code) {
    const q = queryParams.code.toLowerCase()
    list = list.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.kor_name.toLowerCase().includes(q) ||
        a.eng_name.toLowerCase().includes(q)
    )
  }

  if (queryParams.status === 'public') {
    list = list.filter((a) => a.status === 'public')
  } else if (queryParams.status === 'private') {
    list = list.filter((a) => a.status === 'private')
  }

  if (queryParams.is_online_available === true) {
    list = list.filter((a) => a.is_online_available)
  }

  // 검사 분류 필터
  // 'developmental' 필터는 developmental + cognitive 모두 포함 (지능&발달 검사)
  // 'objective' 필터는 objective + attention + behavioral 모두 포함 (객관적 검사)
  if (queryParams.assessment_type) {
    if (queryParams.assessment_type === 'developmental') {
      list = list.filter(
        (a) => a.assessment_type === 'developmental' || a.assessment_type === 'cognitive'
      )
    } else if (queryParams.assessment_type === 'objective') {
      list = list.filter(
        (a) =>
          a.assessment_type === 'objective' ||
          a.assessment_type === 'attention' ||
          a.assessment_type === 'behavioral'
      )
    } else {
      list = list.filter((a) => a.assessment_type === queryParams.assessment_type)
    }
  }

  if (queryParams.sort === 'created_at_desc') {
    list = list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  } else {
    list = list.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  return paginate(list, queryParams.page ?? 1, queryParams.page_size ?? 12)
}

export function mockListPackages(
  request: GetPackageListRequest
): PaginationRes<PackageType> {
  // centerId는 단일 목 데이터라 필터 없이 반환
  return paginate(
    packages,
    request.queryParams.page ?? 1,
    request.queryParams.page_size ?? 100
  )
}

export function mockCreatePackage(
  request: CreatePackageRequest
): ApiResponse<CreatePackageResponse> {
  const uid = genId()
  packages = [
    ...packages,
    {
      uid,
      center_uid: request.centerId,
      name: request.payload.name,
      description: request.payload.description ?? null,
      assessments: request.payload.assessment_uids
        .map((id) => assessments.find((a) => a.uid === id))
        .filter(Boolean)
        .map((a) => (a ? toPackageAssessment(a) : null))
        .filter(Boolean) as PackageAssessment[],
      package_price: null,
      is_active: true,
      created_at: now(),
      updated_at: now(),
      modified_by_account: 'mock',
      modified_by_person: 'mock'
    }
  ]
  return { success: true, data: { data: { uid } } }
}

export function mockUpdatePackage(
  request: UpdatePackageRequest
): ApiResponse<UpdatePackageResponse> {
  packages = packages.map((pkg) =>
    pkg.uid === request.packageId
      ? {
          ...pkg,
          name: request.payload.name ?? pkg.name,
          description: request.payload.description ?? pkg.description,
          assessments: request.payload.assessment_uids
            ? (request.payload.assessment_uids
                .map((id) => assessments.find((a) => a.uid === id))
                .filter(Boolean)
                .map((a) => (a ? toPackageAssessment(a) : null))
                .filter(Boolean) as PackageAssessment[])
            : pkg.assessments,
          updated_at: now()
        }
      : pkg
  )
  return { success: true, data: { data: { uid: request.packageId } } }
}

export function mockDeletePackage(
  request: DeletePackageRequest
): ApiResponse<{ data: { uid: string } }> {
  packages = packages.filter((pkg) => pkg.uid !== request.packageId)
  return { success: true, data: { data: { uid: request.packageId } } }
}

// 검사 UID로 검사 정보 조회
export function getAssessmentByUidFromMock(uid: string): Assessment | undefined {
  return assessments.find((a) => a.uid === uid)
}
