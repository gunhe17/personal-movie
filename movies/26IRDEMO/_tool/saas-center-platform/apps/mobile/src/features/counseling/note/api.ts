import apiClient from '@/shared/api/client';
import type {
  CounselingNoteResponse,
  CounselingNoteCreateRequest,
  CounselingNoteUpdateRequest,
  MyCounselingNotesResponse,
  MyNotesParams,
} from './types';

/** 내 상담일지 목록 조회 (작성/미작성/전체) */
export async function getMyNotes(
  centerId: string,
  params?: MyNotesParams,
): Promise<MyCounselingNotesResponse> {
  const response = await apiClient.get<MyCounselingNotesResponse>(
    `/centers/${centerId}/counseling/notes`,
    {
      params: {
        status: params?.status ?? 'all',
        ...(params?.keyword ? { keyword: params.keyword } : {}),
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 30,
      },
    },
  );
  return response.data;
}

/** 회기 노트 목록 조회 */
export async function getNotesBySession(
  centerId: string,
  sessionId: string,
  clientId?: string,
): Promise<CounselingNoteResponse[]> {
  const response = await apiClient.get<CounselingNoteResponse[]>(
    `/centers/${centerId}/counseling/sessions/${sessionId}/notes`,
    { params: clientId ? { client_id: clientId } : undefined },
  );
  return response.data;
}

/** 노트 단일 조회 */
export async function getNoteById(
  centerId: string,
  noteId: string,
): Promise<CounselingNoteResponse> {
  const response = await apiClient.get<CounselingNoteResponse>(
    `/centers/${centerId}/counseling/notes/${noteId}`,
  );
  return response.data;
}

/** 노트 생성 */
export async function createNote(
  centerId: string,
  sessionId: string,
  data: CounselingNoteCreateRequest,
): Promise<CounselingNoteResponse> {
  const response = await apiClient.post<CounselingNoteResponse>(
    `/centers/${centerId}/counseling/sessions/${sessionId}/notes`,
    data,
  );
  return response.data;
}

/** 노트 수정 */
export async function updateNote(
  centerId: string,
  noteId: string,
  data: CounselingNoteUpdateRequest,
): Promise<CounselingNoteResponse> {
  const response = await apiClient.patch<CounselingNoteResponse>(
    `/centers/${centerId}/counseling/notes/${noteId}`,
    data,
  );
  return response.data;
}

/** 노트 삭제 */
export async function deleteNote(
  centerId: string,
  noteId: string,
): Promise<void> {
  await apiClient.delete(`/centers/${centerId}/counseling/notes/${noteId}`);
}
