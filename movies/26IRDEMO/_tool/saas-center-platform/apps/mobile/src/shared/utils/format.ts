/** 전화번호 자동 포맷: 01012345678 → 010-1234-5678 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 생년월일 자동 포맷: 20150315 → 2015-03-15 */
export function formatBirthInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** 생년월일 유효성 검사 (YYYY-MM-DD 형식, 미래 날짜 불가) */
export function isValidBirthDate(dateStr: string): boolean {
  if (dateStr.length !== 10) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false;
  return date <= new Date();
}
