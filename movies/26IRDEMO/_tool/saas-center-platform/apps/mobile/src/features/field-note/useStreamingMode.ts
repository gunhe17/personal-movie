/**
 * 스트리밍 모드 통합 훅 — 레코더 + WebSocket 조합
 *
 * RecordingHost에서 chunk 모드와 동일한 인터페이스로 사용:
 * - startRecording(fieldNoteId) → WebSocket 연결 + PCM 녹음 시작
 * - pauseRecording() / resumeRecording()
 * - stopRecording() → WebSocket finish + 녹음 중지
 * - meteringRef, isRecording, isPaused
 *
 * 추가로 실시간 전사 결과(partial/final)를 콜백으로 전달.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFieldNotePlatform } from './platform/context';
import { useStreamingSocket } from './useStreamingSocket';
import { useStreamingRecorder } from './useStreamingRecorder';

// 스트리밍 녹음 중 화면이 꺼지지 않게 유지 — 화면 타임아웃 → 백그라운드 → OS가 앱/오디오 모듈을
// 죽여 녹음이 조용히 끊기는 것(긴 녹음에서 JS 에러 없이 앱이 사라짐)을 방지. 청크 모드(useRecorder)와 동일.
const STREAMING_KEEP_AWAKE_TAG = 'field-note-streaming';
import type { StreamingServerMessage, StreamingFinalMessage, StreamingPartialMessage } from './types';

/** Promise that resolves when WebSocket 'finished' message is received */
type FinishResolver = (value: { audioPath: string; totalDuration: number }) => void;

interface StreamingUtterance {
  text: string;
  startSeconds: number | null;
  endSeconds: number | null;
  isFinal: boolean;
}

interface UseStreamingModeOptions {
  onPartial?: (msg: StreamingPartialMessage) => void;
  onFinal?: (msg: StreamingFinalMessage) => void;
  onFinished?: (audioPath: string, totalDuration: number) => void;
  onFallbackToChunk?: () => void;
}

/** partial(부분 전사) 화면 반영 간격(ms). AWS는 초당 여러 번 partial을 보내므로
 *  매번 setState 하면 전사 리스트가 초당 수회 갱신 → VirtualizedList "slow to update". */
const PARTIAL_THROTTLE_MS = 250;

export function useStreamingMode(options: UseStreamingModeOptions = {}) {
  const centerId = useFieldNotePlatform().centerId ?? '';
  const [utterances, setUtterances] = useState<StreamingUtterance[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>('');
  const fieldNoteIdRef = useRef<string | null>(null);
  const finishResolverRef = useRef<FinishResolver | null>(null);
  // 의도적 종료(stop/finish/cleanup) 중인지 — 이때 발생하는 WS 끊김은 '실패 폴백'이 아니라
  // 정상 종료이므로 onFallbackToChunk('기본 모드 전환' 스낵바)를 띄우지 않는다.
  const closingRef = useRef(false);
  // 세션 타임스탬프 보정 — AWS 타임스탬프는 "WS 세션 시작" 기준 0부터라, 백그라운드 복귀
  // 등으로 세션을 재시작하면 새 발화가 0초부터 다시 찍혀 기존 발화 사이에 끼어든다(시간 뒤섞임).
  // 재연결 시 직전까지의 발화 누적 끝(lastEndSecRef)을 새 세션의 베이스로 삼아 이어붙인다.
  // (최종 저장본은 서버가 청크 duration 기반으로 정확히 합치므로 — 이건 라이브 표시용 보정.)
  const sessionBaseSecRef = useRef(0);
  const lastEndSecRef = useRef(0);

  // partial throttle — 매 partial 마다 setState 하지 않고 ~PARTIAL_THROTTLE_MS 마다 1회만 반영.
  // final 이 오면 즉시 clear(아래 'final' 케이스). 실시간 느낌 유지 + 리스트 갱신 횟수↓.
  const partialTextRef = useRef('');
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPartial = useCallback(() => {
    if (partialTimerRef.current != null) {
      clearTimeout(partialTimerRef.current);
      partialTimerRef.current = null;
    }
    partialTextRef.current = '';
    setCurrentPartial('');
  }, []);
  const pushPartialThrottled = useCallback((text: string) => {
    partialTextRef.current = text;
    if (partialTimerRef.current == null) {
      partialTimerRef.current = setTimeout(() => {
        partialTimerRef.current = null;
        setCurrentPartial(partialTextRef.current);
      }, PARTIAL_THROTTLE_MS);
    }
  }, []);
  // 언마운트 시 대기 중인 throttle 타이머 정리
  useEffect(() => () => {
    if (partialTimerRef.current != null) clearTimeout(partialTimerRef.current);
  }, []);

  const handleMessage = useCallback(
    (msg: StreamingServerMessage) => {
      switch (msg.type) {
        case 'session_started':
          break;

        case 'partial':
          pushPartialThrottled(msg.text);
          options.onPartial?.(msg);
          break;

        case 'final': {
          clearPartial();
          // 세션 상대 타임스탬프 + 세션 베이스(재연결 시 직전 발화 끝) = 이번 녹음 기준 연속 시간
          const base = sessionBaseSecRef.current;
          const startSec = msg.start_seconds != null ? msg.start_seconds + base : null;
          const endSec = msg.end_seconds != null ? msg.end_seconds + base : startSec;
          if (endSec != null) {
            lastEndSecRef.current = Math.max(lastEndSecRef.current, endSec);
          }
          setUtterances((prev) => [
            ...prev,
            {
              text: msg.text,
              startSeconds: startSec,
              endSeconds: endSec,
              isFinal: true,
            },
          ]);
          options.onFinal?.(msg);
          break;
        }

        case 'finished':
          // stopRecording()의 await를 해제 — DB 레코드 생성 완료 시점
          if (finishResolverRef.current) {
            finishResolverRef.current({
              audioPath: msg.audio_storage_path,
              totalDuration: msg.total_duration,
            });
            finishResolverRef.current = null;
          }
          options.onFinished?.(msg.audio_storage_path, msg.total_duration);
          break;

        case 'error':
          console.error('[StreamingMode] Server error:', msg.code, msg.message);
          if (msg.code === 'mode_unavailable') {
            options.onFallbackToChunk?.();
          }
          break;

        case 'paused':
        case 'resumed':
          break;
      }
    },
    [options, pushPartialThrottled, clearPartial],
  );

  const handleDisconnect = useCallback(
    (_code: number, _reason: string) => {
      // 정지/종료로 인한 정상 끊김이면 폴백하지 않음 (스낵바·모드 전환 방지).
      if (closingRef.current) {
        closingRef.current = false;
        return;
      }
      options.onFallbackToChunk?.();
    },
    [options],
  );

  const socket = useStreamingSocket({
    centerId,
    onMessage: handleMessage,
    onDisconnect: handleDisconnect,
  });

  const recorder = useStreamingRecorder({
    onAudioData: (buffer) => {
      socket.sendAudio(buffer);
    },
  });

  const startRecording = useCallback(
    async (fieldNoteId: string) => {
      fieldNoteIdRef.current = fieldNoteId;
      closingRef.current = false;
      sessionBaseSecRef.current = 0;
      lastEndSecRef.current = 0;
      setUtterances([]);
      setCurrentPartial('');

      // WebSocket 연결
      const connected = await socket.connect();
      if (!connected) {
        options.onFallbackToChunk?.();
        return false;
      }

      // 세션 시작
      socket.startSession(fieldNoteId);

      // PCM 녹음 시작
      await recorder.startRecording();
      // 화면 유지 — 긴 녹음 중 화면 꺼짐 → 백그라운드 → OS kill 방지
      activateKeepAwakeAsync(STREAMING_KEEP_AWAKE_TAG).catch(() => { /* 미지원 무시 */ });
      return true;
    },
    [socket, recorder, options],
  );

  const pauseRecording = useCallback(() => {
    recorder.pauseRecording();
    socket.pause();
  }, [recorder, socket]);

  const resumeRecording = useCallback(async () => {
    // 백그라운드 등으로 WS 가 끊긴 상태면 재연결 후 세션 재시작.
    // 서버는 기존(stale) 세션을 evict 하며 그때까지 오디오를 emergency-save 하므로
    // 백그라운드 전 녹음은 같은 field_note 에 보존되고, 새 세션이 이어진다.
    // 재연결 실패 시에만 청크 모드로 폴백.
    if (!socket.isConnected() && fieldNoteIdRef.current) {
      const reconnected = await socket.connect();
      if (!reconnected) {
        options.onFallbackToChunk?.();
        return;
      }
      // 새 세션의 AWS 타임스탬프는 0부터 — 직전까지의 발화 누적 끝을 베이스로 이어붙여
      // 라이브 타임라인이 뒤섞이지 않게 한다(백그라운드 복귀 시간 뒤섞임 수정).
      sessionBaseSecRef.current = lastEndSecRef.current;
      socket.startSession(fieldNoteIdRef.current);
    } else {
      socket.resume();
    }
    recorder.resumeRecording();
  }, [recorder, socket, options]);

  const stopRecording = useCallback(async () => {
    closingRef.current = true; // 이후 WS 끊김은 정상 종료 → 폴백 안 함
    deactivateKeepAwake(STREAMING_KEEP_AWAKE_TAG);
    recorder.stopRecording();

    // WebSocket 'finished' 메시지가 올 때까지 대기 (서버에서 WAV 저장 + DB 레코드 생성 완료)
    // 이후 RecordingHost가 POST /finish를 호출해야 파이프라인이 오디오를 찾을 수 있음
    const finishPromise = new Promise<{ audioPath: string; totalDuration: number }>(
      (resolve) => {
        finishResolverRef.current = resolve;
        // 10초 타임아웃 — 서버 응답이 없으면 그냥 진행
        setTimeout(() => {
          if (finishResolverRef.current) {
            finishResolverRef.current({ audioPath: '', totalDuration: 0 });
            finishResolverRef.current = null;
          }
        }, 10000);
      },
    );

    socket.finish();
    await finishPromise;
  }, [recorder, socket]);

  const cleanup = useCallback(() => {
    closingRef.current = true; // 정상 정리 → 끊김 폴백 안 함
    deactivateKeepAwake(STREAMING_KEEP_AWAKE_TAG);
    recorder.stopRecording();
    socket.disconnect();
    setUtterances([]);
    setCurrentPartial('');
    sessionBaseSecRef.current = 0;
    lastEndSecRef.current = 0;
    fieldNoteIdRef.current = null;
  }, [recorder, socket]);

  return {
    // 레코더 인터페이스 (RecordingHost 호환)
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cleanup,
    isRecording: recorder.isRecording,
    isPaused: recorder.isPaused,
    isSupported: recorder.isSupported,
    meteringRef: recorder.meteringRef,
    ensurePermission: recorder.ensurePermission,

    // 스트리밍 전용
    utterances,
    currentPartial,
  };
}
