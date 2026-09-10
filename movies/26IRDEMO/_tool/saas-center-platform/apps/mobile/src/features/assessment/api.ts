import apiClient from "@/shared/api/client";
import type {
  AssessmentCaseListResponse,
  AssessmentCaseListParams,
  AssessmentCaseDetailResponse,
  AssessmentTaskResponse,
} from "./types";

export async function getAssessmentCaseList(
  params: AssessmentCaseListParams,
): Promise<AssessmentCaseListResponse> {
  const { centerId, ...query } = params;
  const response = await apiClient.get<AssessmentCaseListResponse>(
    `/centers/${centerId}/assessment-cases`,
    { params: { ...query, size: query.size ?? 50 } },
  );
  return response.data;
}

export async function getAssessmentCaseDetail(
  centerId: string,
  caseId: string,
): Promise<AssessmentCaseDetailResponse> {
  const response = await apiClient.get<AssessmentCaseDetailResponse>(
    `/centers/${centerId}/assessment-cases/${caseId}`,
  );
  return response.data;
}

export async function getCaseTasks(
  centerId: string,
  caseId: string,
): Promise<AssessmentTaskResponse[]> {
  const response = await apiClient.get<AssessmentTaskResponse[]>(
    `/centers/${centerId}/assessment-cases/${caseId}/tasks`,
  );
  return response.data;
}

export async function updateTaskOpinion(
  centerId: string,
  taskId: string,
  opinion: string | null,
): Promise<AssessmentTaskResponse> {
  const response = await apiClient.patch<AssessmentTaskResponse>(
    `/centers/${centerId}/tasks/${taskId}/opinion`,
    { opinion },
  );
  return response.data;
}

/** 검사 항목 완료 — POST /centers/{id}/assessment-cases/{caseId}/tasks/{assessmentId}/complete */
export async function completeTask(
  centerId: string,
  caseId: string,
  assessmentId: string,
): Promise<AssessmentTaskResponse> {
  const response = await apiClient.post<AssessmentTaskResponse>(
    `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/complete`,
    {},
  );
  return response.data;
}

/** 검사 완료 되돌리기 — POST /centers/{id}/assessment-cases/{caseId}/tasks/{assessmentId}/revert */
export async function revertTask(
  centerId: string,
  caseId: string,
  assessmentId: string,
): Promise<AssessmentTaskResponse> {
  const response = await apiClient.post<AssessmentTaskResponse>(
    `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/revert`,
    {},
  );
  return response.data;
}

/** 검사 항목 중단 — POST /centers/{id}/tasks/{taskId}/cancel (사유, 선택) */
export async function cancelTask(
  centerId: string,
  taskId: string,
  reason: string | null,
): Promise<AssessmentTaskResponse> {
  const response = await apiClient.post<AssessmentTaskResponse>(
    `/centers/${centerId}/tasks/${taskId}/cancel`,
    { reason },
  );
  return response.data;
}

/** 검사 항목 거부 — POST /centers/{id}/assessment-cases/{caseId}/tasks/{assessmentId}/refuse (사유) */
export async function refuseTask(
  centerId: string,
  caseId: string,
  assessmentId: string,
  reason: string,
): Promise<AssessmentTaskResponse> {
  const response = await apiClient.post<AssessmentTaskResponse>(
    `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/refuse`,
    { reason },
  );
  return response.data;
}

/** 검사 항목 중단·거부 되돌리기 — POST /centers/{id}/tasks/{taskId}/rollback */
export async function rollbackTask(
  centerId: string,
  taskId: string,
): Promise<AssessmentTaskResponse> {
  const response = await apiClient.post<AssessmentTaskResponse>(
    `/centers/${centerId}/tasks/${taskId}/rollback`,
    {},
  );
  return response.data;
}

export async function getDocumentDownloadUrl(
  centerId: string,
  documentId: string,
): Promise<string> {
  const response = await apiClient.get<{ download_url: string }>(
    `/centers/${centerId}/documents/${documentId}/download-url`,
  );
  return response.data.download_url;
}
