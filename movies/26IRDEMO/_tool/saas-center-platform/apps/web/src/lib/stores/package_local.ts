import { get, writable } from 'svelte/store';

// 패키지 타입 정의
export type PackageType = {
	id: string;
	name: string;
	assessments: string[]; // 검사 ID 목록
	createdAt: string;
};

// Mock API 응답 타입
export type MockApiRes<T = any> = {
	success: boolean;
	data?: T;
	error?: string;
};

// 패키지 목록 스토어 (초기값: 빈 배열)
export const packageListStore = writable<PackageType[]>([]);

// ID 생성 함수
const generateId = () => {
	return `package_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

// Mock API
export const packageMockApis = {
	// 전체 패키지 목록 가져오기
	getAllPackages: (): PackageType[] => {
		return get(packageListStore);
	},

	// 패키지 생성하기
	createPackage: (data: { name: string; assessments: string[] }): MockApiRes<PackageType> => {
		try {
			const newPackage: PackageType = {
				id: generateId(),
				name: data.name,
				assessments: data.assessments,
				createdAt: new Date().toISOString()
			};

			packageListStore.update((list) => [...list, newPackage]);

			return { success: true, data: newPackage };
		} catch (error) {
			return { success: false, error: '패키지 생성에 실패했습니다.' };
		}
	},

	// 패키지 삭제하기
	deletePackage: (packageId: string): MockApiRes => {
		try {
			packageListStore.update((list) => list.filter((pkg) => pkg.id !== packageId));
			return { success: true };
		} catch (error) {
			return { success: false, error: '패키지 삭제에 실패했습니다.' };
		}
	},

	// 패키지 수정하기
	updatePackage: (
		packageId: string,
		data: {
			name?: string;
			assessments?: string[];
		}
	): MockApiRes<PackageType> => {
		try {
			let updatedPackage: PackageType | null = null;

			packageListStore.update((list) =>
				list.map((pkg) => {
					if (pkg.id === packageId) {
						updatedPackage = {
							...pkg,
							...(data.name && { name: data.name }),
							...(data.assessments && { assessments: data.assessments })
						};
						return updatedPackage;
					}
					return pkg;
				})
			);

			if (!updatedPackage) {
				return { success: false, error: '패키지를 찾을 수 없습니다.' };
			}

			return { success: true, data: updatedPackage };
		} catch (error) {
			return { success: false, error: '패키지 수정에 실패했습니다.' };
		}
	},

	// 특정 패키지 가져오기
	getPackageById: (packageId: string): MockApiRes<PackageType> => {
		try {
			const packages = get(packageListStore);
			const pkg = packages.find((p) => p.id === packageId);

			if (!pkg) {
				return { success: false, error: '패키지를 찾을 수 없습니다.' };
			}

			return { success: true, data: pkg };
		} catch (error) {
			return { success: false, error: '패키지 조회에 실패했습니다.' };
		}
	}
};
