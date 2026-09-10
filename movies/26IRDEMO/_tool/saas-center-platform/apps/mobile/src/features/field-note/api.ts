import apiClient from '@/shared/api/client';
import type {
  FieldNoteResponse,
  FieldNoteDetailResponse,
  FieldNoteEntry,
  FieldNoteStatusItem,
  LinkableAssessmentTask,
  AudioUploadResponse,
} from './types';
import { AUDIO_UPLOAD_TIMEOUT_MS } from './constants';

/** 필드노트 생성 (녹음 시작) - scheduleId/taskId 없이도 가능.
 * scheduleId=상담 회기 연결, taskId=검사 항목 연결 (둘 다 지정 불가). */
export async function createFieldNote(
  centerId: string,
  scheduleId?: string | null,
  taskId?: string | null,
): Promise<FieldNoteResponse> {
  const response = await apiClient.post<FieldNoteResponse>(
    `/centers/${centerId}/field-notes`,
    { schedule_id: scheduleId ?? null, task_id: taskId ?? null },
  );
  return response.data;
}

/** 검사 항목(task)에 연결된 필드노트 목록 (최신순) */
export async function getFieldNotesByTask(
  centerId: string,
  taskId: string,
): Promise<FieldNoteStatusItem[]> {
  const response = await apiClient.get<FieldNoteStatusItem[]>(
    `/centers/${centerId}/field-notes/by-task/${taskId}`,
  );
  return response.data;
}

/** 필드노트 상세 조회 */
export async function getFieldNote(
  centerId: string,
  fieldNoteId: string,
): Promise<FieldNoteDetailResponse> {
  const response = await apiClient.get<FieldNoteDetailResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}`,
  );
  return response.data;
}

/** 일정별 필드노트 조회 */
export async function getFieldNoteBySchedule(
  centerId: string,
  scheduleId: string,
): Promise<FieldNoteDetailResponse> {
  const response = await apiClient.get<FieldNoteDetailResponse>(
    `/centers/${centerId}/field-notes/by-schedule/${scheduleId}`,
  );
  return response.data;
}

/** 필드노트 상태 일괄 조회 (schedule_ids로) */
export async function getFieldNoteStatuses(
  centerId: string,
  scheduleIds: string[],
): Promise<FieldNoteStatusItem[]> {
  if (scheduleIds.length === 0) return [];
  const response = await apiClient.get<FieldNoteStatusItem[]>(
    `/centers/${centerId}/field-notes/statuses`,
    { params: { schedule_ids: scheduleIds.join(',') } },
  );
  return response.data;
}

/** 메모/태그 추가 */
export async function addEntry(
  centerId: string,
  fieldNoteId: string,
  data: {
    entry_type: 'memo' | 'tag';
    tag_category?: string | null;
    content: string;
    timestamp_seconds: number;
  },
): Promise<FieldNoteEntry> {
  const response = await apiClient.post<FieldNoteEntry>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/entries`,
    data,
  );
  return response.data;
}

/** 오디오 청크 업로드 */
export async function uploadAudioChunk(
  centerId: string,
  fieldNoteId: string,
  fileUri: string,
  duration: number,
): Promise<AudioUploadResponse> {
  const formData = new FormData();

  // React Native FormData with file URI
  formData.append('file', {
    uri: fileUri,
    name: 'chunk.m4a',
    type: 'audio/mp4',
  } as unknown as Blob);
  formData.append('duration', duration.toString());

  const response = await apiClient.post<AudioUploadResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/audio`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: AUDIO_UPLOAD_TIMEOUT_MS,
    },
  );
  return response.data;
}

/** 녹음 종료 */
export async function finishRecording(
  centerId: string,
  fieldNoteId: string,
  totalDuration: number,
  skipPipeline = false,
): Promise<FieldNoteResponse> {
  const response = await apiClient.post<FieldNoteResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/finish`,
    {
      total_duration: totalDuration,
      skip_pipeline: skipPipeline,
      // 종료(분석)는 오케스트레이터 파이프라인으로 — 단계별 processing_step 기록 +
      // 완료 시 processing_status='completed'(완료 애니메이션 트리거). 단독 transcribe 는
      // 'idle'로 끝나 애니메이션이 안 뜬다. (요약은 파이프라인에서 제외돼 transcribe만 돎)
      auto_pipeline: !skipPipeline,
    },
  );
  return response.data;
}

/** 파이프라인 재시도 */
export async function retryPipeline(
  centerId: string,
  fieldNoteId: string,
): Promise<FieldNoteDetailResponse> {
  const response = await apiClient.post<FieldNoteDetailResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/retry-pipeline`,
  );
  return response.data;
}

/** AI 분석(요약) 생성 / 재생성.
 * 응답은 PipelineStepResponse (status: 'started' | 'already_completed' | ...).
 * 필드노트 detail 이 아니므로 캐시에 그대로 spread 하지 말 것. */
export interface PipelineStepResponse {
  status: 'started' | 'already_completed' | 'precondition_not_met' | string;
  step: string;
  field_note_id: string;
  message?: string | null;
}

/** 파이프라인 남은 단계 전체 실행 (transcribe → summary).
 * "저장만 하기" 로 종료한 노트나 transcribe 만 된 노트의 분석 트리거에 사용.
 * 이미 완료된 step 은 백엔드가 자동 스킵. */
export async function runPipeline(
  centerId: string,
  fieldNoteId: string,
): Promise<PipelineStepResponse> {
  const response = await apiClient.post<PipelineStepResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/run-pipeline`,
  );
  return response.data;
}

export async function generateSummary(
  centerId: string,
  fieldNoteId: string,
): Promise<PipelineStepResponse> {
  const response = await apiClient.post<PipelineStepResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/generate-summary`,
  );
  return response.data;
}

/** 화자분리 (유료 온디맨드) 실행 — 전사된 노트를 화자별로 분리.
 * status: 'started' | 'insufficient_credit' | 'already_done' | 'precondition_not_met' | ... */
export async function diarizeFieldNote(
  centerId: string,
  fieldNoteId: string,
): Promise<PipelineStepResponse> {
  const response = await apiClient.post<PipelineStepResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/diarize`,
  );
  return response.data;
}

/**
 * 상담일지 초안 자동 생성 — 필드노트가 연결된 회기의 내담자별 상담일지를 LLM으로 생성.
 * 회기 미연결/내담자 없음 등은 PipelineStepResponse.status(started 외) + message로 안내된다.
 * 회기 전체 내담자에게 일괄 생성됨(그룹이면 N명 모두).
 */
export async function generateCounselingNote(
  centerId: string,
  fieldNoteId: string,
  noteTemplateType?: string,
): Promise<PipelineStepResponse> {
  const response = await apiClient.post<PipelineStepResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/generate-counseling-note`,
    noteTemplateType ? { note_template_type: noteTemplateType } : undefined,
  );
  return response.data;
}

/** 회기 연결 (미연결 필드노트에 schedule 연결) */
export async function linkSchedule(
  centerId: string,
  fieldNoteId: string,
  scheduleId: string,
): Promise<FieldNoteResponse> {
  const response = await apiClient.post<FieldNoteResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/link-schedule`,
    { schedule_id: scheduleId },
  );
  return response.data;
}

/** 검사 항목(task) 연결 — 검사별 필드노트 */
export async function linkTask(
  centerId: string,
  fieldNoteId: string,
  taskId: string,
): Promise<FieldNoteResponse> {
  const response = await apiClient.post<FieldNoteResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/link-task`,
    { task_id: taskId },
  );
  return response.data;
}

/** 연결 가능한 검사 task 목록 (진행중 케이스 onsite·미완료) */
export async function getLinkableAssessmentTasks(
  centerId: string,
): Promise<LinkableAssessmentTask[]> {
  const response = await apiClient.get<LinkableAssessmentTask[]>(
    `/centers/${centerId}/field-notes/linkable-tasks`,
  );
  return response.data;
}

/** 화자 이름 매핑 업데이트 */
export async function updateSpeakerMap(
  centerId: string,
  fieldNoteId: string,
  speakerMap: Record<string, string>,
): Promise<FieldNoteResponse> {
  const response = await apiClient.patch<FieldNoteResponse>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/speaker-map`,
    { speaker_map: speakerMap },
  );
  return response.data;
}

/** 미연결 필드노트 목록 조회 */
export async function getUnlinkedFieldNotes(
  centerId: string,
  params?: { analysis_state?: string },
): Promise<FieldNoteResponse[]> {
  const response = await apiClient.get<FieldNoteResponse[]>(
    `/centers/${centerId}/field-notes/unlinked`,
    { params },
  );
  return response.data;
}

/** 전체 필드노트 목록 조회 (연결+미연결 포함, 페이지네이션). */
export interface FieldNoteListResponse {
  items: FieldNoteResponse[];
  total: number;
  page: number;
  size: number;
}

export async function getFieldNotes(
  centerId: string,
  params?: { linked?: boolean; link_type?: 'schedule' | 'task' | 'none'; analysis_state?: string; page?: number; size?: number },
): Promise<FieldNoteListResponse> {
  const response = await apiClient.get<FieldNoteListResponse>(
    `/centers/${centerId}/field-notes`,
    { params },
  );
  return response.data;
}

/** 필드노트 삭제 */
export async function deleteFieldNote(
  centerId: string,
  fieldNoteId: string,
): Promise<void> {
  await apiClient.delete(`/centers/${centerId}/field-notes/${fieldNoteId}`);
}

/** 오디오 청크 다운로드 URL 조회 */
export async function getAudioDownloadUrl(
  centerId: string,
  fieldNoteId: string,
  audioId: string,
): Promise<{ download_url: string; expires_in: number; audio_id: string; chunk_index: number; duration: number }> {
  const response = await apiClient.get<{ download_url: string; expires_in: number; audio_id: string; chunk_index: number; duration: number }>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/audio/${audioId}/download-url`,
  );
  return response.data;
}

/** AI 상담 추천 요청 */
export async function getRecommendation(
  centerId: string,
  fieldNoteId: string,
): Promise<{ recommendation: string }> {
  const response = await apiClient.post<{ recommendation: string }>(
    `/centers/${centerId}/field-notes/${fieldNoteId}/recommend`,
  );
  return response.data;
}
