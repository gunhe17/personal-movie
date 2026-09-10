/** Atom render 유틸 — 8개 RenderEnum에 대한 값 변환. */

import type { AtomDef } from './column-atoms'
import type { BadgeStyle } from './tool-columns'
import { BADGE_STYLES, formatDate, formatDateTime, formatPhone, getNestedValue } from './tool-columns'

export function getAtomValue(row: Record<string, unknown>, atom: AtomDef): unknown {
  return getNestedValue(row, atom.key)
}

export interface RenderResult {
  type: 'text' | 'badge'
  text: string
  className?: string
  badge?: BadgeStyle
}

const EMPTY: RenderResult = { type: 'text', text: '-', className: 'text-gray-400' }

export function renderAtom(atom: AtomDef, value: unknown): RenderResult {
  if (value == null || value === '') return EMPTY

  switch (atom.render) {
    case 'text':
      return { type: 'text', text: String(value) }

    case 'text-grey':
      return { type: 'text', text: String(value), className: 'text-gray-500' }

    case 'date':
      return { type: 'text', text: formatDate(value) }

    case 'datetime': {
      const { date, time } = formatDateTime(value)
      return { type: 'text', text: time ? `${date} ${time}` : date }
    }

    case 'phone':
      return { type: 'text', text: formatPhone(value) }

    case 'enum_text': {
      const mapped = atom.enum?.[String(value)]
      const label = typeof mapped === 'string' ? mapped : String(value)
      return { type: 'text', text: label }
    }

    case 'enum_badge': {
      const raw = String(value)
      // atom.enum 우선 → BADGE_STYLES fallback → text downgrade
      const fromAtom = atom.enum?.[raw]
      if (fromAtom && typeof fromAtom === 'object' && 'label' in fromAtom) {
        return { type: 'badge', text: fromAtom.label, badge: fromAtom as BadgeStyle }
      }
      const fromGlobal = BADGE_STYLES[raw]
      if (fromGlobal) {
        return { type: 'badge', text: fromGlobal.label, badge: fromGlobal }
      }
      // downgrade: 값 그대로 텍스트 표시
      return { type: 'text', text: raw }
    }

    case 'currency': {
      const num = typeof value === 'number' ? value : Number(value)
      if (isNaN(num)) return { type: 'text', text: String(value) }
      return { type: 'text', text: `${num.toLocaleString('ko-KR')}원` }
    }

    default:
      return { type: 'text', text: String(value) }
  }
}
