export type ApiResponse<T> = {
  success: boolean
  data: T
  meta?: ApiMeta
}

export type ApiMeta = {
  pagination?: PaginationType
  code?: number
  message?: string
  [key: string]: any
}

export type PaginationType = {
  page: number
  page_size?: number
  total: number
  total_pages?: number
}

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  meta: ApiMeta & {
    pagination: PaginationType
  }
}

export type Action<T, TResponse = ApiResponse<T>> = {
  key?: string[]
  request: (params?: any) => Promise<TResponse>
}
