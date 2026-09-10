import {
  createQuery,
  createInfiniteQuery,
  type QueryKey,
  createMutation,
  useQueryClient,
  keepPreviousData
} from '@tanstack/svelte-query'
import type { AxiosError } from 'axios'

import type { Action, ApiResponse, Page } from '$types/apiResponse'
import { showErrorSnackbar, showSuccessSnackbar } from '$utils/errorHandler'

/**
 * 주어진 옵션으로 데이터를 가져오기 위한 쿼리를 생성합니다.
 * @param action - 키와 요청 함수를 포함하는 Action 객체를 반환하는 함수.
 * @param keyId - 쿼리 키에 대한 선택적 식별자, 숫자, 문자열, 배열, 객체 또는 getter 함수일 수 있습니다.
 * @param queryOptions - 추가적인 쿼리 옵션.
 * @returns 쿼리 키와 쿼리 결과 subscribe를 포함하는 객체.
 */
export const queryBuilder = <T, TResponse = ApiResponse<T>>(
  action: () => Action<T, TResponse>,
  keyId?: number | string | (number | string)[] | object | (() => any),
  queryOptions?: Record<string, unknown> | (() => Record<string, unknown>)
) => {
  const actionOption = action()

  if (!actionOption) {
    throw new Error('Option is null!')
  } else if (!actionOption.key) {
    throw new Error('key must be specified!')
  }

  if (typeof keyId === 'function') {
  }
  const query = createQuery(() => {
    // keyId가 함수면 실행하여 값을 얻음 (반응형 지원)
    const resolvedKeyId = typeof keyId === 'function' ? keyId() : keyId

    // key를 함수 안에서 생성하여 반응형으로 만듦
    const key = resolvedKeyId
      ? [actionOption.key![0], resolvedKeyId]
      : ([actionOption.key![0]] as QueryKey)

    const resolvedQueryOptions =
      typeof queryOptions === 'function' ? queryOptions() : (queryOptions ?? {})

    return {
      queryKey: key,
      queryFn: async (): Promise<TResponse> => {
        const result = await actionOption.request(resolvedKeyId)
        return result
      },
      placeholderData: keepPreviousData, // 이전 데이터 유지하며 부드러운 전환
      throwOnError: true,
      // Svelte 5 호환성을 위한 설정
      enabled: true,
      refetchOnMount: 'always', // 페이지 진입 시 항상 최신 데이터 fetch
      refetchOnReconnect: false,
      staleTime: 0,
      ...(resolvedQueryOptions as any)
    } as const
  })

  return query as typeof query & { data: TResponse }
}

/**
 * offset(skip/limit) 기반 무한 스크롤 쿼리를 생성합니다.
 * 카드(그리드) 뷰 전용 — 테이블 뷰는 기존 queryBuilder + Pagination 을 그대로 사용한다.
 *
 * 백엔드 list 응답은 정본 Page<T>({ items, total, page, size, pages }) 형태를 따른다.
 * pageParam(0-based 페이지 인덱스)로 skip = pageParam * pageSize 를 계산하고,
 * 누적 로드된 items 수가 total 미만이면 다음 페이지가 있다고 판단한다.
 *
 * @param action - 키와 요청 함수를 포함하는 Action 객체를 반환하는 함수.
 * @param opts.key - 페이지(skip)를 제외한 반응형 쿼리 키(필터값들). 변경 시 처음부터 재조회.
 * @param opts.buildInput - (skip, limit) → 요청 입력. 기존 buildInput 을 재사용해 skip/limit 만 덮어쓰면 된다.
 * @param opts.pageSize - 페이지당 항목 수(청크). 숫자 또는 getter.
 * @param opts.enabled - 활성 여부(예: viewType === 'grid'). 숫자/불리언 또는 getter.
 */
export const infiniteQueryBuilder = <
  TItem,
  TResponse extends { items: TItem[]; total: number } = Page<TItem>
>(
  action: () => Action<TItem[], TResponse>,
  opts: {
    key: () => number | string | (number | string)[] | object
    buildInput: (skip: number, limit: number) => any
    pageSize: number | (() => number)
    enabled?: boolean | (() => boolean)
    queryOptions?: Record<string, unknown> | (() => Record<string, unknown>)
  }
) => {
  const actionOption = action()

  if (!actionOption) {
    throw new Error('Option is null!')
  } else if (!actionOption.key) {
    throw new Error('key must be specified!')
  }

  const query = createInfiniteQuery(() => {
    const resolvedKey = opts.key()
    const limit =
      typeof opts.pageSize === 'function' ? opts.pageSize() : opts.pageSize
    const enabled =
      typeof opts.enabled === 'function'
        ? opts.enabled()
        : (opts.enabled ?? true)
    const resolvedQueryOptions =
      typeof opts.queryOptions === 'function'
        ? opts.queryOptions()
        : (opts.queryOptions ?? {})

    return {
      queryKey: [
        actionOption.key![0],
        'infinite',
        resolvedKey,
        limit
      ] as QueryKey,
      queryFn: async ({ pageParam }): Promise<TResponse> => {
        const skip = (pageParam as number) * limit
        return actionOption.request(opts.buildInput(skip, limit))
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage: TResponse, allPages: TResponse[]) => {
        const loaded = allPages.reduce(
          (n, p) => n + (Array.isArray(p?.items) ? p.items.length : 0),
          0
        )
        const total = lastPage?.total ?? 0
        return loaded < total ? allPages.length : undefined
      },
      enabled,
      placeholderData: keepPreviousData, // 필터 전환 시 이전 페이지 유지하며 부드럽게 교체
      throwOnError: true,
      refetchOnMount: 'always',
      refetchOnReconnect: false,
      staleTime: 0,
      ...(resolvedQueryOptions as any)
    } as const
  })

  return query
}

/**
 * 선택적인 쿼리 무효화와 함께 데이터를 변경하기 위한 뮤테이션을 생성합니다.
 * @param action - 요청 함수를 포함하는 Action 객체를 반환하는 함수.
 * @param useInvalidate - 성공적인 뮤테이션 후 무효화할 선택적인 쿼리 키.
 * @param options - 성공/에러 메시지와 추가 옵션을 포함하는 객체.
 * @returns 쿼리 클라이언트와 뮤테이션 결과 subscribe를 포함하는 객체.
 */
type MutationOptions<T> = {
  successMessage?: string
  errorMessage?: string
  autoReset?: boolean
  showError?: boolean
  onMutate?: (variables: any, client: ReturnType<typeof useQueryClient>) => any
  onError?: (
    error: AxiosError | ApiResponse<T>,
    variables: any,
    context: any,
    client: ReturnType<typeof useQueryClient>
  ) => void
  onSettled?: (
    data: ApiResponse<T> | undefined,
    error: AxiosError | ApiResponse<T> | null,
    variables: any,
    context: any,
    client: ReturnType<typeof useQueryClient>
  ) => void
}

export const mutationBuilder = <T>(
  action: () => Action<T>,
  useInvalidate?: QueryKey,
  extraInvalidate?: QueryKey[],
  options?: MutationOptions<T>
) => {
  const client = useQueryClient()
  let actionOption = action()

  if (!actionOption) {
    throw new Error('Option is null!')
  }

  const query = createMutation(() => ({
    mutationFn: (request: object | string): Promise<ApiResponse<T>> =>
      actionOption.request(request),
    onMutate: async (variables: any) => {
      if (options?.onMutate) {
        return options.onMutate(variables, client)
      }
      return undefined
    },
    onSuccess: () => {
      // action의 key 배열에 있는 모든 키들을 invalidate
      if (actionOption?.key && Array.isArray(actionOption.key)) {
        actionOption.key.forEach((key) => {
          const queryKey = typeof key === 'string' ? [key] : key
          client.invalidateQueries({
            queryKey,
            exact: false // prefix matching 활성화 - ['assessments']로 시작하는 모든 쿼리 무효화
          })
        })
      }

      // 추가로 지정된 쿼리 무효화
      if (useInvalidate) {
        const queryKey =
          typeof useInvalidate === 'string' ? [useInvalidate] : useInvalidate
        client.invalidateQueries({
          queryKey,
          exact: false // prefix matching 활성화
        })
      }

      if (extraInvalidate && extraInvalidate.length) {
        extraInvalidate.forEach((key) => {
          const queryKey = typeof key === 'string' ? [key] : key
          client.invalidateQueries({
            queryKey,
            exact: false // prefix matching 활성화
          })
        })
      }

      // 성공 메시지 표시
      if (options?.successMessage) {
        showSuccessSnackbar(options.successMessage)
      }
    },
    onError: (
      err: AxiosError | ApiResponse<T>,
      variables: any,
      context: any
    ) => {
      if (options?.onError) {
        options.onError(err, variables, context, client)
      }
      console.error('Mutation error:', err)
      // 에러 메시지 표시 (options.showError가 true일 때만)
      if (options?.showError !== false) {
        if (options?.errorMessage) {
          showErrorSnackbar(err, options.errorMessage)
        } else {
          showErrorSnackbar(err)
        }
      }
    },
    onSettled: (
      data: ApiResponse<T> | undefined,
      error: AxiosError | ApiResponse<T> | null,
      variables: any,
      context: any
    ) => {
      if (options?.onSettled) {
        options.onSettled(data, error, variables, context, client)
      }
    }
  }))

  // @tanstack/svelte-query v6 의 createMutation 은 Proxy 를 반환하는데,
  // mutateAsync 를 Proxy 의 get 트랩에서만 동적으로 주입한다. Proxy 의 ownKeys 는
  // target(내부 result state)만 노출하므로 `...query` 스프레드 시 mutateAsync 가
  // 누락된다 (→ undefined). 래퍼 함수로 감싸 호출 시점마다 Proxy 의 get 트랩을
  // 경유하도록 하여 항상 최신 observer 의 mutate 를 보장한다.
  //
  // 주의: 기존 호출부는 전부 `.mutate(vars, { onSuccess, onError })` 콜백 패턴만
  // 사용하므로 이 추가는 순수 additive 임 (스프레드된 기존 속성은 그대로 보존).
  return {
    client,
    ...query,
    mutateAsync: (variables: any, options?: any) =>
      (query as any).mutateAsync(variables, options)
  }
}
