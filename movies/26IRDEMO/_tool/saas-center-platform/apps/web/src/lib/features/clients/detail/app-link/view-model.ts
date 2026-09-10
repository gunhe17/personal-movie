import type {
  AppLinkStatusResponse,
  AppLinkStatusValue
} from '$lib/hooks/actions/appLink.action'

// ============ 앱 연결 상태 → UI 표현 변환 ============

export interface AppLinkBadgeVM {
  label: string
  className: string
}

/** 상태 배지 — 미연결은 중립 그레이(폄하 톤 금지), 대기는 블루, 연결됨은 그린 */
export const APP_LINK_BADGE: Record<AppLinkStatusValue, AppLinkBadgeVM> = {
  none: { label: '미연결', className: 'bg-gray-100 text-gray-500' },
  invited: { label: '발급 대기', className: 'bg-primary-50 text-primary-600' },
  linked: { label: '연결됨', className: 'bg-green-50 text-green-700' }
}

export interface AppLinkInvitationVM {
  code: string
  /** "MM/DD HH:mm" (로컬 시각) */
  expiresAtLabel: string
}

export interface AppLinkChildVM {
  clientId: string
  name: string
  /** "YYYY.MM.DD" — 연결 시각이 없으면 빈 문자열 */
  linkedAtLabel: string
}

export interface AppLinkVM {
  status: AppLinkStatusValue
  badge: AppLinkBadgeVM
  invitation: AppLinkInvitationVM | null
  children: AppLinkChildVM[]
}

const pad = (n: number) => String(n).padStart(2, '0')

function formatExpiresAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatLinkedAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

export function mapToAppLinkVM(
  data: AppLinkStatusResponse | null | undefined
): AppLinkVM | null {
  if (!data) return null
  const status: AppLinkStatusValue =
    data.status === 'invited' || data.status === 'linked' ? data.status : 'none'
  return {
    status,
    badge: APP_LINK_BADGE[status],
    invitation: data.invitation
      ? {
          code: data.invitation.code,
          expiresAtLabel: formatExpiresAt(data.invitation.expires_at)
        }
      : null,
    children: dedupeByClientId(data.linked_children ?? []).map((child) => ({
      clientId: child.client_id,
      name: child.name ?? '이름 미확인',
      linkedAtLabel: formatLinkedAt(child.linked_at)
    }))
  }
}

/**
 * 같은 아이가 여러 가족(계정)에 연결되면 링크가 가족 수만큼 온다(설계 §14 가족 간
 * client N 허용) — 이 카드는 "아이가 앱에 보인다" 사실만 다루므로 첫 링크만 남긴다.
 * dedupe 없이는 keyed each 키 중복으로 화면이 죽는다.
 */
function dedupeByClientId<T extends { client_id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.client_id)) return false
    seen.add(item.client_id)
    return true
  })
}
