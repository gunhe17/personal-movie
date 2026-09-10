/**
 * Assessment Receive Service
 * 검사 접수 관련 비즈니스 로직 (모달/토스트/API/invalidate)
 */

import { goto } from '$app/navigation'
import { browser } from '$app/environment'
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { receiveFormStore } from '$lib/stores/receiveForm'
import { excelUploadStore, type ExcelClientData } from '$lib/stores/excelUpload'
import ExcelUploadModal from '$lib/components/modal/ExcelUploadModal.svelte'
import PackageSettingModal from '$lib/components/modal/PackageSettingModal.svelte'
import RoomRegisterModal from '$lib/components/modal/RoomRegisterModal.svelte'
import SimpleClientRegisterModal, {
  type RegisteredClientData
} from '$lib/components/modal/SimpleClientRegisterModal.svelte'
import { createAssessmentSet } from '$lib/hooks/actions/assessmentSet.action'
import {
  createBatchAssessmentCase,
  createIndividualAssessmentCase,
  getCaseById,
  updateCase,
  type CaseDetail,
  type ScheduleUpdateInput,
  type UpdateCasePayload
} from '$lib/hooks/actions/case.action'
export type { CaseDetail } from '$lib/hooks/actions/case.action'
import { postCreateClient } from '$lib/hooks/actions/client.action'
import {
  getInstitutionList,
  postCreateInstitution
} from '$lib/hooks/actions/institution.action'
import type { QueryClient } from '@tanstack/svelte-query'
import { MODAL_SIZES, DEFAULT_ASSESSMENT_DURATION_HOURS } from './constants'
import * as XLSX from 'xlsx'
import {
  buildCreateClientRequest,
  buildCreateInstitutionPayload,
  buildGroupScheduleRequest,
  buildIndividualScheduleRequest,
  formatBirthDateValue
} from './query-builders'
import type { CenterAssessment } from '$lib/hooks/actions/assessment.action'
import type { PackageType } from '$lib/hooks/actions/package.action'
import type { MemberListItem } from '$lib/hooks/actions/member.action'
import type { RoomItemType } from '$lib/hooks/actions/room.action'
import type { ExtendedClient, GroupMember } from '$lib/stores/receiveForm'
import type { Organization } from '$lib/types/organization'
import { requireCenterId } from '$lib/stores/center.store'
import { get } from 'svelte/store'

export interface ReceiveServiceDeps {
  queryClient: QueryClient
}

export interface SubmitReceiveInput {
  clientType: 'individual' | 'group'
  /** 센터 방문 여부. false면 일정 없이 접수 */
  visitCenter?: boolean
  selectedDate: Date | null
  selectedTime: string | null
  selectedEndTime?: string | null
  selectedMember: MemberListItem[]
  selectedRoom: RoomItemType | null
  selectedAssessmentItems: string[]
  excludedAssessmentItems: string[]
  selectedPackageIds: string[]
  comprehensiveReport: '미작성' | '작성'
  clientMemo: string
  assessmentsData: CenterAssessment[]
  packagesData: PackageType[]
  /** 개인 모드: 선택된 내담자 (다중 선택 지원) */
  selectedClients: ExtendedClient[]
  selectedOrganization: Organization | null
  groupMembers: GroupMember[]
  /** 편집 모드: 있으면 케이스 수정 API 호출 (내담자 변경 없음) */
  editCaseId?: string
}

export function createReceiveService({ queryClient }: ReceiveServiceDeps) {
  function getReceiveBasePath(): string {
    if (!browser) return '/assessment/receive'
    return window.location.pathname.startsWith('/assessment-flow/receive')
      ? '/assessment-flow/receive'
      : '/assessment/receive'
  }

  function isUuid(value: string | undefined | null): boolean {
    if (!value) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  }

  function extractCreatedId(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null
    const directId = (result as { id?: string }).id
    if (directId) return directId
    const nestedId = (result as { data?: { id?: string } }).data?.id
    return nestedId || null
  }

  function toDateOnly(
    value: Date | string | null | undefined
  ): string | undefined {
    if (!value) return undefined
    const date = value instanceof Date ? value : new Date(value)
    if (isNaN(date.getTime())) return undefined
    return date.toISOString().split('T')[0]
  }

  function getAssessmentIds(
    assessmentsData: CenterAssessment[],
    packagesData: PackageType[],
    selectedAssessmentItems: string[],
    selectedPackageIds: string[],
    excludedAssessmentItems: string[]
  ): string[] {
    const selectedAssessmentIds = assessmentsData
      .filter((assessment) =>
        selectedAssessmentItems.includes(assessment.eng_name)
      )
      .map((assessment) => assessment.assessment_id)

    const selectedPackageAssessmentIds = packagesData
      .filter((pkg) => selectedPackageIds.includes(pkg.uid))
      .flatMap((pkg) =>
        pkg.assessments
          .filter(
            (assessment) =>
              !excludedAssessmentItems.includes(assessment.eng_name)
          )
          .map((assessment) => assessment.uid)
      )

    return [
      ...new Set([...selectedAssessmentIds, ...selectedPackageAssessmentIds])
    ]
  }

  // 쿼리 무효화
  const invalidateCases = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['getCases'],
      exact: false
    })
    await queryClient.invalidateQueries({
      queryKey: ['getCaseStatusCounts'],
      exact: false
    })
  }

  const invalidatePackages = () => {
    queryClient.invalidateQueries({
      queryKey: ['getAssessmentSetList'],
      exact: false
    })
  }

  // 엑셀 업로드 모달 열기
  function openExcelUploadModal(
    onUpload: (clients: ExcelClientData[], fileName: string) => void
  ) {
    modalStore.open({
      component: ExcelUploadModal,
      props: {
        templateData: RECEIVE_CLIENT_TEMPLATE_DATA,
        templateFileName: '내담자_명단_템플릿.xlsx',
        onSubmit: async (file: File) => {
          const result = await parseExcelFile(file)
          if (result) {
            onUpload(result.clients, file.name)
          }
        }
      },
      options: MODAL_SIZES.excelUpload
    })
  }

  // 엑셀 파일 파싱
  async function parseExcelFile(
    file: File
  ): Promise<{ clients: ExcelClientData[] } | null> {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (
        | string
        | number
      )[][]

      const rows = jsonData.slice(1).filter((row) => row.length > 0)

      if (rows.length === 0) {
        snackbarStore.error('엑셀 파일에 데이터가 없습니다.')
        return null
      }

      const clients: ExcelClientData[] = rows.map((row, index) => {
        // 엑셀 템플릿 컬럼 순서: 이름, 성별, 생년월일, 보호자 이름, 관계, 보호자 성별, 보호자 생년월일, 보호자 연락처
        const name = String(row[0] || '').trim()
        const genderRaw = String(row[1] || '').trim()
        const birthDateRaw = row[2]
        const guardianName = String(row[3] || '').trim()
        const guardianRelationship = String(row[4] || '').trim()
        const guardianGenderRaw = String(row[5] || '').trim()
        const guardianBirthDateRaw = row[6]
        const guardianPhone = String(row[7] || '').trim()

        let birthDate = ''
        if (birthDateRaw) {
          if (typeof birthDateRaw === 'number') {
            const date = XLSX.SSF.parse_date_code(birthDateRaw)
            birthDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
          } else {
            birthDate = formatBirthDateValue(
              String(birthDateRaw).replace(/[^0-9]/g, '')
            )
          }
        }

        let gender: 'male' | 'female' | '' = ''
        const genderLower = genderRaw.toLowerCase()
        if (['남', '남자', 'male', 'm'].includes(genderLower)) {
          gender = 'male'
        } else if (['여', '여자', 'female', 'f'].includes(genderLower)) {
          gender = 'female'
        }

        let guardianGender: 'male' | 'female' | '' = ''
        const guardianGenderLower = guardianGenderRaw.toLowerCase()
        if (['남', '남자', 'male', 'm'].includes(guardianGenderLower)) {
          guardianGender = 'male'
        } else if (
          ['여', '여자', 'female', 'f'].includes(guardianGenderLower)
        ) {
          guardianGender = 'female'
        }

        let guardianBirthDate = ''
        if (guardianBirthDateRaw) {
          if (typeof guardianBirthDateRaw === 'number') {
            const date = XLSX.SSF.parse_date_code(guardianBirthDateRaw)
            guardianBirthDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
          } else {
            guardianBirthDate = formatBirthDateValue(
              String(guardianBirthDateRaw).replace(/[^0-9]/g, '')
            )
          }
        }

        return {
          id: `excel_${Date.now()}_${index}`,
          status: 'new' as const,
          name,
          gender,
          birthDate,
          organization: '',
          guardianName,
          guardianRelationship,
          guardianGender,
          guardianBirthDate,
          guardianPhone
        }
      })

      return { clients }
    } catch {
      snackbarStore.error('엑셀 파일을 읽는 중 오류가 발생했습니다.')
      return null
    }
  }

  // 세트 검사 추가 모달 열기
  function openAddSetModal() {
    modalStore.open({
      component: PackageSettingModal,
      props: {
        onConfirm: async (data: {
          packageName: string
          description: string
          selectedAssessments: string[]
          selectedStaff: string[]
        }) => {
          try {
            await createAssessmentSet().request({
              centerId: requireCenterId(),
              name: data.packageName,
              description: data.description || undefined,
              assessment_ids: data.selectedAssessments,
              center_member_ids: data.selectedStaff || []
            })
            snackbarStore.success('검사 세트가 추가되었어요!')
            invalidatePackages()
          } catch (error) {
            console.error('[createAssessmentSet] failed', error)
            snackbarStore.error('세트 추가 중 오류가 발생했어요.')
            throw error
          }
        }
      },
      options: MODAL_SIZES.packageSetting
    })
  }

  // 상담실 추가 모달 열기
  function openRoomRegisterModal(onCreated?: (created: any) => void) {
    modalStore.open({
      component: RoomRegisterModal,
      props: {
        onSuccessAfterCreate: (created: any) => {
          if (created) onCreated?.(created)
        }
      },
      options: MODAL_SIZES.roomRegister
    })
  }

  /** 새 내담자 등록 모달 (등록 후 getClientList 자동 무효화) */
  function openClientRegisterModal(
    onRegistered?: (client: RegisteredClientData) => void
  ) {
    modalStore.open({
      component: SimpleClientRegisterModal,
      props: {
        onRegistered
      },
      options: MODAL_SIZES.clientRegister
    })
  }

  // 닫기 (폼 초기화 후 이전 페이지로 이동)
  function closeAndNavigate() {
    receiveFormStore.clear()
    history.back()
  }

  // 엑셀 프리뷰로 이동 (폼 상태 저장)
  function navigateToExcelPreview(
    formState: Parameters<typeof receiveFormStore.update>[0]
  ) {
    receiveFormStore.update(formState)
    goto(`${getReceiveBasePath()}/excel-preview`, { replaceState: true })
  }

  // 엑셀 데이터를 스토어에 저장하고 프리뷰 콜백 호출
  function saveExcelAndNavigate(
    clients: ExcelClientData[],
    fileName: string,
    formState: Parameters<typeof receiveFormStore.update>[0],
    onReady?: () => void
  ) {
    receiveFormStore.update(formState)
    excelUploadStore.setData(clients, fileName)
    onReady?.()
  }

  const RECEIVE_CLIENT_TEMPLATE_DATA = [
    [
      '이름',
      '성별',
      '생년월일',
      '보호자 이름',
      '관계',
      '보호자 성별',
      '보호자 생년월일',
      '보호자 연락처'
    ],
    ['홍길동', '남', '2015-03-15', '', '', '', '', ''],
    [
      '김민지',
      '여',
      '2014-07-20',
      '김영희',
      '엄마',
      '여',
      '1985-04-10',
      '010-1234-5678'
    ]
  ]

  /** 검사 접수용 내담자 엑셀 템플릿 다운로드 (parseExcelFile 컬럼 순서와 동일) */
  function downloadReceiveClientTemplate() {
    const data = RECEIVE_CLIENT_TEMPLATE_DATA
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    XLSX.writeFile(workbook, '내담자_명단_템플릿.xlsx')
  }

  /** 엑셀 파일 업로드 처리 (파싱 후 프리뷰로 이동) */
  async function handleExcelFileUpload(
    file: File,
    formState: Parameters<typeof receiveFormStore.update>[0]
  ): Promise<boolean> {
    const result = await parseExcelFile(file)
    if (!result) return false
    saveExcelAndNavigate(result.clients, file.name, formState)
    return true
  }

  /** 엑셀 파일만 파싱 (이동 없음, 접수 페이지에서 groupMembers 설정용) */
  async function parseExcelFileOnly(
    file: File
  ): Promise<ExcelClientData[] | null> {
    const result = await parseExcelFile(file)
    return result?.clients ?? null
  }

  /** 단체 모드: 엑셀 파일 유효성 검사 + 파싱 + 스토어 저장 */
  async function handleGroupExcelFile(file: File): Promise<boolean> {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    const validExt =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls')
    if (!validTypes.includes(file.type) && !validExt) {
      snackbarStore.error('Xlsx 형식만 업로드 가능해요.')
      return false
    }
    const clients = await parseExcelFileOnly(file)
    if (!clients || clients.length === 0) return false
    excelUploadStore.setData(clients, file.name)
    snackbarStore.success('파일 내용을 업로드했어요!')
    return true
  }

  /** 엑셀 오버레이 확인: 스토어의 클라이언트를 GroupMember[]로 변환 */
  function resolveExcelOverlayClients(): GroupMember[] {
    const state = get(excelUploadStore)
    const members: GroupMember[] = state.clients.map((c) => ({
      id: c.id,
      name: c.name,
      birthDate: c.birthDate,
      gender: c.gender,
      guardianPhone: c.guardianPhone || ''
    }))
    excelUploadStore.clear()
    return members
  }

  async function createClient(input: {
    id?: string
    name: string
    birthDate?: string
    gender?: 'male' | 'female' | ''
    guardianPhone?: string
    address?: string
  }): Promise<string> {
    if (isUuid(input.id)) {
      return input.id as string
    }

    const created = await postCreateClient().request(
      buildCreateClientRequest(requireCenterId(), {
        name: input.name,
        birthDate: input.birthDate,
        gender: input.gender,
        phone: input.guardianPhone,
        address: input.address
      })
    )
    const createdId = extractCreatedId(created)
    if (!createdId) {
      throw new Error('내담자 생성 응답에서 id를 확인할 수 없습니다.')
    }
    return createdId
  }

  async function createInstitution(input: {
    name: string
    phone?: string
    address?: string
  }): Promise<{ id: string; name: string; phone: string; address: string }> {
    const created = await postCreateInstitution().request(
      buildCreateInstitutionPayload(input)
    )
    return {
      id: created.id,
      name: created.name,
      address: created.address?.address || input.address || '',
      phone: created.phone || input.phone || ''
    }
  }

  /**
   * 제출용 기관 id 확정.
   * 에이전트 prefill(page-tools)은 신규 기관을 `new-<이름>` 스텁 id로 화면에 얹는다 —
   * 그대로 보내면 백엔드 get_summary가 404를 낸다. UUID가 아니면 이름으로 찾고, 없으면 만든다.
   */
  async function resolveInstitutionId(
    org: Organization | null
  ): Promise<string | undefined> {
    if (!org?.name) return undefined
    if (isUuid(org.id)) return org.id

    // ponytail: 동명 기관은 첫 건을 쓴다. 기관은 글로벌 카탈로그라 이름 중복이 드물다 —
    // 구분이 필요해지면 주소·연락처까지 비교로 올린다.
    const list = await getInstitutionList().request({
      keyword: org.name,
      size: 20
    })
    const matched = list?.items?.find((item) => item.name === org.name)
    if (matched) return matched.id

    const created = await createInstitution({
      name: org.name,
      phone: org.phone,
      address: org.address
    })
    return created.id
  }

  async function loadCaseForEdit(caseId: string): Promise<CaseDetail | null> {
    const res = await getCaseById().request({
      centerId: requireCenterId(),
      caseId
    })
    return res?.data ?? null
  }

  async function submitReceive(input: SubmitReceiveInput): Promise<boolean> {
    const assessmentIds = getAssessmentIds(
      input.assessmentsData,
      input.packagesData,
      input.selectedAssessmentItems,
      input.selectedPackageIds,
      input.excludedAssessmentItems
    )

    if (assessmentIds.length === 0) {
      snackbarStore.error('검사 항목을 선택해주세요.')
      return false
    }

    if (!input.selectedMember.length) {
      snackbarStore.error('담당자를 선택해주세요.')
      return false
    }

    if (input.visitCenter && (!input.selectedDate || !input.selectedTime)) {
      snackbarStore.error('일정 정보를 입력해주세요.')
      return false
    }

    if (input.editCaseId) {
      try {
        const mainCounselorId = input.selectedMember[0]?.id ?? null
        let schedule: ScheduleUpdateInput | null = null
        if (input.selectedDate && input.selectedTime) {
          const [hours, minutes] = input.selectedTime.split(':').map(Number)
          const startAt = new Date(input.selectedDate)
          startAt.setHours(hours, minutes, 0, 0)
          const endAt = input.selectedEndTime
            ? (() => {
                const [eh, em] = input.selectedEndTime!.split(':').map(Number)
                const e = new Date(input.selectedDate!)
                e.setHours(eh, em, 0, 0)
                return e <= startAt
                  ? new Date(startAt.getTime() + 30 * 60 * 1000)
                  : e
              })()
            : (() => {
                const e = new Date(startAt)
                e.setHours(e.getHours() + DEFAULT_ASSESSMENT_DURATION_HOURS)
                return e
              })()
          schedule = {
            has_schedule: true,
            scheduled_start: startAt.toISOString(),
            scheduled_end: endAt.toISOString(),
            room_id: input.selectedRoom?.id ?? null,
            memo: input.clientMemo || null
          }
        } else {
          schedule = { has_schedule: false }
        }
        // 서버 반영: counselor_id(메인 담당자), assistant_ids(보조 검사자 Participant), assessment_ids(검사 목록)
        const assessmentIdsArray = Array.isArray(assessmentIds)
          ? assessmentIds
          : []
        const editPayload: UpdateCasePayload = {
          assessment_ids: assessmentIdsArray,
          is_final_report_required: input.comprehensiveReport === '작성',
          schedule
        }
        // 담당자 수정: 주 담당자(counselor_id) + 보조 담당자(assistant_ids)
        if (mainCounselorId != null) {
          editPayload.counselor_id = mainCounselorId
        }
        const assistantIds = input.selectedMember.slice(1).map((m) => m.id)
        editPayload.assistant_ids = assistantIds.length > 0 ? assistantIds : []
        await updateCase().request({
          centerId: requireCenterId(),
          caseId: input.editCaseId,
          payload: editPayload,
          force: true
        })
        snackbarStore.success('검사 정보가 수정되었습니다.')
        await invalidateCases()
        return true
      } catch (error) {
        console.error('[submitReceive] edit case failed', error)
        snackbarStore.error('검사 정보 수정에 실패했습니다.')
        return false
      }
    }

    try {
      if (input.clientType === 'group') {
        // 기관을 내담자보다 먼저 확정한다 — 여기서 실패하면 내담자가 아직 안 만들어져 고아가 남지 않는다
        const institutionId = await resolveInstitutionId(
          input.selectedOrganization
        )

        const resolvedClientIds = await Promise.all(
          input.groupMembers.map((member) =>
            createClient({
              id: member.id,
              name: member.name,
              birthDate: member.birthDate || undefined,
              gender: member.gender,
              guardianPhone: member.guardianPhone
            })
          )
        )
        // 만든 내담자 id를 폼에 되돌린다 — 케이스 생성이 실패해 다시 접수해도 같은 사람을 또 만들지 않는다
        input.groupMembers.forEach((member, idx) => {
          member.id = resolvedClientIds[idx]
        })

        const request = buildGroupScheduleRequest({
          centerId: requireCenterId(),
          groupMembers: input.groupMembers,
          selectedOrganization: input.selectedOrganization
            ? { ...input.selectedOrganization, id: institutionId ?? '' }
            : null,
          selectedDate: input.selectedDate,
          selectedTime: input.selectedTime,
          selectedEndTime: input.selectedEndTime,
          selectedMember: input.selectedMember,
          selectedRoom: input.selectedRoom,
          clientMemo: input.clientMemo,
          assessmentIds,
          comprehensiveReport: input.comprehensiveReport,
          selectedPackageIds: input.selectedPackageIds
        })

        try {
          await createBatchAssessmentCase().request(request)
        } catch (error) {
          console.error('[submitReceive] batch case failed', error)
          // 부분 성공을 숨기지 않는다 — 내담자는 남았고 케이스만 실패했다는 걸 그대로 알린다
          snackbarStore.error(
            `내담자 ${resolvedClientIds.length}명은 등록됐지만 검사 접수에 실패했어요. 명단은 그대로 두고 다시 접수해주세요.`,
            null,
            6000
          )
          return false
        }
      } else {
        if (!input.selectedClients?.length) {
          snackbarStore.error('내담자를 선택해주세요.')
          return false
        }

        const collectedWarnings: string[] = []
        for (const selectedClient of input.selectedClients) {
          const selectedClientId = await createClient({
            id: selectedClient.uid,
            name: selectedClient.name,
            birthDate: toDateOnly(selectedClient.birth_date),
            gender: selectedClient.gender === '여자' ? 'female' : 'male',
            guardianPhone: selectedClient.guardian_phone,
            address: selectedClient.address
          })
          // 단체와 같은 이유 — 케이스 생성이 실패해도 재접수 시 같은 사람을 또 만들지 않는다
          selectedClient.uid = selectedClientId

          const request = buildIndividualScheduleRequest({
            centerId: requireCenterId(),
            selectedClient: { ...selectedClient, uid: selectedClientId },
            selectedDate: input.selectedDate,
            selectedTime: input.selectedTime,
            selectedEndTime: input.selectedEndTime,
            selectedMember: input.selectedMember,
            selectedRoom: input.selectedRoom,
            clientMemo: input.clientMemo,
            assessmentIds,
            comprehensiveReport: input.comprehensiveReport,
            selectedPackageIds: input.selectedPackageIds
          })

          const res = await createIndividualAssessmentCase().request(request)
          if (res?.warnings?.length) {
            collectedWarnings.push(...res.warnings)
          }
        }

        // 일정 충돌 등 경고가 있으면 warning 토스트로 노출 (접수 자체는 성공).
        // 경고 폭발 방지: 상위 5건만 + "외 N건 더" 축약.
        if (collectedWarnings.length > 0) {
          const shown = collectedWarnings.slice(0, 5)
          const extra = collectedWarnings.length - shown.length
          const message =
            shown.join('\n') + (extra > 0 ? `\n외 ${extra}건 더` : '')
          snackbarStore.warning(message, null, 5000)
          await invalidateCases()
          return true
        }
      }

      snackbarStore.success('검사가 접수되었습니다.')
      await invalidateCases()
      return true
    } catch (error) {
      console.error('[submitReceive] failed', error)
      snackbarStore.error('검사 접수 중 오류가 발생했습니다.')
      return false
    }
  }

  return {
    openExcelUploadModal,
    openAddSetModal,
    openRoomRegisterModal,
    openClientRegisterModal,
    closeAndNavigate,
    navigateToExcelPreview,
    saveExcelAndNavigate,
    downloadReceiveClientTemplate,
    handleExcelFileUpload,
    parseExcelFileOnly,
    createClient,
    createInstitution,
    loadCaseForEdit,
    submitReceive,
    invalidateCases,
    invalidatePackages,
    handleGroupExcelFile,
    resolveExcelOverlayClients
  }
}
