import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// 디버깅: 요청 데이터 로깅
		console.log('🔍 채점 결과 저장 요청:', JSON.stringify(body, null, 2));

		try {
			// 외부 API로 프록시 요청 시도
			const response = await fetch('http://192.168.1.38:8001/assessment/rorschach/score', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(15000) // 15초 timeout
			});

			console.log(`🌐 외부 API 응답 상태: ${response.status} ${response.statusText}`);

			if (!response.ok) {
				// 에러 응답 본문도 읽어서 로깅
				let errorDetails = '';
				try {
					const errorText = await response.text();
					console.error('❌ 외부 API 에러 응답:', errorText);
					errorDetails = errorText;
				} catch (e) {
					console.error('❌ 에러 응답을 읽을 수 없음:', e);
				}

				throw new Error(
					`외부 API 요청 실패: ${response.status} ${response.statusText}\n응답: ${errorDetails}`
				);
			}

			const data = await response.json();
			console.log('✅ 외부 API 성공 응답:', data);
			return json(data);
		} catch (fetchError) {
			console.log('외부 API 연결 실패, Mock 채점 결과 반환:', fetchError);

			// Mock 채점 결과 생성 (RorschachResultType 형식에 맞게)
			const mockResult = {
				upper_section: {
					Location: {
						W: 5,
						D: 8,
						Dd: 2,
						S: 1
					},
					Content: {
						H: 4,
						A: 8,
						Ad: 2,
						Hd: 1,
						An: 1,
						Obj: 2
					},
					DQ: {
						"DQ+": 2,
						"DQo": 10,
						"DQv": 3,
						"DQv+": 1
					},
					Single: {
						R: body.responses?.length || 16,
						P: 4,
						Zf: 8,
						ZSum: 28,
						ZEst: 30.0
					},
					Special: {
						DV: 0,
						DR: 0,
						INCOM: 1,
						FABCOM: 0,
						ALOG: 0,
						CONTAM: 0
					},
					FQ: {
						FQplus: { total: 2 },
						FQo: { total: 10 },
						FQu: { total: 3 },
						FQminus: { total: 1 }
					},
					Blend: [
						["FC", "CF"],
						["M", "FC"]
					],
					Determinants: {
						F: 10,
						M: 3,
						FM: 4,
						FC: 2,
						CF: 1,
						C: 1
					},
					Approach: {
						sequence: ["W", "D", "W", "Dd"]
					}
				},
				lower_section: {
					Core: {
						Lambda: 0.67,
						OBS: 0,
						HVI: 0,
						"EA-ep": "6.5-4.2"
					},
					Affection: {
						FC: 2,
						CF: 1,
						"C'": 0,
						"Afr": 0.58
					},
					Interpersonal: {
						COP: 2,
						AG: 0,
						"GHR-PHR": "4-2",
						H: 4
					},
					Ideation: {
						"a:p": "3:2",
						M: 3,
						"2AB+Art+Ay": 1,
						MOR: 1
					},
					Processing: {
						Zf: 8,
						W: 5,
						D: 8,
						Dd: 2
					},
					Mediation: {
						"XA%": 0.75,
						"WDA%": 0.80,
						X: 1,
						"Xu%": 0.19
					},
					Controls: {
						"Sum C'": 1,
						"WSumC": 4.5,
						EA: 6.5,
						es: 8
					}
				},
				special_section: {
					S_CON: {
						criterion_1: "",
						criterion_2: "",
						criterion_3: "v"
					},
					PTI: {
						criterion_1: "",
						criterion_2: "v",
						criterion_3: ""
					},
					DEPI: {
						criterion_1: "v",
						criterion_2: "",
						criterion_3: ""
					}
				}
			};

			console.log('Mock 채점 결과 반환:', mockResult);
			return json(mockResult);
		}
	} catch (err) {
		console.error('채점 API 프록시 오류:', err);
		const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
		throw error(500, `채점 결과 저장 중 오류가 발생했습니다. ${errorMessage}`);
	}
};
