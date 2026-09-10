export type FamilyRole = 'owner' | 'member';

/** GET /app/family/members 항목 */
export interface FamilyMember {
  id: string;
  person_id: string;
  name: string | null;
  role: FamilyRole;
}

/** POST /app/family/invitations — 6자리, 48시간 */
export interface FamilyInvitation {
  id: string;
  code: string;
  expires_at: string;
  created_at: string;
}

export interface FamilyJoinResult {
  family_id: string;
  members: FamilyMember[];
}
