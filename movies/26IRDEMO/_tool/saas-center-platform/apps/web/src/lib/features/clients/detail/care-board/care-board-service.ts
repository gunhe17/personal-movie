// 케어보드 쿼리·뮤테이션 캡슐화. 도크는 이 서비스가 준 상태만 그린다.

import {
  createInfiniteQuery,
  keepPreviousData,
  useQueryClient
} from '@tanstack/svelte-query'
import { get as getStore } from 'svelte/store'
import { mutationBuilder } from '$lib/hooks/queries/builder'
import { auth } from '$lib/stores/auth'
import {
  deleteCareMemo,
  getCareBoardStream,
  patchCareMemo,
  postCareBoardPin,
  postCareBoardRead,
  postCareMemo,
  type CareBoardStreamResponse,
  type CareBoardStreamRow
} from '$lib/hooks/actions/care-board.action'
import { FILTERS, toStreamItem, type StreamItem } from './view-model'

const STREAM_KEY = 'getCareBoardStream'
// 첫 묶음은 작게 — 나머지는 위로 올릴 때 이어 붙인다
const PAGE_SIZE = 50

export function createCareBoardService(params: {
  centerId: () => string
  clientId: string
  filter: () => string
  enabled: () => boolean
}) {
  const queryClient = useQueryClient()
  const fetchStream = getCareBoardStream().request

  // 커서 페이징이라 공용 infiniteQueryBuilder(skip/limit + {items,total})를 못 쓴다
  const stream = createInfiniteQuery(() => ({
    queryKey: [
      STREAM_KEY,
      'infinite',
      params.centerId(),
      params.clientId,
      params.filter()
    ],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchStream({
        centerId: params.centerId(),
        clientId: params.clientId,
        kinds: FILTERS.find((f) => f.value === params.filter())?.kinds ?? [],
        cursor: pageParam,
        limit: PAGE_SIZE
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CareBoardStreamResponse) =>
      last?.next_cursor ?? undefined,
    enabled: params.enabled() && !!params.centerId(),
    // 필터를 바꾸면 키가 바뀐다 — 이게 없으면 새 데이터가 올 때까지 목록이
    // 빈 프레임을 한 번 지나가서 화면이 깜빡인다(이전 목록을 들고 있다가 교체)
    placeholderData: keepPreviousData,
    throwOnError: true,
    refetchOnMount: 'always',
    refetchOnReconnect: false,
    staleTime: 0
  }))

  /** 첫 묶음 = 가장 최근. 고정 메모·안 읽음 수는 여기 것만 쓴다 */
  const head = (): CareBoardStreamResponse | undefined =>
    stream.data?.pages?.[0]

  // refetchType 'all' — 지금 보고 있는 필터만 갱신하면 다른 탭 캐시가 낡은 채 남아,
  // 그 탭으로 옮겼을 때 옛 목록이 먼저 보였다가 새 행이 튀어 들어온다
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: [STREAM_KEY],
      exact: false,
      refetchType: 'all'
    })

  /** 임시 행이 들어갈 캐시인가 — 이 내담자의 'all'·'memo' 탭만(메모는 그 둘에만 뜬다) */
  const acceptsMemo = (key: readonly unknown[]) =>
    key[0] === STREAM_KEY &&
    key[3] === params.clientId &&
    (key[4] === 'all' || key[4] === 'memo')

  /** 임시 행 식별자 — 캐시 안에서만 쓰는 값이라 UUID일 필요가 없다.
   *  ⚠️ `crypto.randomUUID`는 **secure context(https·localhost)에만** 있다.
   *  vite가 `--host 0.0.0.0`이라 LAN IP(`http://192.168…`)로 열면 undefined다 —
   *  그러면 POST를 보내기도 전에 여기서 TypeError가 나 전송이 통째로 죽고,
   *  도크의 catch가 그걸 삼켜 "엔터도 버튼도 무반응"이 된다. 없으면 난수로 대체한다. */
  const tempMemoId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`

  /** 서버 행과 같은 모양의 임시 메모 — toStreamItem이 그대로 그린다 */
  const optimisticRow = (id: string, text: string): CareBoardStreamRow => {
    const me = getStore(auth).user
    return {
      id,
      kind: 'memo',
      occurred_at: new Date().toISOString(),
      source_table: 'care_memos',
      source_id: id,
      case_id: null,
      actor_id: me?.id ?? null,
      actor_name: me?.name ?? null,
      share_class: 'center',
      title: null,
      subtitle: null,
      body: text,
      meta: null,
      pinned: false,
      pinned_at: null,
      pinned_by: null,
      pinned_by_name: null,
      source_deleted_at: null
    }
  }

  /** 방금 보낸 메모의 신원 인계표 — `메모 id → 임시 행 id`.
   *  낙관 행은 임시 id로 먼저 그려지는데, 서버 행이 도착할 때 신원(view-model `key`)이
   *  바뀌면 keyed each가 "제거 + 삽입"으로 읽어 등장 전환이 다시 돌고 말풍선이 깜빡인다.
   *  임시 id를 **서버 행 쪽이 물려받게** 해 신원을 고정한다 — 그러면 같은 행의 내용
   *  갱신이라 전환이 재생되지 않는다. (반대로 임시 행을 진짜 id로 올리면 그 순간
   *  키가 바뀌어 똑같이 깜빡인다 — 실측으로 확인.)
   *  이 화면 세션 동안만, 보낸 건수(수 건)만큼 산다. */
  const adoptedMemoKeys = new Map<string, string>()

  const streamKeys = () =>
    queryClient
      .getQueryCache()
      .findAll({ queryKey: [STREAM_KEY], exact: false })
      .map((q) => q.queryKey)

  // 서버는 최신순이라 첫 페이지 rows 맨 앞이 가장 최근 — 도크가 뒤집어 맨 아래에 그린다
  const insertOptimisticMemo = (id: string, text: string) => {
    const row = optimisticRow(id, text)
    for (const key of streamKeys()) {
      if (!acceptsMemo(key)) continue
      queryClient.setQueryData(key, (old: any) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((page: any, i: number) =>
            i === 0 ? { ...page, rows: [row, ...(page.rows ?? [])] } : page
          )
        }
      })
    }
  }

  const removeOptimisticMemo = (id: string) => {
    for (const key of streamKeys()) {
      queryClient.setQueryData(key, (old: any) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            rows: (page.rows ?? []).filter((r: any) => r.id !== id)
          }))
        }
      })
    }
  }

  const createMemo = mutationBuilder(postCareMemo)
  const updateMemo = mutationBuilder(patchCareMemo)
  const removeMemo = mutationBuilder(deleteCareMemo)
  const togglePin = mutationBuilder(postCareBoardPin)
  const markRead = mutationBuilder(postCareBoardRead)

  return {
    get isLoading() {
      return stream.isLoading
    },
    get items(): StreamItem[] {
      const rows = (stream.data?.pages ?? []).flatMap(
        (page) => page?.rows ?? []
      )
      // 서버는 최신순(커서 정렬), 도크는 채팅처럼 오래된 것이 위
      const items = rows.map((row) => {
        const item = toStreamItem(row)
        const adopted = adoptedMemoKeys.get(row.source_id)
        if (adopted) item.key = `${row.source_table}:${adopted}`
        return item
      })
      // 안전망 — 낙관 행과 서버 행이 한 프레임에 겹치면 키가 같아진다.
      // 재조회가 페이지를 통째로 갈아끼우므로 정상 경로에선 생기지 않지만,
      // 겹치는 순간 keyed each가 중복 키로 죽으므로 뒤엣것(서버 행)만 남긴다.
      const seen = new Set<string>()
      const deduped: StreamItem[] = []
      for (let i = items.length - 1; i >= 0; i--) {
        if (seen.has(items[i].key)) continue
        seen.add(items[i].key)
        deduped.push(items[i])
      }
      return deduped
    },
    get pinned(): StreamItem[] {
      return (head()?.pinned ?? []).map(toStreamItem)
    },
    get unreadCount(): number {
      return head()?.unread_count ?? 0
    },
    /** 위로 더 불러올 게 남았나 */
    get hasOlder(): boolean {
      return stream.hasNextPage ?? false
    },
    get isLoadingOlder(): boolean {
      return stream.isFetchingNextPage
    },
    /** 지금 보이는 게 이전 필터의 목록인가 — 교체 중임을 화면이 말하는 근거 */
    get isPlaceholder(): boolean {
      return stream.isPlaceholderData
    },
    async loadOlder() {
      if (!stream.hasNextPage || stream.isFetchingNextPage) return
      await stream.fetchNextPage()
    },
    /**
     * 채팅처럼 **먼저 붙이고 나중에 맞춘다** — 서버 왕복(POST + 재조회)을 기다리면
     * 엔터를 친 뒤 한 박자 비어 있어 "안 눌렸나" 싶어진다.
     * 임시 행을 캐시에 얹어 즉시 그리고, 응답이 오면 재조회가 진짜 행으로 갈아끼운다.
     * 실패하면 임시 행을 걷어내고 던진다(호출자가 입력값을 되살린다).
     */
    async submitMemo(body: string) {
      const text = body.trim()
      if (!text) return
      const tempId = `optimistic-memo-${tempMemoId()}`
      insertOptimisticMemo(tempId, text)
      let created: any
      try {
        created = await createMemo.mutateAsync({
          centerId: params.centerId(),
          clientId: params.clientId,
          body: text
        })
      } catch (e) {
        removeOptimisticMemo(tempId)
        throw e
      }
      // 재조회보다 **먼저** 등록해야 한다 — 서버 행이 도착하는 순간 이미 임시 신원을
      // 물려받고 있어야 제자리 갱신이 된다.
      if (created?.id) adoptedMemoKeys.set(created.id, tempId)
      await invalidate()
    },
    async editMemo(memoId: string, body: string) {
      await updateMemo.mutateAsync({
        centerId: params.centerId(),
        clientId: params.clientId,
        memoId,
        body: body.trim()
      })
      await invalidate()
    },
    async deleteMemo(memoId: string) {
      await removeMemo.mutateAsync({
        centerId: params.centerId(),
        clientId: params.clientId,
        memoId
      })
      await invalidate()
    },
    async setPinned(entryId: string, pinned: boolean) {
      await togglePin.mutateAsync({
        centerId: params.centerId(),
        clientId: params.clientId,
        entryId,
        pinned
      })
      await invalidate()
    },
    async markSeen() {
      if (!params.centerId()) return
      await markRead.mutateAsync({
        centerId: params.centerId(),
        clientId: params.clientId
      })
      // 서버에 기준선을 남긴 뒤 화면 숫자만 0으로 내린다 — 스트림을 다시 받으면
      // 읽음 표시 → refetch → 다시 읽음 표시로 도는 루프가 되므로 무효화하지 않는다
      queryClient.setQueriesData(
        { queryKey: [STREAM_KEY], exact: false },
        (old: any) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((page: any, i: number) =>
              i === 0 ? { ...page, unread_count: 0 } : page
            )
          }
        }
      )
    }
  }
}
