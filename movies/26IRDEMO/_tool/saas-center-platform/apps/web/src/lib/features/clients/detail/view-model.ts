import type { DocumentType } from '$lib/hooks/actions/client.action'
import type { ClientDocumentItem } from '$lib/types/client'

export interface ClientDetailVM {
  name: string
  code: string
  /** client | guardian | both — 앱 연결 섹션 게이팅용 */
  role: string
  birth: string
  gender: 'MALE' | 'FEMALE'
  phone: string
  email: string
  address: string
  memo: string
  profileImageUrl: string | null
}

export interface RelationInfo {
  clientId: string
  name: string
  relationLabel: string
}

export function mapToClientDetailVM(data: any): ClientDetailVM | null {
  if (!data) return null
  return {
    name: data.name ?? '',
    code: data.code ?? '',
    role: data.role ?? '',
    birth: data.birth_date ?? '',
    gender:
      data.gender === 'male' || data.gender === 'MALE' ? 'MALE' : 'FEMALE',
    phone: data.phone ?? '',
    email: data.email ?? '',
    address: data.address ?? '',
    memo: data.memo ?? '',
    profileImageUrl: data.profile_image_url ?? null
  }
}

export function mapToDocumentItem(doc: DocumentType): ClientDocumentItem {
  return {
    title: doc.document.name,
    originalName: doc.document.original_name,
    id: doc.document.id,
    mappingId: doc.mapping_id,
    finishedAt: doc.created_at,
    fileType: doc.document.file_type,
    fileSize: doc.document.file_size,
    storagePath: doc.document.storage_path,
    file: undefined
  }
}

export function mapToPreAdmissionDocument(
  documentData: DocumentType[]
): ClientDocumentItem | null {
  const found = documentData.find((d) => d.resource_type === 'pre_admission')
  if (!found) return null
  return mapToDocumentItem(found)
}

export function mapToDocumentList(
  documentData: DocumentType[]
): ClientDocumentItem[] {
  return documentData
    .filter((d) => d.resource_type !== 'pre_admission')
    .map(mapToDocumentItem)
}

export function formatAnswerValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value
}
