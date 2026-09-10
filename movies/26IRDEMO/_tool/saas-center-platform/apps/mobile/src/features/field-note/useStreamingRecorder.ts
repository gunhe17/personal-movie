/**
 * 스트리밍 레코더 훅 — 연속 PCM 녹음 + WebSocket 전송
 *
 * expo-av 대신 react-native-live-audio-stream 사용:
 * - 연속 PCM 16kHz mono 스트림 (stop/start 없이 gap 없는 녹음)
 * - ~100ms 간격으로 onAudioData 콜백 발생
 * - RMS 기반 metering (웨이브폼 시각화용)
 *
 * 주의: react-native-live-audio-stream은 네이티브 모듈이므로 expo prebuild 필요.
 *       아직 패키지가 설치되지 않은 경우 useRecorder(chunk 모드)로 fallback.
 */
import { useRef, useState, useCallback } from 'react';
import { Platform, NativeModules } from 'react-native';
import { Audio } from 'expo-av';
import { AUDIO_STREAM_INTERVAL_MS } from './constants';

/** PCM 오디오 데이터 콜백 */
type AudioDataHandler = (buffer: ArrayBuffer) => void;

interface UseStreamingRecorderOptions {
  onAudioData: AudioDataHandler;
  sampleRate?: number;
}

// react-native-live-audio-stream는 optional dependency.
// 두 가지 경우 모두 null → chunk 모드 fallback:
//   1) 패키지 미설치 (require throw)
//   2) 패키지는 있으나 네이티브 모듈 RNLiveAudioStream 이 런타임에 미등록.
//      New Architecture(bridgeless)에서는 마이그레이션 안 된 레거시 모듈이
//      NativeModules 에서 null 로 노출됨 → require 는 성공하지만 .init 호출 시
//      "cannot read property 'init' of null" 크래시. JS require 성공만으로
//      isSupported 를 판단하면 안 되고, 네이티브 모듈 존재까지 확인해야 한다.
let LiveAudioStream: any = null;
try {
  if (NativeModules.RNLiveAudioStream) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    LiveAudioStream = require('react-native-live-audio-stream').default;
  }
} catch {
  // react-native-live-audio-stream 미설치/미등록 — chunk 모드 fallback
}

/**
 * PCM 바이트 배열에서 RMS(Root Mean Square) 계산 → dB 변환
 * metering 값으로 사용 (-160 ~ 0 범위, expo-av 호환)
 */
function calculateRMS(buffer: ArrayBuffer): number {
  const view = new Int16Array(buffer);
  if (view.length === 0) return -160;

  let sum = 0;
  for (let i = 0; i < view.length; i++) {
    const normalized = view[i] / 32768;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / view.length);
  // RMS → dB (expo-av 호환 범위)
  if (rms <= 0) return -160;
  return Math.max(-160, 20 * Math.log10(rms));
}

export function useStreamingRecorder({
  onAudioData,
  sampleRate = 16000,
}: UseStreamingRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const meteringRef = useRef(-160);
  const isStreamingAvailable = LiveAudioStream !== null;

  const ensurePermission = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain: status !== 'denied',
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!LiveAudioStream) return;

    LiveAudioStream.init({
      sampleRate,
      channels: 1,
      bitsPerSample: 16,
      audioSource: Platform.OS === 'android' ? 6 : undefined, // VOICE_RECOGNITION
      bufferSize: Math.floor(sampleRate * (AUDIO_STREAM_INTERVAL_MS / 1000) * 2),
    });

    LiveAudioStream.on('data', (base64: string) => {
      // base64 → ArrayBuffer
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = bytes.buffer;

      // metering 업데이트
      meteringRef.current = calculateRMS(buffer);

      // 콜백으로 전달
      onAudioData(buffer);
    });

    LiveAudioStream.start();
    setIsRecording(true);
    setIsPaused(false);
  }, [onAudioData, sampleRate]);

  const pauseRecording = useCallback(() => {
    if (!LiveAudioStream || !isRecording) return;
    LiveAudioStream.stop();
    setIsPaused(true);
  }, [isRecording]);

  const resumeRecording = useCallback(() => {
    if (!LiveAudioStream || !isPaused) return;
    LiveAudioStream.start();
    setIsPaused(false);
  }, [isPaused]);

  const stopRecording = useCallback(() => {
    if (!LiveAudioStream) return;
    try {
      LiveAudioStream.stop();
    } catch {
      // 이미 중지됨
    }
    setIsRecording(false);
    setIsPaused(false);
    meteringRef.current = -160;
  }, []);

  return {
    ensurePermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isRecording,
    isPaused,
    isSupported: isStreamingAvailable,
    meteringRef,
  };
}
