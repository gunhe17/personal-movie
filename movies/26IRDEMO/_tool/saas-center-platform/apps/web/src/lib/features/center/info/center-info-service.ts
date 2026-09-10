import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import { centerStore } from '$lib/stores/center.store'
import { modalStore } from '$lib/stores/modal'
import { appInstance } from '$lib/services/api/instances'
import { formatBusinessNumber } from '$lib/utils/stringConverter'
import CenterProfileEditModal from '$lib/components/modal/CenterProfileEditModal.svelte'
import CenterOperatingHoursModal from '$lib/components/modal/CenterOperatingHoursModal.svelte'
import {
  patchCenterDetail,
  putOperatingTimes,
  postNonOperatingTime,
  deleteNonOperatingTime,
  type CenterDetailResponse,
  type WeekdayEnum,
  type OperatingTimeCreateItem
} from '$lib/hooks/actions/center.action'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  WEEKDAY_KO,
  MONTH_WEEK_LABELS,
  type EditableOperatingTime,
  type EditableHoliday
} from './constants'
import { getSelectValue, diffRegularHolidays } from './view-model'

export interface CenterInfoServiceDeps {
  queryClient: QueryClient
}

/** 기본 정보 모달이 편집하는 필드 묶음 (에이전트 page-tool과 공유하는 상태) */
export interface CenterProfileForm {
  centerName: string
  ownerName: string
  businessNumber: string
  zipCode: string
  address: string
  addressDetail: string
  phonePrefix: string
  phoneBody: string
  description: string
}

export interface SaveProfileParams {
  centerData: CenterDetailResponse
  form: CenterProfileForm
  selectedFile: File | null
}

export interface SaveOperatingHoursParams {
  operatingTimes: EditableOperatingTime[]
  deletedHolidayIds: string[]
  newHolidays: EditableHoliday[]
}

export function createCenterInfoService(deps: CenterInfoServiceDeps) {
  const { queryClient } = deps

  const invalidateCenter = () =>
    queryClient.invalidateQueries({
      queryKey: ['getCenterDetail'],
      exact: false
    })

  const invalidateOperating = () => {
    queryClient.invalidateQueries({
      queryKey: ['getOperatingTimes'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getNonOperatingTimes'],
      exact: false
    })
  }

  const invalidateAll = () => {
    invalidateCenter()
    invalidateOperating()
  }

  async function uploadLogo(file: File): Promise<string | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const cId = requireCenterId()
      const query = `?category=center-logo&entity_id=${cId}`
      const res = await appInstance.post(`/upload/images${query}`, formData)
      const data = res?.data ?? res
      return (data as any)?.url ?? (data as any)?.data?.url ?? null
    } catch (err) {
      console.error('Logo upload failed', err)
      snackbarStore.error('로고 업로드에 실패했습니다.')
      return null
    }
  }

  /** 기본 정보(로고·센터명·대표자·사업자번호·주소·전화·소개) 저장 */
  async function saveProfile(params: SaveProfileParams): Promise<boolean> {
    try {
      const cId = requireCenterId()
      const { centerData, form, selectedFile } = params

      let logoUrl = centerData.logo_url || null
      if (selectedFile) {
        const uploadedUrl = await uploadLogo(selectedFile)
        if (uploadedUrl) logoUrl = uploadedUrl
      }

      const phone = form.phoneBody
        ? `${getSelectValue(form.phonePrefix)}-${form.phoneBody}`
        : null

      const formattedBrn = form.businessNumber
        ? formatBusinessNumber(form.businessNumber)
        : null

      await patchCenterDetail().request({
        centerId: cId,
        name: form.centerName || undefined,
        representative_name: form.ownerName || null,
        business_registration_number: formattedBrn,
        phone,
        description: form.description?.trim() ? form.description : null,
        address: {
          zip_code: form.zipCode || null,
          address: form.address || null,
          detail: form.addressDetail || null
        },
        logo_url: logoUrl
      })

      centerStore.updateCurrentCenter({
        id: centerData.id,
        code: centerData.code,
        name: form.centerName,
        logo_url: logoUrl || ''
      })

      invalidateCenter()
      snackbarStore.success('센터 정보를 수정했어요')
      return true
    } catch (err) {
      console.error('Save center profile failed:', err)
      return false
    }
  }

  /** 운영시간 + 정기휴일 저장 */
  async function saveOperatingHours(
    params: SaveOperatingHoursParams
  ): Promise<boolean> {
    try {
      const cId = requireCenterId()
      const { operatingTimes, deletedHolidayIds, newHolidays } = params

      const items: OperatingTimeCreateItem[] = operatingTimes.map((ot) => ({
        weekday: ot.weekday,
        open_time: ot.isOpen ? getSelectValue(ot.openTime) || null : null,
        close_time: ot.isOpen ? getSelectValue(ot.closeTime) || null : null
      }))
      await putOperatingTimes().request({ centerId: cId, items })

      for (const id of deletedHolidayIds) {
        await deleteNonOperatingTime().request({
          centerId: cId,
          nonOperatingTimeId: id
        })
      }

      for (const holiday of newHolidays) {
        const mw = Number(getSelectValue(holiday.monthWeek))
        const wd = getSelectValue(holiday.weekday) as WeekdayEnum
        await postNonOperatingTime().request({
          centerId: cId,
          month_week: mw,
          weekday: wd,
          reason: `정기 휴일 (${MONTH_WEEK_LABELS[mw]} ${WEEKDAY_KO[wd]}요일)`
        })
      }

      invalidateOperating()
      snackbarStore.success('운영시간을 수정했어요')
      return true
    } catch (err) {
      console.error('Save operating hours failed:', err)
      return false
    }
  }

  // ─── 모달 ───

  /**
   * 기본 정보 수정 모달.
   * form은 페이지가 소유한 $state 프록시를 그대로 넘긴다 — 에이전트 page-tool이 같은
   * 객체에 쓰기 때문에, 모달이 자체 사본을 뜨면 에이전트 입력이 화면에 반영되지 않는다.
   */
  const openProfileEdit = (args: {
    centerData: CenterDetailResponse
    form: CenterProfileForm
    onClose?: () => void
  }) => {
    modalStore.open({
      component: CenterProfileEditModal,
      props: {
        center: args.centerData,
        form: args.form,
        onSubmit: (selectedFile: File | null) =>
          saveProfile({
            centerData: args.centerData,
            form: args.form,
            selectedFile
          })
      },
      options: { size: 'lg', onClose: args.onClose }
    })
  }

  /** 운영시간·정기휴일 수정 모달 */
  const openOperatingHoursEdit = (args: {
    operatingTimes: EditableOperatingTime[]
    holidays: EditableHoliday[]
  }) => {
    modalStore.open({
      component: CenterOperatingHoursModal,
      props: {
        initialOperatingTimes: args.operatingTimes,
        initialHolidays: args.holidays,
        onSubmit: (payload: {
          operatingTimes: EditableOperatingTime[]
          holidays: EditableHoliday[]
        }) =>
          saveOperatingHours({
            operatingTimes: payload.operatingTimes,
            ...diffRegularHolidays(args.holidays, payload.holidays)
          })
      },
      options: { size: 'xl' }
    })
  }

  return {
    saveProfile,
    saveOperatingHours,
    openProfileEdit,
    openOperatingHoursEdit,
    invalidateAll
  }
}
