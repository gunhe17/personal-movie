import type { VoucherClientItem } from '$lib/hooks/actions/clientVoucher.action'
import { VOUCHER_STATUS_STYLES } from './constants'

export interface VoucherClientVM {
  clientId: string
  name: string
  birth: string
  gender: 'MALE' | 'FEMALE'
  profileImageUrl: string | null
  status: 'active' | 'completed'
  statusLabel: string
  statusBg: string
  statusText: string
  vouchers: {
    clientVoucherId: string
    programName: string
    /** 잔여 회기·만료 요약 — 예: "잔여 4회 · ~7/29" */
    metaLabel: string
  }[]
  voucherCount: number
  primaryClientVoucherId: string | null
}

const localToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const buildVoucherMetaLabel = (
  remainingSessions: number,
  validUntil: string | null
): string => {
  const parts = [`잔여 ${remainingSessions}회`]
  if (validUntil) {
    const [, m, d] = validUntil.split('-')
    if (m && d) parts.push(`~${Number(m)}/${Number(d)}`)
  }
  return parts.join(' · ')
}

export function mapVoucherClientsToVM(
  data: VoucherClientItem[] | undefined
): VoucherClientVM[] {
  if (!data) return []
  const today = localToday()
  return data.map((item) => {
    const style = VOUCHER_STATUS_STYLES[item.status]
    const vouchers = item.vouchers
      .filter(
        (v) =>
          v.remaining_sessions > 0 && (!v.valid_until || v.valid_until >= today)
      )
      .map((v) => ({
        clientVoucherId: v.client_voucher_id,
        programName: v.program_name,
        metaLabel: buildVoucherMetaLabel(v.remaining_sessions, v.valid_until)
      }))
    return {
      clientId: item.client_id,
      name: item.name,
      birth: item.birth_date ?? '',
      gender:
        item.gender === 'male' || item.gender === 'MALE' ? 'MALE' : 'FEMALE',
      profileImageUrl: item.profile_image_url ?? null,
      status: item.status,
      statusLabel: style.label,
      statusBg: style.bg,
      statusText: style.text,
      vouchers,
      voucherCount: vouchers.length,
      primaryClientVoucherId: vouchers[0]?.clientVoucherId ?? null
    }
  })
}

// ─── 바우처(사업) 기준 행 ───

/**
 * 바우처 현황을 **사업 기준**으로 볼 때의 행 = `내담자 × 그 사업의 바우처 1건`.
 * 원천은 내담자 축 API(`/voucher-clients`)라 클라이언트에서 바우처 단위로 편다.
 * 사업 매칭 키가 id가 아니라 **이름**인 이유: 이 응답의 `program_name`은
 * catalog.name이고 center_voucher_id가 없다(백엔드에 필터가 생기면 id로 교체).
 */
export interface VoucherProgramRowVM {
  /** client_voucher_id — 선택·서류 발급·상세 진입의 키 */
  id: string
  clientId: string
  name: string
  birth: string
  gender: 'MALE' | 'FEMALE'
  profileImageUrl: string | null
  /** = center voucher의 catalogName */
  programName: string
  usedSessions: number
  totalSessions: number
  remainingSessions: number
  validUntil: string | null
  /** 오늘 기준 남은 일수 (유효기간 없으면 null) */
  dday: number | null
}

export function flattenVoucherProgramRows(
  data: VoucherClientItem[] | undefined
): VoucherProgramRowVM[] {
  if (!data) return []
  const today = localToday()
  const todayMs = new Date(`${today}T00:00:00`).getTime()

  return data.flatMap((item) =>
    item.vouchers.map((v) => ({
      id: v.client_voucher_id,
      clientId: item.client_id,
      name: item.name,
      birth: item.birth_date ?? '',
      gender: (item.gender === 'male' || item.gender === 'MALE'
        ? 'MALE'
        : 'FEMALE') as 'MALE' | 'FEMALE',
      profileImageUrl: item.profile_image_url ?? null,
      programName: v.program_name,
      usedSessions: Math.max(0, v.total_sessions - v.remaining_sessions),
      totalSessions: v.total_sessions,
      remainingSessions: v.remaining_sessions,
      validUntil: v.valid_until,
      dday: v.valid_until
        ? Math.round(
            (new Date(`${v.valid_until}T00:00:00`).getTime() - todayMs) /
              86400000
          )
        : null
    }))
  )
}
