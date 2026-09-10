/** "MM:SS" 형식 */
export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** "HH:MM:SS" 형식 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 분석 가능한 실내용이 있는지 — 무음(빈 전사)뿐인 녹음에 "분석하기"를 노출/허용하지 않기 위함.
 * 백엔드 요약/가이드 조건과 일치: "음성 전사(공백 제외) OR 메모/태그" 중 하나라도 있어야 함.
 * (없으면 요약이 "(전사 내용 없음)" 으로 무의미하게 돌아 크레딧만 낭비)
 */
export function hasAnalyzableContent(
  fn?: {
    audios?: { transcript?: string | null }[];
    entries?: { entry_type: string }[];
  } | null,
): boolean {
  if (!fn) return false;
  const hasSpeech = !!fn.audios?.some((a) => (a.transcript ?? '').trim().length > 0);
  const hasMemo = !!fn.entries?.some(
    (e) => e.entry_type === 'memo' || e.entry_type === 'tag',
  );
  return hasSpeech || hasMemo;
}

/**
 * 이어/추가 녹음 시 새 청크가 받을 다음 chunk_index.
 * 기존 청크와 충돌하면(0 으로 리셋) 타임라인 시점 매핑(chunkStartedAtMap)이 꼬여
 * 전사 순서가 뒤섞이므로, 기존 최대 인덱스 + 1 부터 이어간다.
 */
export function nextChunkIndex(
  audios?: { chunk_index: number }[] | null,
): number {
  if (!audios?.length) return 0;
  return Math.max(...audios.map((a) => a.chunk_index)) + 1;
}

/** 오디오 청크 duration 합. */
export function sumAudioDuration(
  audios?: { duration: number }[] | null,
): number {
  if (!audios?.length) return 0;
  return audios.reduce((acc, a) => acc + (a.duration ?? 0), 0);
}

/**
 * 노트의 "실효 길이" — `total_duration` 은 녹음 종료(finalize) 시점에만 기록되므로,
 * 미종료(recording/paused) 노트는 0 이다. 그 경우 업로드된 청크 duration 합으로 보정.
 * 표시(ResumeScreen 등) + 이어/추가 녹음 타이머 기준에 사용.
 */
export function effectiveDuration(
  fn?: { total_duration?: number; audios?: { duration: number }[] } | null,
): number {
  if (!fn) return 0;
  return fn.total_duration || sumAudioDuration(fn.audios);
}
