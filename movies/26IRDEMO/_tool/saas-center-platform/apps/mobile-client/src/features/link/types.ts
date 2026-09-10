/** 센터 연결(link) 상태 */
export type LinkStatus =
  | 'requested'
  | 'active'
  | 'suspended'
  | 'rejected'
  | 'revoked';

/** 프로필 ↔ 센터 내담자(client) 연결 */
export interface CenterLink {
  id: string;
  profile_id: string;
  center_id: string;
  center_name: string;
  center_phone: string | null;
  center_logo_url: string | null;
  client_id: string;
  status: LinkStatus;
  linked_at: string | null;
}

/** 초대 코드 verify 응답의 자녀(내담자) 항목 */
/** 매칭 후보 — tier=strong 만 미리 선택되고, weak 은 목록에만 노출된다 */
export interface ProfileCandidate {
  profile_id: string;
  display_name: string;
  birth_date: string | null;
  relation: string;
  tier: 'strong' | 'weak';
  /** 'name' | 'birth_date' | 'linked_elsewhere' */
  reasons: string[];
  linked_center_names: string[];
  /** 값이 있으면 선택 불가 — 'linked_to_this_center' */
  disabled_reason: string | null;
}

export interface InvitationChild {
  client_id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  /** 기존 프로필과 매칭 추천이 있는 경우 */
  suggested_profile_id: string | null;
  /** 추천(strong) + 약한 후보까지 — 비면 부모가 새 프로필로 간다 */
  candidates?: ProfileCandidate[];
  /** 이 아이가 이미 걸려 있는 프로필 — 다른 프로필로 재매핑은 서버가 거부한다 */
  linked_profile_id?: string | null;
  /** 본인 내담(후보 = 보호자 자신) — "아이 확인" 대신 본인 문구를 쓴다 */
  is_self?: boolean;
}

/** POST /app/link-invitations/verify 응답 (비소모 열람) */
export interface InvitationVerifyResponse {
  center: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    image_url: string | null;
  };
  guardian_name: string;
  expires_at: string;
  children: InvitationChild[];
}

/** claim 매핑 — profile_id 또는 new_profile 중 하나 */
export interface ClaimMapping {
  client_id: string;
  profile_id?: string;
  new_profile?: {
    display_name: string;
    birth_date?: string;
    gender?: string;
  };
}

export interface ClaimRequest {
  code: string;
  mappings: ClaimMapping[];
}

export interface ClaimResponse {
  links: CenterLink[];
}
