/**
 * Center Register Service
 * 센터 등록 신청 비즈니스 로직 (API 호출 + 에러 처리 + 리다이렉트)
 */

import { goto } from '$app/navigation'
import {
  postCenterApplication,
  type AddressInfo
} from '$lib/hooks/actions/center.action'
import {
  formatPhoneNumber,
  formatBusinessNumber
} from '$lib/utils/stringConverter'

// ============================================================
// 타입
// ============================================================

export interface CenterRegisterParams {
  name: string
  phone: string
  zipCode: string
  address: string
  addressDetail: string
  description?: string
  businessRegistrationNumber: string
  representativeName: string
}

export interface CenterRegisterResult {
  success: boolean
  error?: string
}

// ============================================================
// 센터 등록 신청 API
// ============================================================

export async function registerCenter(
  params: CenterRegisterParams
): Promise<CenterRegisterResult> {
  try {
    const addressInfo: AddressInfo | null =
      params.address.trim() || params.addressDetail.trim()
        ? {
            zip_code: params.zipCode.trim() || null,
            address: params.address.trim() || null,
            detail: params.addressDetail.trim() || null
          }
        : null

    const formattedPhone = params.phone.trim()
      ? formatPhoneNumber(params.phone.trim())
      : null

    const formattedBrn = params.businessRegistrationNumber.trim()
      ? formatBusinessNumber(params.businessRegistrationNumber.trim())
      : null

    await postCenterApplication().request({
      name: params.name.trim(),
      phone: formattedPhone,
      address: addressInfo,
      description: params.description?.trim() || null,
      business_registration_number: formattedBrn,
      representative_name: params.representativeName.trim() || null
    })

    await goto('/welcome/register/success')

    return { success: true }
  } catch (err: unknown) {
    console.error(err)

    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as {
        response?: { data?: { detail?: unknown; message?: string } }
      }
      const detail = axiosErr.response?.data?.detail

      if (typeof detail === 'string') {
        return { success: false, error: detail }
      }
      if (Array.isArray(detail)) {
        const msg = detail
          .map(
            (e: { msg?: string; message?: string }) =>
              e.msg || e.message || JSON.stringify(e)
          )
          .join(', ')
        return { success: false, error: msg }
      }
      return {
        success: false,
        error:
          axiosErr.response?.data?.message || '센터 등록 신청에 실패했습니다.'
      }
    }

    return { success: false, error: '서버 연결에 실패했습니다.' }
  }
}
