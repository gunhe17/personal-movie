// API Response types

export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
    timestamp?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: any;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedApiResponse<T = any> extends ApiResponse<T[]> {
    meta: PaginationMeta;
}