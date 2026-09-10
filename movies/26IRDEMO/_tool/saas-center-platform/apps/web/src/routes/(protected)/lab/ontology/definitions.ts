/**
 * 온톨로지 정의 — 프로토타입용 mock
 *
 * 실제 구현에서는 서버가 소유하고 `GET /api/v1/ontology/{org_type}`으로 내려준다.
 * 여기서는 화면이 "정의만 읽고 렌더한다"는 것을 보이기 위해 상수로 둔다.
 *
 * 설계 근거: docs/institution-ontology-layer.html §6(스펙) · §12(렌더링 전략)
 */

export type OrgType = 'counseling_center' | 'school' | 'military' | 'clinic'

/** 확장 속성의 타입 — §12-2 레지스트리의 키가 된다 */
export type AttrType = 'string' | 'int' | 'enum' | 'date' | 'ref'

export interface AttrDef {
  key: string
  type: AttrType
  label: string
  /** enum일 때만 */
  values?: string[]
  /** 목록 셀에서 뒤에 붙일 단위 (예: "학년") */
  suffix?: string
}

/** 대상자(Client) 블록 — lab에서 실제로 렌더에 쓰인다 */
export interface ClientEntityDef {
  /** 기관 고유 속성 — §12-2에서 순회 렌더 */
  attributes: AttrDef[]
  /** 목록의 1차 분류 축. role을 대체한다(§4) */
  primary_axis: { key: string; label: string } | null
  /** 목록 컬럼 — 코어 필드명 또는 attributes 키 */
  list_columns: string[]
  /** 카드/상세 상단 보조 줄에 넣을 필드 (§12-4 슬롯 바인딩) */
  subline: string[]
  /** 상세 좌측 "기관 정보" 블록에 넣을 필드 */
  info_block: { label: string; fields: string[] }
  /** 진행현황 타일 — 길이에서 grid 열 수가 파생된다(§11-2) */
  progress_items: { key: string; label: string }[]
}

/**
 * 구성원(Member) 블록 — §10 실측 기준.
 * 아직 화면에 배선되지 않았다(작업 단위 C). 정의 형식만 확정해 둔다.
 */
export interface MemberEntityDef {
  attributes: AttrDef[]
  list_columns: string[]
  /** 카드의 연락 2행 — 병원은 진료과·면허로 교체된다(§10-1) */
  contact_slots: string[]
  info_block: { label: string; fields: string[] }
  /** 활동 지표 3종 */
  metric_items: { key: string; label: string }[]
  /**
   * 역할 어휘는 선언하지 않는다 — 서버 role 테이블이 이미 소유한다(§10).
   * 여기에 두면 서버와 이중 관리가 된다.
   */
}

/**
 * 기관(Center) 블록 — §11 실측 기준.
 * 아직 화면에 배선되지 않았다(작업 단위 D).
 */
export interface CenterEntityDef {
  /** 기본정보 행 — 병원은 식별번호가 2개라 4행 고정을 배열로 푼다(§11-1) */
  info_rows: { key: string; label: string }[]
  /** 통계 타일 */
  stat_tiles: { key: string; label: string; unit: string; href: string }[]
}

export interface OntologyDef {
  org_type: OrgType
  /** 칩에 표시할 기관 이름 */
  org_label: string

  labels: {
    center: string
    client: string
    client_code: string
    member: string
    voucher: string
    /** 진행현황 좌측 항목명 (상담/면담/진료) */
    case: string
  }

  /** status 코드 → 표시 라벨. 코드는 전 기관 동일(§4) */
  status_labels: Record<'active' | 'inactive' | 'archived', string>

  /**
   * §12-3 능력 플래그. 기관명이 아니라 능력을 묻는다.
   * 아직 프로토타입 전용 — 실제 사이드바·라우트 가드 배선은 없다.
   * 메뉴는 별도 선언하지 않고 이 플래그에서 파생된다(§14-2).
   */
  capabilities: {
    billing: boolean
    voucher: boolean
    assessment: boolean
    guardian: boolean
  }

  /** 엔티티별 블록 — 같은 형식의 반복 (§14-2) */
  entities: {
    client: ClientEntityDef
    member: MemberEntityDef
    center: CenterEntityDef
  }

  relations: {
    guardian: {
      enabled: boolean
      label: string
      kinds: string[]
    }
  }
}

/* ────────────────────────────────────────────────────────────
   기본값 — 기존 센터가 그대로 동작해야 한다 (§12-7 안티패턴)
   ──────────────────────────────────────────────────────────── */
const counselingCenter: OntologyDef = {
  org_type: 'counseling_center',
  org_label: '심리센터',
  labels: {
    center: '센터',
    client: '내담자',
    client_code: '코드',
    member: '상담사',
    voucher: '바우처',
    case: '상담'
  },
  status_labels: { active: '활동중', inactive: '휴면', archived: '종결' },
  capabilities: {
    billing: true,
    voucher: true,
    assessment: true,
    guardian: true
  },
  entities: {
    client: {
      attributes: [],
      primary_axis: { key: 'role', label: '역할별' },
      list_columns: ['name', 'birth_date', 'phone', 'voucher', 'status'],
      subline: ['birth_date', 'gender'],
      info_block: { label: '기본 정보', fields: ['phone', 'email', 'address'] },
      progress_items: [
        { key: 'counseling', label: '상담' },
        { key: 'assessment', label: '검사' }
      ]
    },
    member: {
      attributes: [],
      list_columns: ['name', 'role', 'employment_type', 'phone', 'status'],
      contact_slots: ['phone', 'email'],
      info_block: {
        label: '기본 정보',
        fields: ['employment_type', 'hire_date']
      },
      metric_items: [
        { key: 'clients', label: '담당 내담자' },
        { key: 'counseling', label: '상담' },
        { key: 'assessment', label: '검사' }
      ]
    },
    center: {
      info_rows: [
        { key: 'representative_name', label: '대표자명' },
        { key: 'business_registration_number', label: '사업자등록번호' },
        { key: 'address', label: '주소' },
        { key: 'phone', label: '전화번호' }
      ],
      stat_tiles: [
        { key: 'members', label: '구성원', unit: '명', href: '/member' },
        { key: 'clients', label: '내담자', unit: '명', href: '/clients' },
        { key: 'rooms', label: '상담실', unit: '개', href: '/center/room' },
        {
          key: 'programs',
          label: '프로그램',
          unit: '개',
          href: '/center/program'
        }
      ]
    }
  },
  relations: {
    guardian: {
      enabled: true,
      label: '보호자',
      kinds: ['엄마', '아빠', '할머니', '할아버지', '기타']
    }
  }
}

/* ────────────────────────────────────────────────────────────
   학교 — 슬롯 구조 그대로, 축만 학년으로 (§9-2)
   ──────────────────────────────────────────────────────────── */
const school: OntologyDef = {
  org_type: 'school',
  org_label: '학교',
  labels: {
    center: '학교',
    client: '학생',
    client_code: '학번',
    member: '상담교사',
    voucher: '지원사업',
    case: '상담'
  },
  status_labels: { active: '재학', inactive: '휴학', archived: '졸업' },
  capabilities: {
    billing: false,
    voucher: false,
    assessment: true,
    guardian: true
  },
  entities: {
    client: {
      attributes: [
        { key: 'grade', type: 'int', label: '학년', suffix: '학년' },
        { key: 'class_no', type: 'int', label: '반', suffix: '반' },
        { key: 'number', type: 'int', label: '번호', suffix: '번' },
        { key: 'homeroom', type: 'ref', label: '담임' }
      ],
      primary_axis: { key: 'grade', label: '학년별' },
      list_columns: ['name', 'grade_class', 'homeroom', 'status'],
      subline: ['birth_date', 'gender'],
      info_block: { label: '학적 정보', fields: ['grade_class', 'homeroom'] },
      progress_items: [
        { key: 'counseling', label: '상담' },
        { key: 'assessment', label: '검사' }
      ]
    },
    member: {
      attributes: [
        { key: 'subject', type: 'string', label: '담당 학년' },
        {
          key: 'position',
          type: 'enum',
          label: '직위',
          values: ['전문상담교사', '기간제', '교원']
        }
      ],
      list_columns: ['name', 'role', 'position', 'phone', 'status'],
      contact_slots: ['phone', 'email'],
      info_block: { label: '소속 정보', fields: ['subject', 'position'] },
      metric_items: [
        { key: 'clients', label: '담당 학생' },
        { key: 'counseling', label: '상담' },
        { key: 'assessment', label: '검사' }
      ]
    },
    center: {
      info_rows: [
        { key: 'representative_name', label: '교장' },
        { key: 'school_code', label: '표준학교코드' },
        { key: 'address', label: '주소' },
        { key: 'phone', label: '전화번호' }
      ],
      stat_tiles: [
        { key: 'members', label: '교직원', unit: '명', href: '/member' },
        { key: 'clients', label: '학생', unit: '명', href: '/clients' },
        { key: 'rooms', label: '상담실', unit: '개', href: '/center/room' },
        {
          key: 'programs',
          label: '프로그램',
          unit: '개',
          href: '/center/program'
        }
      ]
    }
  },
  relations: {
    guardian: {
      enabled: true,
      label: '보호자',
      kinds: ['담임', '모', '부', '조부모', '기타']
    }
  }
}

/* ────────────────────────────────────────────────────────────
   군대 — 보호자 축이 통째로 없다. subline도 교체 (§9-1)
   ──────────────────────────────────────────────────────────── */
const military: OntologyDef = {
  org_type: 'military',
  org_label: '군대',
  labels: {
    center: '부대',
    client: '장병',
    client_code: '군번',
    member: '병영생활전문상담관',
    voucher: '지원 프로그램',
    case: '면담'
  },
  status_labels: { active: '복무중', inactive: '휴가/파견', archived: '전역' },
  capabilities: {
    billing: false,
    voucher: false,
    assessment: true,
    guardian: false
  },
  entities: {
    client: {
      attributes: [
        {
          key: 'rank',
          type: 'enum',
          label: '계급',
          values: ['이병', '일병', '상병', '병장', '부사관', '장교']
        },
        { key: 'unit', type: 'string', label: '소속부대' },
        { key: 'discharge_date', type: 'date', label: '전역예정일' }
      ],
      primary_axis: { key: 'unit', label: '소속부대별' },
      list_columns: ['name', 'rank', 'unit', 'discharge_date', 'status'],
      // 성인 단독이라 생년월일·성별의 변별력이 낮다 → 계급·전역일로 교체
      subline: ['rank', 'discharge_date'],
      info_block: {
        label: '복무 정보',
        fields: ['rank', 'unit', 'discharge_date']
      },
      progress_items: [
        { key: 'counseling', label: '면담' },
        { key: 'assessment', label: '심리검사' }
      ]
    },
    member: {
      attributes: [
        { key: 'assigned_unit', type: 'string', label: '담당 부대' },
        { key: 'civil_grade', type: 'string', label: '군무원 등급' }
      ],
      list_columns: ['name', 'role', 'assigned_unit', 'phone', 'status'],
      // 군에선 소속이 이메일보다 먼저 필요 (§10-1)
      contact_slots: ['assigned_unit', 'phone'],
      info_block: {
        label: '담당 부대',
        fields: ['assigned_unit', 'civil_grade']
      },
      metric_items: [
        { key: 'clients', label: '관리 인원' },
        { key: 'counseling', label: '면담' },
        { key: 'assessment', label: '심리검사' }
      ]
    },
    center: {
      info_rows: [
        { key: 'representative_name', label: '지휘관' },
        { key: 'unit_code', label: '부대기호' },
        { key: 'parent_unit', label: '상급부대' },
        { key: 'phone', label: '전화번호' }
      ],
      stat_tiles: [
        { key: 'members', label: '상담관', unit: '명', href: '/member' },
        { key: 'clients', label: '장병', unit: '명', href: '/clients' },
        { key: 'rooms', label: '상담실', unit: '개', href: '/center/room' },
        {
          key: 'programs',
          label: '프로그램',
          unit: '개',
          href: '/center/program'
        }
      ]
    }
  },
  relations: {
    guardian: { enabled: false, label: '', kinds: [] }
  }
}

/* ────────────────────────────────────────────────────────────
   병원 — 진행현황이 3종. 타일 열 수가 배열에서 파생됨 (§11-2)
   ──────────────────────────────────────────────────────────── */
const clinic: OntologyDef = {
  org_type: 'clinic',
  org_label: '병원',
  labels: {
    center: '병원',
    client: '환자',
    client_code: '등록번호',
    member: '임상심리사',
    voucher: '급여 인정',
    case: '진료'
  },
  status_labels: { active: '외래', inactive: '휴진', archived: '종결' },
  capabilities: {
    billing: true,
    voucher: false,
    assessment: true,
    guardian: true
  },
  entities: {
    client: {
      attributes: [
        { key: 'doctor', type: 'ref', label: '주치의' },
        {
          key: 'visit_type',
          type: 'enum',
          label: '진료구분',
          values: ['외래', '입원', '응급']
        },
        { key: 'diagnosis', type: 'string', label: '진단코드' }
      ],
      primary_axis: { key: 'doctor', label: '주치의별' },
      list_columns: ['name', 'doctor', 'visit_type', 'diagnosis', 'status'],
      subline: ['birth_date', 'gender'],
      info_block: {
        label: '진료 정보',
        fields: ['doctor', 'visit_type', 'diagnosis']
      },
      // 3종 — grid-cols-2 하드코딩이었다면 여기서 깨진다
      progress_items: [
        { key: 'counseling', label: '진료' },
        { key: 'assessment', label: '검사' },
        { key: 'prescription', label: '처방' }
      ]
    },
    member: {
      attributes: [
        { key: 'department', type: 'string', label: '진료과' },
        { key: 'license_no', type: 'string', label: '면허번호' }
      ],
      list_columns: ['name', 'role', 'department', 'license_no', 'status'],
      // 의료기관은 자격 식별이 연락처보다 상위 (§10-1)
      contact_slots: ['department', 'license_no'],
      info_block: {
        label: '면허 · 진료과',
        fields: ['department', 'license_no']
      },
      metric_items: [
        { key: 'clients', label: '담당 환자' },
        { key: 'counseling', label: '진료' },
        { key: 'assessment', label: '검사' }
      ]
    },
    center: {
      // 병원만 식별번호가 2개 — 4행 고정이었다면 여기서 깨진다 (§11-1)
      info_rows: [
        { key: 'representative_name', label: '병원장' },
        { key: 'business_registration_number', label: '사업자등록번호' },
        { key: 'institution_no', label: '요양기관번호' },
        { key: 'address', label: '주소' },
        { key: 'phone', label: '전화번호' }
      ],
      stat_tiles: [
        { key: 'members', label: '의료진', unit: '명', href: '/member' },
        { key: 'clients', label: '환자', unit: '명', href: '/clients' },
        { key: 'rooms', label: '진료실', unit: '개', href: '/center/room' },
        {
          key: 'programs',
          label: '프로그램',
          unit: '개',
          href: '/center/program'
        }
      ]
    }
  },
  relations: {
    guardian: {
      enabled: true,
      label: '보호자',
      kinds: ['주보호자', '법정대리인', '배우자', '자녀', '기타']
    }
  }
}

export const ONTOLOGIES: Record<OrgType, OntologyDef> = {
  counseling_center: counselingCenter,
  school,
  military,
  clinic
}

export const ORG_TYPES: OrgType[] = [
  'counseling_center',
  'school',
  'military',
  'clinic'
]
