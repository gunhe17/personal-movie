/**
 * 서버 STT 설정 조회 훅 — 녹음 시작 전 모드 확인
 *
 * GET /field-notes/config → { stt_mode: "whisper_chunk" | "aws_streaming" }
 * 앱 세션 동안 캐시 유지 (staleTime: Infinity)
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/shared/api/client';
import { useFieldNotePlatform } from './platform/context';
import type { STTMode } from './types';

interface STTConfigResponse {
  stt_mode: STTMode;
}

async function fetchSTTConfig(centerId: string): Promise<STTConfigResponse> {
  const response = await apiClient.get<STTConfigResponse>(
    `/centers/${centerId}/field-notes/config`,
  );
  return response.data;
}

export function useSTTConfig() {
  const { centerId } = useFieldNotePlatform();

  return useQuery({
    queryKey: ['fieldNoteSTTConfig', centerId],
    queryFn: () => fetchSTTConfig(centerId!),
    enabled: !!centerId,
    staleTime: Infinity, // 앱 세션 동안 유지
    gcTime: Infinity,
  });
}
