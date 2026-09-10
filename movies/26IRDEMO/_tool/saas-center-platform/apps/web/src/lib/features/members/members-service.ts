/**
 * 구성원 관리 서비스
 * 모달/토스트/invalidate 로직 캡슐화
 */

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { permissionStore } from '$lib/stores/permission.store'
import { canAccess } from '$lib/stores/permission.view'
import { extractErrorMessage } from '$lib/utils/errorHandler'
import { requireCenterId } from '$lib/stores/center.store'
import { appInstance } from '$lib/services/api/instances'
import type { PermissionRule } from '$lib/types/permissions'
import { get } from 'svelte/store'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  updateMember,
  createMemberInvitation,
  bulkUpdateMemberWorkingTimes,
  deleteMember,
  postActivateMember,
  postDeactivateMember,
  type MemberDetailResponse,
  type InvitationItem,
  type MemberWorkingTimeCreateItem
} from '$lib/hooks/actions/member.action'
import { getCenterRoles } from '$lib/hooks/actions/role.action'
import type { MemberModifyFormData } from '$lib/components/modal/MemberModifyModal.svelte'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import MemberInviteModal from '$lib/components/modal/MemberInviteModal.svelte'
import MemberModifyModal from '$lib/components/modal/MemberModifyModal.svelte'
import ExcelUploadModal from '$lib/components/modal/ExcelUploadModal.svelte'
import WorkScheduleModal from '$lib/components/modal/WorkScheduleModal.svelte'
import CareerModal from '$lib/components/modal/CareerModal.svelte'
import * as XLSX from 'xlsx'
import {
  MODAL_SIZES,
  WEEKDAYS,
  WEEKDAY_KR_TO_API,
  type WorkDay,
  type WeeklySchedule,
  type BreakTime,
  type CareerData
} from './constants'
import { MEMBER_PERMISSIONS } from './permissions'
import { inviteReviewStore } from './invite-review.store'
import { goto } from '$app/navigation'

// 프로필 이미지 업로드 제약 (백엔드 upload_image_handler와 동일)
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const AVATAR_MAX_SIZE = 10 * 1024 * 1024 // 10MB

export interface MembersDeps {
  queryClient: QueryClient
}

export function createMembersService(deps: MembersDeps) {
  const { queryClient } = deps

  const ensurePermission = (rule: PermissionRule, message: string) => {
    if (!get(canAccess)(rule)) {
      snackbarStore.error(message)
      return false
    }
    return true
  }

  const invalidateMembers = () =>
    queryClient.invalidateQueries({
      queryKey: ['getMemberList'],
      exact: false
    })

  const invalidateInvitations = () =>
    queryClient.invalidateQueries({
      queryKey: ['getInvitationList'],
      exact: false
    })

  // 구성원 초대 모달
  // redirectToPending: 초대 후 대기 탭으로 이동 — 구성원 페이지 전용 후처리.
  // 대시보드 등 다른 진입점은 false 로 열어 현재 화면에 머문다.
  const openInviteModal = async ({ redirectToPending = true } = {}) => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.invite] },
        '구성원 초대 권한이 없습니다'
      )
    ) {
      return
    }

    const centerId = requireCenterId()

    // 역할 목록을 API에서 가져와 ADMIN 제외
    let roleOptions: { value: string; title: string }[] = []
    try {
      const roles = await getCenterRoles().request({ centerId })
      roleOptions = (roles ?? [])
        .filter((r) => r.code !== 'ADMIN')
        .map((r) => ({ value: r.code, title: r.name }))
    } catch {
      snackbarStore.error('역할 목록을 불러올 수 없습니다')
      return
    }

    modalStore.open({
      component: MemberInviteModal,
      props: {
        roleOptions,
        onConfirm: async (items: InvitationItem[]) => {
          try {
            for (const item of items) {
              await createMemberInvitation().request({
                centerId,
                name: item.name,
                email: item.email,
                role_code: item.role_code,
                employment_type: item.employment_type
              })
            }
            snackbarStore.success('구성원 초대가 완료되었습니다')
            invalidateMembers()
            invalidateInvitations()
            if (redirectToPending) goto('/member?tab=pending')
          } catch (error) {
            console.error('[inviteMembers] failed', error)
            snackbarStore.error('구성원 초대에 실패했습니다')
            throw error
          }
        }
      },
      options: MODAL_SIZES.invite
    })
  }

  // 역할 한글 → role_code 매핑
  const ROLE_NAME_MAP: Record<string, string> = {
    관리자: 'ADMIN',
    전문가: 'COUNSELOR',
    매니저: 'MANAGER',
    스태프: 'STAFF'
  }

  // 근무형태 한글 → employment_type 매핑
  const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
    정규직: 'FULLTIME',
    계약직: 'CONTRACT',
    프리랜서: 'FREELANCER'
  }

  // 엑셀 파일 파싱 → InvitationItem[]
  async function parseExcelInvitations(file: File): Promise<InvitationItem[]> {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (
      | string
      | number
    )[][]

    const rows = jsonData.slice(1).filter((row) => row.length > 0)
    const items: InvitationItem[] = []
    const errors: string[] = []

    rows.forEach((row, index) => {
      const rowNum = index + 2
      const name = String(row[0] || '').trim()
      const email = String(row[1] || '').trim()
      const roleRaw = String(row[2] || '').trim()
      const employmentRaw = String(row[3] || '').trim()

      if (!name) {
        errors.push(`${rowNum}행: 이름이 비어있습니다`)
        return
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`${rowNum}행: 이메일이 유효하지 않습니다 (${email})`)
        return
      }

      const role_code = ROLE_NAME_MAP[roleRaw]
      if (!role_code) {
        errors.push(
          `${rowNum}행: 역할이 유효하지 않습니다 (${roleRaw}). 관리자/전문가/매니저/스태프 중 선택`
        )
        return
      }

      const employment_type = EMPLOYMENT_TYPE_MAP[employmentRaw]
      if (!employment_type) {
        errors.push(
          `${rowNum}행: 근무형태가 유효하지 않습니다 (${employmentRaw}). 정규직/계약직/프리랜서 중 선택`
        )
        return
      }

      items.push({ name, email, role_code, employment_type })
    })

    if (errors.length > 0) {
      snackbarStore.error(errors.slice(0, 3).join('\n'))
      return []
    }

    return items
  }

  // 엑셀 일괄 초대 모달 (Step 1: 파일 업로드 → Step 2: /member/invite 페이지로 이동)
  const openExcelInviteModal = () => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.invite] },
        '구성원 초대 권한이 없습니다'
      )
    ) {
      return
    }
    modalStore.open({
      component: ExcelUploadModal,
      props: {
        title: '구성원을 초대할게요',
        subtitle: '구성원 초대에 필요한 정보를 입력해주세요',
        description:
          '아래 엑셀 양식 파일을 다운로드하고,\n구성원을 등록해보세요.',
        templateData: [
          ['이름', '이메일', '역할', '근무형태'],
          ['홍길동', 'hong@example.com', '전문가', '정규직'],
          ['김영희', 'kim@example.com', '매니저', '계약직']
        ],
        templateFileName: '구성원_초대_템플릿.xlsx',
        submitLabel: '다음',
        onSubmit: async (file: File) => {
          const items = await parseExcelInvitations(file)
          if (items.length === 0) return
          inviteReviewStore.set(items)
          snackbarStore.success('파일 내용을 업로드했어요!')
          goto('/member/invite')
        }
      },
      options: MODAL_SIZES.excelInvite
    })
  }

  // 초대 재전송 (단일 초대 API 사용 - 동일 이메일이면 백엔드에서 기존 초대 반환 후 이메일만 재발송)
  const resendInvite = async (item: {
    name: string
    email: string
    role_code: string
    employment_type: string | null
  }) => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.invite] },
        '구성원 초대 권한이 없습니다'
      )
    ) {
      return
    }
    try {
      await createMemberInvitation().request({
        centerId: requireCenterId(),
        name: item.name,
        email: item.email,
        role_code: item.role_code,
        employment_type: (item.employment_type ?? 'FULLTIME') as
          | 'FULLTIME'
          | 'CONTRACT'
          | 'FREELANCER'
      })
      snackbarStore.success('초대를 재전송했습니다')
      invalidateInvitations()
    } catch (error) {
      console.error('[resendInvite] failed', error)
      snackbarStore.error('초대 재전송에 실패했습니다')
    }
  }

  // ============================================
  // 상세 페이지 핸들러
  // ============================================

  const invalidateMemberDetail = () =>
    queryClient.invalidateQueries({
      queryKey: ['getMemberDetail'],
      exact: false
    })

  // 구성원 정보 수정 모달 (관리자가 타인 수정)
  const openModifyModal = async (member: MemberDetailResponse) => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.modify] },
        '구성원 수정 권한이 없습니다'
      )
    ) {
      return
    }

    const centerId = requireCenterId()

    // 역할 목록을 API에서 가져오기
    let roleOptions: { value: string; title: string }[] = []
    try {
      const roles = await getCenterRoles().request({ centerId })
      roleOptions = (roles ?? []).map((r) => ({ value: r.code, title: r.name }))
    } catch {
      snackbarStore.error('역할 목록을 불러올 수 없습니다')
      return
    }

    modalStore.open({
      component: MemberModifyModal,
      props: {
        member,
        roleOptions,
        onConfirm: async (data: MemberModifyFormData) => {
          try {
            await updateMember().request({
              centerId,
              memberId: member.id,
              ...data
            })
            snackbarStore.success('구성원 정보가 수정되었습니다')
            invalidateMemberDetail()
          } catch (error) {
            console.error('[updateMember] failed', error)
            snackbarStore.error('구성원 정보 수정에 실패했습니다')
            throw error
          }
        }
      },
      options: MODAL_SIZES.modify
    })
  }

  // WeeklySchedule → WorkDay[] 변환 (모달 입력용)
  const weeklyScheduleToArray = (
    weeklySchedule?: WeeklySchedule
  ): Omit<WorkDay, 'id'>[] => {
    if (!weeklySchedule) return []
    return WEEKDAYS.filter((day) => weeklySchedule[day] !== null).map(
      (day) => ({
        day,
        start: weeklySchedule[day]!.start,
        end: weeklySchedule[day]!.end
      })
    )
  }

  // WorkDay[] → WeeklySchedule 변환 (모달 출력용)
  const arrayToWeeklySchedule = (
    schedules: Omit<WorkDay, 'id'>[]
  ): WeeklySchedule => {
    const result: WeeklySchedule = {}
    WEEKDAYS.forEach((day) => {
      result[day] = null
    })
    schedules.forEach(({ day, start, end }) => {
      result[day] = { start, end }
    })
    return result
  }

  // 근무일정 모달
  const openWorkScheduleModal = (
    weeklySchedule?: WeeklySchedule,
    breakTime?: BreakTime | null,
    memberId?: string
  ) => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.updateSchedule] },
        '근무일정 수정 권한이 없습니다'
      )
    ) {
      return
    }
    const centerId = requireCenterId()
    if (!memberId) {
      snackbarStore.error('멤버 정보를 찾을 수 없습니다.')
      return
    }
    modalStore.open({
      component: WorkScheduleModal,
      props: {
        schedules: weeklyScheduleToArray(weeklySchedule),
        initialBreakTime: breakTime ?? null,
        onConfirm: async (
          scheduleArray: Omit<WorkDay, 'id'>[],
          newBreakTime: BreakTime | null
        ) => {
          const newWeeklySchedule = arrayToWeeklySchedule(scheduleArray)
          const items: MemberWorkingTimeCreateItem[] = WEEKDAYS.map((day) => {
            const slot = newWeeklySchedule[day]
            const apiDay = WEEKDAY_KR_TO_API[day]
            if (slot) {
              return {
                weekday: apiDay as MemberWorkingTimeCreateItem['weekday'],
                start_time: slot.start,
                end_time: slot.end,
                break_start_time: newBreakTime?.start ?? null,
                break_end_time: newBreakTime?.end ?? null
              }
            }
            return {
              weekday: apiDay as MemberWorkingTimeCreateItem['weekday'],
              start_time: null,
              end_time: null,
              break_start_time: null,
              break_end_time: null
            }
          })
          try {
            await bulkUpdateMemberWorkingTimes().request({
              centerId,
              memberId,
              items
            })
            await queryClient.invalidateQueries({
              queryKey: ['getMemberWorkingTimes'],
              exact: false
            })
            await invalidateMemberDetail()
            snackbarStore.success('근무 일정을 저장했어요')
          } catch (error: unknown) {
            const status = (error as { response?: { status?: number } })
              ?.response?.status
            if (status === 403) {
              snackbarStore.error(
                '근무일정 수정 권한이 없습니다. 권한이 변경되었을 수 있어요.'
              )
              await permissionStore.fetchFromServer()
            } else {
              snackbarStore.error(
                extractErrorMessage(error) ?? '근무 일정 저장에 실패했어요'
              )
            }
          }
        }
      },
      options: MODAL_SIZES.workSchedule
    })
  }

  // 학력/경력/자격증 모달 (관리자가 타인 수정)
  const openCareerModal = (existingData?: CareerData, memberId?: string) => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.modify] },
        '학력/경력 수정 권한이 없습니다'
      )
    ) {
      return
    }
    const centerId = requireCenterId()
    if (!memberId) {
      snackbarStore.error('멤버 정보를 찾을 수 없습니다.')
      return
    }
    modalStore.open({
      component: CareerModal,
      props: {
        initialData: existingData,
        onConfirm: async (
          educations: string[],
          careers: string[],
          certifications: string[]
        ) => {
          try {
            await updateMember().request({
              centerId,
              memberId,
              careers,
              educations,
              certifications
            })
            invalidateMemberDetail()
            snackbarStore.success(
              existingData ? '학력/경력을 수정했어요' : '학력/경력을 추가했어요'
            )
          } catch (error: unknown) {
            const status = (error as { response?: { status?: number } })
              ?.response?.status
            if (status === 403) {
              snackbarStore.error(
                '학력/경력 수정 권한이 없습니다. 권한이 변경되었을 수 있어요.'
              )
              await permissionStore.fetchFromServer()
            } else {
              snackbarStore.error(
                extractErrorMessage(error) ?? '학력/경력 저장에 실패했어요'
              )
            }
          }
        }
      },
      options: MODAL_SIZES.career
    })
  }

  // 구성원 삭제 확인 모달
  const openDeleteConfirm = (member: { id: string; name: string }) => {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.delete] },
        '구성원 삭제 권한이 없습니다'
      )
    ) {
      return
    }
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: member.id,
        title: `[${member.name}]을(를) 삭제할까요?`,
        description: '구성원 정보가 삭제되며 복구할 수 없어요',
        cancelText: '닫기',
        confirmText: '삭제',
        onConfirm: async () => {
          try {
            await deleteMember().request({
              centerId: requireCenterId(),
              memberId: member.id
            })
            snackbarStore.success('구성원을 삭제했습니다')
            invalidateMembers()
          } catch (error) {
            console.error('[deleteMember] failed', error)
            snackbarStore.error('구성원 삭제에 실패했습니다')
          }
        }
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 프로필 이미지 변경 (업로드 → 멤버 저장 → 상세 새로고침)
  async function changeAvatar(memberId: string, file: File) {
    if (
      !ensurePermission(
        { any: [MEMBER_PERMISSIONS.modify] },
        '구성원 수정 권한이 없습니다'
      )
    ) {
      return
    }
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      snackbarStore.error('JPG, PNG, GIF, WebP 이미지만 올릴 수 있어요.')
      return
    }
    if (file.size > AVATAR_MAX_SIZE) {
      snackbarStore.error('이미지 크기는 10MB까지 가능해요.')
      return
    }

    const centerId = requireCenterId()
    try {
      const formData = new FormData()
      formData.append('file', file)
      const query = `?category=member-profile&entity_id=${memberId}`
      const res = await appInstance.post(`/upload/images${query}`, formData)
      const data = (res as any)?.data ?? res
      const url: string | null =
        (data as any)?.url ?? (data as any)?.data?.url ?? null
      if (!url) {
        snackbarStore.error('이미지 업로드에 실패했어요.')
        return
      }

      await updateMember().request({
        centerId,
        memberId,
        profile_image_url: url
      })

      snackbarStore.success('프로필 사진을 변경했어요.')
      invalidateMemberDetail()
    } catch (err) {
      console.error('Member avatar update failed', err)
      snackbarStore.error('프로필 사진 변경에 실패했어요.')
    }
  }

  async function changeStatus(memberId: string, status: string) {
    try {
      const action = status === 'active' ? postActivateMember : postDeactivateMember
      await action().request({
        centerId: requireCenterId(),
        memberId
      })
      snackbarStore.success('상태가 변경되었습니다.')
      invalidateMembers()
    } catch {
      snackbarStore.error('상태 변경에 실패했습니다.')
    }
  }

  return {
    // 목록 페이지
    invalidateMembers,
    invalidateInvitations,
    openInviteModal,
    openExcelInviteModal,
    resendInvite,
    openDeleteConfirm,
    changeStatus,
    // 상세 페이지
    invalidateMemberDetail,
    openModifyModal,
    openWorkScheduleModal,
    openCareerModal,
    changeAvatar
  }
}
