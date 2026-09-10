import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createRecord,
  deleteRecord,
  getRecord,
  getRecordDates,
  getRecords,
  moveRecordProfile,
  setRecordBookmark,
  updateRecord,
} from './api';
import type { RecordCreateInput, RecordUpdateInput } from './types';

const PAGE_SIZE = 20;

/** 목록·달력 점·상세가 한 덩어리로 갱신되도록 루트 키를 공유한다 */
function invalidateRecords(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['records'] });
  queryClient.invalidateQueries({ queryKey: ['record-dates'] });
}

/** from/to는 반개구간 [from, to) `YYYY-MM-DDTHH:mm:ss` — 없으면 전체 기간 */
export function useRecords(params: {
  profileId?: string | null;
  bookmarkedOnly?: boolean;
  from?: string | null;
  to?: string | null;
  enabled?: boolean;
}) {
  return useInfiniteQuery({
    queryKey: [
      'records',
      params.profileId ?? 'all',
      !!params.bookmarkedOnly,
      params.from ?? 'all',
      params.to ?? 'all',
    ],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getRecords({
        profileId: params.profileId,
        cursor: pageParam,
        limit: PAGE_SIZE,
        bookmarkedOnly: params.bookmarkedOnly,
        from: params.from,
        to: params.to,
      }),
    getNextPageParam: (last) => last.next_cursor,
    enabled: params.enabled ?? true,
    /**
     * 날짜·뷰를 옮기면 queryKey가 바뀌어 새 쿼리가 되는데, 그때마다 화면이
     * 로딩 스피너로 교체돼 깜빡였다. 이전 데이터를 그대로 들고 있다가 새 응답이
     * 오면 갈아끼운다 — 스피너 대신 살짝 흐려지는 전환(isPlaceholderData)만 남는다.
     */
    placeholderData: (prev) => prev,
  });
}

/** 주간 스트립·달력 점 — from/to는 `YYYY-MM-DDTHH:mm:ss` */
export function useRecordDates(params: {
  profileId?: string | null;
  from: string;
  to: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'record-dates',
      params.profileId ?? 'all',
      params.from,
      params.to,
    ],
    queryFn: () =>
      getRecordDates({
        profileId: params.profileId,
        from: params.from,
        to: params.to,
      }),
    enabled: params.enabled ?? true,
    // 달을 넘길 때 스트립·달력 점이 잠깐 사라지지 않게 이전 범위를 들고 있는다
    placeholderData: (prev) => prev,
  });
}

export function useRecord(recordId: string | null) {
  return useQuery({
    queryKey: ['records', 'detail', recordId],
    queryFn: () => getRecord(recordId as string),
    enabled: !!recordId,
  });
}

export function useCreateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordCreateInput) => createRecord(input),
    onSuccess: () => invalidateRecords(queryClient),
  });
}

export function useUpdateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      input,
    }: {
      recordId: string;
      input: RecordUpdateInput;
    }) => updateRecord(recordId, input),
    onSuccess: () => invalidateRecords(queryClient),
  });
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => deleteRecord(recordId),
    onSuccess: () => invalidateRecords(queryClient),
  });
}

export function useSetRecordBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      bookmarked,
    }: {
      recordId: string;
      bookmarked: boolean;
    }) => setRecordBookmark(recordId, bookmarked),
    onSuccess: () => invalidateRecords(queryClient),
  });
}

export function useMoveRecordProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      targetProfileId,
    }: {
      recordId: string;
      targetProfileId: string;
    }) => moveRecordProfile(recordId, targetProfileId),
    onSuccess: () => invalidateRecords(queryClient),
  });
}
