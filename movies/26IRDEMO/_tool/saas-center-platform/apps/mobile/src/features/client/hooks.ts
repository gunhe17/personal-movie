import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  getClientList, getClientDetail, getClientCases, getCounselingCasesByClientName,
  createClient, batchCreateClients, getClientRelations,
  getClientFavorites, addClientFavorite, removeClientFavorite,
  getClientSignals,
  getClientFormInstances,
  getClientDocuments,
} from './api';
import type {
  CounselingCaseListItem, CreateClientPayload, BatchCreateClientsRequest, RelationInfo,
  FavoriteListResponse, ClientDetail, ClientSummary,
} from './types';
import { RELATION_DETAIL_REVERSE_MAP } from './constants';

export interface UseClientListOptions {
  search?: string;
  status?: 'active' | 'inactive' | 'archived';
  sort?: 'asc' | 'desc' | 'name' | 'next_session';
  limit?: number;
}

export function useClientList(
  centerId: string | null,
  options: UseClientListOptions = {},
) {
  const { search, status, sort = 'desc', limit = 100 } = options;
  return useQuery({
    queryKey: ['clientList', centerId, search, status, sort, limit],
    queryFn: () =>
      getClientList({
        centerId: centerId!,
        search: search || undefined,
        status,
        sort,
        limit,
      }),
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000,
    // 검색어가 바뀌어도 이전 결과를 유지 → isLoading 이 다시 true 가 되지 않음.
    // (clients 화면은 isLoading 시 ScrollView 를 통째로 교체하는데, 그 안의 검색
    //  TextInput 까지 언마운트되어 키보드가 닫히던 문제를 막는다. 검색 중엔 isFetching/
    //  isPlaceholderData 로 표현되고 입력은 그대로 유지됨.)
    placeholderData: keepPreviousData,
  });
}

export const CLIENT_INFINITE_PAGE_SIZE = 40;

export interface UseInfiniteClientListOptions {
  search?: string;
  status?: 'active' | 'inactive' | 'archived';
  sort?: 'asc' | 'desc';
  pageSize?: number;
}

export function useInfiniteClientList(
  centerId: string | null,
  options: UseInfiniteClientListOptions = {},
) {
  const { search, status, sort = 'desc', pageSize = CLIENT_INFINITE_PAGE_SIZE } = options;
  return useInfiniteQuery({
    queryKey: ['clientListInfinite', centerId, search, status, sort, pageSize],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getClientList({
        centerId: centerId!,
        search: search || undefined,
        status,
        sort,
        skip: pageParam,
        limit: pageSize,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 상태별 카운트 (전체 / 활성 / 비활성) — 서버에서 total만 가져와 집계.
 * limit=1로 요청해 items는 최소로 전송받음.
 */
export function useClientCounts(centerId: string | null) {
  return useQuery({
    queryKey: ['clientCounts', centerId],
    queryFn: async () => {
      const [all, active, inactive] = await Promise.all([
        getClientList({ centerId: centerId!, limit: 1 }),
        getClientList({ centerId: centerId!, status: 'active', limit: 1 }),
        getClientList({ centerId: centerId!, status: 'inactive', limit: 1 }),
      ]);
      return {
        total: all.total,
        active: active.total,
        inactive: inactive.total,
      };
    },
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientDetail(centerId: string | null, clientId: string) {
  return useQuery({
    queryKey: ['clientDetail', centerId, clientId],
    queryFn: () => getClientDetail(centerId!, clientId),
    enabled: !!centerId && !!clientId,
  });
}

/** Phase 4a-1 /signals — Attention 카드 데이터. best-effort 30초 stale. */
export function useClientSignals(centerId: string | null, clientId: string) {
  return useQuery({
    queryKey: ['clientSignals', centerId, clientId],
    queryFn: () => getClientSignals(centerId!, clientId),
    enabled: !!centerId && !!clientId,
    staleTime: 30 * 1000,
  });
}

/** 내담자별 폼 인스턴스 (사전기록지·동의서 등) — 5분 stale. */
export function useClientFormInstances(
  centerId: string | null,
  clientId: string,
) {
  return useQuery({
    queryKey: ['clientFormInstances', centerId, clientId],
    queryFn: () => getClientFormInstances(centerId!, clientId),
    enabled: !!centerId && !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/** 내담자별 업로드 문서 — 5분 stale. */
export function useClientDocuments(centerId: string | null, clientId: string) {
  return useQuery({
    queryKey: ['clientDocuments', centerId, clientId],
    queryFn: () => getClientDocuments(centerId!, clientId),
    enabled: !!centerId && !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientCases(centerId: string | null, clientId: string) {
  return useQuery({
    queryKey: ['clientCases', centerId, clientId],
    queryFn: () => getClientCases(centerId!, clientId),
    enabled: !!centerId && !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 상담 케이스 조회 (client_name 기반 검색 후 client_id로 필터링)
 * 백엔드에 by-client 엔드포인트가 없으므로 이름 검색 후 클라이언트 ID 매칭
 */
export function useCounselingCases(centerId: string | null, clientId: string, clientName: string | null) {
  return useQuery({
    queryKey: ['counselingCases', centerId, clientId, clientName],
    queryFn: async (): Promise<CounselingCaseListItem[]> => {
      if (!clientName) return [];
      const response = await getCounselingCasesByClientName(centerId!, clientName);
      // client_name은 LIKE 검색이므로 정확한 client_id로 필터링
      return response.items.filter((item) =>
        item.clients.some((c) => c.client_id === clientId),
      );
    },
    enabled: !!centerId && !!clientId && !!clientName,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 내담자의 보호자 관계 조회 + 관계된 내담자 상세 조합
 */
export function useClientRelations(centerId: string | null, clientId: string) {
  return useQuery({
    queryKey: ['clientRelations', centerId, clientId],
    queryFn: async (): Promise<RelationInfo[]> => {
      const relations = await getClientRelations(centerId!, clientId, 'guardian');
      // 대표 보호자(is_primary) 우선, 이후 등록순
      const guardians = relations
        .filter((r) => r.relation_type === 'guardian' || r.relation_type === 'child')
        .sort((a, b) => {
          const primaryDiff = Number(b.is_primary ?? false) - Number(a.is_primary ?? false);
          if (primaryDiff !== 0) return primaryDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      if (guardians.length === 0) return [];

      const details = await Promise.all(
        guardians.map(async (rel): Promise<RelationInfo> => {
          const detail = await getClientDetail(centerId!, rel.related_client_id);
          const relationLabel =
            rel.relation_type === 'guardian'
              ? RELATION_DETAIL_REVERSE_MAP[rel.relation_detail || ''] || '보호자'
              : '내담자';
          return {
            clientId: rel.related_client_id,
            name: detail.name,
            relationType: rel.relation_type === 'guardian' ? 'guardian' : 'child',
            relationLabel,
            isPrimary: rel.is_primary ?? false,
            phone: detail.phone,
          };
        }),
      );
      return details;
    },
    enabled: !!centerId && !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateClient(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientPayload) => createClient(centerId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientList'], exact: false });
    },
  });
}

export function useBatchCreateClients(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchCreateClientsRequest) => batchCreateClients(centerId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientList'], exact: false });
    },
  });
}

// --- Favorites ---

export function useClientFavorites(centerId: string | null) {
  return useQuery({
    queryKey: ['clientFavorites', centerId],
    queryFn: () => getClientFavorites(centerId!),
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 관심 토글 — 낙관적 업데이트.
 * - favorites 캐시에 즉시 add/remove (캐러셀 즉시 반영)
 * - 진행 중인 client list 캐시들의 is_favorited 플래그도 즉시 갱신 (카드 하트 즉시 반영)
 * - 실패 시 모두 롤백, 성공 시 무관 캐시 무효화
 */
export function useToggleFavorite(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { clientId: string; next: boolean }) => {
      if (vars.next) {
        await addClientFavorite(centerId!, vars.clientId);
      } else {
        await removeClientFavorite(centerId!, vars.clientId);
      }
      return vars;
    },
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['clientFavorites', centerId] }),
        queryClient.cancelQueries({ queryKey: ['clientList'], exact: false }),
        queryClient.cancelQueries({ queryKey: ['clientListInfinite'], exact: false }),
        queryClient.cancelQueries({ queryKey: ['clientDetail', centerId, vars.clientId] }),
      ]);

      const snapshots = {
        favorites: queryClient.getQueryData<FavoriteListResponse>(['clientFavorites', centerId]),
        lists: queryClient.getQueriesData({ queryKey: ['clientList'], exact: false }),
        infinite: queryClient.getQueriesData({ queryKey: ['clientListInfinite'], exact: false }),
      };

      // Patch favorites list — add 시 favorites 캐시가 비어 있어도 detail/list
      // 캐시에서 ClientSummary 합성해 즉시 push (캐러셀 즉시 반영). 서버 응답 후
      // onSettled invalidate로 최종 순서·중복 정리.
      queryClient.setQueryData<FavoriteListResponse | undefined>(
        ['clientFavorites', centerId],
        (prev) => {
          const safe: FavoriteListResponse = prev ?? { items: [], total: 0 };
          if (!vars.next) {
            return {
              ...safe,
              items: safe.items.filter((c) => c.id !== vars.clientId),
              total: Math.max(safe.total - 1, 0),
            };
          }
          // add — 이미 있으면 맨 앞으로 이동
          const existing = safe.items.find((c) => c.id === vars.clientId);
          if (existing) {
            return {
              ...safe,
              items: [
                { ...existing, is_favorited: true },
                ...safe.items.filter((c) => c.id !== vars.clientId),
              ],
            };
          }
          // detail 캐시 → ClientSummary 합성 (필드 호환)
          const detail = queryClient.getQueryData<ClientDetail>([
            'clientDetail',
            centerId,
            vars.clientId,
          ]);
          if (!detail) return safe; // 없으면 invalidate가 마무리
          const summary: ClientSummary = {
            id: detail.id,
            code: detail.code,
            name: detail.name,
            role: detail.role,
            phone: detail.phone,
            status: detail.status,
            birth_date: detail.birth_date,
            gender: detail.gender,
            profile_image_url: detail.profile_image_url,
            memo: detail.memo,
            created_at: detail.created_at,
            is_favorited: true,
          };
          return {
            ...safe,
            items: [summary, ...safe.items],
            total: safe.total + 1,
          };
        },
      );

      // Patch is_favorited in all client list caches
      const flip = (item: { id: string; is_favorited?: boolean }) =>
        item.id === vars.clientId ? { ...item, is_favorited: vars.next } : item;

      snapshots.lists.forEach(([key, data]) => {
        if (!data || typeof data !== 'object') return;
        const d = data as { items?: unknown[] };
        if (!Array.isArray(d.items)) return;
        queryClient.setQueryData(key, {
          ...d,
          items: d.items.map((it) => flip(it as { id: string; is_favorited?: boolean })),
        });
      });

      snapshots.infinite.forEach(([key, data]) => {
        if (!data || typeof data !== 'object') return;
        const d = data as { pages?: Array<{ items?: unknown[] }> };
        if (!Array.isArray(d.pages)) return;
        queryClient.setQueryData(key, {
          ...d,
          pages: d.pages.map((p) => ({
            ...p,
            items: Array.isArray(p.items)
              ? p.items.map((it) => flip(it as { id: string; is_favorited?: boolean }))
              : p.items,
          })),
        });
      });

      // Patch detail is_favorited if cached
      queryClient.setQueryData<Record<string, unknown> | undefined>(
        ['clientDetail', centerId, vars.clientId],
        (prev) => (prev ? { ...prev, is_favorited: vars.next } : prev),
      );

      return snapshots;
    },
    onError: (_err, _vars, snapshots) => {
      if (!snapshots) return;
      queryClient.setQueryData(['clientFavorites', centerId], snapshots.favorites);
      snapshots.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      snapshots.infinite.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _err, vars) => {
      // 추가의 경우 서버에서 최신순으로 정렬된 favorites를 받아오기 위해 invalidate
      queryClient.invalidateQueries({ queryKey: ['clientFavorites', centerId] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail', centerId, vars.clientId] });
    },
  });
}
