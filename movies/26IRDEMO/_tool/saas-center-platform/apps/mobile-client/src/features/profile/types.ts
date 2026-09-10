/** 아이(내담자) 프로필 — 보호자 계정 아래 자녀/본인 프로필 */
export type ProfileRelation = 'child' | 'self';

/** 성별 코드 — 백엔드 계약 미확정, 'male' | 'female' 가정 */
export type Gender = string;

export interface Profile {
  id: string;
  display_name: string;
  relation: ProfileRelation;
  birth_date: string | null;
  gender: Gender | null;
  /** 보호자가 고른 것 > 연결된 센터 Client의 것 > null (서버가 해소) */
  image_url: string | null;
  /** 센터 연결 = 센터 명부의 투영이라 수정·삭제 잠김(서버도 409로 막는다) */
  is_linked: boolean;
}

export interface ProfileCreateRequest {
  display_name: string;
  relation: ProfileRelation;
  birth_date?: string;
  gender?: string;
  /** 미지정이면 서버가 성별 기준으로 배정한다 */
  default_avatar_key?: string;
}

/** 서버가 제공하는 기본 아바타 — 앱에 번들하지 않고 URL을 그대로 그린다 */
export interface DefaultAvatar {
  key: string;
  gender: string;
  url: string;
}

export interface ProfileUpdateRequest {
  display_name?: string;
  relation?: ProfileRelation;
  birth_date?: string | null;
  gender?: string | null;
}
