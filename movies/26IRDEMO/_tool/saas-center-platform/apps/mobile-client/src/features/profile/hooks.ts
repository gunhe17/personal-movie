import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProfile,
  deleteProfile,
  listDefaultAvatars,
  listProfiles,
  mergeProfile,
  setProfileDefaultAvatar,
  updateProfile,
  uploadProfileImage,
} from './api';
import type { ProfileCreateRequest, ProfileUpdateRequest } from './types';

/** GET /app/profiles — 프로필 목록 (me 캐시와 별개로 필요한 경우) */
export function useProfiles(enabled = true) {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled,
  });
}

function useInvalidateProfileData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  };
}

export function useCreateProfile() {
  const invalidate = useInvalidateProfileData();
  return useMutation({
    mutationFn: (body: ProfileCreateRequest) => createProfile(body),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile() {
  const invalidate = useInvalidateProfileData();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProfileUpdateRequest }) =>
      updateProfile(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteProfile() {
  const invalidate = useInvalidateProfileData();
  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: invalidate,
  });
}

/** GET /app/profile-avatars — 기본 아바타 목록. 배포마다 바뀌지 않아 오래 캐시한다 */
export function useDefaultAvatars(enabled = true) {
  return useQuery({
    queryKey: ['default-avatars'],
    queryFn: listDefaultAvatars,
    enabled,
    staleTime: 1000 * 60 * 60,
  });
}

export function useSetProfileDefaultAvatar() {
  const invalidate = useInvalidateProfileData();
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) =>
      setProfileDefaultAvatar(id, key),
    onSuccess: invalidate,
  });
}

export function useUploadProfileImage() {
  const invalidate = useInvalidateProfileData();
  return useMutation({
    mutationFn: ({
      id,
      file,
    }: {
      id: string;
      file: { uri: string; name: string; type: string };
    }) => uploadProfileImage(id, file),
    onSuccess: invalidate,
  });
}

export function useMergeProfile() {
  const invalidate = useInvalidateProfileData();
  return useMutation({
    mutationFn: ({ id, targetProfileId }: { id: string; targetProfileId: string }) =>
      mergeProfile(id, targetProfileId),
    onSuccess: invalidate,
  });
}
