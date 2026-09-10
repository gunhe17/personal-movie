import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		console.log('프록시로 전송되는 데이터:', JSON.stringify(data, null, 2));

		// 외부 API로 프록시 요청
		const response = await fetch('http://192.168.1.98:8010/assessment/rorschach/query', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		console.log('외부 API 응답 상태:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.log('외부 API 에러 응답:', errorText);
			throw new Error(`External API 요청 실패: ${response.status} - ${errorText}`);
		}

		const result = await response.json();

		return json(result);
	} catch (error) {
		console.error('API 프록시 오류:', error);
		return json({ error: 'API 요청 처리 중 오류가 발생했습니다.' }, { status: 500 });
	}
};
