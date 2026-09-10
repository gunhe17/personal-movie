/** 로그인 요청 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Account 요약 (백엔드 AccountSummary 미러링) */
export interface AccountSummary {
  id: string;
  email: string;
  is_verified: boolean;
  created_at: string;
}

/** Person 요약 (백엔드 PersonSummary 미러링) */
export interface PersonSummary {
  id: string;
  name: string;
  phone: string;
  gender: "male" | "female" | null;
}

/** 사용자 소속 센터 요약 (백엔드 UserCenterSummary 미러링) */
export interface UserCenterSummary {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  role_code: string | null;
  role_name: string | null;
  joined_at: string | null;
}

/** 로그인 응답 (백엔드 LoginResponse 미러링) */
export interface LoginResponse {
  account: AccountSummary;
  person: PersonSummary | null;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  centers: UserCenterSummary[];
}

/** 토큰 리프레시 요청 */
export interface RefreshTokenRequest {
  refresh_token: string;
}

/** 토큰 리프레시 응답 */
export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/** /auth/me 응답 */
export interface MeResponse {
  account: AccountSummary;
  person: PersonSummary | null;
  centers: UserCenterSummary[];
}
