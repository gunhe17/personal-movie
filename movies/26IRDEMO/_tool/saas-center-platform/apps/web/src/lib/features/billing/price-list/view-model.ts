import type {
  PriceListResponse,
  PriceListSource,
  ServiceType
} from '$lib/hooks/actions/priceList.action'
import { formatUtcToKst } from '$lib/utils/date'
import { SOURCE_LABELS } from './constants'

export interface PriceListVM {
  id: string
  serviceType: ServiceType
  serviceName: string
  referenceId: string | null
  unitPrice: number
  priceFormatted: string
  isActive: boolean
  activeLabel: string
  notes: string | null
  source: PriceListSource
  sourceLabel: string
  needsPriceSetup: boolean
  createdAt: string
  updatedAt: string
  createdAtFormatted: string
  updatedAtFormatted: string
  createdAtDate: string // 'YYYY-MM-DD' (셀 상단)
  createdAtTime: string // '(목) HH:mm' (셀 하단)
  updatedAtDate: string // 'YYYY-MM-DD' (셀 상단)
  updatedAtTime: string // '(목) HH:mm' (셀 하단)
}

export function mapToPriceListVM(item: PriceListResponse): PriceListVM {
  return {
    id: item.id,
    serviceType: item.service_type,
    serviceName: item.service_name,
    referenceId: item.reference_id ?? null,
    unitPrice: item.unit_price,
    priceFormatted: `${item.unit_price.toLocaleString()}원`,
    isActive: item.is_active,
    activeLabel: item.is_active ? '활성' : '비활성',
    notes: item.notes,
    source: item.source,
    sourceLabel: SOURCE_LABELS[item.source] ?? item.source,
    needsPriceSetup: item.source === 'synced' && item.unit_price === 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdAtFormatted: formatUtcToKst(item.created_at, 'YYYY-MM-DD HH:mm'),
    updatedAtFormatted: formatUtcToKst(item.updated_at, 'YYYY-MM-DD HH:mm'),
    createdAtDate: formatUtcToKst(item.created_at, 'YYYY-MM-DD'),
    createdAtTime: formatUtcToKst(item.created_at, '(d) HH:mm'),
    updatedAtDate: formatUtcToKst(item.updated_at, 'YYYY-MM-DD'),
    updatedAtTime: formatUtcToKst(item.updated_at, '(d) HH:mm')
  }
}

export function mapToPriceListVMs(
  items: PriceListResponse[] | undefined
): PriceListVM[] {
  if (!items) return []
  return items.map(mapToPriceListVM)
}
