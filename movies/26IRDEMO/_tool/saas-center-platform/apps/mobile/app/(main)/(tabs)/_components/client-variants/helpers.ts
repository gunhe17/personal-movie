export function formatBirthDate(birth: string | null): string {
  if (!birth) return '-';
  return birth.split('T')[0].replaceAll('-', '.');
}

export function calculateAge(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function getGenderLabel(gender: 'male' | 'female' | null): string | null {
  if (gender === 'female') return '여';
  if (gender === 'male') return '남';
  return null;
}

export function formatPhone(phone: string | null): string {
  if (!phone || phone.trim().length === 0) return '-';
  const raw = phone.replace(/-/g, '');
  if (!/^\d+$/.test(raw)) return phone;
  if (raw.length === 11) {
    return raw.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (raw.length === 10 && raw.startsWith('02')) {
    return raw.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (raw.length === 10) {
    return raw.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (raw.length === 9 && raw.startsWith('02')) {
    return raw.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return phone;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function formatNextSession(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '일정 없음';
  const utc = isoUtc.endsWith('Z') ? isoUtc : isoUtc + 'Z';
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return '일정 없음';
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  const day = DAYS[d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `다음 ${m}/${dd} (${day}) ${hh}:${mm}`;
}

export function getInitial(name: string): string {
  return name?.trim()?.[0] ?? '?';
}

import { COLORS } from '@/shared/constants/theme';

/**
 * 프로필 아바타용 색상 팔레트 — Extended Palette 기반.
 * bg: paletteBg(고정 투명도) / fg: palette(solid)
 * primary/gray 외 색은 모두 팔레트에서 선택한다 (CLAUDE.md §1 참조).
 */
const PROFILE_PALETTE = [
  { bg: COLORS.paletteBg.blue,        fg: COLORS.palette.blue },        // Blue
  { bg: COLORS.paletteBg.green,       fg: COLORS.palette.green },       // Green
  { bg: COLORS.paletteBg.orange,      fg: COLORS.palette.orange },      // Orange
  { bg: COLORS.paletteBg.violet,      fg: COLORS.palette.violet },      // Violet
  { bg: COLORS.paletteBg.pink,        fg: COLORS.palette.pink },        // Pink
  { bg: COLORS.paletteBg.mint,        fg: COLORS.palette.mint },        // Mint
] as const;

/**
 * 사람마다 일관된 프로필 배경/포어그라운드 색상 반환.
 * 같은 seed(client.id 등)에 대해 항상 같은 색이 나오도록 단순 해시 사용.
 */
export function getProfileColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PROFILE_PALETTE[Math.abs(hash) % PROFILE_PALETTE.length];
}
