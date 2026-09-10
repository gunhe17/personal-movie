// Common types used across the application

export type AbsPlacement =
	| 'top'
	| 'bottom'
	| 'left'
	| 'right'
	| 'top-start'
	| 'top-end'
	| 'bottom-start'
	| 'bottom-end'
	| 'left-start'
	| 'left-end'
	| 'right-start'
	| 'right-end';

export interface BaseResponse<T = any> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
}

export interface PaginatedResponse<T = any> extends BaseResponse<T> {
	total?: number;
	page?: number;
	limit?: number;
}
