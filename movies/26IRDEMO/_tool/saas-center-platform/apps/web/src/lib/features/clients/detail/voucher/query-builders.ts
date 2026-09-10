/**
 * 내담자 상세 - 바우처 탭 쿼리 입력 빌더
 */

export function buildClientVoucherListInput(
  centerId: string | null | undefined,
  clientId: string
) {
  return {
    centerId,
    client_id: clientId,
    page: 1,
    size: 50
  }
}

export function buildVoucherUsageInput(
  centerId: string | null | undefined,
  clientVoucherId: string | null | undefined
) {
  return {
    centerId,
    clientVoucherId: clientVoucherId ?? ''
  }
}
