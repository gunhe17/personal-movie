import type { ClientSummary } from './types'
import { CLIENT_STATUS_STYLES, GENDER_LABELS } from './constants'

export interface ClientVM {
  id: string
  name: string
  birthDate: string | null
  age: number | null
  gender: string | null
  genderLabel: string
  phone: string | null
  status: string
  statusLabel: string
  statusBg: string
  statusText: string
  createdAt: string
}

function mapToClientVM(item: ClientSummary): ClientVM {
  const style = CLIENT_STATUS_STYLES[item.status] ?? CLIENT_STATUS_STYLES.active

  return {
    id: item.id,
    name: item.name,
    birthDate: item.birth_date,
    age: item.birth_date ? calculateAge(item.birth_date) : null,
    gender: item.gender,
    genderLabel: item.gender ? (GENDER_LABELS[item.gender] ?? '-') : '-',
    phone: item.phone,
    status: item.status,
    statusLabel: style.label,
    statusBg: style.bg,
    statusText: style.text,
    createdAt: formatDate(item.created_at)
  }
}

export function mapClientsToVM(items: ClientSummary[]): ClientVM[] {
  return items.map(mapToClientVM)
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
