import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { create } from 'zustand';

/**
 * 재생 위치 전용 외부 스토어.
 *
 * 위치는 재생 중 매 틱(~500ms) 갱신되는데, 이를 React state(state.globalPositionSec)로
 * 흘리면 플레이어를 든 화면 전체(긴 전사 리스트 포함)가 틱마다 리렌더된다 — 모달 등장
 * 애니메이션 버벅임의 공범. 위치만 zustand 로 빼서 재생바·활성 행 동기화 등
 * "위치가 진짜 필요한 작은 구독자"만 갱신되게 한다.
 *
 * state.globalPositionSec 은 coarse 이벤트(시크·청크 전환·재생 완료·정지)에만 갱신된다.
 * 활성 플레이어는 한 번에 하나(상세 화면 단일)라 전역 싱글톤으로 충분.
 */
interface PlaybackPositionStore {
  positionSec: number;
  setPositionSec: (sec: number) => void;
}

export const usePlaybackPositionStore = create<PlaybackPositionStore>((set) => ({
  positionSec: 0,
  setPositionSec: (sec) => set({ positionSec: sec }),
}));

/** 플레이리스트에 등록할 청크 정보 */
export interface AudioChunkInfo {
  id: string;
  chunkIndex: number;
  duration: number; // seconds
}

export interface AudioPlayerState {
  /** 현재 재생 중인 청크 인덱스 (-1 = 비활성) */
  currentChunkIndex: number;
  /** 재생 중 여부 */
  isPlaying: boolean;
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** 글로벌 재생 위치 (초) — 전체 녹음 기준 */
  globalPositionSec: number;
  /** 전체 녹음 길이 (초) */
  totalDurationSec: number;
}

interface UseAudioPlayerParams {
  /** 오디오 청크 목록 (chunk_index 순 정렬) */
  chunks: AudioChunkInfo[];
  /** 청크 ID → presigned URL 을 가져오는 함수 */
  getUrl: (audioId: string) => Promise<string>;
}

interface UseAudioPlayerReturn {
  state: AudioPlayerState;
  /** 최신 재생 위치 (stale closure 방지용 ref) */
  positionRef: React.RefObject<number>;
  /** 전체 재생/일시정지 토글 (처음부터 또는 현재 위치에서) */
  togglePlay: () => Promise<void>;
  /** 재생 중지 및 리소스 해제 */
  stop: () => Promise<void>;
  /** 글로벌 위치(초)로 시크. autoPlay=true 면 그 지점부터 바로 재생. */
  seekTo: (globalSec: number, autoPlay?: boolean) => Promise<void>;
}

const INITIAL_STATE: AudioPlayerState = {
  currentChunkIndex: -1,
  isPlaying: false,
  isLoading: false,
  globalPositionSec: 0,
  totalDurationSec: 0,
};

/**
 * 연속 재생 오디오 플레이어 훅
 *
 * 여러 오디오 청크를 하나의 연속 트랙처럼 재생합니다.
 * 현재 청크 재생이 끝나면 자동으로 다음 청크를 로드하여 재생합니다.
 */
export function useAudioPlayer({ chunks, getUrl }: UseAudioPlayerParams): UseAudioPlayerReturn {
  const [state, setState] = useState<AudioPlayerState>(INITIAL_STATE);
  const soundRef = useRef<Audio.Sound | null>(null);
  const chunksRef = useRef(chunks);
  const urlCacheRef = useRef<Record<string, string>>({});
  // 다음 청크 자동 진행 중 중복 방지
  const advancingRef = useRef(false);
  // 사용자가 stop 했는지 추적 (자동 진행 방지)
  const stoppedRef = useRef(false);
  // seek 중 onPlaybackStatusUpdate 무시 (진행바 왔다갔다 방지)
  const seekingRef = useRef(false);
  // 최신 위치를 ref로 추적 (stale closure 방지)
  const positionRef = useRef(0);
  // 현재 로드된 청크 / 재생 여부를 ref로도 추적 — seekTo 가 same/cross chunk 분기를 판단할 때
  // React state(setState 비동기 → 한 박자 늦음)를 보면 stale closure 로 분기를 오판해
  // 시크가 '될 때 안 될 때' 가 생긴다. 모든 의사결정은 이 ref(=soundRef 와 동기) 로 한다.
  const currentChunkRef = useRef(-1);
  const isPlayingRef = useRef(false);
  // 로드/seek 연산 토큰 — 재생바를 빠르게 여러 곳 옮길 때 loadAndPlay 가 겹쳐
  // 사운드가 동시에 생성/해제되며 고아 사운드·에러가 나는 것을 막는다.
  // 각 loadAndPlay 가 토큰을 선점하고, await 사이에 더 새 연산이 시작되면 자신을 중단·정리한다.
  const opSeqRef = useRef(0);

  // chunks 변경 시 동기화
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  // 전체 녹음 길이 계산
  const totalDuration = chunks.reduce((sum, c) => sum + c.duration, 0);

  // 청크 인덱스까지의 누적 시간 (초)
  const getAccumulatedDuration = useCallback((upToChunkIndex: number) => {
    let acc = 0;
    for (const c of chunksRef.current) {
      if (c.chunkIndex >= upToChunkIndex) break;
      acc += c.duration;
    }
    return acc;
  }, []);

  // URL 가져오기 (캐시 우선)
  const fetchUrl = useCallback(async (audioId: string): Promise<string> => {
    if (urlCacheRef.current[audioId]) return urlCacheRef.current[audioId];
    const url = await getUrl(audioId);
    urlCacheRef.current[audioId] = url;
    return url;
  }, [getUrl]);

  // Sound 해제
  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
  }, []);

  // 특정 청크를 로드하고 재생
  const loadAndPlay = useCallback(async (chunkIndex: number, startOffsetMs = 0) => {
    const chunk = chunksRef.current.find(c => c.chunkIndex === chunkIndex);
    if (!chunk) return;

    // 이 로드의 토큰 선점. 이후 await 사이에 더 새 loadAndPlay 가 들어오면
    // opSeqRef 가 바뀌어 이 로드는 중단된다(고아 사운드 정리 포함).
    const seq = ++opSeqRef.current;

    await unloadSound();
    if (opSeqRef.current !== seq) return; // 더 새 연산이 시작됨

    setState(prev => ({
      ...prev,
      currentChunkIndex: chunkIndex,
      isLoading: true,
    }));

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      if (opSeqRef.current !== seq) return;

      const url = await fetchUrl(chunk.id);
      if (opSeqRef.current !== seq) return;

      // 정지 상태(shouldPlay:false)로 먼저 로드한다.
      // shouldPlay:true 로 만들면 iOS 에서 사운드가 0 초부터 재생을 시작하고, 그 직후의
      // setPositionAsync(offset) 보정이 '이미 굴러가는 재생'에 묻혀 무시되는 경우가 있다
      // → 크로스 청크 seek(예: 51분 녹음 1/3 지점)가 청크 시작점으로 튐.
      // 정지 상태에서 정확히 목표 위치로 seek 한 뒤(playAsync) 재생을 시작하면 경쟁이 없다.
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false, positionMillis: startOffsetMs },
      );

      // createAsync 사이에 더 새 seek 가 들어왔으면 방금 만든 사운드는 고아 — 정리하고 중단.
      if (opSeqRef.current !== seq) {
        try { await sound.unloadAsync(); } catch { /* ignore */ }
        return;
      }

      soundRef.current = sound;
      currentChunkRef.current = chunkIndex; // soundRef 와 동기 — seekTo 분기 판단의 기준

      // 정지 상태에서 목표 위치로 명시 seek (createAsync positionMillis 무시 케이스 보정).
      // 이 시점은 seekingRef 가드 안이라 status 갱신에 안 잡힌다.
      if (startOffsetMs > 0) {
        try {
          await sound.setPositionAsync(startOffsetMs);
        } catch { /* ignore */ }
        if (opSeqRef.current !== seq) return; // setPosition 사이에 바뀌면 다음 연산이 처리
      }

      // 상태 업데이트 핸들러 설정 (재생 시작 전에 붙여 첫 status 부터 잡는다)
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        // 이 핸들러의 사운드가 이미 교체됐으면(다음 seek) 무시.
        if (opSeqRef.current !== seq) return;
        if (!status.isLoaded) return;
        if (seekingRef.current) return;

        const accSec = getAccumulatedDuration(chunkIndex);
        const currentSec = status.positionMillis / 1000;

        const globalPos = accSec + currentSec;
        // 위치가 갑자기 ~0 으로 보고되면(0초 순간이동) 어느 청크/오프셋에서 왔는지 남긴다.
        if (__DEV__ && globalPos < 1 && (chunkIndex > 0 || accSec > 1)) {
          console.warn('[fieldnote-audio] status reported ~0', {
            chunkIndex,
            accSec: Math.round(accSec),
            currentSec: currentSec.toFixed(2),
            posMs: status.positionMillis,
          });
        }
        positionRef.current = globalPos;
        isPlayingRef.current = status.isPlaying;
        // 위치는 외부 스토어로만 — 매 틱 React state 갱신(화면 전체 리렌더) 금지.
        usePlaybackPositionStore.getState().setPositionSec(globalPos);

        // isPlaying/isLoading 이 실제로 바뀔 때만 setState (동일하면 prev 반환 → 리렌더 스킵).
        setState(prev =>
          prev.isPlaying === status.isPlaying && !prev.isLoading
            ? prev
            : { ...prev, isPlaying: status.isPlaying, isLoading: false },
        );

        // 청크 재생 완료 → 다음 청크 자동 재생
        if (status.didJustFinish && !advancingRef.current && !stoppedRef.current) {
          advancingRef.current = true;
          const currentChunks = chunksRef.current;
          const currentIdx = currentChunks.findIndex(c => c.chunkIndex === chunkIndex);
          // currentIdx === -1 (끝난 청크가 목록에 없음 — chunks 가 갱신됐거나 비정상) 일 때
          // currentChunks[-1 + 1] = currentChunks[0] = chunk0 으로 잘못 폴백되어 '0초로 순간이동'
          // 하던 버그. 못 찾으면 다음 청크 없음(=완료)으로 처리하고 절대 chunk0 으로 되돌리지 않는다.
          const nextChunk = currentIdx >= 0 ? currentChunks[currentIdx + 1] : undefined;
          if (__DEV__ && currentIdx === -1) {
            console.warn(
              '[fieldnote-audio] didJustFinish: finished chunkIndex not found in chunks',
              { chunkIndex, available: currentChunks.map((c) => c.chunkIndex) },
            );
          }

          if (nextChunk) {
            loadAndPlay(nextChunk.chunkIndex).finally(() => {
              advancingRef.current = false;
            });
          } else {
            // 마지막 청크 → 재생 완료
            positionRef.current = totalDuration;
            currentChunkRef.current = -1;
            isPlayingRef.current = false;
            usePlaybackPositionStore.getState().setPositionSec(totalDuration);
            setState(prev => ({
              ...prev,
              isPlaying: false,
              globalPositionSec: totalDuration,
              currentChunkIndex: -1,
            }));
            unloadSound().finally(() => {
              advancingRef.current = false;
            });
          }
        }
      });

      // 정확한 위치로 seek 가 끝난 뒤 재생 시작 — 재생@0 과의 경쟁 제거.
      try {
        await sound.playAsync();
      } catch { /* ignore */ }
      if (opSeqRef.current !== seq) return;

      isPlayingRef.current = true;
      setState(prev => ({ ...prev, isLoading: false, isPlaying: true }));

      // 다음 청크 URL 선제 캐싱
      const currentIdx = chunksRef.current.findIndex(c => c.chunkIndex === chunkIndex);
      const nextChunk = chunksRef.current[currentIdx + 1];
      if (nextChunk) {
        fetchUrl(nextChunk.id).catch(() => {});
      }
    } catch {
      setState(prev => ({ ...prev, isLoading: false, isPlaying: false }));
      await unloadSound();
    }
  }, [unloadSound, fetchUrl, getAccumulatedDuration, totalDuration]);

  // 재생/일시정지 토글
  const togglePlay = useCallback(async () => {
    stoppedRef.current = false;

    // 이미 로드된 Sound가 있으면 토글
    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          isPlayingRef.current = false;
          await soundRef.current.pauseAsync();
          return;
        }
        // 재생 완료 상태면 처음부터
        if (status.positionMillis >= (status.durationMillis ?? 0) - 100) {
          // 마지막 청크 끝에서 전체 처음으로 (위치는 positionRef 가 최신 — state 위치는 coarse)
          if (currentChunkRef.current === -1 || positionRef.current >= totalDuration - 0.5) {
            const first = chunksRef.current[0];
            if (first) await loadAndPlay(first.chunkIndex);
            return;
          }
        }
        isPlayingRef.current = true;
        await soundRef.current.playAsync();
        return;
      }
    }

    // 첫 재생
    const first = chunksRef.current[0];
    if (first) {
      await loadAndPlay(first.chunkIndex);
    }
  }, [totalDuration, loadAndPlay]);

  // 정지
  const stop = useCallback(async () => {
    if (__DEV__) console.warn('[fieldnote-audio] stop() → position reset 0');
    stoppedRef.current = true;
    ++opSeqRef.current; // 진행 중 로드 무효화 — 정지 후 사운드가 되살아나지 않게
    await unloadSound();
    positionRef.current = 0;
    currentChunkRef.current = -1;
    isPlayingRef.current = false;
    usePlaybackPositionStore.getState().setPositionSec(0);
    setState({
      ...INITIAL_STATE,
      totalDurationSec: totalDuration,
    });
  }, [unloadSound, totalDuration]);

  // 글로벌 위치로 시크 (초 단위)
  const seekTo = useCallback(async (globalSec: number, autoPlay = false) => {
    const clampedSec = Math.max(0, Math.min(globalSec, totalDuration));

    // 어떤 청크에 속하는지 계산
    let acc = 0;
    let targetChunk: AudioChunkInfo | null = null;
    let offsetInChunk = 0;

    for (const chunk of chunksRef.current) {
      if (acc + chunk.duration > clampedSec) {
        targetChunk = chunk;
        offsetInChunk = clampedSec - acc;
        break;
      }
      acc += chunk.duration;
    }

    // 마지막 청크 끝을 넘은 경우
    if (!targetChunk) {
      const last = chunksRef.current[chunksRef.current.length - 1];
      if (last) {
        targetChunk = last;
        offsetInChunk = last.duration;
      } else {
        return;
      }
    }

    // ⚠️ 분기 판단은 React state 가 아니라 ref(=soundRef 와 동기) 로 — state.currentChunkIndex 는
    // setState 가 한 박자 늦어, 빠른 연속 시크/일시정지 직후엔 stale 값이라 same/cross 를 오판한다
    // (시크가 '될 때 안 될 때' 의 주범). currentChunkRef 는 loadAndPlay 가 soundRef 와 같은 시점에 갱신.
    const sameChunk =
      currentChunkRef.current === targetChunk.chunkIndex && !!soundRef.current;

    if (__DEV__) {
      console.log('[fieldnote-audio] seek', {
        globalSec: Math.round(globalSec),
        clampedSec: Math.round(clampedSec),
        total: Math.round(totalDuration),
        targetChunk: targetChunk.chunkIndex,
        offsetInChunk: Math.round(offsetInChunk),
        curChunk: currentChunkRef.current,
        branch: sameChunk ? 'same-chunk' : 'cross-chunk',
      });
    }

    stoppedRef.current = false;
    seekingRef.current = true;
    positionRef.current = clampedSec;

    // 즉시 재생바/하이라이트가 탭한 위치로 따라오도록 위치를 먼저 반영한다.
    // (다른 청크 로드 경로는 status handler 가 seekingRef 로 막혀 있어, 이걸 안 하면
    //  실제 재생이 시작될 때까지 재생바가 옛 위치에 머문다.)
    usePlaybackPositionStore.getState().setPositionSec(clampedSec);
    setState(prev => ({ ...prev, globalPositionSec: clampedSec }));

    // 현재 같은 청크면 위치만 이동.
    // ⚠️ opSeqRef 는 여기서 건드리지 않는다 — 같은 청크는 기존 사운드/status 핸들러를 그대로
    // 재사용하는데, opSeqRef 를 올리면 그 핸들러가 seq 불일치로 영구 muted 되어(위치 갱신 정지)
    // 재생바가 멈춰 버린다. 진행 중 로드 무효화(=opSeqRef 증가)는 새로 로드하는 크로스 청크에서만.
    if (sameChunk) {
      try {
        await soundRef.current!.setPositionAsync(offsetInChunk * 1000);
        if (autoPlay) {
          isPlayingRef.current = true;
          await soundRef.current!.playAsync();
        }
      } catch { /* 사운드가 교체/언로드됨 — 무시 */ }
      setState(prev => ({
        ...prev,
        globalPositionSec: clampedSec,
        ...(autoPlay ? { isPlaying: true } : {}),
      }));
    } else {
      // 다른 청크: 진행 중 이전 loadAndPlay(예: 자동 다음청크 진행)를 무효화한 뒤 새 청크 로드.
      // loadAndPlay 가 자체 토큰으로 겹침 방어 + 새 status 핸들러를 단다.
      ++opSeqRef.current;
      const wasPlaying = isPlayingRef.current;
      await loadAndPlay(targetChunk.chunkIndex, offsetInChunk * 1000);
      if (!autoPlay && !wasPlaying && soundRef.current) {
        try { await soundRef.current.pauseAsync(); } catch { /* ignore */ }
      }
    }

    seekingRef.current = false;
  }, [totalDuration, loadAndPlay]);

  // totalDuration 업데이트
  useEffect(() => {
    setState(prev => ({ ...prev, totalDurationSec: totalDuration }));
  }, [totalDuration]);

  // 마운트 시 위치 스토어 초기화 — 전역 싱글톤이라 직전 노트의 재생 위치가 남아 있으면
  // 새 상세의 재생바가 엉뚱한 위치에서 시작한다. 언마운트 시 사운드 정리.
  useEffect(() => {
    if (__DEV__) console.warn('[fieldnote-audio] mount → position reset 0 (remount?)');
    positionRef.current = 0;
    usePlaybackPositionStore.getState().setPositionSec(0);
    return () => {
      stoppedRef.current = true;
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  return { state, positionRef, togglePlay, stop, seekTo };
}
