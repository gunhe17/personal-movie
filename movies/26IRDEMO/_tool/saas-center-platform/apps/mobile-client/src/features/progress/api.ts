import apiClient from '@/shared/api/client';
import type { AssessmentReport, ProfileProgress } from './types';

/** 프로필별 상담·검사 진행 현황 (읽기 전용) */
export async function getProfileProgress(profileId: string): Promise<ProfileProgress> {
  const { data } = await apiClient.get<ProfileProgress>(
    `/app/profiles/${profileId}/progress`,
  );
  return data;
}

/** 검사 결과지 — 센터가 결과를 전송(공개)한 검사만 열린다 */
export async function getAssessmentReport(taskId: string): Promise<AssessmentReport> {
  const { data } = await apiClient.get<AssessmentReport>(
    `/app/assessment-tasks/${taskId}/report`,
  );
  return data;
}
