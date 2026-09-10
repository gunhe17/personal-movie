/**
 * 당겨서 새로고침 — 전 화면 공용 RefreshControl (브랜드 그린 스피너).
 *
 * const refreshControl = useRefreshControl(() => Promise.all([...refetch들]));
 * <ScrollView refreshControl={refreshControl}>
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { COLORS } from '@/shared/constants/theme';

export function useRefreshControl(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={COLORS.gray[400]}
      colors={[COLORS.brand[500]]}
      progressBackgroundColor={COLORS.white}
    />
  );
}

/**
 * disabled 쿼리 가드 — react-query의 refetch()는 enabled=false여도 강제 실행되므로
 * (게스트가 인증 API를 때리게 됨), 한 번이라도 fetch된 쿼리만 새로고침한다.
 */
export function refetchIfFetched(query: {
  isFetched: boolean;
  refetch: () => Promise<unknown>;
}): Promise<unknown> {
  return query.isFetched ? query.refetch() : Promise.resolve();
}
