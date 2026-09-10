import {
  DEPOSIT_EXPIRE_OPTIONS,
  DEPOSIT_TYPE_OPTIONS,
  RESERVATION_CONFIRM_OPTIONS
} from './constants'

type DepositExpireType = (typeof DEPOSIT_EXPIRE_OPTIONS)[number]['value']
type DepositType = (typeof DEPOSIT_TYPE_OPTIONS)[number]['value']
type ReservationConfirmType =
  (typeof RESERVATION_CONFIRM_OPTIONS)[number]['value']

interface SettingsState {
  depositAmount: number
  maxReservationCount: number
  showDepositType: boolean
  showWithdrawalRules: boolean
  showDepositExpireType: boolean
  depositExpireType: DepositExpireType
  showReservationConfirmType: boolean
  depositType: DepositType
  reservationConfirmType: ReservationConfirmType
}

const DEFAULT_SETTINGS: SettingsState = {
  depositAmount: 0,
  maxReservationCount: 1,
  showDepositType: false,
  showWithdrawalRules: false,
  showDepositExpireType: false,
  depositExpireType: '1day',
  showReservationConfirmType: false,
  depositType: 'static',
  reservationConfirmType: 'confirm'
}

export function useScheduleSettings(initial?: Partial<SettingsState>) {
  const init = { ...DEFAULT_SETTINGS, ...initial }

  let depositAmount = $state<number>(init.depositAmount)
  let maxReservationCount = $state<number>(init.maxReservationCount)
  let showDepositType = $state<boolean>(init.showDepositType)
  let showWithdrawalRules = $state<boolean>(init.showWithdrawalRules)
  let showDepositExpireType = $state<boolean>(init.showDepositExpireType)
  let depositExpireType: DepositExpireType = $state(init.depositExpireType)
  let showReservationConfirmType = $state<boolean>(
    init.showReservationConfirmType
  )
  let depositType: DepositType = $state(init.depositType)
  let reservationConfirmType: ReservationConfirmType = $state(
    init.reservationConfirmType
  )

  function reset() {
    depositAmount = DEFAULT_SETTINGS.depositAmount
    maxReservationCount = DEFAULT_SETTINGS.maxReservationCount
    showDepositType = DEFAULT_SETTINGS.showDepositType
    showWithdrawalRules = DEFAULT_SETTINGS.showWithdrawalRules
    showDepositExpireType = DEFAULT_SETTINGS.showDepositExpireType
    depositExpireType = DEFAULT_SETTINGS.depositExpireType
    showReservationConfirmType = DEFAULT_SETTINGS.showReservationConfirmType
    depositType = DEFAULT_SETTINGS.depositType
    reservationConfirmType = DEFAULT_SETTINGS.reservationConfirmType
  }

  return {
    // 값
    get depositAmount() {
      return depositAmount
    },
    set depositAmount(value: number) {
      depositAmount = value
    },
    get maxReservationCount() {
      return maxReservationCount
    },
    set maxReservationCount(value: number) {
      maxReservationCount = value
    },
    get showDepositType() {
      return showDepositType
    },
    set showDepositType(value: boolean) {
      showDepositType = value
    },
    get showWithdrawalRules() {
      return showWithdrawalRules
    },
    set showWithdrawalRules(value: boolean) {
      showWithdrawalRules = value
    },
    get showDepositExpireType() {
      return showDepositExpireType
    },
    set showDepositExpireType(value: boolean) {
      showDepositExpireType = value
    },
    get depositExpireType() {
      return depositExpireType
    },
    set depositExpireType(value: DepositExpireType) {
      depositExpireType = value
    },
    get showReservationConfirmType() {
      return showReservationConfirmType
    },
    set showReservationConfirmType(value: boolean) {
      showReservationConfirmType = value
    },
    get depositType() {
      return depositType
    },
    set depositType(value: DepositType) {
      depositType = value
    },
    get reservationConfirmType() {
      return reservationConfirmType
    },
    set reservationConfirmType(value: ReservationConfirmType) {
      reservationConfirmType = value
    },

    // 헬퍼
    reset,
    RESERVATION_CONFIRM_OPTIONS: [...RESERVATION_CONFIRM_OPTIONS],
    DEPOSIT_TYPE_OPTIONS: [...DEPOSIT_TYPE_OPTIONS],
    DEPOSIT_EXPIRE_OPTIONS: [...DEPOSIT_EXPIRE_OPTIONS]
  }
}
