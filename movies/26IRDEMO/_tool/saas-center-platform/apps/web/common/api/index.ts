import axios from 'axios';
import type { ApiResponse } from '@common/types/apiResponse';
import setInterceptors from './interceptors';

const apiClient = axios.create({
	baseURL: '/api',
	timeout: 30000
});
setInterceptors(apiClient);

const get = async <T>(route: string, params?: string): Promise<ApiResponse<T>> => {
	const response = await apiClient.get<ApiResponse<T>>(route, { params });
	return response.data;
};

const put = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await apiClient.put<ApiResponse<T>>(route, params);
	return response.data;
};

const post = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await apiClient.post<ApiResponse<T>>(route, params);
	return response.data;
};

const patch = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await apiClient.patch<ApiResponse<T>>(route, params);
	return response.data;
};

const deleteResource = async <T>(route: string, params?: object): Promise<ApiResponse<T>> => {
	const response = await apiClient.delete<ApiResponse<T>>(route, {
		data: params
	});
	return response.data;
};

export { apiClient, get, put, post, deleteResource, patch };
