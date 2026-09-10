import apiClient from '@/shared/api/client';
import type {
  ClientListResponse, ClientListParams, ClientDetail,
  AssessmentCaseSummary, CounselingCaseListResponse,
  CreateClientPayload, BatchCreateClientsRequest, BatchCreateClientsResponse,
  RelationResponse, FavoriteListResponse, FavoriteResponse,
  ClientSignalListResponse,
  ClientFormInstanceListResponse,
  ClientDocumentListResponse,
} from './types';

export async function getClientList(params: ClientListParams): Promise<ClientListResponse> {
  const { centerId, ...query } = params;
  const response = await apiClient.get<ClientListResponse>(
    `/centers/${centerId}/clients/`,
    { params: query },
  );
  return response.data;
}

export async function getClientDetail(centerId: string, clientId: string): Promise<ClientDetail> {
  const response = await apiClient.get<ClientDetail>(
    `/centers/${centerId}/clients/${clientId}`,
  );
  return response.data;
}

/** Phase 4a-1: 단일 내담자의 활성 신호 통합 — Attention 카드용 */
export async function getClientSignals(
  centerId: string,
  clientId: string,
): Promise<ClientSignalListResponse> {
  const response = await apiClient.get<ClientSignalListResponse>(
    `/centers/${centerId}/clients/${clientId}/signals`,
  );
  return response.data;
}

/** 내담자별 폼 인스턴스 (사전기록지·동의서 등) 목록 — web과 동일 API */
export async function getClientFormInstances(
  centerId: string,
  clientId: string,
  params?: { template_id?: string; status?: 'draft' | 'submitted' },
): Promise<ClientFormInstanceListResponse> {
  const response = await apiClient.get<ClientFormInstanceListResponse>(
    `/centers/${centerId}/clients/${clientId}/form-instances`,
    { params },
  );
  return response.data;
}

/** 내담자별 업로드 문서 목록 — web과 동일 API. resource_type로 분류 가능 */
export async function getClientDocuments(
  centerId: string,
  clientId: string,
  params?: { resource_type?: string },
): Promise<ClientDocumentListResponse> {
  const response = await apiClient.get<ClientDocumentListResponse>(
    `/centers/${centerId}/clients/${clientId}/documents`,
    { params },
  );
  return response.data;
}

/** 문서 다운로드용 Pre-signed URL 조회 (document 모듈 엔드포인트 재사용, read:document) */
export async function getDocumentDownloadUrl(
  centerId: string,
  documentId: string,
): Promise<string> {
  const response = await apiClient.get<{ download_url: string }>(
    `/centers/${centerId}/documents/${documentId}/download-url`,
  );
  return response.data.download_url;
}

export async function getClientCases(centerId: string, clientId: string): Promise<AssessmentCaseSummary[]> {
  const response = await apiClient.get<AssessmentCaseSummary[]>(
    `/centers/${centerId}/assessment-cases/by-client/${clientId}`,
  );
  return response.data;
}

export async function getCounselingCasesByClientName(
  centerId: string,
  clientName: string,
): Promise<CounselingCaseListResponse> {
  const response = await apiClient.get<CounselingCaseListResponse>(
    `/centers/${centerId}/counseling/`,
    { params: { client_name: clientName, size: 50 } },
  );
  return response.data;
}

export async function createClient(
  centerId: string,
  data: CreateClientPayload,
): Promise<ClientDetail> {
  const response = await apiClient.post<ClientDetail>(
    `/centers/${centerId}/clients/`,
    data,
  );
  return response.data;
}

export async function batchCreateClients(
  centerId: string,
  data: BatchCreateClientsRequest,
): Promise<BatchCreateClientsResponse> {
  const response = await apiClient.post<BatchCreateClientsResponse>(
    `/centers/${centerId}/clients/batch`,
    data,
  );
  return response.data;
}

export async function getClientRelations(
  centerId: string,
  clientId: string,
  relationCategory?: 'guardian' | 'sibling',
): Promise<RelationResponse[]> {
  const response = await apiClient.get<RelationResponse[]>(
    `/centers/${centerId}/clients/${clientId}/relations`,
    { params: relationCategory ? { relation_category: relationCategory } : undefined },
  );
  return response.data;
}

// --- Favorites ---

export async function getClientFavorites(centerId: string): Promise<FavoriteListResponse> {
  const response = await apiClient.get<FavoriteListResponse>(
    `/centers/${centerId}/clients/favorites`,
  );
  return response.data;
}

export async function addClientFavorite(
  centerId: string,
  clientId: string,
): Promise<FavoriteResponse> {
  const response = await apiClient.post<FavoriteResponse>(
    `/centers/${centerId}/clients/${clientId}/favorite`,
  );
  return response.data;
}

export async function removeClientFavorite(
  centerId: string,
  clientId: string,
): Promise<void> {
  await apiClient.delete(`/centers/${centerId}/clients/${clientId}/favorite`);
}
