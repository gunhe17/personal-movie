# 필드노트 STT 듀얼 모드 — 개발자 인수인계 문서

> 작성일: 2026-06-02
> 상태: 개발 완료, QA 전 단계

---

## 1. 개요

필드노트 녹음의 STT(Speech-to-Text) 시스템이 **듀얼 모드**로 확장되었다.
서버 환경변수 하나로 모드를 전환하며, 모바일 앱 업데이트 없이 운영 중 전환 가능.

| 모드 | 코드명 | 방식 | 지연 | 비용(30분) |
|------|--------|------|------|-----------|
| 기존 | `whisper_chunk` | 4초 M4A chunk HTTP 업로드 + Whisper STT + 1.5초 폴링 | 6~10초 | $0.36 |
| 신규 | `aws_streaming` | 연속 PCM WebSocket + AWS Transcribe Streaming | 0.5~2초 | $0.90 |

**해결한 문제**: 4초마다 stop/start로 발생하던 오디오 갭(찝힘) 현상 제거, 실시간 전사 표시.

---

## 2. 아키텍처

```
[서버 설정: STT_STREAMING_PROVIDER]
         │
    ┌────┴────┐
    │         │
whisper_chunk  aws_streaming
    │              │
 기존 그대로     WebSocket + PCM
    │              │
    └────┬────┘
         │
   녹음 종료 시
         │
  기존 파이프라인 (Whisper diarize → refine → summarize)
```

### 모드 결정 흐름

1. 모바일: `GET /field-notes/config` → `{ stt_mode: "whisper_chunk" | "aws_streaming" }`
2. `stt_mode`에 따라 chunk 레코더 또는 streaming 레코더 사용
3. streaming 모드에서 WebSocket 실패 시 → chunk 모드로 자동 fallback

---

## 3. 파일 인벤토리

### 3.1 Backend — 신규 파일

| 파일 | 역할 |
|------|------|
| `apps/api/app/infrastructure/stt/streaming_protocol.py` | `StreamingSTTProvider`, `StreamingSTTSession` Protocol + `STTResponse` dataclass |
| `apps/api/app/infrastructure/stt/aws_transcribe_client.py` | AWS Transcribe Streaming SDK 구현체 |
| `apps/api/app/infrastructure/stt/streaming_factory.py` | Provider factory — 설정에 따라 provider 생성 또는 None 반환 |
| `apps/api/app/modules/field_note/streaming/__init__.py` | 패키지 init |
| `apps/api/app/modules/field_note/streaming/session.py` | `StreamingRecordingSession` — PCM 버퍼 관리, WAV 변환, S3 업로드 |
| `apps/api/app/modules/field_note/streaming/ws_handler.py` | WebSocket 엔드포인트 — 인증, 세션 관리, 응답 pump |
| `apps/api/app/modules/field_note/streaming/wav_writer.py` | PCM → WAV 변환 유틸 |

### 3.2 Backend — 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `apps/api/app/core/config.py` | `STT_STREAMING_PROVIDER` 설정 추가 |
| `apps/api/app/modules/field_note/field_note/router.py` | `/config` API + WebSocket 라우트 마운트 |
| `apps/api/app/modules/field_note/router.py` | streaming router include |
| `apps/api/app/modules/llm/credit/plan_config.py` | `FIELD_NOTE_STT_STREAMING` AIPurpose 추가 |

### 3.3 Mobile — 신규 파일

| 파일 | 역할 |
|------|------|
| `src/features/field-note/useSTTConfig.ts` | `GET /field-notes/config` 조회 훅 (staleTime: Infinity) |
| `src/features/field-note/useStreamingSocket.ts` | WebSocket 연결/전송/제어 훅 |
| `src/features/field-note/useStreamingRecorder.ts` | `react-native-live-audio-stream` PCM 녹음 훅 |
| `src/features/field-note/useStreamingMode.ts` | 레코더 + 소켓 통합 훅 (RecordingHost와 동일 인터페이스) |

### 3.4 Mobile — 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/features/field-note/RecordingHost.tsx` | 듀얼 모드 분기, fallback 로직 |
| `src/features/field-note/constants.ts` | `AUDIO_STREAM_INTERVAL_MS`, `WS_MAX_RECONNECT_ATTEMPTS` 추가 |
| `src/features/field-note/types.ts` | `STTMode`, `StreamingServerMessage` 등 타입 추가 |
| `src/features/field-note/useRecordingTimeline.ts` | streaming utterance 기반 타임라인 지원 |
| `src/features/field-note/components/LiveTranscriptSheet.tsx` | partial 텍스트 표시 |
| `src/features/field-note/components/StreamingText.tsx` | streaming/chunk 키 분기 |

---

## 4. WebSocket 프로토콜

### Client → Server

```
Binary frames: raw PCM 16kHz mono 16bit (연속 전송, ~100ms 간격)

JSON: { "type": "start", "field_note_id": "uuid", "sample_rate": 16000 }
JSON: { "type": "pause" }
JSON: { "type": "resume" }
JSON: { "type": "finish" }
```

### Server → Client

```json
{ "type": "session_started", "session_id": "uuid" }
{ "type": "partial", "text": "안녕하세...", "stability": 0.8, "timestamp_seconds": 12.5 }
{ "type": "final", "text": "안녕하세요.", "start_seconds": 10.0, "end_seconds": 14.2 }
{ "type": "paused" }
{ "type": "resumed" }
{ "type": "finished", "audio_storage_path": "s3://...", "total_duration": 300.0 }
{ "type": "error", "code": "mode_unavailable|session_exists|...", "message": "..." }
```

### 종료 시퀀스 (중요)

```
Mobile                          Server
  │                               │
  ├─ recorder.stop()              │
  ├─ socket.finish() ───────────► │ PCM flush → WAV 변환 → S3 저장
  │                               │ FieldNoteAudio DB 레코드 생성
  │  ◄────── "finished" ─────────┤
  │  (Promise resolve)            │
  ├─ HTTP PATCH /finish ─────────► │ 파이프라인 트리거
  │                               │
```

`stopRecording()`은 WebSocket `finished` 메시지를 **await** 한다 (10초 타임아웃).
이 순서가 깨지면 파이프라인이 "No audio chunks found" 에러를 발생시킨다.

---

## 5. 환경 설정

### 서버 환경변수

```bash
# 기본값 (기존 방식, 변경 불필요)
STT_STREAMING_PROVIDER=whisper_chunk

# AWS Transcribe 스트리밍 활성화
STT_STREAMING_PROVIDER=aws_transcribe

# AWS 키는 기존 S3용 키 재사용 (IAM에 Transcribe 권한 추가 필요)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-northeast-2
```

### IAM 권한 추가

기존 S3용 IAM 사용자에 아래 권한 추가:

```json
{
  "Effect": "Allow",
  "Action": "transcribe:StartStreamTranscription",
  "Resource": "*"
}
```

### 모바일 네이티브 빌드

`react-native-live-audio-stream`은 네이티브 모듈이므로 Expo Go에서 동작하지 않음.

```bash
# 네이티브 프로젝트 생성 (최초 1회 또는 native 설정 변경 시)
npx expo prebuild --clean

# iOS 실기기 빌드
npx expo run:ios --device
# 또는 Xcode에서 직접 빌드 (signing 설정 필요)

# Android
npx expo run:android
```

---

## 6. 코드 핵심 포인트

### 6.1 RecordingHost 모드 분기 (`RecordingHost.tsx`)

```typescript
// 서버 설정으로 모드 결정
const { data: sttConfig } = useSTTConfig();
const serverSTTMode: STTMode = sttConfig?.stt_mode ?? 'whisper_chunk';

// streaming 훅은 항상 마운트 (훅 규칙), 사용 여부만 분기
const streaming = useStreamingMode({ onFallbackToChunk: ... });

// 녹음 중이 아닐 때만 모드 동기화
useEffect(() => {
  if (!recorder.isRecording && !streaming.isRecording) {
    setActiveSTTMode(serverSTTMode);
  }
}, [serverSTTMode, ...]);

// 실제 상태는 모드에 따라 분기
const effectiveIsRecording = isStreaming ? streaming.isRecording : recorder.isRecording;
```

### 6.2 Fallback 메커니즘

WebSocket 연결 실패 또는 끊김 시 chunk 모드로 자동 전환:

```typescript
// useStreamingMode의 onFallbackToChunk 콜백
const streaming = useStreamingMode({
  onFallbackToChunk: () => {
    setActiveSTTMode('whisper_chunk');
    showToast({ type: 'info', message: '실시간 전사를 사용할 수 없어 기본 모드로 전환했어요' });
  },
});
```

### 6.3 LiveAudioStream optional dependency

`react-native-live-audio-stream`이 미설치된 환경에서도 앱이 정상 동작:

```typescript
// useStreamingRecorder.ts
let LiveAudioStream: any = null;
try {
  LiveAudioStream = require('react-native-live-audio-stream').default;
} catch {
  // 미설치 — chunk 모드 fallback
}

// isSupported: false → streaming 모드 사용 불가 → chunk fallback
```

### 6.4 세션 메모리 관리 (`session.py`)

장시간 녹음 시 PCM 버퍼 메모리 관리:
- 1시간 녹음 = ~115MB PCM
- 10분마다 S3로 flush (중간 저장)
- 비정상 종료 시 `emergency_save()` 호출

---

## 7. 테스트 체크리스트

### Regression (whisper_chunk 모드)

- [ ] `STT_STREAMING_PROVIDER=whisper_chunk`에서 기존 녹음 플로우 100% 동일 동작
- [ ] 4초 chunk 업로드 + 폴링 전사 정상
- [ ] 녹음 종료 → 파이프라인(diarize/refine/summarize) 정상 트리거

### Streaming (aws_streaming 모드)

- [ ] WebSocket 연결 성공 + `session_started` 수신
- [ ] 실시간 partial 텍스트 0.5~2초 내 표시
- [ ] final 텍스트 타임라인 정확성
- [ ] pause/resume 정상 동작
- [ ] 녹음 종료 → `finished` 메시지 수신 → PATCH /finish → 파이프라인 정상
- [ ] 30분+ 녹음 안정성 (메모리, JWT 토큰)

### Fallback

- [ ] `STT_STREAMING_PROVIDER=whisper_chunk`일 때 WebSocket 접근 시 `mode_unavailable` 에러 → chunk fallback
- [ ] 녹음 중 WebSocket 끊김 → chunk 모드 전환 + 사용자 토스트 알림
- [ ] `react-native-live-audio-stream` 미설치 환경에서 앱 정상 동작 (chunk 모드)

### 운영 전환

- [ ] `whisper_chunk` → `aws_streaming` 전환 시 기존 녹음 데이터 영향 없음
- [ ] `aws_streaming` → `whisper_chunk` 롤백 시 즉시 원복

---

## 8. 알려진 제한 사항

| 항목 | 상태 | 설명 |
|------|------|------|
| streaming 중 HTTP 폴링 | 미최적화 | `useFieldNote`의 `refetchInterval`이 streaming 모드에서도 동작. 불필요한 네트워크 호출 |
| JWT 토큰 만료 | 미처리 | 30분+ 녹음 시 WebSocket 연결에 사용한 토큰 만료 가능. 토큰 리프레시 메커니즘 필요 |
| 이어하기(resume) | chunk 전용 | 기존 녹음에 이어서 추가 녹음은 chunk 모드로만 진행 |
| iOS 백그라운드 | 기존 설정 재활용 | `UIBackgroundModes: audio` 필요 (expo-av 설정 그대로) |
| Expo Go | 미지원 | 네이티브 모듈 필요 → 커스텀 dev client 빌드 필수 |

---

## 9. 향후 개선 과제

1. **streaming 중 폴링 제거**: `isStreaming` 상태일 때 `useFieldNote`의 `refetchInterval` 비활성화
2. **JWT 리프레시**: WebSocket 연결 중 토큰 만료 대응 (재연결 + 새 토큰)
3. **다른 STT Provider 확장**: `StreamingSTTProvider` Protocol 구현체 추가로 Deepgram, Google 등 교체 가능
4. **streaming 이어하기**: 기존 녹음에 streaming 모드로 추가 녹음 지원
5. **비용 최적화**: VAD(Voice Activity Detection)로 무음 구간 전송 스킵

---

## 10. 로컬 테스트 방법

### WebSocket 수동 테스트

```bash
# websocat 설치
brew install websocat

# 토큰 획득 (로그인 API)
TOKEN=$(curl -s -X POST http://localhost:3502/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}' | jq -r '.access_token')

# WebSocket 연결
websocat "ws://localhost:3502/api/v1/centers/{CENTER_ID}/field-notes/stream?token=$TOKEN"

# JSON 메시지 전송
{"type":"start","field_note_id":"uuid","sample_rate":16000}
```

### PCM 음성 파일 생성 (macOS)

```bash
# TTS로 음성 생성
say -v Yuna "안녕하세요. 오늘 상담 내용을 기록하겠습니다." -o test.aiff

# PCM 16kHz mono 변환
ffmpeg -i test.aiff -ar 16000 -ac 1 -f s16le -acodec pcm_s16le test.pcm
```
