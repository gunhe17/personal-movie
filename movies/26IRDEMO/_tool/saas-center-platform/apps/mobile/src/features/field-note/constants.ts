import { Dimensions } from 'react-native';
import type { TagCategory } from './types';

/** 태그 카테고리 라벨 */
export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  observation: '관찰',
  behavior: '행동',
  emotion: '감정',
  other: '기타',
};

/** 태그 카테고리 색상 (다크 테마 대비) */
export const TAG_CATEGORY_COLORS: Record<TagCategory, { bg: string; text: string }> = {
  observation: { bg: 'rgba(37,110,244,0.2)', text: '#85aff9' },
  behavior: { bg: 'rgba(1,119,80,0.2)', text: '#4ecca3' },
  emotion: { bg: 'rgba(239,73,103,0.2)', text: '#f78da7' },
  other: { bg: 'rgba(113,113,113,0.2)', text: '#aab2be' },
};

/** 녹음 청크 간격 (초).
 * 라이브 자막 등장 속도와 trade-off — 짧을수록 자막이 빨리 뜨지만 청크 수 증가.
 * 분석 총 시간은 영향 없음 (최종 diarize 는 머지된 전체 오디오에 1회 호출). */
export const CHUNK_INTERVAL_SECONDS = 4;

/** 폴링 간격 (ms) - 파이프라인 상태 갱신용.
 * 짧을수록 라이브 자막/분석 진행 표시가 신속하지만 활성 녹음 중 API 호출 빈도 증가. */
export const POLLING_INTERVAL_MS = 1500;

/** 파이프라인 단계 라벨 */
export const PROCESSING_STEP_LABELS: Record<string, string> = {
  transcribing: '음성 전사 중',
  refining: 'AI 보정 중',
  summarizing: '요약 생성 중',
  generating_note: '상담일지 작성 중',
};

/** 최소 녹음 시간 (초) - 이 시간 미만이면 파이프라인 건너뛰기 제안 */
export const MIN_RECORDING_DURATION_SECONDS = 30;

/** 웨이브폼 바 너비 (px) */
export const WAVEFORM_BAR_WIDTH = 2;
/** 웨이브폼 바 사이 간격 (px) */
export const WAVEFORM_BAR_GAP = 5;
/** 웨이브폼 양쪽 패딩 (px) */
const WAVEFORM_HORIZONTAL_PADDING = 32;
/** 웨이브폼 바 개수 — 화면 폭에 맞춰 동적 계산 (BAR_WIDTH + BAR_GAP 기준).
 *  Skia Canvas로 single path 그리기라 모든 플랫폼 동일 처리. */
export const WAVEFORM_BAR_COUNT = Math.max(
  20,
  Math.floor(
    (Dimensions.get('window').width - WAVEFORM_HORIZONTAL_PADDING) /
      (WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP),
  ),
);

/** Presigned URL 캐시 유지 시간 (ms) — URL 유효기간(1시간)보다 짧게 설정 */
export const PRESIGNED_URL_CACHE_MS = 30 * 60 * 1000;

/** 오디오 업로드 타임아웃 (ms) */
export const AUDIO_UPLOAD_TIMEOUT_MS = 30_000;

/** 스트리밍 모드: PCM 오디오 전송 간격 (ms) */
export const AUDIO_STREAM_INTERVAL_MS = 100;

/** 스트리밍 모드: WebSocket 최대 재연결 시도 횟수 */
export const WS_MAX_RECONNECT_ATTEMPTS = 3;
