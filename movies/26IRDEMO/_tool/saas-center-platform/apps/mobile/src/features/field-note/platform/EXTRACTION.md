# 필드노트 별도 앱 추출 플레이북

필드노트를 **별도의 네이티브 앱**(`apps/fieldnoteapp` 등)으로 분리하기 위한 준비 상태와 남은 작업, 절차를 정리한다.

- **결정된 아키텍처**: 필드노트 앱 + 메인(상담사) 앱 **공존**, 백엔드 `apps/api` **공유**. 상담일지·검사 소견은 API로 필드노트 데이터를 계속 소비한다(§5 역방향 의존 참고).
- **목표 형태**: 코어(`src/features/field-note/**`)는 결국 `packages/field-note` 워크스페이스 패키지가 되어 두 앱이 함께 consume. 이 문서는 그 이전 단계로 **경계(seam)를 in-place로 정리**한 상태를 기록한다.

---

## 1. 플랫폼 포트 (완료)

필드노트 코어는 바깥 세계(`@/features/*`, `@/shared/*`)를 **직접 import하지 않고** 단일 포트를 통해 주입받는다.

```
코어 68파일 ──> useFieldNotePlatform() ──> platform/mainApp.tsx ──> @/features/*, @/shared/*
                (포트 계약)                  (교체 대상 단 1파일)
```

| 파일 | 역할 |
|------|------|
| `platform/types.ts` | `FieldNotePlatform` 인터페이스(포트 계약). 어떤 앱 모듈도 import 안 함 — 자립. |
| `platform/context.tsx` | React context — `FieldNotePlatformProvider` / `useFieldNotePlatform()` |
| `platform/mainApp.tsx` | **메인 앱 어댑터.** 바깥 결합을 여기 한 곳에 집약. **추출 시 이 파일만 교체.** |

**Provider 마운트**: `app/(main)/_layout.tsx` 가 `<MainAppFieldNotePlatformProvider>` 로 Stack·RecordingHost·ProcessingHost·FieldNoteFab 를 감싼다.

### 포트로 이미 뺀 결합 (완료 — 코어는 아래를 포트로만 접근)

| 포트 멤버 | 대체한 직접 결합 | 소비 파일 |
|-----------|-----------------|-----------|
| `centerId` | `useCenterStore` (7곳) | useSTTConfig · ProcessingHost · useStreamingMode · useFieldNoteOrchestrator · CompletedScreen · FieldNoteListContent · RecordTargetSheet |
| `config.{getApiBaseUrl,getApiPrefix,getAccessToken}` | `API_BASE_URL`·`API_PREFIX`·`TokenStorage` | useStreamingSocket (WS URL 조립) |
| `notify` | `useToastStore().show` | ProcessingHost · RecordingHost · CompletedScreen · RecordingSheet(AiGuideMorph) |
| `ToastHost` | `GlobalToastHost` (elevated 렌더) | RecordingSheet |
| `navigate.*` | 하드코딩 `/(main)/...` push | ProcessingHost · CompletedScreen · FieldNoteFab · DraggableFab · FieldNoteListContent |
| `theme.ts` `DK` | `COLORS.fieldnoteDark` | (자립화 — 리터럴 소유) |

---

## 2. 남은 결합 (추출 시 처리 — 실기기 QA 필요)

아직 코어가 직접 import하는 것들. **런타임 hook 규칙/react-query 때문에 실기기 검증이 필요**해 이번 준비 단계에서는 손대지 않았다. 각 소비 파일에 `TODO(extraction)` 주석을 달아둠.

### 2-1. 스케줄 데이터 훅 (`@/features/schedule`) — 최우선 잔여

| 파일 | 쓰는 것 |
|------|---------|
| `useFieldNoteOrchestrator.ts` | `useScheduleDetail`, `SCHEDULE_TYPE_LABELS` |
| `RecordingHost.tsx` | `useScheduleList` |
| `components/RecordTargetSheet.tsx` | `useScheduleList` |
| `components/LinkScheduleSheet.tsx` | (schedule 훅) |
| `components/CompletedScreen.tsx` | `openScheduleDetail`, `useScheduleDetail` |

- **처리 방향**: 포트에 스케줄 데이터 provider를 추가(훅을 context로 주입하거나, 필드노트 전용 얇은 API 재구현). 훅 주입은 rules-of-hooks(무조건 호출) 준수 필요 → 실기기 확인 필수.
- **또는**: 별도 앱에 schedule 도메인이 없다면, 필드노트가 쓰는 스케줄 조회를 `apps/api` 엔드포인트로 직접 재구현.

### 2-2. REST apiClient (`@/shared/api/client`)

- `api.ts` 의 13개 함수 + `useSTTConfig.ts` 가 axios 싱글턴 `apiClient` 를 직접 import.
- **처리 방향**: 포트 `config` 에 `apiClient`(또는 `request()` 함수)를 추가해 주입. 새 앱은 자체 `client.ts`(interceptor·리프레시 큐)를 만들어 어댑터에서 주입.
- REST 는 interceptor 가 토큰을 자동 주입하므로 WS(§1 완료)만큼 급하지 않음.

### 2-3. 알림 미읽음 카운트 (`@/features/notification`)

- `FieldNoteListContent.tsx` 의 `useUnreadCount(centerId)` (헤더 벨 뱃지).
- **처리 방향**: 포트에 옵셔널 hook/값으로 주입, 또는 별도 앱에 알림이 없으면 벨 자체를 제거.

---

## 3. 네이티브 모듈 / app.config (새 앱에 이식 필수)

| 모듈 | 용도 |
|------|------|
| `react-native-live-audio-stream` | 스트리밍 STT PCM (런타임 optional 로딩, prebuild 필요) |
| `expo-av` | 청크 녹음/재생, 오디오 권한, `setAudioModeAsync` |
| `expo-keep-awake` | 녹음 중 화면 유지 |
| `expo-navigation-bar` | 안드로이드 다크 내비바 |
| `react-native-reanimated` · `react-native-svg` · `@shopify/react-native-skia` · `expo-blur` · `expo-linear-gradient` · `expo-constants` · `react-native-keyboard-controller` · `react-native-safe-area-context` | 파형·모션·시트 UI |

**app.config.ts 이식**:
- iOS `UIBackgroundModes: ['audio']` (백그라운드 오디오) — **필수**.
- `plugins/withNavBarNoContrast` (안드로이드 다크 내비바 대비 제거).
- **매니페스트 권한 재확인**: `RECORD_AUDIO` / `FOREGROUND_SERVICE` 가 expo-av/live-audio-stream plugin 자동 주입인지 `android/` 네이티브에 있는지 확인 후 새 앱에 반영.

---

## 4. 백엔드 계약 (공유 유지 — 새 앱도 같은 `apps/api` 호출)

베이스 `/api/v1/centers/{centerId}/field-notes`.

**REST**: `POST /` · `GET /` · `GET /{id}` · `GET /by-schedule/{scheduleId}` · `GET /by-task/{taskId}` · `GET /statuses` · `GET /unlinked` · `GET /linkable-tasks` · `GET /config` · `POST /{id}/entries` · `POST /{id}/audio` · `PATCH /{id}/finish` · `POST /{id}/retry-pipeline` · `POST /{id}/run-pipeline` · `POST /{id}/generate-summary` · `POST /{id}/diarize` · `POST /{id}/generate-counseling-note` · `POST /{id}/recommend` · `PATCH /{id}/link-schedule` · `PATCH /{id}/link-task` · `PATCH /{id}/speaker-map` · `GET /{id}/audio/{audioId}/download-url` · `DELETE /{id}`

**WebSocket**: `{wsBase}/api/v1/centers/{centerId}/field-notes/stream?token={accessToken}` (base = `API_BASE_URL` 의 `http→ws`, 토큰 쿼리스트링 인증).

> `by-task`·`link-task`·`linkable-tasks`·`generate-counseling-note`·`by-schedule` 는 assessment·counseling·schedule 도메인과 계약이 얽혀 있음 → 별도 앱이어도 이 백엔드 도메인들과 런타임 통합 유지.

---

## 5. 역방향 의존 (추출 시 메인 앱에서 끊기는 지점)

필드노트를 코어째 빼면, **메인 앱**의 아래 소비처가 필드노트 데이터를 못 받는다. "공유" 아키텍처이므로 이들은 API/공유 패키지로 필드노트 데이터를 계속 받아야 한다.

| 소비처(메인 앱) | 쓰는 필드노트 심볼 |
|-----------------|-------------------|
| `features/assessment/AssessmentOpinionSheet.tsx` | `useFieldNotesByTask`, `useFieldNote`, `FieldNoteAnalysis` |
| `features/counseling/note/components/CounselingNoteSheet.tsx` | `useFieldNoteBySchedule`, `generateCounselingNote` |
| `app/(main)/assessment/task.tsx` | `useFieldNotesByTask`, `useFieldNote`, `useUnlinkedFieldNotes`, `FieldNoteResponse` |
| `app/(main)/counseling/notes.tsx` | `useFieldNote`, `useCounselingNoteGenerationComplete` |
| `app/(main)/(tabs)/index.tsx` | `useUnlinkedFieldNotes` (미연결 뱃지) |
| `shared/components/SystemNavBarScrim.tsx` | `useFieldNoteNavBar`(subscribeDarkNav) — 양방향 결합 |

→ 코어가 `packages/field-note` 가 되면 메인 앱은 그 패키지의 훅을, 필드노트 앱은 자체 UI를 각각 consume(둘 다 같은 백엔드). `SystemNavBarScrim` 결합은 별도 앱에선 앱 전체가 다크라 불필요 → 제거 대상.

---

## 6. 추출 절차 (요약)

1. `packages/field-note` 워크스페이스 생성, `src/features/field-note/**` 이동(코어·platform 포함, `mainApp.tsx` 제외).
2. §2 잔여 결합을 포트로 마저 이관(스케줄·REST apiClient·알림) — **실기기 QA**.
3. 새 Expo 앱 `apps/fieldnoteapp` 스캐폴드 + §3 네이티브 모듈·app.config 이식.
4. 새 앱용 어댑터(`mainApp.tsx` 대체)를 작성 — centerId(자체 auth/center 컨텍스트)·config(자체 client.ts)·navigate(새 라우트)·notify/ToastHost(자체 토스트) 주입.
5. 메인 앱은 `packages/field-note` 의 훅을 §5 소비처에 연결(데이터 공유 유지), `SystemNavBarScrim` 결합 제거.
6. 새 앱 루트에 어댑터 Provider + RecordingHost/ProcessingHost 마운트, 자체 라우트에 필드노트 화면 연결.

---

## 유지 규칙 (경계 동결)

- 필드노트 코어는 `@/features/*`·`@/shared/*` 를 **직접 import하지 않는다.** 새 결합이 필요하면 **포트(`platform/types.ts`)에 추가**하고 `mainApp.tsx` 에서 구현한다.
- 예외(아직 미이관): §2 의 스케줄·REST apiClient·알림. 새로 늘리지 말 것.
- 경계 확인(수동): `grep -rn -e "@/features/" -e "@/shared/" src/features/field-note` → 결과가 포트/§2 잔여/`@/shared/utils`(scale·date 등 순수 유틸)·`@/shared/components/ui`(공용 UI) 범위인지 점검.
