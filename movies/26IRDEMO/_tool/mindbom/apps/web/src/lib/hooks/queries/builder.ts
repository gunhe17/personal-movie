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

export const queryBuilder = <T, TResponse = ApiResponse<T>>(
  action: () => Action<T, TResponse>,
  keyId?: number | string | (number | string)[] | object | (() => any),
  queryOptions?: Record<string, unknown> | (() => Record<string, unknown>)
) => {
  const actionOption = action()

  if (!actionOption) throw new Error('Option is null!')
  if (!actionOption.key) throw new Error('key must be specified!')

  const query = createQuery(() => {
    const resolvedKeyId = typeof keyId === 'function' ? keyId() : keyId

    const key = resolvedKeyId
      ? [actionOption.key![0], resolvedKeyId]
      : ([actionOption.key![0]] as QueryKey)

    const resolvedQueryOptions =
      typeof queryOptions === 'function' ? queryOptions() : queryOptions ?? {}

    return {
      queryKey: key,
      queryFn: async (): Promise<TResponse> => {
        return await actionOption.request(resolvedKeyId)
      },
      placeholderData: keepPreviousData,
      throwOnError: true,
      enabled: true,
      refetchOnMount: 'always',
      refetchOnReconnect: false,
      staleTime: 0,
      ...(resolvedQueryOptions as any)
    } as const
  })

  return query as typeof query & { data: TResponse }
}

type MutationOptions<T> = {
  successMessage?: string
  errorMessage?: string
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
  const actionOption = action()

  if (!actionOption) throw new Error('Option is null!')

  const query = createMutation(() => ({
    mutationFn: (request: object | string): Promise<ApiResponse<T>> =>
      actionOption.request(request),
    onMutate: async (variables: any) => {
      if (options?.onMutate) {
        return options.onMutate(variables, client)
      }
    },
    onSuccess: () => {
      if (actionOption?.key && Array.isArray(actionOption.key)) {
        actionOption.key.forEach((key) => {
          const queryKey = typeof key === 'string' ? [key] : key
          client.invalidateQueries({ queryKey, exact: false })
        })
      }

      if (useInvalidate) {
        const queryKey =
          typeof useInvalidate === 'string' ? [useInvalidate] : useInvalidate
        client.invalidateQueries({ queryKey, exact: false })
      }

      if (extraInvalidate?.length) {
        extraInvalidate.forEach((key) => {
          const queryKey = typeof key === 'string' ? [key] : key
          client.invalidateQueries({ queryKey, exact: false })
        })
      }

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
      if (options?.showError !== false) {
        showErrorSnackbar(err, options?.errorMessage)
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

  return {
    client,
    ...query,
    mutateAsync: (variables: any, opts?: any) =>
      (query as any).mutateAsync(variables, opts)
  }
}
