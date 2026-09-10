import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { CHUNK_INTERVAL_SECONDS } from './constants';

/** KeepAwake 태그 — 다른 화면 wake lock 과 충돌 방지 */
const KEEP_AWAKE_TAG = 'field-note-recording';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Audio: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ExponentAV: any = null;
try {
  Audio = require('expo-av').Audio;
  const { requireNativeModule } = require('expo-modules-core');
  ExponentAV = requireNativeModule('ExponentAV');
} catch {
  // expo-av를 로드할 수 없는 환경 (웹 등)
}

// --- Orphan 레코더 정리 헬퍼 ---
//
// expo-av Recording은 두 잠금을 사용한다:
//   1) JS: _recorderExists (모듈 스코프 boolean)
//   2) Native: iOS AVAudioRecorder 싱글톤
//
// hot-reload / 언마운트로 Recording 참조가 유실되면
// 아래 헬퍼로 양쪽을 강제 리셋한다.

const G = globalThis as Record<string, unknown>;
const RECORDING_KEY = '__expo_av_recording__';
const CLEANUP_KEY = '__expo_av_cleanup__';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _getGlobalRecording(): any { return G[RECORDING_KEY] ?? null; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _setGlobalRecording(rec: any) { G[RECORDING_KEY] = rec; }
function _getCleanupPromise(): Promise<void> { return (G[CLEANUP_KEY] as Promise<void>) ?? Promise.resolve(); }
function _setCleanupPromise(p: Promise<void>) { G[CLEANUP_KEY] = p; }

/** 네이티브 레코더 강제 해제. */
async function _forceNativeCleanup(): Promise<void> {
  if (!ExponentAV) return;
  try { await ExponentAV.unloadAudioRecorder(); } catch { /* */ }
  try { await ExponentAV.stopAudioRecording(); } catch { /* */ }
}

/**
 * JS _recorderExists 플래그 리셋.
 * _cleanupForUnloadedRecorder()는 무조건 _recorderExists = false 설정.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _resetJsRecorderFlag(recording?: any): Promise<void> {
  const target = recording ?? (Audio ? new Audio.Recording() : null);
  if (!target) return;
  if (typeof target._cleanupForUnloadedRecorder === 'function') {
    try { await target._cleanupForUnloadedRecorder(); } catch { /* */ }
  }
}

/** orphan 레코더 완전 해제 (녹음 시작 전 1회 호출). */
async function _releaseOrphanRecorder(): Promise<void> {
  try { await _getCleanupPromise(); } catch { /* */ }

  const orphan = _getGlobalRecording();
  _setGlobalRecording(null);

  if (orphan) {
    try {
      await orphan.stopAndUnloadAsync();
      return;
    } catch { /* */ }
    await _forceNativeCleanup();
    await _resetJsRecorderFlag(orphan);
    return;
  }

  await _forceNativeCleanup();
  await _resetJsRecorderFlag();
}

// --- Hook ---

interface UseRecorderOptions {
  onChunkReady: (fileUri: string, chunkIndex: number, duration: number) => void;
}

export interface MicPermissionResult {
  granted: boolean;
  /** OS가 다시 권한 다이얼로그를 띄울 수 있는지. iOS는 첫 거부 후 항상 false. */
  canAskAgain: boolean;
}

interface UseRecorderReturn {
  /**
   * 마이크 권한을 확인/요청한다 (사이드이펙트 없음 — 알럿은 띄우지 않음).
   * createMutation 등 비싼 작업 전에 호출해 거부 시 일찍 빠져나오기 위함.
   */
  ensurePermission: () => Promise<MicPermissionResult>;
  /** 녹음 시작. 권한이 없거나 시작에 실패하면 false 반환. */
  startRecording: (startChunkIndex?: number) => Promise<boolean>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  isRecording: boolean;
  isPaused: boolean;
  isSupported: boolean;
  /** 현재 입력 레벨 (dB, -160 ~ 0). metering 지원 시에만 업데이트. */
  meteringRef: React.MutableRefObject<number>;
}

export function useRecorder({ onChunkReady }: UseRecorderOptions): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordingRef = useRef<any>(null);
  const chunkIndexRef = useRef(0);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChunkReadyRef = useRef(onChunkReady);
  const pendingChunkRef = useRef(false);
  const rotatingRef = useRef(false);
  /** 현재 입력 레벨 (dB). metering 콜백이 매 update 갱신. */
  const meteringRef = useRef<number>(-160);

  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);
  const startingRef = useRef(false);

  useEffect(() => { onChunkReadyRef.current = onChunkReady; }, [onChunkReady]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const clearChunkTimer = useCallback(() => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
  }, []);

  /** 현재 녹음을 정지하고 리소스 해제. URI + duration 반환. */
  const stopCurrentRecording = useCallback(
    async (): Promise<{ uri: string; duration: number } | null> => {
      const recording = recordingRef.current;
      if (!recording) return null;

      recordingRef.current = null;
      _setGlobalRecording(null);

      let durationMs = 0;
      try {
        const status = await recording.getStatusAsync();
        durationMs = status.durationMillis || 0;
      } catch { /* */ }

      try {
        await recording.stopAndUnloadAsync();
      } catch {
        await _forceNativeCleanup();
        await _resetJsRecorderFlag(recording);
      }

      const uri = recording.getURI();
      if (uri && durationMs > 0) {
        return { uri, duration: durationMs / 1000 };
      }
      return null;
    },
    [],
  );

  /** 새 청크 녹음 시작. */
  const startNewChunk = useCallback(async () => {
    if (!Audio) return;

    if (AppState.currentState !== 'active') {
      pendingChunkRef.current = true;
      return;
    }

    const scheduleNextRotation = () => {
      chunkTimerRef.current = setTimeout(async () => {
        if (rotatingRef.current) return;
        rotatingRef.current = true;
        try {
          const result = await stopCurrentRecording();
          if (result) {
            const idx = chunkIndexRef.current;
            chunkIndexRef.current += 1;
            onChunkReadyRef.current(result.uri, idx, result.duration);
          }
          if (recordingRef.current === null && isRecordingRef.current && !isPausedRef.current) {
            await startNewChunk();
          }
        } finally {
          rotatingRef.current = false;
        }
      }, CHUNK_INTERVAL_SECONDS * 1000);
    };

    const recordingOptions = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachMetering = (rec: any) => {
      try {
        rec.setProgressUpdateInterval?.(80);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.setOnRecordingStatusUpdate?.((status: any) => {
          if (typeof status?.metering === 'number' && !Number.isNaN(status.metering)) {
            meteringRef.current = status.metering;
          }
        });
      } catch { /* metering 미지원 환경 — 무시 */ }
    };

    try {
      const recording = new Audio.Recording();
      attachMetering(recording);
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();
      recordingRef.current = recording;
      _setGlobalRecording(recording);
      scheduleNextRotation();
    } catch (err) {
      // orphan lock → 강제 정리 후 1회 재시도
      const msg = String(err);
      if (msg.includes('prepared') || msg.includes('Only one')) {
        await _forceNativeCleanup();
        await _resetJsRecorderFlag();
        await new Promise(r => setTimeout(r, 100));
        try {
          const recording = new Audio.Recording();
          attachMetering(recording);
          await recording.prepareToRecordAsync(recordingOptions);
          await recording.startAsync();
          recordingRef.current = recording;
          _setGlobalRecording(recording);
          scheduleNextRotation();
          return;
        } catch { /* retry 실패 → 아래 복구 불가 처리 */ }
      }

      // 복구 불가 → 녹음 중단
      isRecordingRef.current = false;
      isPausedRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
      Alert.alert('녹음 오류', '녹음을 시작할 수 없습니다. 앱을 완전히 종료 후 다시 시작해주세요.');
    }
  }, [stopCurrentRecording]);

  const ensurePermission = useCallback(async (): Promise<MicPermissionResult> => {
    if (!Audio) return { granted: false, canAskAgain: false };
    const res = await Audio.requestPermissionsAsync();
    return { granted: !!res?.granted, canAskAgain: !!res?.canAskAgain };
  }, []);

  const startRecording = useCallback(async (startChunkIndex = 0): Promise<boolean> => {
    if (startingRef.current || isRecordingRef.current) return false;
    startingRef.current = true;

    try {
      if (!Audio) {
        Alert.alert('지원되지 않음', '녹음은 모바일 앱에서만 사용할 수 있습니다.');
        return false;
      }

      // 방어적 권한 체크. 호출자가 ensurePermission으로 사전 체크해 알럿을 띄우는 것이 정상 경로.
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return false;

      await _releaseOrphanRecorder();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // 이어/추가 녹음이면 기존 청크 다음 인덱스부터 — 0 리셋 시 기존 청크와 충돌해
      // 타임라인 시점 매핑이 꼬임(전사 순서 뒤섞임).
      chunkIndexRef.current = startChunkIndex;
      rotatingRef.current = false;
      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);
      await startNewChunk();
      return true;
    } finally {
      startingRef.current = false;
    }
  }, [startNewChunk]);

  const pauseRecording = useCallback(async () => {
    // UI state 먼저 업데이트 — expo-av Recording.pauseAsync() 가 iOS 에서
    // 간헐적으로 늦게 resolve 되는 이슈가 있어, await 뒤에 두면 일시정지 버튼이
    // 먹지 않는 것처럼 보였음.
    clearChunkTimer();
    isPausedRef.current = true;
    setIsPaused(true);
    meteringRef.current = -160;

    const recording = recordingRef.current;
    if (recording) {
      // fire-and-forget — 실패해도 chunkTimer 가 멈췄으니 다음 청크는 안 만들어짐
      recording.pauseAsync().catch(() => {});
    }
  }, [clearChunkTimer]);

  const resumeRecording = useCallback(async () => {
    // UI state 먼저 업데이트 (위와 동일한 이유)
    isPausedRef.current = false;
    setIsPaused(false);

    // 재개 = 일시정지된 청크 마무리(즉시 업로드/전사) + 새 청크 시작.
    //
    // 이전 구현(recording.startAsync() 로 같은 파일 이어쓰기)은 두 가지 문제가 있었음:
    //   1) pauseRecording 에서 clearChunkTimer() 로 청크 로테이션 타이머를 지웠는데
    //      resume 에서 타이머를 다시 스케줄하지 않아 영영 onChunkReady 가 호출되지 않음
    //      → 백엔드로 청크가 안 가서 전사 파이프라인이 멈춤.
    //   2) pauseAsync 가 fire-and-forget 이라 startAsync 와의 상태 일치도 보장 안 됨.
    //
    // 한 청크의 분할 시점이 일시정지 경계가 되도록 바꿔서 두 이슈 모두 자연스럽게 해소.
    const result = await stopCurrentRecording();
    if (result && result.duration > 0.5) {
      const idx = chunkIndexRef.current;
      chunkIndexRef.current += 1;
      onChunkReadyRef.current(result.uri, idx, result.duration);
    }
    await startNewChunk();
  }, [stopCurrentRecording, startNewChunk]);

  const stopRecording = useCallback(async () => {
    clearChunkTimer();
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);

    const result = await stopCurrentRecording();
    if (result && result.duration > 0.5) {
      const idx = chunkIndexRef.current;
      chunkIndexRef.current += 1;
      onChunkReadyRef.current(result.uri, idx, result.duration);
    }

    meteringRef.current = -160;

    if (Audio) {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }
  }, [clearChunkTimer, stopCurrentRecording]);

  // 포그라운드 복귀 시 보류된 청크 재개
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && pendingChunkRef.current && isRecording && !isPaused) {
        pendingChunkRef.current = false;
        startNewChunk();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isRecording, isPaused, startNewChunk]);

  // 녹음 중에는 OS 자동 잠금 비활성 — 사용자가 화면 만지지 않아도 녹음 세션 유지.
  // 일시정지 중에도 활성 유지 (일시정지는 종료가 아닌 세션의 일부).
  // 종료/언마운트 시 자동 해제되어 OS 자동 잠금 정상 복귀.
  useEffect(() => {
    if (!isRecording) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => { /* 디바이스 지원 안 함 — 무시 */ });
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [isRecording]);

  // 언마운트 시 정리 (global ref는 유지 → 다음 mount에서 정리)
  useEffect(() => {
    return () => {
      clearChunkTimer();
      const rec = recordingRef.current;
      if (rec) {
        recordingRef.current = null;
        _setCleanupPromise(
          (async () => {
            try { await rec.stopAndUnloadAsync(); } catch {
              await _forceNativeCleanup();
              await _resetJsRecorderFlag(rec);
            }
          })(),
        );
      }
    };
  }, [clearChunkTimer]);

  return {
    ensurePermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isRecording,
    isPaused,
    isSupported: !!Audio,
    meteringRef,
  };
}
