# 로샤 검사 — 그리기 ↔ 오디오 타임스탬프 정합 계획

> 상위 문서: [RORSCHACH_PLAN.md](./RORSCHACH_PLAN.md) Phase 5 의 첫 단계
> 범위: **시연용 최소 구현** — 그리기 시각이 오디오 시각과 정확히 일치하도록 클라이언트 시계만 정비

---

## 1. 목표 & 비목표

### 목표
- region 의 `audio_timestamp_start_sec / end_sec` 가 오디오 파일 내부 시각과 정확히 일치 (ms 정밀도)
- 이를 통해 채점 화면에서 **전사된 STT 발화 ↔ 그려진 영역**이 시간 축 기준으로 매핑됨

### 비목표 (이번 작업에서 제외)
- 오디오 파일 서버 업로드 / 저장
- 백엔드 작업 일체
- 음성 전사 / 화자분리 / AI 호출 — *다른 팀원 담당*
- chunk 백업 / 페이지 새로고침 복구
- 일시정지·재개 시나리오의 엄격한 처리

---

## 2. 핵심 원칙 — 단일 시계

### 문제
지금 [recording.svelte.ts](../apps/web/src/lib/features/examination/rorschach/hooks/recording.svelte.ts)는 `setInterval` 1초 카운터. 두 가지 한계:
- 1초 단위 → 짧은 그리기 동작이 같은 초로 박힘 (정합 X)
- `mediaRecorder.start()` 호출 ↔ 첫 샘플 캡처 사이 수십 ms 지연 — 이걸 못 잡음

채점 화면에서 STT segment가 "12.34초 ~ 14.10초에 발화" 라고 줘도, region 이 "12초"로만 박혀있으면 시연용으로도 매핑이 어긋나 보임.

### 해결
**`MediaRecorder`의 `'start'` 이벤트가 발화한 순간을 t=0으로 고정.** 이 이벤트는 첫 샘플이 캡처된 시점에 발화하므로, 이걸 기준으로 잡으면 그리기 timestamp가 자동으로 녹음 파일 내부 시각과 동일 좌표계가 됨.

```ts
let recordStartedAt = 0  // performance.now() at 'start' event

mediaRecorder.addEventListener('start', () => {
  recordStartedAt = performance.now()
})

function currentAudioSec(): number {
  return (performance.now() - recordStartedAt) / 1000
}
```

> **주의:** `mediaRecorder.start()` *호출 시점*을 t=0으로 잡으면 안 됨 — 첫 샘플 캡처는 그 뒤 수십 ms 지연됨. 반드시 `'start'` 이벤트 핸들러에서 시각을 박을 것.

---

## 3. 작업 항목

### 3.1 `hooks/recording.svelte.ts` 교체
- mock 타이머 제거
- `getUserMedia({ audio: true })` + `MediaRecorder` 사용
- 권한 거부 / 마이크 없음 분기 (시연 환경이라도 에러 토스트는 필요)
- 출력 인터페이스 (호출부 수정 최소화):
  - `isRecording: boolean`
  - `seconds: number` ← 기존 호환 (UI 타이머 표시용 — 1초 단위 derived OK)
  - `currentAudioSec(): number` ← **신규** (ms 정밀도, 그리기 timestamp용)
  - `start() / stop() / toggle() / dispose()`
- 포맷: 브라우저 기본 (`audio/webm; codecs=opus` 예상). 이번 단계에선 Blob 활용 X — 단지 `MediaRecorder`를 시계로 사용

### 3.2 그리기 timestamp 호출부 수정
- [examinations/[id]/rorschach/+page.svelte:193](../apps/web/src/routes/(protected)/examinations/[id]/rorschach/+page.svelte#L193) `handleStartDrawing`:
  - `drawStartSec = recording.seconds` → `recording.currentAudioSec()`
- [examinations/[id]/rorschach/+page.svelte:197](../apps/web/src/routes/(protected)/examinations/[id]/rorschach/+page.svelte#L197) `handleDrawEnd`:
  - `endSec = recording.seconds` → `recording.currentAudioSec()`
- `drawStartSec`의 타입은 이미 `number` 이고, DB 컬럼도 `Float` 이라 스키마 변경 불필요 ([models.py:64-65](../apps/api/app/modules/examination/rorschach/models.py#L64-L65))

---

## 4. 시연 시나리오 체크리스트

- [ ] 마이크 권한 허용 → 녹음 시작 → 빨간 펄스
- [ ] 카드 1번에서 영역을 빠르게(1초 미만) 그려도 region 의 start/end 가 서로 다른 ms 값으로 박힘
- [ ] 카드 여러 장 진행 → 각 region 의 timestamp가 단조 증가
- [ ] 채점 화면에서 STT segment 와 region timestamp 가 같은 좌표계로 정렬됨 (다른 팀원 전사 작업 후 통합 검증)

---

## 5. 후속 TODO (이번 작업 범위 외)

시연 후 정식 구현 시 다뤄야 할 것들:

- [ ] **오디오 파일 업로드 & 저장** — `POST .../rorschach/audio` 멀티파트, 로컬 디스크 → 추후 S3/MinIO. 파일 해시(SHA-256) 동시 저장 (SaMD 데이터 무결성)
- [ ] **인증된 audio 서빙** — 권한 체크 거치는 스트리밍 엔드포인트
- [ ] **chunk 단위 백업** — `MediaRecorder.start(timeslice)` 로 5~10초 chunk 를 IndexedDB 에 저장. 페이지 크래시/새로고침 시 복구. (현장 임상에서 검사 도중 사고 = 데이터 손실 = SaMD 무결성 위반 소지)
- [ ] **일시정지 중 그리기 차단** — `handleStartDrawing` 에 `if (!recording.isRecording) return` 가드. 정지 중 그리면 timestamp 의미 없어짐
- [ ] **포맷 호환성 검증** — Safari / Firefox 에서 webm/opus 지원 확인. 필요 시 fallback (audio/mp4)
- [ ] **권한 거부 UX** — 마이크 거부 시 안내 + 재요청 흐름
- [ ] **녹음 시간 상한** — 메모리 보호 (예: 2시간 초과 시 강제 분할/종료)
- [ ] **AI 전사 결과 ↔ region 매핑 시각화** — [WaveformDisplay.svelte](../apps/web/src/lib/features/examination/rorschach/components/coding/WaveformDisplay.svelte) 에 region 의 `start~end` 색띠 오버레이 → 임상가가 시각적으로 정합 검증
- [ ] **타이밍 정합 자동 검증 (V&V)** — 알려진 길이의 테스트 오디오 + 정해진 타이밍에 그리기 시뮬레이션 → timestamp 오차 측정 테스트
- [ ] **AI팀 합의 명문화** — "우리 오디오 0초 = transcript segment 0초" 동일 좌표계 보장
- [ ] **local storage 백엔드의 audio URL 지원** — 현재 `GetAudioUrlService` 는 S3 의 `get_presigned_url` 만 호출. 로컬 디스크 백엔드면 `InvalidOperationException` 발생. 별도 정적 서빙 엔드포인트 (Range 헤더 지원) 또는 `StorageBackend` Protocol 에 `get_url(path)` 추가하여 통일된 추상화 마련
- [ ] **audio Range streaming 백엔드 옵션** — presigned URL 못 쓰는 환경에서는 백엔드가 Range 헤더 지원하는 partial response 로 스트리밍 (audio seek 즉시 반응)

# 음성 전사 API

`multipart/form-data`, Bearer 인증, 파일 25MB 이하 (`mp3/mp4/m4a/wav/webm`).

---

## POST `/api/v1/institutions/{institution_id}/transcription/whisper`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `audio` | File | :white_check_mark: | 오디오 |
| `language` | string | | ISO 639-1 (예: `ko`) |
| `prompt` | string | | 컨텍스트 (224 토큰) |

```json
{ "text": "string", "language": "string|null", "duration_sec": "number|null" }
```

---

## POST `/api/v1/institutions/{institution_id}/transcription/diarize`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `audio` | File | :white_check_mark: | 오디오 |
| `language` | string | | ISO 639-1 |
| `speaker_names[]` | string[] | | 화자 라벨 (최대 4명) |
| `speaker_audios[]` | File[] | | 참조 오디오 2~10초 (인덱스 매칭) |
| `speaker_mime` | string | | 기본 `audio/wav` |

```json
{
  "text": "string",
  "duration_sec": "number|null",
  "segments": [
    { "speaker": "string", "start": "number", "end": "number", "text": "string" }
  ]
}
```[오후 2:00]올렸습니다ㅏ