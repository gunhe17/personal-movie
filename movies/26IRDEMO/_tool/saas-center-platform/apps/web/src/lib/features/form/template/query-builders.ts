import { INSTANCE_PAGE_SIZE } from './constants'

export function buildTemplateListInput(centerId: string) {
  return {
    centerId,
    includeSystem: true, // 전역(center_id null) + 센터 소유 모두 — 페이지에서 분리
    // 관리 화면은 비활성까지 본다 — 활성만 받으면 비활성화한 양식이 목록에서
    // 사라져 토글로 되돌릴 수가 없다. (피커는 이 입력을 쓰지 않으므로 활성만)
    includeInactive: true
  }
}

export function buildTemplateDetailInput(centerId: string, templateId: string) {
  return {
    centerId,
    templateId
  }
}

export function buildTemplateInstancesInput(
  centerId: string,
  templateId: string,
  page: number
) {
  return {
    centerId,
    templateId,
    page,
    size: INSTANCE_PAGE_SIZE
  }
}
