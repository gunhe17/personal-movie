/**
 * 센터 정보 수정 페이지(/center/info) FormSpec 디스크립터.
 * 필드 계약 변경 시 백엔드 prefill 스키마 동기화 — ./README.md 참고.
 *
 * view 모드에서 쓰기가 오면 beforeWrite가 먼저 edit 모드로 전환한다.
 */

import { registerFormTools } from './form-tools'

export interface CenterInfoEditForm {
  getState: () => {
    centerName: string
    ownerName: string
    businessNumber: string
    zipCode: string
    address: string
    addressDetail: string
    phonePrefix: string
    phoneBody: string
  }
  getMode: () => 'view' | 'edit'
  enterEditMode: () => void
  setCenterName: (v: string) => void
  setOwnerName: (v: string) => void
  setBusinessNumber: (v: string) => void
  setZipCode: (v: string) => void
  setAddress: (v: string) => void
  setAddressDetail: (v: string) => void
  setPhonePrefix: (v: string) => void
  setPhoneBody: (v: string) => void
}

export function registerCenterInfoEditTools(form: CenterInfoEditForm): void {
  registerFormTools({
    formName: '센터 정보 수정',
    submitLabel: '저장',
    fields: {
      centerName: {
        label: '센터명',
        get: () => form.getState().centerName,
        set: form.setCenterName
      },
      ownerName: {
        label: '대표자',
        get: () => form.getState().ownerName,
        set: form.setOwnerName
      },
      businessNumber: {
        label: '사업자등록번호',
        get: () => form.getState().businessNumber,
        set: form.setBusinessNumber
      },
      zipCode: {
        label: '우편번호',
        get: () => form.getState().zipCode,
        set: form.setZipCode
      },
      address: {
        label: '주소',
        get: () => form.getState().address,
        set: form.setAddress
      },
      addressDetail: {
        label: '상세주소',
        get: () => form.getState().addressDetail,
        set: form.setAddressDetail
      },
      phonePrefix: {
        label: '전화 지역번호',
        get: () => form.getState().phonePrefix,
        set: form.setPhonePrefix
      },
      phoneBody: {
        label: '전화 뒷자리',
        get: () => form.getState().phoneBody,
        set: form.setPhoneBody
      }
    },
    extraState: () => ({ mode: form.getMode() }),
    beforeWrite: async () => {
      // agent navigate 직후엔 센터 데이터가 아직 로딩 중일 수 있음 — enterEditMode는 그동안
      // 조용히 no-op(view 모드 그대로)이라, 데이터가 실제로 준비될 때까지 짧게 재시도한다.
      const start = Date.now()
      while (form.getMode() !== 'edit' && Date.now() - start < 2000) {
        form.enterEditMode()
        if (form.getMode() === 'edit') break
        await new Promise((r) => setTimeout(r, 50))
      }
    }
  })
}
