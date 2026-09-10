import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getNoticeDetail, getNoticeList } from './api';

const PAGE_SIZE = 20;

export function useNoticeList(centerId: string | null) {
  return useInfiniteQuery({
    queryKey: ['noticeList', centerId],
    queryFn: ({ pageParam }) =>
      getNoticeList({
        page: pageParam,
        size: PAGE_SIZE,
        center_id: centerId ?? undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    staleTime: 60 * 1000,
  });
}

export function useNoticeDetail(noticeId: string | null, centerId: string | null) {
  return useQuery({
    queryKey: ['noticeDetail', noticeId, centerId],
    queryFn: () => getNoticeDetail(noticeId!, centerId ?? undefined),
    enabled: !!noticeId,
    staleTime: 60 * 1000,
  });
}
