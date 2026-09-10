import type { DEPOSIT_EXPIRE_OPTIONS } from './constants'

type DepositExpireType = (typeof DEPOSIT_EXPIRE_OPTIONS)[number]['value']

export function formatDepositExpireText(type: DepositExpireType) {
  if (type === '1day') return '1일'
  if (type === '2day') return '2일'
  if (type === '1hour') return '1시간'
  return '2시간'
}

export function getDepositUnit(depositType: 'static' | 'percentile') {
  return depositType === 'static' ? '원' : '%'
}

