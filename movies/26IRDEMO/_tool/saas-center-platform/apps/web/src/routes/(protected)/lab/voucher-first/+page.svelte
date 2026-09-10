<script lang="ts">
  // ============================================================
  // 바우처 현황 — 바우처 기준 재편 (Lab · B안 마스터-디테일)
  // ============================================================
  //
  // 현재 `/vouchers`는 **내담자 기준**이다(1뎁스 내담자 목록 → 2뎁스 그 사람의 바우처 카드
  // → 3뎁스 바우처 상세·서류). 1·2뎁스가 내담자 도메인의 복제라, 축을 **바우처(사업)** 로
  // 뒤집고 "이 사업을 쓰는 내담자들 중 서류 준비할 사람을 골라 일괄 발급"으로 바꾼 시안이다.
  //
  // 이 랩이 확인하려는 것 세 가지:
  //   ① 좌 레일(사업 전환) + 우 패널(내담자 테이블) 2분할이 실제 폭에서 성립하는가
  //   ② 체크박스 선택 → 하단 액션바 → 서식 일괄 발급 모달의 흐름이 자연스러운가
  //   ③ 축을 바꾸면 잃는 "사업 가로지르는 뷰"를 좌 레일 최상단 `전체` 행이 대신할 수 있는가
  //      (대시보드 소진·만료 임박 딥링크가 착지할 자리이기도 하다)
  //
  // 데이터는 전부 목업 — API·라우팅은 건드리지 않는다.
  // 정식 반영 시 논의할 것: `/settings/vouchers`(바우처 관리) 상세의 `바우처 보유 내담자`
  // 탭과 정면 중복 → 관리=사업 정의 / 현황=운영으로 역할을 가르고 그 탭은 이리로 이관.

  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import Table, { type TableColumn } from '$lib/components/Table.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import Select from '$lib/components/Select.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import ArrowRightIcon16 from '$lib/assets/ArrowRightIcon16.svelte'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import ArrowLeftIcon20 from '$lib/assets/ArrowLeftIcon20.svelte'
  import ArrowRightIcon20 from '$lib/assets/ArrowRightIcon20.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'

  // ─────────────────────────────────────────────
  // 목업 데이터
  // ─────────────────────────────────────────────

  /** 목업 기준일 — D-day 계산 고정 (실데이터에선 오늘) */
  const TODAY = '2026-08-26'

  interface FormTemplate {
    id: string
    name: string
  }

  interface Program {
    id: string
    name: string
    org: string
    year: number
    unitPrice: number
    period: string
    ended: boolean
    /** 이 사업에서 받는 서식 — 서류 분모(n/m의 m) */
    templateIds: string[]
  }

  interface ClientRow {
    id: string // client_voucher_id
    programId: string
    name: string
    birth: string
    gender: 'MALE' | 'FEMALE'
    usedSessions: number
    totalSessions: number
    validUntil: string
    /** 발급·작성 완료된 서식 수 (사업 서식 목록 앞에서부터 채워진 것으로 본다) */
    docDone: number
  }

  const TEMPLATES: FormTemplate[] = [
    { id: 't1', name: '바우처 이용 동의서' },
    { id: 't2', name: '초기 상담 신청서' },
    { id: 't3', name: '개인정보 수집·이용 동의서' },
    { id: 't4', name: '회기별 상담 확인서' },
    { id: 't5', name: '서비스 만족도 조사' },
    { id: 't6', name: '발달재활 의뢰서' },
    { id: 't7', name: '위기 스크리닝 기록지' }
  ]

  const PROGRAMS: Program[] = [
    {
      id: 'p1',
      name: '아동청소년 심리지원',
      org: '성남시청',
      year: 2026,
      unitPrice: 45000,
      period: '2026.03.01 ~ 2026.12.31',
      ended: false,
      templateIds: ['t1', 't2', 't3', 't4']
    },
    {
      id: 'p2',
      name: '청년마음건강지원',
      org: '보건복지부',
      year: 2026,
      unitPrice: 70000,
      period: '2026.01.01 ~ 2026.12.31',
      ended: false,
      templateIds: ['t1', 't3', 't5']
    },
    {
      id: 'p3',
      name: '발달재활서비스',
      org: '성남시청',
      year: 2026,
      unitPrice: 55000,
      period: '2026.01.01 ~ 2026.12.31',
      ended: false,
      templateIds: ['t1', 't2', 't3', 't4', 't6']
    },
    {
      id: 'p4',
      name: '가족회복 상담지원',
      org: '경기도',
      year: 2026,
      unitPrice: 60000,
      period: '2026.04.01 ~ 2027.03.31',
      ended: false,
      templateIds: ['t1', 't3']
    },
    {
      id: 'p5',
      name: '위기개입 긴급상담',
      org: '여성가족부',
      year: 2026,
      unitPrice: 80000,
      period: '2026.02.01 ~ 2026.12.31',
      ended: false,
      templateIds: ['t1', 't7']
    },
    {
      id: 'p6',
      name: '노인 심리상담',
      org: '성남시청',
      year: 2025,
      unitPrice: 40000,
      period: '2025.03.01 ~ 2025.12.31',
      ended: true,
      templateIds: ['t1', 't3']
    }
  ]

  const ROWS: ClientRow[] = [
    // p1 — 아동청소년 심리지원 (12명)
    {
      id: 'v1',
      programId: 'p1',
      name: '김민준',
      birth: '2015-03-11',
      gender: 'MALE',
      usedSessions: 4,
      totalSessions: 12,
      validUntil: '2026-09-04',
      docDone: 2
    },
    {
      id: 'v2',
      programId: 'p1',
      name: '이서연',
      birth: '2013-07-02',
      gender: 'FEMALE',
      usedSessions: 8,
      totalSessions: 12,
      validUntil: '2026-10-10',
      docDone: 4
    },
    {
      id: 'v3',
      programId: 'p1',
      name: '박지우',
      birth: '2016-01-20',
      gender: 'MALE',
      usedSessions: 2,
      totalSessions: 12,
      validUntil: '2026-08-29',
      docDone: 0
    },
    {
      id: 'v4',
      programId: 'p1',
      name: '최하은',
      birth: '2014-11-05',
      gender: 'FEMALE',
      usedSessions: 11,
      totalSessions: 12,
      validUntil: '2026-12-31',
      docDone: 3
    },
    {
      id: 'v5',
      programId: 'p1',
      name: '정도윤',
      birth: '2012-05-17',
      gender: 'MALE',
      usedSessions: 6,
      totalSessions: 12,
      validUntil: '2026-11-20',
      docDone: 4
    },
    {
      id: 'v6',
      programId: 'p1',
      name: '강서우',
      birth: '2015-09-23',
      gender: 'FEMALE',
      usedSessions: 1,
      totalSessions: 12,
      validUntil: '2026-09-12',
      docDone: 1
    },
    {
      id: 'v7',
      programId: 'p1',
      name: '윤지호',
      birth: '2013-02-08',
      gender: 'MALE',
      usedSessions: 12,
      totalSessions: 12,
      validUntil: '2026-09-30',
      docDone: 4
    },
    {
      id: 'v8',
      programId: 'p1',
      name: '임채원',
      birth: '2016-06-30',
      gender: 'FEMALE',
      usedSessions: 3,
      totalSessions: 12,
      validUntil: '2026-10-05',
      docDone: 0
    },
    {
      id: 'v9',
      programId: 'p1',
      name: '오시윤',
      birth: '2014-04-14',
      gender: 'MALE',
      usedSessions: 5,
      totalSessions: 12,
      validUntil: '2026-12-15',
      docDone: 2
    },
    {
      id: 'v10',
      programId: 'p1',
      name: '한예린',
      birth: '2015-12-01',
      gender: 'FEMALE',
      usedSessions: 9,
      totalSessions: 12,
      validUntil: '2026-11-08',
      docDone: 4
    },
    {
      id: 'v11',
      programId: 'p1',
      name: '서준우',
      birth: '2012-08-19',
      gender: 'MALE',
      usedSessions: 7,
      totalSessions: 12,
      validUntil: '2026-09-02',
      docDone: 1
    },
    {
      id: 'v12',
      programId: 'p1',
      name: '문가온',
      birth: '2017-03-27',
      gender: 'FEMALE',
      usedSessions: 0,
      totalSessions: 12,
      validUntil: '2026-12-31',
      docDone: 0
    },
    // p2 — 청년마음건강지원 (6명)
    {
      id: 'v13',
      programId: 'p2',
      name: '조은채',
      birth: '2001-04-09',
      gender: 'FEMALE',
      usedSessions: 5,
      totalSessions: 10,
      validUntil: '2026-11-30',
      docDone: 3
    },
    {
      id: 'v14',
      programId: 'p2',
      name: '배도현',
      birth: '1999-10-22',
      gender: 'MALE',
      usedSessions: 2,
      totalSessions: 10,
      validUntil: '2026-12-20',
      docDone: 1
    },
    {
      id: 'v15',
      programId: 'p2',
      name: '신유진',
      birth: '2003-01-15',
      gender: 'FEMALE',
      usedSessions: 9,
      totalSessions: 10,
      validUntil: '2026-10-28',
      docDone: 3
    },
    {
      id: 'v16',
      programId: 'p2',
      name: '황태윤',
      birth: '2000-07-30',
      gender: 'MALE',
      usedSessions: 4,
      totalSessions: 10,
      validUntil: '2026-12-31',
      docDone: 3
    },
    {
      id: 'v17',
      programId: 'p2',
      name: '노아라',
      birth: '2002-12-03',
      gender: 'FEMALE',
      usedSessions: 1,
      totalSessions: 10,
      validUntil: '2026-11-14',
      docDone: 2
    },
    {
      id: 'v18',
      programId: 'p2',
      name: '류시온',
      birth: '1998-05-26',
      gender: 'MALE',
      usedSessions: 7,
      totalSessions: 10,
      validUntil: '2026-12-05',
      docDone: 3
    },
    // p3 — 발달재활서비스 (8명)
    {
      id: 'v19',
      programId: 'p3',
      name: '고은우',
      birth: '2018-02-11',
      gender: 'MALE',
      usedSessions: 3,
      totalSessions: 12,
      validUntil: '2026-09-01',
      docDone: 2
    },
    {
      id: 'v20',
      programId: 'p3',
      name: '남지아',
      birth: '2019-06-18',
      gender: 'FEMALE',
      usedSessions: 6,
      totalSessions: 12,
      validUntil: '2026-08-31',
      docDone: 5
    },
    {
      id: 'v21',
      programId: 'p3',
      name: '백서진',
      birth: '2017-09-07',
      gender: 'FEMALE',
      usedSessions: 10,
      totalSessions: 12,
      validUntil: '2026-09-06',
      docDone: 3
    },
    {
      id: 'v22',
      programId: 'p3',
      name: '심우진',
      birth: '2018-11-29',
      gender: 'MALE',
      usedSessions: 1,
      totalSessions: 12,
      validUntil: '2026-12-31',
      docDone: 0
    },
    {
      id: 'v23',
      programId: 'p3',
      name: '양다인',
      birth: '2020-03-03',
      gender: 'FEMALE',
      usedSessions: 8,
      totalSessions: 12,
      validUntil: '2026-09-08',
      docDone: 5
    },
    {
      id: 'v24',
      programId: 'p3',
      name: '유하람',
      birth: '2019-08-21',
      gender: 'MALE',
      usedSessions: 5,
      totalSessions: 12,
      validUntil: '2026-11-11',
      docDone: 4
    },
    {
      id: 'v25',
      programId: 'p3',
      name: '전소율',
      birth: '2018-05-12',
      gender: 'FEMALE',
      usedSessions: 2,
      totalSessions: 12,
      validUntil: '2026-09-05',
      docDone: 1
    },
    {
      id: 'v26',
      programId: 'p3',
      name: '진태오',
      birth: '2020-01-08',
      gender: 'MALE',
      usedSessions: 11,
      totalSessions: 12,
      validUntil: '2026-12-24',
      docDone: 5
    },
    // p4 — 가족회복 상담지원 (4명)
    {
      id: 'v27',
      programId: 'p4',
      name: '차예람',
      birth: '1988-04-17',
      gender: 'FEMALE',
      usedSessions: 2,
      totalSessions: 8,
      validUntil: '2027-03-31',
      docDone: 2
    },
    {
      id: 'v28',
      programId: 'p4',
      name: '표현우',
      birth: '1985-09-02',
      gender: 'MALE',
      usedSessions: 5,
      totalSessions: 8,
      validUntil: '2027-03-31',
      docDone: 1
    },
    {
      id: 'v29',
      programId: 'p4',
      name: '하수민',
      birth: '1991-12-26',
      gender: 'FEMALE',
      usedSessions: 7,
      totalSessions: 8,
      validUntil: '2026-09-07',
      docDone: 2
    },
    {
      id: 'v30',
      programId: 'p4',
      name: '허준영',
      birth: '1979-06-13',
      gender: 'MALE',
      usedSessions: 0,
      totalSessions: 8,
      validUntil: '2027-03-31',
      docDone: 0
    },
    // p5 — 위기개입 긴급상담 (2명)
    {
      id: 'v31',
      programId: 'p5',
      name: '민서하',
      birth: '2004-02-19',
      gender: 'FEMALE',
      usedSessions: 1,
      totalSessions: 4,
      validUntil: '2026-09-03',
      docDone: 1
    },
    {
      id: 'v32',
      programId: 'p5',
      name: '권시현',
      birth: '1996-11-11',
      gender: 'MALE',
      usedSessions: 3,
      totalSessions: 4,
      validUntil: '2026-12-31',
      docDone: 2
    },
    // p6 — 노인 심리상담 (종료 사업, 3명)
    {
      id: 'v33',
      programId: 'p6',
      name: '김복순',
      birth: '1948-03-08',
      gender: 'FEMALE',
      usedSessions: 6,
      totalSessions: 6,
      validUntil: '2025-12-31',
      docDone: 2
    },
    {
      id: 'v34',
      programId: 'p6',
      name: '박길수',
      birth: '1952-07-21',
      gender: 'MALE',
      usedSessions: 5,
      totalSessions: 6,
      validUntil: '2025-12-31',
      docDone: 2
    },
    {
      id: 'v35',
      programId: 'p6',
      name: '이영자',
      birth: '1945-10-09',
      gender: 'FEMALE',
      usedSessions: 6,
      totalSessions: 6,
      validUntil: '2025-12-31',
      docDone: 1
    }
  ]

  // ─────────────────────────────────────────────
  // 파생 계산
  // ─────────────────────────────────────────────

  /** 만료 임박 배지 기준 — D-7 이하에만 붙인다 */
  const URGENT_DAYS = 7

  const dayDiff = (target: string): number => {
    const from = new Date(`${TODAY}T00:00:00`).getTime()
    const to = new Date(`${target}T00:00:00`).getTime()
    return Math.round((to - from) / 86400000)
  }

  const programById = new Map(PROGRAMS.map((p) => [p.id, p]))
  const templateById = new Map(TEMPLATES.map((t) => [t.id, t]))

  const docTotalOf = (row: ClientRow) =>
    programById.get(row.programId)?.templateIds.length ?? 0
  const isDocPending = (row: ClientRow) => row.docDone < docTotalOf(row)

  // ─────────────────────────────────────────────
  // 화면 상태
  // ─────────────────────────────────────────────

  let selectedProgramId = $state<string>('p1')
  let statusFilter = $state<'all' | 'done' | 'pending'>('all')
  let search = $state('')
  let sort = $state('expiring')
  let hideEnded = $state(true)
  let programSearch = $state('')
  let selectedIds = $state<string[]>([])

  const SORT_OPTIONS = [
    { value: 'expiring', title: '만료 임박순' },
    { value: 'remaining', title: '잔여 적은순' },
    { value: 'name', title: '이름순' }
  ]

  const isAllView = $derived(selectedProgramId === 'all')
  const activeProgram = $derived(programById.get(selectedProgramId) ?? null)

  const endedCount = PROGRAMS.filter((p) => p.ended).length
  /** 레일의 범위(= `전체` 행이 세는 대상) — 종료 숨김만 반영, 검색은 표시에만 쓴다 */
  const railPrograms = $derived(
    hideEnded ? PROGRAMS.filter((p) => !p.ended) : PROGRAMS
  )

  /** 레일에 실제로 그리는 목록 — 사업 검색은 목록만 좁힌다(전체 카운트는 안 흔든다) */
  const railListPrograms = $derived(
    programSearch.trim()
      ? railPrograms.filter((p) => p.name.includes(programSearch.trim()))
      : railPrograms
  )

  /** 좌 레일 행에 붙는 숫자 — 그 사업을 쓰는 내담자 수 */
  const clientCountOf = (programId: string) =>
    ROWS.filter((r) => r.programId === programId).length

  /** 좌 레일 `전체` 행 = 현재 레일에 보이는 사업들의 합 (종료 숨김 상태를 따른다) */
  const visibleRows = $derived(
    ROWS.filter((r) => railPrograms.some((p) => p.id === r.programId))
  )

  const baseRows = $derived(
    isAllView
      ? visibleRows
      : ROWS.filter((r) => r.programId === selectedProgramId)
  )

  const countAll = $derived(baseRows.length)
  const countDone = $derived(baseRows.filter((r) => !isDocPending(r)).length)
  const countPending = $derived(baseRows.filter(isDocPending).length)

  const rows = $derived.by(() => {
    const keyword = search.trim()
    const filtered = baseRows.filter((r) => {
      if (statusFilter === 'done' && isDocPending(r)) return false
      if (statusFilter === 'pending' && !isDocPending(r)) return false
      if (keyword && !r.name.includes(keyword)) return false
      return true
    })
    const sorted = [...filtered]
    if (sort === 'expiring') {
      sorted.sort((a, b) => dayDiff(a.validUntil) - dayDiff(b.validUntil))
    } else if (sort === 'remaining') {
      sorted.sort(
        (a, b) =>
          a.totalSessions - a.usedSessions - (b.totalSessions - b.usedSessions)
      )
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    }
    return sorted
  })

  /** 사업·필터가 바뀌면 선택은 버린다 (보이지 않는 행이 선택된 채 남지 않도록) */
  $effect(() => {
    void selectedProgramId
    void statusFilter
    selectedIds = []
  })

  const selectedRows = $derived(rows.filter((r) => selectedIds.includes(r.id)))

  // ─────────────────────────────────────────────
  // 서류 준비 모달 (목업)
  // ─────────────────────────────────────────────

  let docModalOpen = $state(false)
  let checkedTemplateIds = $state<string[]>([])
  let openAfterIssue = $state(true)

  /** 선택한 사람들에게 이 서식이 아직 없는 수 — docDone 앞에서부터 채워진 것으로 계산 */
  const missingCountOf = (templateId: string): number => {
    return selectedRows.filter((r) => {
      const program = programById.get(r.programId)
      if (!program) return false
      const idx = program.templateIds.indexOf(templateId)
      return idx >= 0 && idx >= r.docDone
    }).length
  }

  /** 모달에 띄울 서식 = (단일 사업) 그 사업 서식 / (전체 뷰) 선택된 사람들의 사업 서식 합집합 */
  const modalTemplates = $derived.by(() => {
    const ids = new Set<string>()
    for (const r of selectedRows) {
      const program = programById.get(r.programId)
      program?.templateIds.forEach((id) => ids.add(id))
    }
    return [...ids].map((id) => templateById.get(id)!).filter(Boolean)
  })

  const openDocModal = () => {
    // 기본 선택 = 미발급이 남아 있는 서식만 (이미 다 있는 서식은 꺼둔다)
    checkedTemplateIds = modalTemplates
      .filter((t) => missingCountOf(t.id) > 0)
      .map((t) => t.id)
    docModalOpen = true
  }

  const toggleTemplate = (id: string) => {
    checkedTemplateIds = checkedTemplateIds.includes(id)
      ? checkedTemplateIds.filter((v) => v !== id)
      : [...checkedTemplateIds, id]
  }

  const issueDocuments = () => {
    const people = selectedRows.length
    const kinds = checkedTemplateIds.length
    docModalOpen = false
    selectedIds = []
    snackbarStore.success(
      openAfterIssue
        ? `${people}명에게 서식 ${kinds}종을 발급했어요 — 첫 서류 작성 화면으로 이동합니다 (시안)`
        : `${people}명에게 서식 ${kinds}종을 발급했어요`
    )
  }

  // ─────────────────────────────────────────────
  // 3뎁스 — 내담자 한 명의 바우처 상세 (행 클릭)
  // ─────────────────────────────────────────────

  let detailRowId = $state<string | null>(null)
  const detailRow = $derived(rows.find((r) => r.id === detailRowId) ?? null)
  const detailProgram = $derived(
    detailRow ? (programById.get(detailRow.programId) ?? null) : null
  )

  const openRowDetail = (row: ClientRow) => {
    detailRowId = row.id
  }

  /** 현재 목록 안에서의 위치 — 새 축의 이점(사업 안에서 사람을 훑는다)을 상세에서도 유지 */
  const detailIndex = $derived(
    detailRow ? rows.findIndex((r) => r.id === detailRow.id) : -1
  )
  const goRelative = (step: number) => {
    const next = rows[detailIndex + step]
    if (next) detailRowId = next.id
  }

  const COUNSELORS = ['이수진', '김도현', '박하늘', '정민아']
  /** 목업 결정값 — id 해시로 뽑는다(새로고침해도 같은 값) */
  const hashOf = (id: string) =>
    [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)

  const counselorOf = (row: ClientRow) =>
    COUNSELORS[hashOf(row.id) % COUNSELORS.length]

  /**
   * 회기당 지원금액 — 같은 사업이어도 내담자마다 다르다(소득구간·본인부담 차이).
   * 그래서 사업 헤더에는 단가를 싣지 않고 여기(개인 상세)에서만 보여준다.
   */
  const feeOf = (row: ClientRow) => {
    const base = programById.get(row.programId)?.unitPrice ?? 0
    const ratio = [0.8, 1, 1.2][hashOf(row.id) % 3]
    return Math.round((base * ratio) / 1000) * 1000
  }

  const remainingAmountOf = (row: ClientRow) =>
    (row.totalSessions - row.usedSessions) * feeOf(row)

  const formatWon = (n: number) => `${n.toLocaleString()}원`

  /** 사용 내역 — 사용 회기 수만큼 주 1회로 역산 */
  const usageOf = (row: ClientRow) => {
    const start = new Date(`${TODAY}T00:00:00`)
    return Array.from({ length: row.usedSessions }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() - i * 7 - 3)
      const date = `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
      return {
        id: `${row.id}-u${i}`,
        date,
        session: row.usedSessions - i,
        counselor: counselorOf(row),
        fee: feeOf(row)
      }
    })
  }

  /** 제출 서류 — 사업 서식 목록의 앞에서부터 docDone개가 작성 완료 */
  const docsOf = (row: ClientRow) => {
    const program = programById.get(row.programId)
    if (!program) return []
    return program.templateIds.map((id, idx) => ({
      id,
      name: templateById.get(id)?.name ?? '',
      submitted: idx < row.docDone
    }))
  }

  // ─────────────────────────────────────────────
  // 테이블 컬럼
  // ─────────────────────────────────────────────

  // 선택 — 공용 Table의 `showCheckbox`를 쓰지 않고 컬럼으로 직접 그린다.
  // (Table의 행 체크박스는 Checkbox 라벨이 클릭을 stopPropagation 해서 정사각형을
  //  정확히 누르면 선택이 안 되는 기존 이슈가 있다. 시안에서 막히면 안 되니 우회한다)
  const allChecked = $derived(
    rows.length > 0 && selectedIds.length === rows.length
  )

  const toggleRow = (id: string) => {
    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter((v) => v !== id)
      : [...selectedIds, id]
  }

  const toggleAll = () => {
    selectedIds = allChecked ? [] : rows.map((r) => r.id)
  }

  const columns = $derived.by<TableColumn<ClientRow>[]>(() => {
    const base: TableColumn<ClientRow>[] = [
      {
        key: 'select',
        label: '',
        width: '24px',
        stopPropagation: true,
        headerRender: selectHeader,
        render: selectCell
      },
      {
        key: 'client',
        label: '내담자',
        width: 'minmax(160px, 1fr)',
        render: clientCell
      }
    ]
    if (isAllView) {
      base.push({
        key: 'program',
        label: '바우처',
        width: 'minmax(140px, 1fr)',
        render: programCell
      })
    }
    base.push(
      {
        key: 'sessions',
        label: '잔여 회기',
        width: '168px',
        render: sessionCell
      },
      { key: 'valid', label: '유효기간', width: '164px', render: validCell },
      { key: 'docs', label: '서류', width: '92px', render: docCell },
      { key: 'go', label: '', width: '24px', align: 'center', render: goCell }
    )
    return base
  })

  const formatDate = (date: string) => date.replaceAll('-', '. ')
</script>

{#snippet clientCell({ item }: { item: ClientRow })}
  <div class="flex min-w-0 items-center gap-3">
    <ClientAvatar
      name={item.name}
      gender={item.gender}
      sizeClass="h-10 w-10"
      textClass="text-body-02-normal-semibold"
    />
    <div class="flex min-w-0 flex-col justify-center gap-2">
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-800"
        className="truncate-safe"
        tag="span"
      >
        {item.name}
      </Typography>
      <ClientBirthGender birthDate={item.birth} gender={item.gender} />
    </div>
  </div>
{/snippet}

{#snippet programCell({ item }: { item: ClientRow })}
  <!-- 전체 뷰에서만 나오는 열 — 칩으로 채우면 행마다 색 면이 하나 더 늘어 시끄럽다 -->
  <Typography
    variant="body-01-normal-regular"
    color="text-gray-600"
    className="truncate-safe"
    tag="span"
  >
    {programById.get(item.programId)?.name ?? '-'}
  </Typography>
{/snippet}

{#snippet sessionCell({ item }: { item: ClientRow })}
  {@const remaining = item.totalSessions - item.usedSessions}
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline gap-1">
      <Typography variant="body-01-normal-medium" color="text-gray-800">
        {remaining}
      </Typography>
      <Typography variant="body-03-normal-regular" color="text-body-subtle">
        / {item.totalSessions}회
      </Typography>
    </div>
    <div class="h-1 w-32 overflow-hidden rounded-full bg-gray-100">
      <div
        class="h-full rounded-full {remaining === 0
          ? 'bg-gray-300'
          : 'bg-primary-500'}"
        style="width: {Math.round((remaining / item.totalSessions) * 100)}%"
      ></div>
    </div>
  </div>
{/snippet}

{#snippet validCell({ item }: { item: ClientRow })}
  {@const d = dayDiff(item.validUntil)}
  <div class="flex items-center gap-2">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      {formatDate(item.validUntil)}
    </Typography>
    <!-- 배지는 D-7 이하에만 (그 위는 날짜만) — 경고를 남발하면 무뎌진다 -->
    {#if d >= 0 && d <= URGENT_DAYS}
      <span
        class="flex h-6 shrink-0 items-center rounded-sm bg-status-danger-bg px-2 text-label-01-normal-medium text-status-danger"
      >
        D-{d}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet docCell({ item }: { item: ClientRow })}
  {@const total = docTotalOf(item)}
  <!-- 미완 건수는 적지 않는다 — n/m이 이미 말한다. 완료만 따로 표시 -->
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline gap-1">
      <Typography variant="body-01-normal-medium" color="text-gray-800">
        {item.docDone}
      </Typography>
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        / {total}
      </Typography>
    </div>
    {#if item.docDone === total}
      <Typography variant="body-03-normal-regular" color="text-status-success">
        완료
      </Typography>
    {/if}
  </div>
{/snippet}

{#snippet selectHeader()}
  <Checkbox id="vf-select-all" checked={allChecked} onchange={toggleAll} />
{/snippet}

{#snippet selectCell({ item }: { item: ClientRow })}
  <Checkbox
    id={`vf-row-${item.id}`}
    checked={selectedIds.includes(item.id)}
    onchange={() => toggleRow(item.id)}
  />
{/snippet}

{#snippet goCell()}
  <span class="text-gray-300">
    <ArrowRightIcon16 />
  </span>
{/snippet}

<!-- 컨테이너는 화면을 꽉 채우고(셸 pb-8이 하단 마진), 스크롤은 컨테이너 내부에서만 -->
<div in:fade class="flex h-full min-h-0 flex-col">
  {#if detailRow}
    {@const docs = docsOf(detailRow)}
    {@const usage = usageOf(detailRow)}
    {@const pendingDocs = docs.filter((d) => !d.submitted).length}
    {@const d = dayDiff(detailRow.validUntil)}

    <!-- 타이틀 영역을 브레드크럼으로 갈아끼운다 — 높이 44(h-11) 유지.
         규격은 상담 상세(counseling/status/[id])와 동일: h-11 · mb-2 · 뒤로 버튼 p-1 ·
         상위 crumb `body-02-normal-regular`/`text-body-subtle` · 구분자 gray-300 ·
         현재 crumb `body-02-normal-medium`/`text-body-default` -->
    <div class="mb-2 flex h-11 shrink-0 items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onclick={() => (detailRowId = null)}
          aria-label="뒤로가기"
          class="rounded-lg p-1 transition-colors hover:bg-gray-100"
        >
          <ArrowBackIcon />
        </button>
        <button
          type="button"
          onclick={() => (detailRowId = null)}
          class="transition-colors hover:text-body-default"
        >
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-subtle"
          >
            바우처
          </Typography>
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-gray-300"
        >
          /
        </Typography>
        <Typography
          variant="body-02-normal-medium"
          tag="span"
          color="text-body-default"
          className="truncate-safe"
        >
          {detailProgram?.name ?? ''}
        </Typography>
      </div>

      <!-- 새 축의 이점 — 사업 안에서 사람을 순서대로 훑는다 -->
      <div class="flex shrink-0 items-center gap-2">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          {detailIndex + 1} / {rows.length}
        </Typography>
        <button
          type="button"
          aria-label="이전 내담자"
          disabled={detailIndex <= 0}
          onclick={() => goRelative(-1)}
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArrowLeftIcon20 />
        </button>
        <button
          type="button"
          aria-label="다음 내담자"
          disabled={detailIndex >= rows.length - 1}
          onclick={() => goRelative(1)}
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArrowRightIcon20 />
        </button>
      </div>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card"
    >
      <!-- 헤더: 누구의 어떤 바우처인가 -->
      <header
        class="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 p-5"
      >
        <div class="flex min-w-0 items-center gap-3">
          <ClientAvatar
            name={detailRow.name}
            gender={detailRow.gender}
            sizeClass="h-10 w-10"
            textClass="text-body-02-normal-semibold"
          />
          <div class="min-w-0">
            <Typography
              variant="title-01-normal-semibold"
              color="text-gray-900"
              className="truncate-safe block"
              tag="h2"
            >
              {detailRow.name}
            </Typography>
            <ClientBirthGender
              birthDate={detailRow.birth}
              gender={detailRow.gender}
              class="mt-2"
            />
          </div>
        </div>
        <button
          type="button"
          onclick={() => snackbarStore.info('내담자 상세로 이동 (시안)')}
          class="flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-gray-600 transition-colors hover:bg-gray-50"
        >
          <span class="text-body-02-normal-medium">내담자 상세</span>
          <ArrowRightIcon16 />
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-5">
        <!-- 통계 바 (기존 바우처 상세와 같은 구성 — 단일 컨테이너 + 세로 구분선) -->
        <div class="flex items-center rounded-xl bg-gray-50">
          <div class="min-w-0 flex-1 px-5 py-4">
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="block"
            >
              담당 상담사
            </Typography>
            <Typography
              variant="title-01-normal-semibold"
              color="text-gray-900"
              className="mt-3 block"
            >
              {counselorOf(detailRow)}
            </Typography>
          </div>

          <span
            class="h-12 w-px shrink-0 self-center bg-gray-200"
            aria-hidden="true"
          ></span>

          <div class="min-w-0 flex-1 px-5 py-4">
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="block"
            >
              사용 회기
            </Typography>
            <div class="mt-3 flex items-baseline gap-1">
              <Typography
                variant="title-01-normal-semibold"
                color="text-gray-900"
              >
                {detailRow.usedSessions}
              </Typography>
              <Typography variant="body-02-normal-medium" color="text-gray-400">
                / {detailRow.totalSessions}회
              </Typography>
            </div>
          </div>

          <span
            class="h-12 w-px shrink-0 self-center bg-gray-200"
            aria-hidden="true"
          ></span>

          <div class="min-w-0 flex-1 px-5 py-4">
            <!-- 지원금액은 내담자마다 다르다 — 사업 헤더가 아니라 여기가 자리 -->
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="block"
            >
              잔여 지원금
            </Typography>
            <div class="mt-3 flex items-baseline gap-2">
              <Typography
                variant="title-01-normal-semibold"
                color="text-gray-900"
              >
                {formatWon(remainingAmountOf(detailRow))}
              </Typography>
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-400"
              >
                회기당 {formatWon(feeOf(detailRow))}
              </Typography>
            </div>
          </div>

          <span
            class="h-12 w-px shrink-0 self-center bg-gray-200"
            aria-hidden="true"
          ></span>

          <div class="min-w-0 flex-1 px-5 py-4">
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="block"
            >
              유효기간
            </Typography>
            <div class="mt-3 flex items-baseline gap-2">
              <Typography
                variant="title-01-normal-semibold"
                color="text-gray-900"
              >
                ~{formatDate(detailRow.validUntil)}
              </Typography>
              {#if d >= 0 && d <= URGENT_DAYS}
                <Typography
                  variant="body-03-normal-medium"
                  color="text-status-danger"
                >
                  D-{d}
                </Typography>
              {/if}
            </div>
          </div>
        </div>

        <!-- 제출 서류 -->
        <section class="mt-8">
          <div class="mb-3 flex h-8 items-center justify-between">
            <div class="flex items-center gap-2">
              <Typography variant="title-02-semibold" color="text-gray-900">
                제출 서류
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-400"
              >
                {docs.length}
              </Typography>
            </div>
            <button
              type="button"
              onclick={() => snackbarStore.info('서식 추가 (시안)')}
              class="flex h-8 items-center rounded-lg px-2 transition-colors hover:bg-gray-50"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
              >
                추가
              </Typography>
            </button>
          </div>

          <div
            class="grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
          >
            {#each docs as doc (doc.id)}
              <div class="flex flex-col rounded-xl border border-gray-200 p-4">
                <span
                  class="flex h-6 w-fit items-center rounded-sm px-2 text-label-01-normal-medium {doc.submitted
                    ? 'bg-status-success-bg text-status-success'
                    : 'bg-gray-100 text-gray-500'}"
                >
                  {doc.submitted ? '작성 완료' : '미작성'}
                </span>
                <Typography
                  variant="body-01-normal-semibold"
                  color="text-gray-900"
                  className="mt-3 block truncate-safe"
                >
                  {doc.name}
                </Typography>
                <button
                  type="button"
                  onclick={() =>
                    snackbarStore.info(
                      `${doc.name} ${doc.submitted ? '미리보기' : '작성'} (시안)`
                    )}
                  class="mt-3 h-11 w-full rounded-lg text-body-02-normal-medium transition-colors {doc.submitted
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'border border-primary-400 text-primary-500 hover:bg-primary-50'}"
                >
                  {doc.submitted ? '미리보기' : '작성'}
                </button>
              </div>
            {/each}
          </div>
        </section>

        <!-- 사용 내역 -->
        <section class="mt-8">
          <div class="mb-3 flex h-6 items-center gap-2">
            <Typography variant="title-02-semibold" color="text-gray-900">
              사용 내역
            </Typography>
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              {usage.length}
            </Typography>
          </div>

          {#if usage.length === 0}
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              아직 사용 내역이 없어요
            </Typography>
          {:else}
            <div class="overflow-hidden rounded-xl border border-gray-200">
              <div
                class="grid h-13 items-center gap-4 bg-gray-50 px-5"
                style="grid-template-columns: 140px 80px 1fr 120px;"
              >
                {#each ['이용일', '회기', '상담사', '지원금'] as label (label)}
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-title-subtitle"
                    className={label === '지원금' ? 'text-right' : ''}
                  >
                    {label}
                  </Typography>
                {/each}
              </div>
              {#each usage as u (u.id)}
                <div
                  class="grid h-14 items-center gap-4 border-t border-gray-100 px-5"
                  style="grid-template-columns: 140px 80px 1fr 120px;"
                >
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-700"
                  >
                    {u.date}
                  </Typography>
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-700"
                  >
                    {u.session}회기
                  </Typography>
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-700"
                  >
                    {u.counselor}
                  </Typography>
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-gray-800"
                    className="text-right"
                  >
                    {formatWon(u.fee)}
                  </Typography>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </div>

      <!-- 푸터: 미작성 서류 일괄 작성 (목록의 '서류 준비'와 짝) -->
      <footer
        class="flex h-20 shrink-0 items-center justify-between border-t border-gray-200 px-5"
      >
        <Typography
          variant="body-01-normal-medium"
          color={pendingDocs > 0 ? 'text-gray-800' : 'text-gray-400'}
        >
          {pendingDocs > 0
            ? `미작성 ${pendingDocs}건`
            : '서류가 모두 작성됐어요'}
        </Typography>
        <button
          type="button"
          disabled={pendingDocs === 0}
          onclick={() =>
            snackbarStore.info(
              `미작성 ${pendingDocs}건을 순차로 작성합니다 (시안)`
            )}
          class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
        >
          전체 서류 작성
        </button>
      </footer>
    </div>
  {:else}
    <PageTitleSection title="바우처" className="mb-2">
      <span slot="extraBtn">
        <span
          class="flex h-7 items-center rounded-sm bg-gray-100 px-2 text-label-01-normal-medium text-gray-500"
        >
          Lab 시안 · 목업 데이터
        </span>
      </span>
    </PageTitleSection>

    <!-- 좁은 화면(<xl): 좌 레일 대신 상단 드롭다운으로 사업을 고른다 -->
    <div class="mb-4 xl:hidden">
      <Select
        class="h-11 w-full"
        selected={selectedProgramId}
        options={[
          { value: 'all', title: `전체 (${visibleRows.length}명)` },
          ...railPrograms.map((p) => ({
            value: p.id,
            title: `${p.name} (${clientCountOf(p.id)}명)`
          }))
        ]}
        on:change={(e) => (selectedProgramId = e.detail.value)}
      />
    </div>

    <!-- 한 덩어리 컨테이너 + 세로 구분선 (권한 설정과 같은 형태).
       레일과 본문이 별개 카드가 아니라 한 작업 공간으로 읽히도록 카드는 하나만 둔다.
       좌 280 = §Layout Patterns > 목록 레일 폭 -->
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card xl:flex-row"
    >
      <!-- ── 좌: 사업 레일 (내부가 인셋을 소유) ── -->
      <aside
        class="hidden min-h-0 w-70 shrink-0 flex-col border-r border-gray-200 xl:flex"
      >
        <!-- 사업 검색 (내담자 검색은 우측이 소유 — 필터가 두 군데로 갈리지 않게) -->
        <div class="shrink-0 p-5">
          <div
            class="flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-3"
          >
            <SearchIcon />
            <input
              type="text"
              bind:value={programSearch}
              placeholder="사업 검색"
              class="w-full text-body-02-normal-regular placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>

        <!-- 사업 목록 -->
        <!-- 메뉴 사이 간격 8 -->
        <div
          class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-5"
        >
          <!-- `전체` — 사업을 가로지르는 뷰 (대시보드 소진·만료 임박 딥링크 착지점) -->
          <button
            type="button"
            onclick={() => (selectedProgramId = 'all')}
            class="flex w-full items-center gap-2 rounded-lg p-3 text-left transition-colors {isAllView
              ? 'bg-primary-50'
              : 'hover:bg-gray-50'}"
          >
            <Typography
              variant="body-01-normal-semibold"
              color={isAllView ? 'text-primary-600' : 'text-gray-700'}
              className="flex-1 truncate-safe"
              tag="span"
            >
              전체
            </Typography>
            <Typography
              variant="body-02-normal-medium"
              color={isAllView ? 'text-primary-600' : 'text-gray-400'}
              tag="span"
            >
              {visibleRows.length}
            </Typography>
          </button>

          <div class="my-2 h-px shrink-0 bg-gray-100"></div>

          {#each railListPrograms as program (program.id)}
            {@const active = selectedProgramId === program.id}
            <button
              type="button"
              onclick={() => (selectedProgramId = program.id)}
              class="flex w-full items-center gap-2 rounded-lg p-3 text-left transition-colors {active
                ? 'bg-primary-50'
                : 'hover:bg-gray-50'}"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-2">
                <span class="flex min-w-0 items-center gap-2">
                  <Typography
                    variant="body-01-normal-semibold"
                    color={active ? 'text-primary-600' : 'text-gray-800'}
                    className="truncate-safe"
                    tag="span"
                  >
                    {program.name}
                  </Typography>
                  {#if program.ended}
                    <span
                      class="flex h-6 shrink-0 items-center rounded-sm bg-gray-100 px-2 text-label-01-normal-medium text-gray-500"
                    >
                      종료
                    </span>
                  {/if}
                </span>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                  className="truncate-safe"
                  tag="span"
                >
                  {program.year} · {program.org}
                </Typography>
              </span>
              <Typography
                variant="body-02-normal-medium"
                color={active ? 'text-primary-600' : 'text-gray-400'}
                tag="span"
              >
                {clientCountOf(program.id)}
              </Typography>
            </button>
          {/each}
        </div>

        <!-- 종료된 사업 숨기기 (바우처 관리 화면과 같은 토글) -->
        {#if endedCount > 0}
          <div
            class="mt-auto flex h-14 shrink-0 items-center justify-between border-t border-gray-100 px-5"
          >
            <Typography variant="body-02-normal-regular" color="text-gray-600">
              종료된 사업 숨기기
              <span class="text-gray-400">({endedCount})</span>
            </Typography>
            <Switch bind:checked={hideEnded} ariaLabel="종료된 사업 숨기기" />
          </div>
        {/if}
      </aside>

      <!-- ── 우: 내담자 패널 ── -->
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <!-- 패널 헤더: 사업 정체 + 규모 지표 -->
        <!-- 타이틀 섹션 ↔ 칩 줄 구분선은 한 단 진하게(gray-200) — gray-100은 거의 안 보인다 -->
        <header class="shrink-0 border-b border-gray-200 p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <!-- 패널 타이틀 = Title L(20) — 페이지 타이틀(24) 아래 한 단 -->
              <Typography
                variant="headline-02-normal-semibold"
                color="text-gray-900"
                className="truncate-safe block"
                tag="h2"
              >
                {isAllView ? '전체 바우처' : (activeProgram?.name ?? '')}
              </Typography>
              <!-- 부제는 사업을 특정했을 때만 — 전체 뷰는 타이틀로 이미 설명된다 -->
              {#if !isAllView && activeProgram}
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                  className="mt-2 block"
                  tag="p"
                >
                  {activeProgram.year} · {activeProgram.org} · {activeProgram.period}
                </Typography>
              {/if}
            </div>

            {#if !isAllView}
              <button
                type="button"
                onclick={() =>
                  snackbarStore.info('바우처 관리(사업 설정)로 이동 (시안)')}
                class="flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-gray-600 transition-colors hover:bg-gray-50"
              >
                <span class="text-body-02-normal-medium">바우처 관리</span>
                <ArrowRightIcon16 />
              </button>
            {/if}
          </div>

          <!-- 규모 지표 — 잔여 회기·단가는 뺀다(지원금액은 내담자마다 달라 사업 단위 숫자가 아니다).
             '처리 대상' 숫자는 아래 필터 칩이 소유한다 -->
          <div class="mt-3 flex items-center gap-4">
            <div class="flex items-center gap-2">
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-500"
              >
                내담자
              </Typography>
              <Typography variant="body-02-normal-medium" color="text-gray-800">
                {countAll}명
              </Typography>
            </div>
            {#if !isAllView && activeProgram}
              <span class="h-3 w-px bg-gray-200" aria-hidden="true"></span>
              <div class="flex items-center gap-2">
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                >
                  제출 서식
                </Typography>
                <Typography
                  variant="body-02-normal-medium"
                  color="text-gray-800"
                >
                  {activeProgram.templateIds.length}종
                </Typography>
              </div>
            {/if}
          </div>
        </header>

        <!-- 필터 툴바 — 컨트롤 높이는 .filter-bar가 소유(44, §text-field '작성 48 / 필터 44').
           칩만 Segmented 규격인 36이라 한 줄에서 세로 가운데로 맞춘다 -->
        <div
          class="filter-bar flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3"
        >
          <div class="flex items-center gap-1">
            {#each [{ value: 'all', label: '전체', count: countAll }, { value: 'done', label: '완료', count: countDone }, { value: 'pending', label: '미완료', count: countPending }] as chip (chip.value)}
              {@const active = statusFilter === chip.value}
              <button
                type="button"
                onclick={() =>
                  (statusFilter = chip.value as typeof statusFilter)}
                class="flex h-9 items-center gap-2 rounded-full px-3 transition-colors {active
                  ? 'bg-gray-700 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
              >
                <span class="text-body-02-normal-regular">{chip.label}</span>
                <span
                  class="text-body-02-normal-medium {active
                    ? 'text-white'
                    : 'text-gray-400'}"
                >
                  {chip.count}
                </span>
              </button>
            {/each}
          </div>

          <div class="flex items-center gap-2">
            <div
              class="filter-bar-field flex w-56 items-center gap-2 rounded-lg border border-gray-200 px-3"
            >
              <SearchIcon />
              <input
                type="text"
                bind:value={search}
                placeholder="내담자 이름"
                class="w-full text-body-02-normal-regular placeholder:text-gray-400 outline-none"
              />
            </div>
            <Select
              class="w-32 rounded-lg bg-white"
              selected={sort}
              options={SORT_OPTIONS}
              on:change={(e) => (sort = e.detail.value)}
            />
          </div>
        </div>

        <!-- 내담자 테이블 -->
        <div class="min-h-0 flex-1">
          {#if rows.length === 0}
            <div class="flex h-full items-center justify-center py-12">
              <NoDataSection description="조건에 맞는 내담자가 없어요" />
            </div>
          {:else}
            <!-- 공용 Table: 셀 인셋을 20으로 맞추고, 헤더 sticky를 풀어 헤더+바디가 함께 스크롤되게 한다 -->
            <Table
              {columns}
              data={rows}
              keyField="id"
              hoverEnabled
              rowHeight="min-h-20"
              headerClass="px-5! static!"
              rowClass="px-5!"
              onRowClick={openRowDetail}
            />
          {/if}
        </div>

        <!-- 선택 액션바 — 선택이 있을 때만 나타난다 -->
        {#if selectedIds.length > 0}
          <div
            in:fade={{ duration: 120 }}
            class="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-5 pt-4 pb-5"
          >
            <Typography variant="body-01-normal-medium" color="text-gray-800">
              {selectedIds.length}명 선택
            </Typography>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => (selectedIds = [])}
                class="h-11 rounded-lg border border-gray-200 px-5 text-body-01-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                선택 해제
              </button>
              <button
                type="button"
                onclick={openDocModal}
                class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
              >
                서류 준비
              </button>
            </div>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<!-- ── 서류 준비 모달 (목업) ── -->
{#if docModalOpen}
  <div
    class="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-6"
    transition:fade={{ duration: 120 }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0"
      onclick={() => (docModalOpen = false)}
      aria-hidden="true"
    ></div>
    <div
      class="relative flex max-h-[80vh] w-135 flex-col overflow-hidden rounded-[20px] bg-white shadow-xl"
    >
      <BaseModal
        closeModal={() => (docModalOpen = false)}
        headerClass="px-5 py-4 items-start"
        bodyClass="p-5"
      >
        {#snippet header()}
          <div class="flex flex-col gap-2">
            <Typography
              variant="headline-02-normal-semibold"
              color="text-gray-800"
            >
              서류 준비
            </Typography>
            <Typography variant="body-02-normal-regular" color="text-gray-500">
              선택한 {selectedRows.length}명에게 발급할 서식을 고르세요
            </Typography>
          </div>
        {/snippet}

        {#snippet body()}
          <div class="flex flex-col gap-6">
            <!-- 서식 목록 -->
            <div class="flex flex-col gap-1">
              {#each modalTemplates as template (template.id)}
                {@const missing = missingCountOf(template.id)}
                {@const checked = checkedTemplateIds.includes(template.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <!-- 면(박스)을 겹치지 않는다 — 선택 표시는 체크박스가 이미 한다 -->
                <div
                  onclick={() => toggleTemplate(template.id)}
                  class="flex h-12 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-gray-50"
                >
                  <Checkbox
                    id={`tpl-${template.id}`}
                    {checked}
                    onchange={() => toggleTemplate(template.id)}
                  />
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-gray-800"
                    className="flex-1 truncate-safe"
                    tag="span"
                  >
                    {template.name}
                  </Typography>
                  <Typography
                    variant="body-02-normal-regular"
                    color={missing > 0 ? 'text-gray-600' : 'text-gray-400'}
                    tag="span"
                  >
                    {missing > 0 ? `미발급 ${missing}명` : '전원 발급됨'}
                  </Typography>
                </div>
              {/each}
            </div>

            <!-- 보조 컨트롤 (그룹에 딸린 것이라 12) -->
            <label
              class="flex cursor-pointer items-center gap-3"
              for="open-after-issue"
            >
              <Checkbox id="open-after-issue" bind:checked={openAfterIssue} />
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-700"
              >
                발급 후 바로 작성 화면으로 이동 (여러 명이면 순차로 이어서 작성)
              </Typography>
            </label>

            <!-- 작성은 개인값이라 일괄이 아니라는 점을 화면에서 고지 -->
            <div class="rounded-lg bg-gray-50 p-4">
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
              >
                발급·연결까지는 한 번에 처리되고, 내용 작성은 내담자별로 순차
                진행됩니다.
              </Typography>
            </div>
          </div>
        {/snippet}

        {#snippet footer()}
          <button
            type="button"
            onclick={() => (docModalOpen = false)}
            class="h-11 rounded-lg border border-gray-200 px-5 text-body-01-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={checkedTemplateIds.length === 0}
            onclick={issueDocuments}
            class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
          >
            {selectedRows.length}명에게 발급
          </button>
        {/snippet}
      </BaseModal>
    </div>
  </div>
{/if}
