import type { SessionStatusType } from '$lib/stores/sessionStatus_local';

export type AssessmentCardType = {
	assessment_id: string;
	name_en: string;
	name_kr: string;
	is_online_available: boolean;
	symbol_color: string;
	status: SessionStatusType;
	background: string;
};

export type AssessmentType = {
	uid: string;
	code: string;
	eng_name: string;
	kor_name: string;
	color: string;
	is_online_available: boolean;
	is_ai_supported: boolean;
	assessment_type: string;
	target_age_group: string;
	estimated_duration_minutes: number;
	has_standard_report: boolean;
	supports_self_scoring: boolean;
	supports_report_upload: boolean;
	external_assessment_url: string | null;
	unit_price: string;
	status: 'public' | 'private' | 'archived';
	created_at: string;
	updated_at: string;
};

export type AssessmentStatusType = {
	id: string;
	uid: string;
	center_uid: string;
	assessment_uid: string;
	is_active: boolean;
	created_at: Date;
};

// API 응답에서 사용되는 타입
export type AssessmentWithStatus =
	| {
			assessment: AssessmentType;
			is_active: false;
	  }
	| {
			assessment: AssessmentType;
			is_active: true;
			activated_at: string;
			activated_by_account: string;
			activated_by_person: string;
	  };
