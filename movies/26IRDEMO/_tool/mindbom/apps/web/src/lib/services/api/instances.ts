import axios from 'axios'
import type { ApiResponse } from '$lib/types/apiResponse'
import setInterceptors from './interceptors'

const appInstance = axios.create({
  baseURL: '/api/proxy',
  timeout: 30000
})
setInterceptors(appInstance)

const get = async <T = any>(
  route: string,
  params?:
    | Record<string, string | number | boolean | null | undefined>
    | URLSearchParams
): Promise<T> => {
  const response = await appInstance.get<T>(route, { params })
  return response.data
}

const put = async <T>(
  route: string,
  params?: object
): Promise<ApiResponse<T>> => {
  const response = await appInstance.put<ApiResponse<T>>(route, params)
  return response.data
}

const post = async <T>(
  route: string,
  params?: object
): Promise<ApiResponse<T>> => {
  const response = await appInstance.post<ApiResponse<T>>(route, params)
  return response.data
}

const postRaw = async <T = any>(
  route: string,
  params?: object
): Promise<T> => {
  const response = await appInstance.post<T>(route, params)
  return response.data
}

const patch = async <T>(
  route: string,
  params?: object
): Promise<ApiResponse<T>> => {
  const response = await appInstance.patch<ApiResponse<T>>(route, params)
  return response.data
}

const deleteResource = async <T>(
  route: string,
  params?: object
): Promise<ApiResponse<T>> => {
  const response = await appInstance.delete<ApiResponse<T>>(route, {
    data: params
  })
  return response.data
}

export { appInstance, get, put, post, postRaw, deleteResource, patch }
