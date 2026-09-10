import type { ClientSummary } from '@/features/client';

export interface ClientCardProps {
  client: ClientSummary;
  onPress: (id: string) => void;
}

/**
 * 내담자 시안 키 — 디자인 톤 & 매너(§0)에 따라 3가지로 구분.
 *  A = 친절 (Helpful)  → 가로 한 줄, 빠른 스캔
 *  C = 친근 (Friendly) → 명함형 label-value, 정보 풍부
 *  E = 재미 (Vibrant)  → 그리드 2열, 시각 중심
 */
export type ClientVariantKey = 'A' | 'C' | 'E';
