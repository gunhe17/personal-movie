import apiClient from '@/shared/api/client';
import type {
  DefaultAvatar,
  Profile,
  ProfileCreateRequest,
  ProfileUpdateRequest,
} from './types';

export async function listProfiles(): Promise<Profile[]> {
  const { data } = await apiClient.get<Profile[]>('/app/profiles');
  return data;
}

export async function createProfile(body: ProfileCreateRequest): Promise<Profile> {
  const { data } = await apiClient.post<Profile>('/app/profiles', body);
  return data;
}

export async function updateProfile(
  id: string,
  body: ProfileUpdateRequest,
): Promise<Profile> {
  const { data } = await apiClient.patch<Profile>(`/app/profiles/${id}`, body);
  return data;
}

export async function deleteProfile(id: string): Promise<void> {
  await apiClient.delete(`/app/profiles/${id}`);
}

export async function listDefaultAvatars(): Promise<DefaultAvatar[]> {
  const { data } = await apiClient.get<DefaultAvatar[]>('/app/profile-avatars');
  return data;
}

/** 기본 아바타로 지정 — 센터 연결 잠금(PATCH 409)과 무관한 별도 경로다 */
export async function setProfileDefaultAvatar(
  id: string,
  defaultAvatarKey: string,
): Promise<Profile> {
  const { data } = await apiClient.patch<Profile>(`/app/profiles/${id}/image`, {
    default_avatar_key: defaultAvatarKey,
  });
  return data;
}

export async function uploadProfileImage(
  id: string,
  file: { uri: string; name: string; type: string },
): Promise<Profile> {
  const form = new FormData();
  // RN의 FormData는 { uri, name, type } 객체를 파일로 취급한다(Blob 아님)
  form.append('file', file as unknown as Blob);
  const { data } = await apiClient.post<Profile>(`/app/profiles/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** 갈라진 프로필 합치기 — id 가 targetProfileId 로 흡수되고 사라진다(기록·센터 연결 전건 이동) */
export async function mergeProfile(
  id: string,
  targetProfileId: string,
): Promise<Profile> {
  const { data } = await apiClient.post<Profile>(`/app/profiles/${id}/merge`, {
    target_profile_id: targetProfileId,
  });
  return data;
}
