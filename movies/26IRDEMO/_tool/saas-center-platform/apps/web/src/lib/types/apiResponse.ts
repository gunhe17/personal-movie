// ── 정본: 페이지네이션 응답 ──────────────────────────────────────────
// 백엔드 전 list 엔드포인트가 이 형태로 통일됨: items + 5필드(비옵셔널).
// 비페이지(전체반환)도 degenerate(page=1,size=len,pages=1)로 이 형태를 따른다.
export type Page<T> = {
	items: T[];
	total: number;
	page: number;
	size: number;
	pages: number;
};
// 집계 동반 엔드포인트는 교차타입으로:
//   type AdminClientList = Page<ClientItem> & { stats: ClientStats }
//   type BillableTargets = Page<TargetItem> & { total_counts: TargetCounts }
//   type CounselingMyList = Page<CounselingItem> & { summary: CounselingSummary }

/** @deprecated mock 레이어 형태({data,pagination}). 실제 API는 Page<T>. */
export type ServerPaginatedResponse<T> = {
	data: T[];
	pagination: PaginationType;
};

// 표준 API 응답 구조 (success, data, meta 포함)
export type ApiResponse<T> = {
	success: boolean;
	data: T;
	meta?: ApiMeta;
};

// meta에 포함될 수 있는 정보들
export type ApiMeta = {
	pagination?: PaginationType;
	code?: number;
	message?: string;
	[key: string]: any; // 추가 메타 정보
};

/** @deprecated mock 레이어 페이지네이션 메타. 실제 API는 Page<T>의 평탄 5필드. */
export type PaginationType = {
	page: number;
	page_size?: number;
	size?: number;
	total: number;
	filtered_total?: number; // 필터 적용 후 전체 개수
	total_pages?: number;
};

/** @deprecated mock 레이어 형태({data,meta.pagination}). 실제 API는 Page<T>. */
export type PaginatedResponse<T> = ApiResponse<T[]> & {
	meta: ApiMeta & {
		pagination: PaginationType;
	};
};

// 레거시 타입 (호환성 유지)
export type MetaRes = {
	code: number;
	message: string;
};

/** @deprecated mock 레이어 형태({data,pagination}). 실제 API는 Page<T>. */
export type PaginationRes<T> = {
	data: T[];
	pagination: PaginationType;
};

// 정본 Page<T>의 별칭(기존 사용처 호환). 신규는 Page<T> 사용.
export type RowPaginationRes<T> = Page<T>;

export type ErrorResponse = {
	status_code: number;
	message: string;
	data: object;
};

export type Action<T, TResponse = ApiResponse<T>> = {
	key?: string[];
	request: (params?: any) => Promise<TResponse>;
};
