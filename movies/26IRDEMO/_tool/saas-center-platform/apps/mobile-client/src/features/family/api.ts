import apiClient from '@/shared/api/client';
import type { FamilyInvitation, FamilyJoinResult, FamilyMember } from './types';

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  const { data } = await apiClient.get<FamilyMember[]>('/app/family/members');
  return data;
}

export async function issueFamilyInvitation(): Promise<FamilyInvitation> {
  const { data } = await apiClient.post<FamilyInvitation>('/app/family/invitations');
  return data;
}

export async function joinFamily(code: string): Promise<FamilyJoinResult> {
  const { data } = await apiClient.post<FamilyJoinResult>('/app/family/join', { code });
  return data;
}

export async function removeFamilyMember(memberId: string): Promise<void> {
  await apiClient.delete(`/app/family/members/${memberId}`);
}

export async function leaveFamily(): Promise<void> {
  await apiClient.delete('/app/family/members/me');
}
