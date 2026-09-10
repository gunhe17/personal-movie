import { get, writable } from 'svelte/store';
import type { AssessmentCardType } from '$lib/types/assessment';

import Assessment_BGT from '$lib/assets/assessmentCardBgImg/Assessment_BGT.png';
import Assessment_HTP from '$lib/assets/assessmentCardBgImg/Assessment_HTP.png';
import Assessment_Bayley from '$lib/assets/assessmentCardBgImg/Assessment_Bayley.png';
import Assessment_CBCL_6_18 from '$lib/assets/assessmentCardBgImg/Assessment_CBCL 6- 18.png';
import Assessment_JTCI_12_18 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 12-18.png';

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

export type AssessmentPackageType = {
	package_id: string;
	package_name: string;
	assessments: AssessmentCardType[];
};

export type SessionAssessmentList = {
	session_id: string;
	session_assessment_id: string;
	package: AssessmentPackageType | null;
	assessments: AssessmentCardType[];
};

export type SessionDetailResponseType = {
	session_id: string;
	session_assessments: SessionAssessmentList;
	child: ChildType;
	expert: ExpertType;
	assessment_code: string;
	session_memo?: string;
	applied_business?: string;
	finish_at: Date | null;
	documents: SessionDocumentType[] | null;
	session_status: SessionStatusType;
	applied_at: Date;
};

export type SessionDocumentType = {
	document_id: string;
	is_sended: boolean;
	document_name: string;
	document_url: string;
};

export type ChildType = {
	child_id: string;
	child_name: string;
	child_gender: 'male' | 'female';
	child_img_url: string | null;
	child_birth: Date;
	child_memo?: string;
	child_guardian: GuardianType;
};

export type GuardianType = {
	guardian_id: string;
	guardian_name: string;
	guardian_phone: string;
	guardian_relation: string;
};

export type ExpertType = {
	expert_id: string;
	expert_name: string;
	expert_role: string;
	expert_phone?: string;
	expert_email?: string;
};

export type SessionStatusType =
	| 'beforeSend'
	| 'inProgress'
	| 'reviewed'
	| 'not_reviewed'
	| 'gradingRequired'
	| 'gradingFinished'
	| 'reportFinished'
	| 'reportRejected';

export type SessionCardResponseType = {
	session_id: string;
	child: ChildType;
	assessment_code: string;
	counselor: string;
	expert: ExpertType;
	assessments_total_count: number;
	package_name: string | null;
	session_status: SessionStatusType;
	applied_at: Date;
	assessments: AssessmentCardType[];
};

export type AssessmentSendHistoryType = {
	session_id: string;
	history_id: string;
	send_date: Date;
	receiver: {
		receiver_name: string;
		receiver_phone: string;
		receiver_relation: string;
	};
	link: string;
};

export type SessionDomainType = {
	session_id: string;
	child_id: string;
	session_assessment_id: string;
	assessment_code: string;
	session_memo?: string;
	applied_business?: string;
	session_status: SessionStatusType;
	session_document_ids: string[] | null;
	applied_at: Date;
	finish_at: Date | null;
	expert_id: string;
};

const initailExpertMock: ExpertType[] = [
	{
		expert_id: '123',
		expert_name: '김아연',
		expert_role: '임상심리사'
	},
	{
		expert_id: '234',
		expert_name: '김퍽춘',
		expert_role: '의사'
	},
	{
		expert_id: '345',
		expert_name: '이삥뿡',
		expert_role: '자영업자'
	}
];

const initialChildMock: ChildType[] = [
	{
		child_id: '123',
		child_name: '길인서',
		child_gender: 'female',
		child_img_url: null,
		child_memo: '이 내담자는 평소에 공격성이 있어보인대요',
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '456',
		child_name: '길서',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '789',
		child_name: '길인',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '101112',
		child_name: '인서',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '131415',
		child_name: '길인사',
		child_gender: 'female',
		child_img_url: null,
		child_memo: '이 내담자는 평소에 공격성이 있어보인대요',
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '161718',
		child_name: '길안서',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '192021',
		child_name: '길안사',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '222324',
		child_name: '길길길',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '252627',
		child_name: '인인인',
		child_gender: 'male',
		child_img_url: null,
		child_memo: '이 내담자는 평소에 공격성이 있어보인대요',
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '282930',
		child_name: '서서서',
		child_gender: 'male',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '313233',
		child_name: '길인인',
		child_gender: 'male',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '343536',
		child_name: '길서서',
		child_gender: 'male',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '373839',
		child_name: '길길인',
		child_gender: 'male',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '404142',
		child_name: '길길서',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2018-01-16'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이영자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	},
	{
		child_id: '536763',
		child_name: '삥빵뿡',
		child_gender: 'female',
		child_img_url: null,
		child_birth: new Date('2012-03-22'),
		child_guardian: {
			guardian_id: '123',
			guardian_name: '이길자',
			guardian_phone: '123-0000-0000',
			guardian_relation: '엄마'
		}
	}
];

export type Grant = {
	id: string;
	name: string;
	organization: string;
	startDate: string;
	endDate: string;
	status: 'active' | 'inactive' | 'pending';
};

const initialSessionAssessmentListMock: SessionAssessmentList[] = [
	{
		session_id: '123',
		session_assessment_id: '123',
		package: {
			package_id: '123',
			package_name: '3~6세 풀배터리',
			assessments: [
				{
					assessment_id: 'BGT',
					name_kr: '벤더게슈탈트검사',
					name_en: 'BGT',
					symbol_color: '#95A5A6',
					is_online_available: false,
					status: 'gradingRequired',
					background: Assessment_BGT
				},
				{
					assessment_id: 'Bayley',
					name_kr: '베일리 영유아 발달 검사',
					name_en: 'Bayley',
					symbol_color: '#012396',
					is_online_available: true,
					status: 'gradingRequired',
					background: Assessment_Bayley
				},
				{
					assessment_id: 'CBCL_6_18',
					name_kr: '아동행동평가척도 6-18세',
					name_en: 'CBCL 6-18',
					symbol_color: '#E74C3C',
					is_online_available: true,
					status: 'gradingRequired',
					background: Assessment_CBCL_6_18
				}
			]
		},
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			},
			{
				assessment_id: 'JTCI_12_18',
				name_kr: '청소년 기질 및 성격검사',
				name_en: 'JTCI 12-18',
				symbol_color: '#3498DB',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_JTCI_12_18
			}
		]
	},
	{
		session_id: '456',
		session_assessment_id: '456',
		package: {
			package_id: '456',
			package_name: '30~60세 풀배터리',
			assessments: [
				{
					assessment_id: 'HTP',
					name_kr: '집-나무-사람 검사',
					name_en: 'HTP',
					symbol_color: '#012396',
					is_online_available: true,
					status: 'gradingRequired',
					background: Assessment_HTP
				},
				{
					assessment_id: 'JTCI_12_18',
					name_kr: '청소년 기질 및 성격검사',
					name_en: 'JTCI 12-18',
					symbol_color: '#3498DB',
					is_online_available: true,
					status: 'gradingRequired',
					background: Assessment_JTCI_12_18
				}
			]
		},
		assessments: [
			{
				assessment_id: 'BGT',
				name_kr: '벤더게슈탈트검사',
				name_en: 'BGT',
				symbol_color: '#95A5A6',
				is_online_available: false,
				status: 'gradingRequired',
				background: Assessment_BGT
			},
			{
				assessment_id: 'Bayley',
				name_kr: '베일리 영유아 발달 검사',
				name_en: 'Bayley',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_Bayley
			}
		]
	},
	{
		session_id: '789',
		session_assessment_id: '789',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '101112',
		session_assessment_id: '101112',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '131415',
		session_assessment_id: '131415',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '161718',
		session_assessment_id: '161718',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '192021',
		session_assessment_id: '192021',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '222324',
		session_assessment_id: '222324',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '252627',
		session_assessment_id: '252627',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '282930',
		session_assessment_id: '282930',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '313233',
		session_assessment_id: '313233',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '343536',
		session_assessment_id: '343536',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '373839',
		session_assessment_id: '373839',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	},
	{
		session_id: '404142',
		session_assessment_id: '404142',
		package: null,
		assessments: [
			{
				assessment_id: 'HTP',
				name_kr: '집-나무-사람 검사',
				name_en: 'HTP',
				symbol_color: '#012396',
				is_online_available: true,
				status: 'gradingRequired',
				background: Assessment_HTP
			}
		]
	}
];

const initialSessionDocument: SessionDocumentType[] = [
	{
		document_id: '123',
		document_url: '123213123',
		document_name: '초기상담 기록지',
		is_sended: false
	}
];

const initialSessionListMock: SessionDomainType[] = [
	{
		session_id: '123',
		child_id: '123',
		session_assessment_id: '123',
		session_document_ids: ['123'],
		assessment_code: '0123AB',
		session_status: 'beforeSend',
		applied_at: new Date('2025-01-12'),
		applied_business: '무슨사업',
		finish_at: null,
		session_memo: '이 내담자는 평소에 공격성이 있어보인대요',
		expert_id: '123'
	},
	{
		session_id: '456',
		child_id: '456',
		session_assessment_id: '456',
		session_document_ids: ['123'],
		assessment_code: '1123AB',
		session_status: 'inProgress',
		applied_at: new Date('2025-02-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '789',
		child_id: '789',
		session_assessment_id: '789',
		session_document_ids: ['123'],
		assessment_code: '2123AB',
		session_status: 'beforeSend',
		applied_at: new Date('2025-03-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '101112',
		child_id: '101112',
		session_assessment_id: '101112',
		session_document_ids: ['123'],
		assessment_code: '3123AB',
		session_status: 'reportFinished',
		applied_at: new Date('2025-04-12'),
		finish_at: null,
		session_memo: '이 내담자는 평소에 공격성이 있어보인대요',
		expert_id: '123'
	},
	{
		session_id: '131415',
		child_id: '131415',
		session_assessment_id: '131415',
		session_document_ids: ['123'],
		assessment_code: '4123AB',
		session_status: 'reportFinished',
		applied_at: new Date('2025-05-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '161718',
		child_id: '161718',
		session_assessment_id: '161718',
		session_document_ids: ['123'],
		assessment_code: '5123AB',
		session_status: 'gradingFinished',
		applied_at: new Date('2025-06-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '192021',
		child_id: '192021',
		session_assessment_id: '192021',
		session_document_ids: ['123'],
		assessment_code: '6123AB',
		session_status: 'gradingRequired',
		applied_at: new Date('2025-07-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '222324',
		child_id: '222324',
		session_assessment_id: '222324',
		session_document_ids: ['123'],
		assessment_code: '0003AB',
		session_status: 'reportRejected',
		applied_at: new Date('2025-08-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '252627',
		child_id: '252627',
		session_assessment_id: '252627',
		session_document_ids: ['123'],
		assessment_code: '0000AB',
		session_status: 'beforeSend',
		applied_at: new Date('2025-09-12'),
		finish_at: null,
		applied_business: '무슨사업',
		expert_id: '123'
	},
	{
		session_id: '282930',
		child_id: '282930',
		session_assessment_id: '282930',
		session_document_ids: ['123'],
		assessment_code: '0001AB',
		session_status: 'gradingRequired',
		applied_at: new Date('2025-10-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '313233',
		child_id: '313233',
		session_assessment_id: '313233',
		session_document_ids: ['123'],
		assessment_code: '0002AB',
		session_status: 'gradingFinished',
		applied_at: new Date('2025-11-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '343536',
		child_id: '343536',
		session_assessment_id: '343536',
		session_document_ids: ['123'],
		assessment_code: '0004AB',
		session_status: 'gradingRequired',
		applied_at: new Date('2025-12-12'),
		finish_at: null,
		expert_id: '123'
	},
	{
		session_id: '373839',
		child_id: '373839',
		session_assessment_id: '373839',
		session_document_ids: ['123'],
		assessment_code: '0005AB',
		session_status: 'beforeSend',
		applied_at: new Date('2025-08-05'),
		finish_at: null,
		session_memo: '이 내담자는 평소에 공격성이 있어보인대요',
		expert_id: '123'
	},
	{
		session_id: '404142',
		child_id: '404142',
		session_assessment_id: '404142',
		session_document_ids: ['123'],
		assessment_code: '0006AB',
		applied_business: '무슨사업',
		session_status: 'beforeSend',
		applied_at: new Date('2025-08-03'),
		finish_at: null,
		expert_id: '123'
	}
];

const initialSendHistoryMock: AssessmentSendHistoryType[] = [
	{
		session_id: '456',
		history_id: '456',
		send_date: new Date(),
		receiver: {
			receiver_name: '이영자',
			receiver_phone: '123-0000-0000',
			receiver_relation: '엄마'
		},
		link: '/imomTestLink'
	}
];

const initialGrantsMock: Grant[] = [
	{
		id: '1',
		name: '2024 상반기 청소년 심리지원사업',
		organization: '서울시교육청',
		startDate: '2024.01.01',
		endDate: '2024.06.30',
		status: 'inactive'
	},
	{
		id: '2',
		name: '2024 하반기 청소년 심리지원사업',
		organization: '서울시교육청',
		startDate: '2024.07.01',
		endDate: '2024.12.31',
		status: 'active'
	},
	{
		id: '3',
		name: '취약계층 아동 심리검사 지원',
		organization: '보건복지부',
		startDate: '2024.03.01',
		endDate: '2025.02.28',
		status: 'active'
	},
	{
		id: '4',
		name: '학교폭력 피해학생 심리치료 지원',
		organization: '교육부',
		startDate: '2024.09.01',
		endDate: '2025.08.31',
		status: 'active'
	},
	{
		id: '5',
		name: '2025 상반기 청소년 심리지원사업',
		organization: '서울시교육청',
		startDate: '2025.01.01',
		endDate: '2025.06.30',
		status: 'pending'
	}
];

const chunkAndSort = (
	arr: any[],
	size: number = 10,
	sortCondition: 'asc' | 'desc' = 'asc',
	sortKey: string = 'created_at'
) => {
	const sorted = [...arr].sort((a, b) =>
		sortCondition === 'asc'
			? new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime()
			: new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime()
	);
	return Array.from({ length: Math.ceil(sorted.length / size) }, (_, i) =>
		sorted.slice(i * size, i * size + size)
	);
};

export const clientListStroe = writable<ChildType[]>(initialChildMock);
export const expertListStroe = writable<ExpertType[]>(initailExpertMock);
export const sessionListStore = writable<SessionDomainType[]>(initialSessionListMock);
export const assessmentSendHistoryStore =
	writable<AssessmentSendHistoryType[]>(initialSendHistoryMock);
export const sessionAssessmentListStore = writable<SessionAssessmentList[]>(
	initialSessionAssessmentListMock
);
export const grantsStore = writable<Grant[]>(initialGrantsMock);

export const sessionListMockApis = {
	getSessionLists: (queryParams: {
		page: number;
		size: number;
		search: string;
		sort: 'asc' | 'desc';
		status?: SessionStatusType | 'all';
	}): MockApiRes<SessionCardResponseType[]> => {
		try {
			const sessionDomains = get(sessionListStore);
			let sessionList = sessionDomains.map((d) => {
				const child = initialChildMock.find((c) => c.child_id === d.child_id);
				if (!child) return;
				const expert = initailExpertMock.find((e) => e.expert_id === d.expert_id);
				if (!expert) return;
				const assessments = initialSessionAssessmentListMock.find(
					(a) => a.session_assessment_id === d.session_assessment_id
				);
				const assessmentTotal =
					(assessments?.assessments.length || 0) + (assessments?.package?.assessments.length || 0);
				return {
					child,
					expert,
					counselor: expert.expert_name,
					session_id: d.session_id,
					assessment_code: d.assessment_code,
					assessments_total_count: assessmentTotal,
					package_name: assessments?.package?.package_name || null,
					session_status: d.session_status,
					applied_at: d.applied_at,
					assessments: assessments?.assessments || []
				};
			});
			sessionList = sessionList.filter(
				(s) =>
					(s && s.assessment_code.includes(queryParams.search)) ||
					(s && s.child.child_name.includes(queryParams.search))
			);
			if (queryParams.status !== 'all') {
				sessionList = sessionList.filter((s) => s && s.session_status === queryParams.status);
			}
			if (!sessionList || !sessionList.length) return { success: false };
			let sortedList = chunkAndSort(sessionList, queryParams.size, queryParams.sort, 'applied_at');
			if (!sortedList) return { success: false };
			const pagination = {
				page: queryParams.page,
				limit: queryParams.size,
				total_count: sessionList.length,
				total_pages: sortedList.length
			};

			const data = sortedList[queryParams.page - 1];
			return { success: true, pagination, data: data };
		} catch {
			return { success: false };
		}
	},
	getSessionAssessmentList: (sessionId: string): MockApiRes<SessionAssessmentList> => {
		try {
			let sessionAssessmentList = get(sessionAssessmentListStore).find(
				(a) => a.session_id === sessionId
			);
			if (!sessionAssessmentList) return { success: false };
			return { success: true, data: sessionAssessmentList };
		} catch {
			return { success: false };
		}
	},
	getSessionDetail: (sessionId: string) => {
		try {
			const sessionDomain = get(sessionListStore).find((s) => s.session_id === sessionId);
			if (!sessionDomain) return { success: false };
			const child = initialChildMock.find((c) => c.child_id === sessionDomain.child_id);
			const expert = initailExpertMock.find((e) => e.expert_id === sessionDomain.expert_id);
			const assessments = get(sessionAssessmentListStore).find(
				(a) => a.session_assessment_id === sessionDomain.session_assessment_id
			);
			if (!child || !expert || !assessments) return { success: false };
			const documents = sessionDomain.session_document_ids
				? sessionDomain.session_document_ids
						.map((i) => initialSessionDocument.find((d) => d.document_id === i))
						.filter((d): d is SessionDocumentType => d !== undefined)
				: null;
			let sessionDetail = {
				child,
				expert,
				documents: documents || null,
				session_assessments: assessments || [],
				session_id: sessionDomain.session_id,
				applied_at: sessionDomain.applied_at,
				assessment_code: sessionDomain.assessment_code,
				session_status: sessionDomain.session_status,
				applied_business: sessionDomain.applied_business,
				session_memo: sessionDomain.session_memo,
				finish_at: sessionDomain.finish_at
			};
			if (!sessionDetail) return { success: false };
			return { success: true, data: sessionDetail };
		} catch {
			return { success: false };
		}
	},
	getGrants: (): MockApiRes<Grant[]> => {
		try {
			let grants = get(grantsStore);
			return { success: true, data: grants };
		} catch {
			return { success: false };
		}
	},
	postAppendChild: (req: Omit<ChildType, 'child_id'>): MockApiRes<ChildType> => {
		try {
			if (!req) return { success: false };
			const newClient = {
				...req,
				child_id: new Date().getTime().toString()
			};
			clientListStroe.update((client) => {
				return [...client, newClient];
			});
			return { success: true, data: newClient };
		} catch {
			return { success: false };
		}
	},
	createNewSession: (req: any): MockApiRes<SessionDomainType> => {
		const { assessments, package_d, ...rest } = req;
		const sessionId = new Date().getTime().toString();
		const sessionAssessId = (new Date().getTime() + 1).toString();
		const assessmentReq = {
			session_id: sessionId,
			session_assessment_id: sessionAssessId,
			package: package_d,
			assessments: assessments
		};
		sessionAssessmentListStore.update((a) => {
			return [...a, assessmentReq];
		});
		const newSession = {
			...rest,
			session_id: sessionId,
			session_assessment_id: sessionAssessId,
			assessment_code: '123AAA',
			session_status: 'inProgress',
			finish_at: null
		};
		sessionListStore.update((sess) => {
			return [...sess, newSession];
		});
		return { success: true, data: newSession };
	},
	handleSendAssessment: (req: any): MockApiRes => {
		sessionListStore.update((sessions) => {
			if (!sessions.length) return [...sessions];
			const updatedSessions = sessions.map((s) =>
				s.session_id === req.sessionId
					? {
							...s,
							session_status: 'inProgress' as SessionStatusType,
							finish_at: req.expiryDate ? req.expiryDate : null
						}
					: s
			);
			return [...updatedSessions];
		});
		assessmentSendHistoryStore.update((sh) => {
			const newHistory = req.validRecipient.map((r: any) => {
				return {
					session_id: req.sessionId,
					history_id: new Date().getTime().toString(),
					send_date: new Date(),
					receiver: {
						receiver_name: r.name,
						receiver_phone: r.phone_number,
						receiver_relation: r.role
					},
					link: '/imomTestLink'
				};
			});
			return [...sh, ...newHistory];
		});
		return { success: true };
	},
	getAssessmentSendHistoryList: (sessionId: string) => {
		let assessmentSendHistoryList = get(assessmentSendHistoryStore).filter(
			(h) => h.session_id === sessionId
		);
		return { success: true, data: assessmentSendHistoryList };
	},
	getClientDetail: (childId: string) => {
		let clientDetail = get(clientListStroe).find((c) => c.child_id === childId);
		if (!clientDetail) return { success: false };
		return { success: true, data: clientDetail };
	},
	handleChangeClientInfo: (req: ChildType): MockApiRes => {
		clientListStroe.update((clients) => {
			if (!clients.length) return [...clients];
			const updatedClients = clients.map((c) =>
				c.child_id === req.child_id
					? {
							...c,
							...req
						}
					: c
			);
			return [...updatedClients];
		});
		return { success: true };
	}
};
