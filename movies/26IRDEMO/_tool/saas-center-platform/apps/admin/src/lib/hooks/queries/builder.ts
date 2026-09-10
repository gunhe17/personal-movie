import {
  createQuery,
  type QueryKey,
  createMutation,
  useQueryClient,
  keepPreviousData
} from '@tanstack/svelte-query'
import type { AxiosError } from 'axios'

import type { Action, ApiResponse } from '$types/apiResponse'
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

  return { client, ...query }
}
