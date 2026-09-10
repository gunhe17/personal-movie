import { get, patch, post } from '$lib/services/api/instances';

// HTTP-Only 쿠키 환경: 모든 요청은 /api/proxy를 통해 프록시됨
// instances.ts에서 baseURL이 '/api/proxy'로 설정됨

// 테넌트 상세 정보 가져오기
export const getClients = () => ({
	key: ['getClients'],
	request: async () => {
		const response = await get('/pre-design/persons?role=내담자');
		return response;
	}
});

// export const verifyCurrentPassword = () => ({
// 	key: ['verifyCurrentPassword'],
// 	request: async ({ password, accountId }: { password: string; accountId: string }) => {
// 		const response = await post<boolean>(`/accounts/${accountId}/password/verify`, {
// 			current_password: password
// 		});
// 		return response;
// 	}
// });

// export const updatePassword = () => ({
// 	key: ['updatePassword'],
// 	request: async ({ newPassword, accountId }: { newPassword: string; accountId: string }) => {
// 		const response = await patch(`/accounts/${accountId}/password`, {
// 			new_password: newPassword
// 		});
// 		return response;
// 	}
// });
