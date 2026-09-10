import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// FormData 받기
		const formData = await request.formData();

		console.log('Rorschach OCR 추출 요청 받음:', {
			files: formData.get('files'),
			test_name: formData.get('test_name')
		});

		try {
			// 실제 OCR API 서버로 요청 (환경변수에서 URL 가져오기)
			const OCR_API_URL = process.env.OCR_API_URL || 'http://192.168.1.6:8002';
			console.log('OCR_API_URL:', OCR_API_URL);
			const response = await fetch(`${OCR_API_URL}/api/extract`, {
				method: 'POST',
				body: formData, // FormData를 그대로 전송
				headers: {
					// FormData 사용 시 Content-Type 헤더는 자동으로 설정됨
				}
			});

			console.log('외부 OCR API 응답 상태:', response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.log('외부 OCR API 에러 응답:', errorText);
				throw new Error(`External OCR API 요청 실패: ${response.status} - ${errorText}`);
			}

			const result = await response.json();
			console.log('Rorschach OCR 추출 성공:', result);

			return json(result);
		} catch (fetchError) {
			console.log('외부 OCR API 연결 실패, 에러 반환:', fetchError);

			// 개발 중 임시 Mock 데이터 반환 (OCR 서버 연결 실패 시)
			console.log('OCR 서버 연결 실패, Mock 데이터 반환');
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
					}
				]
			};
			return json(mockResult);

			// 실제 서버 연결이 필요할 때는 아래 에러 반환을 사용
			/*
			return json(
				{
					error: 'OCR 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요.',
					details: fetchError instanceof Error ? fetchError.message : String(fetchError)
				},
				{ status: 503 }
			);
			*/
		}
	} catch (error) {
		console.error('Rorschach OCR API 프록시 오류:', error);
		return json(
			{
				error: 'OCR API 요청 처리 중 오류가 발생했습니다.',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
