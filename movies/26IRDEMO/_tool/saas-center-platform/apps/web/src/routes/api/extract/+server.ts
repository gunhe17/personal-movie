import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// DEPRECATED: 이 API는 더 이상 사용되지 않습니다.
// 대신 /api/assessment/rorschach/extract를 사용하세요.
export const POST: RequestHandler = async ({ request }) => {
	try {
		// FormData 받기
		const formData = await request.formData();

		console.log('OCR 추출 요청 받음:', {
			files: formData.get('files'),
			test_name: formData.get('test_name')
		});

		try {
			// 실제 OCR API 서버로 요청 (환경변수에서 URL 가져오기)
			const OCR_API_URL = process.env.OCR_API_URL || 'http://192.168.1.6:8002';
			const response = await fetch(`${OCR_API_URL}/api/extract`, {
				method: 'POST',
				body: formData, // FormData를 그대로 전송
				headers: {
					// FormData 사용 시 Content-Type 헤더는 자동으로 설정됨
				}
			});

			console.log('외부 API 응답 상태:', response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.log('외부 API 에러 응답:', errorText);
				throw new Error(`External API 요청 실패: ${response.status} - ${errorText}`);
			}

			const result = await response.json();
			console.log('OCR 추출 성공:', result);

			return json(result);
		} catch (fetchError) {
			console.log('외부 API 연결 실패, Mock 데이터 반환:', fetchError);

			// Mock OCR 추출 결과 반환
			const mockResult = {
				responses: [
					{
						card: 'I',
						response: '박쥐 같아 보입니다',
						location: 'W',
						inquiry: '전체적인 형태가 박쥐 같아 보여서요',
						dq: '',
						determinants: '',
						fq: '',
						pair: '',
						contents: '',
						contents2: '',
						contents3: '',
						p: '',
						zScore: '',
						zValue: '',
						gPhr: '',
						specialScores: '',
						specialScores2: '',
						specialScores3: '',
						color: '',
						shading: ''
					},
					{
						card: 'II',
						response: '나비',
						location: 'W',
						inquiry: '빨간색과 검정색이 나비 같아요',
						dq: '',
						determinants: '',
						fq: '',
						pair: '',
						contents: '',
						contents2: '',
						contents3: '',
						p: '',
						zScore: '',
						zValue: '',
						gPhr: '',
						specialScores: '',
						specialScores2: '',
						specialScores3: '',
						color: '',
						shading: ''
					}
				]
			};

			console.log('Mock OCR 결과 반환:', mockResult);
			return json(mockResult);
		}
	} catch (error) {
		console.error('OCR API 프록시 오류:', error);
		return json({ error: 'OCR API 요청 처리 중 오류가 발생했습니다.' }, { status: 500 });
	}
};