import { get, writable } from 'svelte/store';

// 검사 카드 타입 정의
export type AssessmentStyleMap = {
	symbol_color: string;
	backgroundImage: string;
};

// Mock API 응답 타입
export type MockApiRes<T = any> = {
	success: boolean;
	pagination?: {
		page: number;
		limit: number;
		total_count: number;
		total_pages: number;
	};
	data?: T;
};

// 패키지 타입 정의
export type PackageType = {
	id: string;
	name: string;
	assessmentIds: string[]; // 패키지에 포함된 검사 ID 목록
};

// 검사 배경 이미지 import
import Assessment_BGT from '$lib/assets/assessmentCardBgImg/Assessment_BGT.png';
import Assessment_Bayley from '$lib/assets/assessmentCardBgImg/Assessment_Bayley.png';
import Assessment_CBCL_1_5 from '$lib/assets/assessmentCardBgImg/Assessment_CBCL 1.5-5.png';
import Assessment_CBCL_6_18 from '$lib/assets/assessmentCardBgImg/Assessment_CBCL 6- 18.png';
import Assessment_HTP from '$lib/assets/assessmentCardBgImg/Assessment_HTP.png';
import Assessment_JTCI_12_18 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 12-18.png';
import Assessment_JTCI_3_6 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 3-6.png';
import Assessment_JTCI_7_11 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 7-11.png';
import Assessment_K_WISC_V from '$lib/assets/assessmentCardBgImg/Assessment_K-WISC-V.png';
import Assessment_K_WPPSI_IV from '$lib/assets/assessmentCardBgImg/Assessment_K-WPPSI-IV.png';
import Assessment_KFD from '$lib/assets/assessmentCardBgImg/Assessment_KFD.png';
import Assessment_MMPI_2 from '$lib/assets/assessmentCardBgImg/Assessment_MMPI-2.png';
import Assessment_MMPI_A_Youth from '$lib/assets/assessmentCardBgImg/Assessment_MMPI-A-Youth.png';
import Assessment_PAT_1 from '$lib/assets/assessmentCardBgImg/Assessment_PAT-1.png';
import Assessment_PAT_2 from '$lib/assets/assessmentCardBgImg/Assessment_PAT-2.png';
import Assessment_RAVEN_CPM from '$lib/assets/assessmentCardBgImg/Assessment_RAVEN_CPM.png';
import Assessment_RAVEN_SPM from '$lib/assets/assessmentCardBgImg/Assessment_RAVEN_SPM.png';
import Assessment_Rorschach from '$lib/assets/assessmentCardBgImg/Assessment_Rorschach.png';
import Assessment_SCT from '$lib/assets/assessmentCardBgImg/Assessment_SCT.png';
import Assessment_TCI from '$lib/assets/assessmentCardBgImg/Assessment_TCI.png';

// 초기 검사 목록 Mock 데이터
export const styleMap: Record<any, AssessmentStyleMap> = {
	BGT: {
		symbol_color: '#95A5A6',
		backgroundImage: Assessment_BGT
	},
	Bayley: {
		symbol_color: '#012396',
		backgroundImage: Assessment_Bayley
	},
	CBCL15: {
		symbol_color: '#A12813',
		backgroundImage: Assessment_CBCL_1_5
	},
	CBCL618: {
		symbol_color: '#A12813',
		backgroundImage: Assessment_CBCL_6_18
	},
	HTP: {
		symbol_color: '#012396',
		backgroundImage: Assessment_HTP
	},
	JTCI1218: {
		symbol_color: '#1395A1',
		backgroundImage: Assessment_JTCI_12_18
	},
	JTCI36: {
		symbol_color: '#1395A1',
		backgroundImage: Assessment_JTCI_3_6
	},
	JTCI711: {
		symbol_color: '#1395A1',
		backgroundImage: Assessment_JTCI_7_11
	},
	KWISC5: {
		symbol_color: '#1395A1',
		backgroundImage: Assessment_K_WISC_V
	},
	KWPPSI4: {
		symbol_color: '#49AAEF',
		backgroundImage: Assessment_K_WPPSI_IV
	},
	KFD: {
		symbol_color: '#A78BFA',
		backgroundImage: Assessment_KFD
	},
	MMPI2: {
		symbol_color: '#C70A89',
		backgroundImage: Assessment_MMPI_2
	},
	MMPIAYouth: {
		symbol_color: '#C70A89',
		backgroundImage: Assessment_MMPI_A_Youth
	},
	PAT1: {
		symbol_color: '#D23E46',
		backgroundImage: Assessment_PAT_1
	},
	PAT2: {
		symbol_color: '#D23E46',
		backgroundImage: Assessment_PAT_2
	},
	RAVENCPM: {
		symbol_color: '#FDCA01',
		backgroundImage: Assessment_RAVEN_CPM
	},
	RAVENSPM: {
		symbol_color: '#FDCA01',
		backgroundImage: Assessment_RAVEN_SPM
	},
	Rorschach: {
		symbol_color: '#3B82F6',
		backgroundImage: Assessment_Rorschach
	},
	SCT: {
		symbol_color: '#69168C',
		backgroundImage: Assessment_SCT
	},
	TCI: {
		symbol_color: '#EF4967',
		backgroundImage: Assessment_TCI
	}
};

// 패키지 Mock 데이터
const initialPackagesMock: PackageType[] = [
	{
		id: 'package_1',
		name: '3~6세 풀배터리',
		assessmentIds: ['JTCI_3_6', 'K_WPPSI_IV', 'HTP', 'KFD']
	},
	{
		id: 'package_2',
		name: '초등학생 풀배터리',
		assessmentIds: ['JTCI_7_11', 'K_WISC_V', 'HTP', 'SCT']
	},
	{
		id: 'package_3',
		name: '청소년 풀배터리',
		assessmentIds: ['JTCI_12_18', 'K_WISC_V', 'MMPI_A', 'SCT']
	}
];

// 패키지 목록 스토어
export const packageListStore = writable<PackageType[]>(initialPackagesMock);

// Mock API
export const assessmentManageMockApis = {
	// 전체 검사 목록 가져오기 (모달용 - enabled 필터링 없음)
	getAllAssessments: () => {
		return [];
	},

	// 검사 목록 가져오기 (검사 관리 페이지용 - enabled 기준 필터링)
	getAssessmentList: async (queryParams: {
		page: number;
		size: number;
		searchQuery: string;
		enabledFilter: 'all' | 'enabled' | 'disabled';
		onlineFilter?: 'all' | 'online' | 'offline';
	}) => {
		try {
			// HTTP-Only 쿠키 환경: /api/proxy를 통해 프록시
			const response = await fetch(`/api/proxy/centers/center_001/view/assessments`);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const res = await response.json();

			if (res.data.length) {
				return {
					data: res.data.map((assessment: any) => {
						return {
							...assessment,
							symbol_color: styleMap[assessment.code]?.symbol_color,
							backgroundImage: styleMap[assessment.code]?.backgroundImage
						};
					}),
					pagination: res.pagination
				};
			}
			return res;
		} catch (error) {
			console.error('Figma API Error:', error);
			throw error;
		}
	}

	// // 검사 활성화 상태 업데이트 (실제 API 연동 시 이 부분만 수정하면 됨)
	// updateAssessmentEnabled: (assessmentId: string, enabled: boolean): MockApiRes => {
	// 	try {
	// 		assessmentListStore.update((list) =>
	// 			list.map((assessment) =>
	// 				assessment.id === assessmentId ? { ...assessment, enabled } : assessment
	// 			)
	// 		);
	// 		return { success: true };
	// 	} catch {
	// 		return { success: false };
	// 	}
	// },

	// // 전체 검사 활성화 상태 일괄 업데이트
	// updateAllAssessmentsEnabled: (enabled: boolean): MockApiRes => {
	// 	try {
	// 		assessmentListStore.update((list) => list.map((assessment) => ({ ...assessment, enabled })));
	// 		return { success: true };
	// 	} catch {
	// 		return { success: false };
	// 	}
	// },

	// // 여러 검사의 활성화 상태 업데이트 (변경하기 버튼용)
	// batchUpdateAssessmentsEnabled: (updates: { id: string; enabled: boolean }[]): MockApiRes => {
	// 	try {
	// 		console.log('[Store] batchUpdateAssessmentsEnabled 호출:', updates.length, '개 업데이트');
	// 		assessmentListStore.update((list) => {
	// 			const newList = list.map((assessment) => {
	// 				const update = updates.find((u) => u.id === assessment.id);
	// 				return update ? { ...assessment, enabled: update.enabled } : assessment;
	// 			});
	// 			console.log('[Store] 스토어 업데이트 완료');
	// 			return newList;
	// 		});
	// 		return { success: true };
	// 	} catch (error) {
	// 		console.error('[Store] 업데이트 실패:', error);
	// 		return { success: false };
	// 	}
	// },

	// // 패키지 목록 가져오기
	// getPackages: (): MockApiRes<PackageType[]> => {
	// 	try {
	// 		const packages = get(packageListStore);
	// 		return { success: true, data: packages };
	// 	} catch {
	// 		return { success: false };
	// 	}
	// },

	// // 패키지 ID로 검사 목록 가져오기
	// getAssessmentsByPackageId: (packageId: string): MockApiRes<AssessmentCardType[]> => {
	// 	try {
	// 		const packages = get(packageListStore);
	// 		const selectedPackage = packages.find((pkg) => pkg.id === packageId);
	// 		if (!selectedPackage) return { success: false };

	// 		const allAssessments = get(assessmentListStore);
	// 		const packageAssessments = allAssessments.filter((assessment) =>
	// 			selectedPackage.assessmentIds.includes(assessment.id)
	// 		);

	// 		return { success: true, data: packageAssessments };
	// 	} catch {
	// 		return { success: false };
	// 	}
	// }
};
