/**
 * 내담자 등록 페이지(/clients/register) FormSpec 디스크립터.
 * 필드 계약 변경 시 백엔드 prefill 스키마 동기화 — ./README.md 참고.
 */

import { registerFormTools } from './form-tools'

export interface ClientRegisterForm {
  getState: () => {
    name: string
    birth: string
    gender: 'MALE' | 'FEMALE'
    phone: string
    email: string
    address: string
    addressDetail: string
    memo: string
  }
  setName: (v: string) => void
  setBirth: (v: string) => void
  setGender: (v: 'MALE' | 'FEMALE') => void
  setPhone: (v: string) => void
  setEmail: (v: string) => void
  setAddress: (v: string) => void
  setAddressDetail: (v: string) => void
  setMemo: (v: string) => void
}

export function registerClientRegisterTools(form: ClientRegisterForm): void {
  registerFormTools({
    formName: '내담자 등록',
    submitLabel: '저장',
    fields: {
      name: {
        label: '이름',
        required: true,
        get: () => form.getState().name,
        set: form.setName
      },
      birth: {
        label: '생년월일',
        kind: 'date',
        required: true,
        get: () => form.getState().birth,
        set: form.setBirth
      },
      gender: {
        label: '성별',
        kind: 'enum',
        values: ['MALE', 'FEMALE'],
        get: () => form.getState().gender,
        set: (v) => form.setGender(v)
      },
      phone: {
        label: '연락처',
        required: true,
        get: () => form.getState().phone,
        set: form.setPhone
      },
      email: {
        label: '이메일',
        get: () => form.getState().email,
        set: form.setEmail
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
      memo: {
        label: '메모',
        get: () => form.getState().memo,
        set: form.setMemo
      }
    }
  })
}
