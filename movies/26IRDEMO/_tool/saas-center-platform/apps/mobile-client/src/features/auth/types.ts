import type { Profile } from '@/features/profile/types';
import type { CenterLink } from '@/features/link/types';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AccountSummary {
  id: string;
  email: string;
}

export interface PersonSummary {
  id: string;
  name: string;
  phone: string | null;
}

/** GET /app/me 응답 */
export interface MeResponse {
  account: AccountSummary;
  person: PersonSummary;
  family: { id: string } | null;
  profiles: Profile[];
  links: CenterLink[];
}
