import apiClient from '@/shared/api/client';
import type {
  AppRecord,
  AppRecordList,
  RecordCreateInput,
  RecordUpdateInput,
} from './types';

/**
 * 목록 — occurred_at 내림차순 keyset. cursor는 이전 페이지 마지막 occurred_at.
 * from/to는 반개구간 [from, to) — 하루치만 보려면 그날 00:00 ~ 다음날 00:00.
 */
export async function getRecords(params: {
  profileId?: string | null;
  cursor?: string | null;
  limit?: number;
  bookmarkedOnly?: boolean;
  from?: string | null;
  to?: string | null;
}): Promise<AppRecordList> {
  const { data } = await apiClient.get<AppRecordList>('/app/records', {
    params: {
      profile_id: params.profileId ?? undefined,
      cursor: params.cursor ?? undefined,
      limit: params.limit ?? 20,
      bookmarked_only: params.bookmarkedOnly ?? undefined,
      occurred_from: params.from ?? undefined,
      occurred_to: params.to ?? undefined,
    },
  });
  return data;
}

/**
 * 날짜별 건수 — 주간 스트립·달력 점의 소스.
 * ⚠️ 건수를 주지만 화면은 유무와 최대 3점까지만 쓴다 — 카운터 표시는 §7-1 위반.
 */
export async function getRecordDates(params: {
  profileId?: string | null;
  from: string;
  to: string;
}): Promise<Record<string, number>> {
  const { data } = await apiClient.get<{ counts: Record<string, number> }>(
    '/app/records/dates',
    {
      params: {
        profile_id: params.profileId ?? undefined,
        occurred_from: params.from,
        occurred_to: params.to,
      },
    },
  );
  return data.counts;
}

export async function getRecord(recordId: string): Promise<AppRecord> {
  const { data } = await apiClient.get<AppRecord>(`/app/records/${recordId}`);
  return data;
}

export async function createRecord(
  input: RecordCreateInput,
): Promise<AppRecord> {
  const { data } = await apiClient.post<AppRecord>('/app/records', input);
  return data;
}

export async function updateRecord(
  recordId: string,
  input: RecordUpdateInput,
): Promise<AppRecord> {
  const { data } = await apiClient.patch<AppRecord>(
    `/app/records/${recordId}`,
    input,
  );
  return data;
}

export async function deleteRecord(recordId: string): Promise<void> {
  await apiClient.delete(`/app/records/${recordId}`);
}

export async function setRecordBookmark(
  recordId: string,
  bookmarked: boolean,
): Promise<AppRecord> {
  const { data } = await apiClient.patch<AppRecord>(
    `/app/records/${recordId}/bookmark`,
    { bookmarked },
  );
  return data;
}

/** 프로필 간 이동 — 날짜는 쓴 날 그대로 보존된다 */
export async function moveRecordProfile(
  recordId: string,
  targetProfileId: string,
): Promise<AppRecord> {
  const { data } = await apiClient.patch<AppRecord>(
    `/app/records/${recordId}/profile`,
    { target_profile_id: targetProfileId },
  );
  return data;
}
