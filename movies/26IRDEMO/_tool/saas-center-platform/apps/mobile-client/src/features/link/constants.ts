import type { BadgeColor } from '@/shared/components/ui';
import type { LinkStatus } from './types';

/** 연결 상태 라벨 — 중립 톤 (빨강·경고 뉘앙스 금지) */
export function linkStatusInfo(status: LinkStatus): { label: string; color: BadgeColor } {
  switch (status) {
    case 'active':
      return { label: '연결됨', color: 'green' };
    case 'requested':
      return { label: '확인 중', color: 'gray' };
    case 'suspended':
      return { label: '일시 중지', color: 'gray' };
    case 'rejected':
      return { label: '승인되지 않음', color: 'gray' };
    case 'revoked':
      return { label: '해제됨', color: 'gray' };
  }
}
