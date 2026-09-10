// 표준 API 응답 구조
export type ApiResponse<T> = {
	success: boolean;
	data: T;
	meta?: ApiMeta;
};

export type ApiMeta = {
	pagination?: PaginationType;
	code?: number;
	message?: string;
	[key: string]: any;
};

export type PaginationType = {
	page: number;
	page_size?: number;
	size?: number;
	total: number;
	filtered_total?: number;
	total_pages?: number;
};

// 페이징이 포함된 응답 타입
export type PaginatedResponse<T> = ApiResponse<T[]> & {
	meta: ApiMeta & {
		pagination: PaginationType;
	};
};

export type PaginationRes<T> = {
	data: T[];
	pagination: PaginationType;
};

export type RowPaginationRes<T> = {
	items: T[];
	total: number;
	page: number;
	size: number;
	pages: number;
};

export type ErrorResponse = {
	status_code: number;
	message: string;
	data: object;
};

export type Action<T, TResponse = ApiResponse<T>> = {
	key?: string[];
	request: (params?: any) => Promise<TResponse>;
};
