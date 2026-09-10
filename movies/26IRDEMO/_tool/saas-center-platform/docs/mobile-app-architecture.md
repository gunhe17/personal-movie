# 전문가 모바일 앱 설계 문서

> 상담센터 SaaS 전문가(상담사/검사사)를 위한 모바일 앱 아키텍처 및 구현 가이드

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [인증 아키텍처](#4-인증-아키텍처)
5. [핵심 기능 설계](#5-핵심-기능-설계)
6. [푸시 알림](#6-푸시-알림)
7. [필드노트 (녹음/STT)](#7-필드노트-녹음stt)
8. [오프라인 지원](#8-오프라인-지원)
9. [백엔드 변경사항](#9-백엔드-변경사항)
10. [배포 및 인프라](#10-배포-및-인프라)
11. [구현 단계](#11-구현-단계)

---

## 1. 프로젝트 개요

### 목적

상담센터 전문가가 모바일 환경에서 핵심 업무를 수행할 수 있는 네이티브 앱 제공.
웹 앱의 전체 기능 이식이 아닌, **모바일에 최적화된 핵심 기능**에 집중.

### 대상 사용자

- 상담사 (Counselor)
- 검사사 (Examiner)
- 센터 관리자 (Manager)

### 핵심 기능 범위

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| **일정 확인/관리** | 오늘/주간 일정 조회, 세션 상태 변경 | P0 |
| **내담자 조회** | 내담자 목록/상세, 관계 정보 | P0 |
| **푸시 알림** | 일정 알림, 세션 변경 알림, 시스템 알림 | P0 |
| **필드노트** | 녹음, 실시간 STT, 메모 기록 | P0 |
| **상담 현황** | 상담 케이스 목록, 세션 상태 관리 | P1 |
| **검사 현황** | 검사 케이스 목록, 진행 상태 확인 | P1 |
| **센터 전환** | 다중 센터 소속 시 센터 전환 | P1 |

### 제외 범위 (웹 전용 유지)

- 검사도구 관리 (복잡한 설정 UI)
- 채점/리포트 생성 (큰 화면 필요)
- 센터 설정/직원 관리 (관리 기능)
- 결제/청구 관리

---

## 2. 기술 스택

### 모바일 앱

| 기술 | 버전 | 선정 이유 |
|------|------|-----------|
| **React Native** | 0.76+ | 크로스 플랫폼, 성숙한 생태계 |
| **Expo** | SDK 52+ | 빌드/배포 간소화, EAS Build |
| **TypeScript** | 5.7+ | 타입 안정성, 백엔드 타입 공유 |
| **Expo Router** | v4+ | 파일 기반 라우팅, Deep Link 지원 |
| **TanStack Query** | v5 | 서버 상태 관리 (웹과 동일 패턴) |
| **Zustand** | 5.0+ | 경량 클라이언트 상태 관리 |
| **React Native MMKV** | - | 고성능 로컬 스토리지 (토큰 등) |
| **Axios** | - | HTTP 클라이언트 (인터셉터 패턴 공유) |

### 오디오/STT

| 기술 | 용도 |
|------|------|
| **expo-av** | 오디오 녹음/재생 |
| **WebSocket** | 실시간 STT 스트리밍 |
| **Google Cloud STT** 또는 **Whisper API** | 음성 인식 서비스 |

### 푸시 알림

| 기술 | 용도 |
|------|------|
| **FCM (Firebase Cloud Messaging)** | Android 푸시 |
| **APNs (via FCM)** | iOS 푸시 |
| **expo-notifications** | 알림 수신/처리 통합 |

### React Native 선정 근거

```
선택지 비교:

1. React Native (Expo)  ← 선정
   + 생태계 성숙, 라이브러리 풍부
   + Expo로 빌드/배포 파이프라인 간소화
   + TanStack Query 등 웹 패턴 재사용 가능
   + 녹음/STT/푸시 라이브러리 검증됨
   - 웹(Svelte)과 코드 직접 공유 불가

2. Flutter
   + 네이티브 성능, 일관된 UI
   - Dart 학습 필요, 기존 팀 스택과 이질적

3. Capacitor + Svelte
   + 웹 코드 재사용 가능
   - 녹음/STT 등 네이티브 기능 제한적
   - 앱 성능/UX 네이티브 대비 부족
```

---

## 3. 프로젝트 구조

### 모노레포 내 위치

```
saas-center-platform/
├── apps/
│   ├── api/              # FastAPI 백엔드 (기존)
│   ├── web/              # SvelteKit 웹 (기존)
│   ├── admin/            # 관리자 웹 (기존)
│   └── mobile/           # React Native 앱 (신규)
├── packages/
│   └── shared-types/     # API 타입 공유 (선택, 추후 도입)
├── docs/
│   └── mobile-app-architecture.md  # 이 문서
└── k8s/                  # 인프라 (기존)
```

### 앱 내부 구조

```
apps/mobile/
├── app/                          # Expo Router (파일 기반 라우팅)
│   ├── _layout.tsx               # Root Layout (Auth Provider, QueryClient)
│   ├── (auth)/                   # 인증 라우트 그룹
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── center-select.tsx     # 센터 선택 화면
│   ├── (main)/                   # 메인 라우트 그룹 (인증 필요)
│   │   ├── _layout.tsx           # 탭 네비게이션
│   │   ├── (tabs)/
│   │   │   ├── home.tsx          # 대시보드 (오늘 일정)
│   │   │   ├── schedule.tsx      # 일정 캘린더
│   │   │   ├── clients.tsx       # 내담자 목록
│   │   │   └── more.tsx          # 더보기 (설정 등)
│   │   ├── schedule/
│   │   │   └── [id].tsx          # 일정 상세
│   │   ├── clients/
│   │   │   └── [id].tsx          # 내담자 상세
│   │   ├── counseling/
│   │   │   ├── index.tsx         # 상담 현황
│   │   │   └── [id].tsx          # 상담 케이스 상세
│   │   ├── assessment/
│   │   │   ├── index.tsx         # 검사 현황
│   │   │   └── [id].tsx          # 검사 케이스 상세
│   │   ├── fieldnote/
│   │   │   ├── [id].tsx          # 필드노트 상세/편집
│   │   │   └── record.tsx        # 녹음/STT 화면
│   │   └── notifications.tsx     # 알림 목록
│   └── +not-found.tsx
│
├── src/
│   ├── api/                      # API 레이어
│   │   ├── client.ts             # Axios 인스턴스 + 인터셉터
│   │   ├── auth.ts               # 인증 API
│   │   ├── schedule.ts           # 일정 API
│   │   ├── clients.ts            # 내담자 API
│   │   ├── counseling.ts         # 상담 API
│   │   ├── assessment.ts         # 검사 API
│   │   ├── fieldnote.ts          # 필드노트 API
│   │   └── notifications.ts      # 알림 API
│   │
│   ├── hooks/                    # Custom Hooks
│   │   ├── queries/              # TanStack Query 훅
│   │   │   ├── useSchedule.ts
│   │   │   ├── useClients.ts
│   │   │   ├── useCounseling.ts
│   │   │   ├── useAssessment.ts
│   │   │   ├── useFieldNote.ts
│   │   │   └── useNotifications.ts
│   │   ├── useAuth.ts            # 인증 상태 훅
│   │   ├── useCenter.ts          # 센터 컨텍스트 훅
│   │   └── usePushNotification.ts
│   │
│   ├── stores/                   # Zustand 스토어
│   │   ├── auth.store.ts         # 인증 상태
│   │   ├── center.store.ts       # 센터 선택 상태
│   │   └── recording.store.ts    # 녹음 상태 관리
│   │
│   ├── services/                 # 비즈니스 서비스
│   │   ├── auth.service.ts       # 토큰 관리, 로그인/로그아웃
│   │   ├── push.service.ts       # 푸시 토큰 등록/해제
│   │   ├── recording.service.ts  # 오디오 녹음 관리
│   │   └── stt.service.ts        # STT WebSocket 관리
│   │
│   ├── components/               # 공통 컴포넌트
│   │   ├── ui/                   # 기본 UI (Button, Card, Input 등)
│   │   ├── schedule/             # 일정 관련 컴포넌트
│   │   ├── client/               # 내담자 관련 컴포넌트
│   │   ├── fieldnote/            # 필드노트 컴포넌트
│   │   │   ├── RecordingPanel.tsx
│   │   │   ├── TranscriptView.tsx
│   │   │   ├── MemoList.tsx
│   │   │   └── VoiceTimeline.tsx
│   │   └── notification/         # 알림 컴포넌트
│   │
│   ├── types/                    # TypeScript 타입 정의
│   │   ├── api.ts                # API 응답 타입
│   │   ├── schedule.ts
│   │   ├── client.ts
│   │   ├── counseling.ts
│   │   ├── assessment.ts
│   │   ├── fieldnote.ts
│   │   └── notification.ts
│   │
│   └── utils/                    # 유틸리티
│       ├── date.ts               # 날짜/시간 변환
│       ├── format.ts             # 포맷팅 (전화번호 등)
│       ├── storage.ts            # MMKV 래퍼
│       └── constants.ts          # 상수
│
├── assets/                       # 정적 리소스
├── app.json                      # Expo 설정
├── eas.json                      # EAS Build 설정
├── tsconfig.json
└── package.json
```

### 레이어 흐름

```
Screen (app/)
  → Hook (src/hooks/)
    → API (src/api/)
      → Backend (api.mindscope.kr/api/v1/...)
```

**원칙**: Screen은 렌더링만, Hook이 데이터/상태 관리, API가 HTTP 통신 담당.

---

## 4. 인증 아키텍처

### 현재 웹 인증 vs 모바일 인증

```
[웹 현재 방식]
Browser → SvelteKit Proxy → API
         ↑ HTTP-only Cookie
         (Proxy가 Bearer 헤더로 변환)

[모바일 방식]
App → API 직접 호출
      ↑ Authorization: Bearer {token}
      (앱이 직접 토큰 관리)
```

### 토큰 저장

```typescript
// src/utils/storage.ts
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'auth-storage', encryptionKey: '...' });

export const TokenStorage = {
  getAccessToken: () => storage.getString('accessToken'),
  setAccessToken: (token: string) => storage.set('accessToken', token),
  getRefreshToken: () => storage.getString('refreshToken'),
  setRefreshToken: (token: string) => storage.set('refreshToken', token),
  clear: () => {
    storage.delete('accessToken');
    storage.delete('refreshToken');
  },
};
```

**MMKV 선정 이유**: AsyncStorage 대비 약 30배 빠른 동기 읽기/쓰기. 암호화 지원.

### Axios 인터셉터

```typescript
// src/api/client.ts
import axios from 'axios';
import { TokenStorage } from '../utils/storage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.mindscope.kr/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request 인터셉터: 토큰 주입
apiClient.interceptors.request.use((config) => {
  const token = TokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response 인터셉터: 401 시 토큰 갱신
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 갱신 중이면 대기열에 추가
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = TokenStorage.getRefreshToken();
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        TokenStorage.setAccessToken(data.access_token);
        TokenStorage.setRefreshToken(data.refresh_token);

        // 대기 중인 요청 처리
        failedQueue.forEach(({ resolve }) => resolve(data.access_token));
        failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        TokenStorage.clear();
        // 로그인 화면으로 이동 (router.replace 등)
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

### 로그인 플로우

```
1. 이메일/비밀번호 입력
2. POST /api/v1/auth/login
   Request:  { email, password }
   Response: { access_token, refresh_token, user: { id, email, name } }
3. MMKV에 토큰 저장
4. GET /api/v1/centers/my → 소속 센터 목록 조회
5. 센터 선택 → centerId를 Zustand 스토어에 저장
6. 메인 화면 진입
```

### 센터 전환

```typescript
// src/stores/center.store.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandMMKVStorage } from '../utils/storage';

interface CenterState {
  centerId: string | null;
  centerName: string | null;
  setCenterContext: (id: string, name: string) => void;
  clearCenter: () => void;
}

export const useCenterStore = create<CenterState>()(
  persist(
    (set) => ({
      centerId: null,
      centerName: null,
      setCenterContext: (id, name) => set({ centerId: id, centerName: name }),
      clearCenter: () => set({ centerId: null, centerName: null }),
    }),
    {
      name: 'center-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
```

---

## 5. 핵심 기능 설계

### 5.1 대시보드 (홈)

**화면 구성**:
- 오늘 일정 요약 (예정 세션 수, 다음 세션 카운트다운)
- 타임라인 형태의 오늘 일정 목록
- 읽지 않은 알림 배지
- 빠른 액션 버튼 (필드노트 작성, 일정 추가)

**API 호출**:
```
GET /centers/{centerId}/schedules?start={today_start}&end={today_end}&member_id={me}
GET /centers/{centerId}/notifications?is_read=false&limit=5
```

### 5.2 일정 (Schedule)

**기능**:
- 일간/주간 뷰 전환
- 일정 유형별 색상 구분 (상담: 파랑, 검사: 초록, 회의: 회색, 차단: 빨강)
- 일정 탭 → 세션 상세로 이동
- 세션 상태 변경 (scheduled → completed / no_show / cancelled)

**핵심 API**:
```
GET  /centers/{centerId}/schedules?start=...&end=...
GET  /centers/{centerId}/schedules/{scheduleId}
POST /centers/{centerId}/schedules
```

**캘린더 컴포넌트**: `react-native-calendars` 또는 커스텀 구현.

### 5.3 내담자 (Client)

**기능**:
- 내담자 목록 (검색, 역할 필터)
- 내담자 상세 (기본 정보, 관계 정보)
- 빠른 전화/문자 연결 (Linking API)
- 관련 상담/검사 케이스 요약

**핵심 API**:
```
GET /centers/{centerId}/clients?search=...&role=...&page=...
GET /centers/{centerId}/clients/{clientId}
GET /centers/{centerId}/clients/{clientId}/relations
```

### 5.4 상담 현황 (Counseling)

**기능**:
- 내 담당 상담 케이스 목록
- 케이스별 세션 진행 현황 (n/total)
- 세션 상태 변경
- 필드노트 바로가기

**핵심 API**:
```
GET /centers/{centerId}/counseling/cases?counselor_id={me}
GET /centers/{centerId}/counseling/cases/{caseId}
GET /centers/{centerId}/counseling/cases/{caseId}/sessions
```

### 5.5 검사 현황 (Assessment)

**기능**:
- 내 담당 검사 케이스 목록
- 진행 상태 확인 (pending → processing → completed)
- 검사 태스크 현황

**핵심 API**:
```
GET /centers/{centerId}/assessment/cases?counselor_id={me}
GET /centers/{centerId}/assessment/cases/{caseId}
```

---

## 6. 푸시 알림

### 아키텍처 개요

```
[알림 발생 트리거]
  Backend Event (일정 변경, 세션 확정 등)
    ↓
  NotificationService.create_notification()
    ↓
  ┌─────────────────┐
  │  In-App 알림     │ → DB 저장 (Notification 테이블)
  │  Push 알림       │ → FCM/APNs 발송
  │  AlarmTalk       │ → Kakao 발송 (선택)
  └─────────────────┘
    ↓
  [모바일 앱]
  ┌─────────────────────────────┐
  │  Foreground → 앱 내 배너    │
  │  Background → 시스템 알림   │
  │  Killed     → 시스템 알림   │
  └─────────────────────────────┘
```

### 기존 인프라 활용

백엔드에 이미 구축된 시스템:
- `Notification` 모델 (in-app 알림 저장)
- `PushToken` 모델 (FCM 디바이스 토큰 관리)
- `NotificationSetting` 모델 (사용자별 알림 설정)
- Firebase Admin SDK 연동 (웹 푸시 발송)

**모바일 추가 작업**: FCM 토큰 등록 시 `platform` 필드 추가 (ios/android 구분).

### expo-notifications 설정

```typescript
// src/services/push.service.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { useCenterStore } from '../stores/center.store';

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushService {
  /**
   * 푸시 알림 권한 요청 + FCM 토큰 등록
   */
  static async register(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // 권한 요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // FCM 토큰 획득
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id',
    });

    // 또는 네이티브 FCM 토큰 사용
    // const token = (await Notifications.getDevicePushTokenAsync()).data;

    // Android 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('schedule', {
        name: '일정 알림',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    return token;
  }

  /**
   * 서버에 FCM 토큰 등록
   */
  static async registerTokenToServer(token: string): Promise<void> {
    const centerId = useCenterStore.getState().centerId;
    if (!centerId) return;

    await apiClient.post(`/centers/${centerId}/notifications/push-tokens`, {
      token,
      platform: Platform.OS,  // 'ios' | 'android'
      device_info: `${Device.modelName} (${Platform.OS} ${Platform.osVersion})`,
    });
  }

  /**
   * 서버에서 FCM 토큰 해제 (로그아웃 시)
   */
  static async unregisterToken(token: string): Promise<void> {
    const centerId = useCenterStore.getState().centerId;
    if (!centerId) return;

    await apiClient.delete(
      `/centers/${centerId}/notifications/push-tokens/${encodeURIComponent(token)}`,
    );
  }
}
```

### 알림 수신 처리

```typescript
// app/_layout.tsx 내부
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // 포그라운드 수신
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        // 앱 내 배너 표시 또는 알림 카운트 갱신
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });

    // 알림 탭 (포그라운드/백그라운드 모두)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        // data.navigation_target에 따라 화면 이동
        navigateFromNotification(data, router);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // ...
}

function navigateFromNotification(data: any, router: any) {
  switch (data.category) {
    case 'schedule':
      router.push(`/schedule/${data.entity_id}`);
      break;
    case 'counseling':
      router.push(`/counseling/${data.entity_id}`);
      break;
    case 'assessment':
      router.push(`/assessment/${data.entity_id}`);
      break;
    default:
      router.push('/notifications');
  }
}
```

### 알림 유형별 동작

| 이벤트 | category | 동작 | 이동 대상 |
|--------|----------|------|-----------|
| 일정 확정 | schedule | 배너 + 푸시 | 일정 상세 |
| 일정 변경 | schedule | 배너 + 푸시 | 일정 상세 |
| 일정 취소 | schedule | 배너 + 푸시 | 일정 목록 |
| 세션 10분 전 | schedule | 푸시 | 일정 상세 |
| 검사 완료 | assessment | 배너 + 푸시 | 검사 상세 |
| 시스템 공지 | system | 배너 | 알림 목록 |

---

## 7. 필드노트 (녹음/STT)

### 7.1 아키텍처

필드노트는 이 앱의 **핵심 차별 기능**. 모바일의 마이크/녹음 접근성을 활용.

```
[녹음 화면]
┌─────────────────────────────────┐
│  🔴 녹음 중  00:15:32           │
│                                 │
│  ┌───────────────────────────┐  │
│  │ [실시간 트랜스크립트]       │  │
│  │ 상담사: 오늘 기분이...     │  │
│  │ 내담자: 조금 나아진 것..   │  │
│  │ 상담사: 구체적으로...      │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 빠른 메모                  │  │
│  │ [관찰] [행동] [감정] [+]  │  │
│  │ ┌─────────────────────┐   │  │
│  │ │ 메모 입력...         │   │  │
│  │ └─────────────────────┘   │  │
│  └───────────────────────────┘  │
│                                 │
│  [⏸ 일시정지]  [⏹ 중지]  [📝 메모] │
└─────────────────────────────────┘
```

### 7.2 녹음 서비스

```typescript
// src/services/recording.service.ts
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export class RecordingService {
  private recording: Audio.Recording | null = null;
  private startTime: number = 0;

  async startRecording(): Promise<void> {
    // 오디오 세션 설정
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,  // 백그라운드 녹음 지원
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
      this.onRecordingStatusUpdate,
      100, // 100ms 간격 상태 업데이트
    );

    this.recording = recording;
    this.startTime = Date.now();
  }

  async stopRecording(): Promise<string> {
    if (!this.recording) throw new Error('No active recording');

    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;

    if (!uri) throw new Error('Recording URI is null');
    return uri;
  }

  async pauseRecording(): Promise<void> {
    await this.recording?.pauseAsync();
  }

  async resumeRecording(): Promise<void> {
    await this.recording?.startAsync();
  }

  private onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
    // Zustand 스토어에 상태 업데이트
    // duration, isRecording, metering 등
  };
}
```

### 7.3 STT 서비스 (WebSocket)

```typescript
// src/services/stt.service.ts

interface STTResult {
  start_time: number;   // 초
  end_time: number;     // 초
  speaker: 'THERAPIST' | 'PATIENT';
  text: string;
  is_final: boolean;    // 최종 결과 여부
}

export class STTService {
  private ws: WebSocket | null = null;
  private onResult: (result: STTResult) => void;

  constructor(onResult: (result: STTResult) => void) {
    this.onResult = onResult;
  }

  connect(fieldNoteId: string): void {
    const wsUrl = __DEV__
      ? `ws://localhost:8000/api/v1/fieldnotes/${fieldNoteId}/stt/stream`
      : `wss://api.mindscope.kr/api/v1/fieldnotes/${fieldNoteId}/stt/stream`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // 인증 토큰 전송
      this.ws?.send(JSON.stringify({
        type: 'auth',
        token: TokenStorage.getAccessToken(),
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'transcript':
          this.onResult(data.payload as STTResult);
          break;
        case 'error':
          console.error('STT error:', data.message);
          break;
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.reconnect(fieldNoteId);
    };
  }

  /**
   * 오디오 청크 전송
   * expo-av의 녹음 데이터를 base64로 인코딩하여 전송
   */
  sendAudioChunk(audioData: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio',
        data: audioData,  // base64 encoded
      }));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  private reconnect(fieldNoteId: string): void {
    setTimeout(() => this.connect(fieldNoteId), 3000);
  }
}
```

### 7.4 STT 구현 전략

**두 가지 접근법**:

#### 방법 A: 서버 사이드 STT (추천)

```
Mobile (녹음)
  → WebSocket → Backend (FastAPI)
    → STT Service (Google Cloud STT / Whisper)
      → Voice 레코드 생성
        → WebSocket으로 결과 반환
```

**장점**: STT 서비스 키 관리가 서버에서만 필요, 일관된 처리
**단점**: 실시간 스트리밍 시 네트워크 지연

#### 방법 B: 온디바이스 STT (대안)

```
Mobile (녹음)
  → 온디바이스 STT (Whisper.cpp / Apple Speech)
    → HTTP POST로 Voice 레코드 저장
```

**장점**: 오프라인 동작 가능, 네트워크 지연 없음
**단점**: 디바이스 성능 의존, 정확도 차이

#### 추천: 하이브리드 (Phase별)

| Phase | 전략 | 이유 |
|-------|------|------|
| Phase 1 | **서버 사이드 STT** | 빠른 구현, 일관된 품질 |
| Phase 2 | 온디바이스 STT 옵션 추가 | 오프라인 지원, 비용 절감 |

### 7.5 녹음 → 업로드 → 필드노트 완성 플로우

```
1. 세션 시작 → FieldNote 생성
   POST /centers/{centerId}/fieldnotes
   { related_type: "COUNSELING", related_id: sessionId }

2. 녹음 시작 + STT WebSocket 연결
   WS /fieldnotes/{fieldNoteId}/stt/stream

3. 녹음 중
   - 오디오 청크 → WebSocket으로 STT 서비스에 전송
   - STT 결과 수신 → Voice 레코드 자동 생성 (서버)
   - 사용자 메모 입력 → Memo 생성
     POST /centers/{centerId}/fieldnotes/{fieldNoteId}/memos

4. 녹음 종료
   - WebSocket 연결 종료
   - 로컬 오디오 파일 → S3 업로드 (Presigned URL)
     POST /centers/{centerId}/fieldnotes/{fieldNoteId}/upload-url
     PUT  {presigned_url}  (S3 직접 업로드)
   - FieldNote에 audio_file_url 저장
     PATCH /centers/{centerId}/fieldnotes/{fieldNoteId}
     { audio_file_url: "s3://...", total_duration: 3600 }

5. 편집 (선택)
   - Voice 텍스트 교정
     PATCH /centers/{centerId}/fieldnotes/{fieldNoteId}/voices/{voiceId}
   - 메모 추가/수정

6. 완료
   PATCH /centers/{centerId}/fieldnotes/{fieldNoteId}
   { status: "COMPLETED" }
```

### 7.6 녹음 상태 관리

```typescript
// src/stores/recording.store.ts
import { create } from 'zustand';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;       // 초
  fieldNoteId: string | null;
  sessionId: string | null;
  sessionType: 'COUNSELING' | 'ASSESSMENT' | 'OTHER';

  // 실시간 트랜스크립트
  voices: Voice[];
  pendingVoice: Partial<Voice> | null;  // STT 중간 결과

  // 메모
  memos: Memo[];

  // Actions
  startSession: (fieldNoteId: string, sessionId: string, type: string) => void;
  addVoice: (voice: Voice) => void;
  updatePendingVoice: (partial: Partial<Voice>) => void;
  addMemo: (memo: Memo) => void;
  reset: () => void;
}
```

---

## 8. 오프라인 지원

### 전략: Online-First + 읽기 캐시

완전한 오프라인 동기화(CRDT 등)는 복잡도 대비 효용이 낮음.
**읽기 캐시 + 제한적 오프라인 동작**으로 충분.

### 구현 방식

```
[Online]
  API 호출 → TanStack Query 캐시 → 화면 렌더링

[Offline]
  TanStack Query 캐시 히트 → 화면 렌더링 (stale 표시)
  쓰기 작업 → 큐에 저장 → 온라인 복귀 시 일괄 전송
```

### TanStack Query Persist

```typescript
// app/_layout.tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { mmkvStorage } from '../src/utils/storage';

const persister = createSyncStoragePersister({
  storage: mmkvStorage,  // MMKV 기반
});

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,  // 24시간 캐시
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // 민감하지 않은 데이터만 캐시
            const nonCacheable = ['notifications'];
            return !nonCacheable.some((key) =>
              query.queryKey.includes(key),
            );
          },
        },
      }}
    >
      {/* ... */}
    </PersistQueryClientProvider>
  );
}
```

### 오프라인 녹음

녹음은 네트워크 의존 없이 로컬에서 진행 가능:

```
1. 녹음 → 로컬 파일 저장 (expo-av)
2. STT → 오프라인 시 건너뜀 (또는 온디바이스 STT)
3. 메모 → 로컬 큐에 저장
4. 온라인 복귀 시:
   - 오디오 파일 S3 업로드
   - 대기 중인 메모 일괄 전송
   - (옵션) 오디오 파일을 서버 STT에 전송하여 Voice 생성
```

---

## 9. 백엔드 변경사항

### 9.1 인증 듀얼 모드 (필수)

현재 `get_current_user`가 쿠키에서만 토큰을 읽는 경우, Bearer 헤더도 지원해야 함.

```python
# apps/api/app/core/auth.py (수정)

async def get_current_user(request: Request) -> CurrentUser:
    """쿠키 또는 Authorization 헤더에서 JWT 추출"""
    token = None

    # 1. Authorization 헤더 우선 확인 (모바일)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]

    # 2. 쿠키에서 확인 (웹)
    if not token:
        token = request.cookies.get("accessToken")

    if not token:
        raise UnauthorizedException("인증 토큰이 없습니다")

    # 이하 기존 로직 동일...
    payload = decode_jwt(token)
    # ...
```

### 9.2 로그인 응답 확장 (필수)

모바일은 쿠키가 아닌 JSON body로 토큰을 받아야 함.

```python
# 기존 (웹): Set-Cookie 헤더로 토큰 전달
# 추가 (모바일): JSON body에도 토큰 포함

@router.post("/auth/login")
async def login(data: LoginRequest, request: Request):
    result = await auth_handler(data, uow)

    response_data = {
        "user": result.user,
        "access_token": result.access_token,    # 모바일용
        "refresh_token": result.refresh_token,   # 모바일용
    }

    response = JSONResponse(content=response_data)

    # 웹용 쿠키도 유지 (하위 호환)
    response.set_cookie("accessToken", result.access_token, httponly=True, ...)
    response.set_cookie("refreshToken", result.refresh_token, httponly=True, ...)

    return response
```

### 9.3 PushToken 모델 확장

```python
# apps/api/app/modules/notification/models.py

class PushToken(Base):
    # 기존 필드...
    token: Mapped[str]
    device_info: Mapped[str | None]
    is_active: Mapped[bool]

    # 추가 필드
    platform: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="web"
    )  # "web", "ios", "android"
```

### 9.4 리프레시 토큰 API 확장

```python
# 기존: 쿠키에서 refresh_token 추출
# 추가: JSON body에서도 추출 가능

@router.post("/auth/refresh")
async def refresh_token(
    request: Request,
    body: RefreshTokenRequest | None = None,  # 모바일용
):
    refresh_token = None

    # 1. Body에서 확인 (모바일)
    if body and body.refresh_token:
        refresh_token = body.refresh_token

    # 2. 쿠키에서 확인 (웹)
    if not refresh_token:
        refresh_token = request.cookies.get("refreshToken")

    if not refresh_token:
        raise UnauthorizedException("리프레시 토큰이 없습니다")

    # 이하 기존 로직...
```

### 9.5 CORS 설정 확장

```python
# apps/api/app/main.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        settings.ADMIN_URL,
        "http://localhost:3503",   # 웹 개발
        "http://localhost:8081",   # Expo 개발
        # 모바일 앱은 실제로 CORS 검사를 하지 않지만,
        # Expo WebView 등에서 필요할 수 있음
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 9.6 STT WebSocket 엔드포인트 (신규)

```python
# apps/api/app/modules/fieldnote/router.py

from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/fieldnotes/{field_note_id}/stt/stream")
async def stt_stream(
    websocket: WebSocket,
    field_note_id: str,
):
    await websocket.accept()

    try:
        # 1. 인증 (첫 메시지로 토큰 수신)
        auth_msg = await websocket.receive_json()
        if auth_msg.get("type") != "auth":
            await websocket.close(code=4001)
            return

        user = await verify_ws_token(auth_msg["token"])

        # 2. STT 서비스 연결
        stt_session = await stt_service.create_session(
            language="ko-KR",
            speaker_diarization=True,
        )

        # 3. 오디오 수신 → STT → 결과 반환 루프
        async for message in websocket.iter_json():
            if message["type"] == "audio":
                audio_data = base64.b64decode(message["data"])
                results = await stt_session.process(audio_data)

                for result in results:
                    if result.is_final:
                        # Voice 레코드 생성
                        voice = await create_voice(field_note_id, result)
                        await websocket.send_json({
                            "type": "transcript",
                            "payload": voice.dict(),
                        })
                    else:
                        # 중간 결과
                        await websocket.send_json({
                            "type": "interim",
                            "payload": {
                                "text": result.text,
                                "speaker": result.speaker,
                            },
                        })

    except WebSocketDisconnect:
        pass
    finally:
        await stt_session.close()
```

### 9.7 변경사항 요약

| 변경 | 파일 | 영향 범위 | 필수 여부 |
|------|------|-----------|-----------|
| 듀얼 인증 (쿠키+Bearer) | `core/auth.py` | 인증 전체 | **필수** |
| 로그인 응답에 토큰 포함 | `auth/handlers.py` | 로그인 API | **필수** |
| 리프레시 토큰 Body 지원 | `auth/handlers.py` | 토큰 갱신 | **필수** |
| PushToken platform 필드 | `notification/models.py` | 알림 | **필수** |
| CORS 확장 | `main.py` | 개발 환경 | 선택 |
| STT WebSocket | `fieldnote/router.py` | 필드노트 | Phase 1 |
| STT 서비스 연동 | `infrastructure/stt.py` | 신규 | Phase 1 |

---

## 10. 배포 및 인프라

### 10.1 앱 빌드/배포 (EAS Build)

```json
// apps/mobile/eas.json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": {
        "API_URL": "http://localhost:8000/api/v1"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "API_URL": "https://api.mindscope.kr/api/v1"
      }
    },
    "production": {
      "env": {
        "API_URL": "https://api.mindscope.kr/api/v1"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id",
        "ascAppId": "your-asc-app-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

### 10.2 네트워크 구성

```
[모바일 앱]
  → api.mindscope.kr (HTTPS, 기존 API Ingress)
     → K8s mindscope-api-svc

  → S3 Presigned URL (오디오 업로드 직접)

  → FCM (Firebase Cloud Messaging)
     → Backend → FCM → APNs (iOS)
     → Backend → FCM → Android
```

모바일 앱은 기존 `api.mindscope.kr` 인그레스를 그대로 사용.
별도 모바일 전용 서버 불필요.

### 10.3 환경 분리

| 환경 | API URL | 용도 |
|------|---------|------|
| Development | `http://localhost:8000/api/v1` | 로컬 개발 |
| Preview | `https://api.mindscope.kr/api/v1` | 내부 테스트 (TestFlight / Internal Track) |
| Production | `https://api.mindscope.kr/api/v1` | 앱 스토어 배포 |

---

## 11. 구현 단계

### Phase 1: 기반 + 핵심 기능

**목표**: 앱 기반 구조 + 일정/내담자 조회 + 푸시 알림

```
백엔드:
  ☐ 인증 듀얼 모드 (쿠키 + Bearer) 적용
  ☐ 로그인 응답에 토큰 JSON body 포함
  ☐ 리프레시 토큰 Body 지원
  ☐ PushToken에 platform 필드 추가 + 마이그레이션

모바일:
  ☐ Expo 프로젝트 초기화 (apps/mobile/)
  ☐ 프로젝트 구조 세팅 (api, hooks, stores, components)
  ☐ Axios 클라이언트 + 인터셉터 (토큰 주입, 갱신)
  ☐ MMKV 토큰 스토리지
  ☐ 로그인/로그아웃 화면
  ☐ 센터 선택 화면
  ☐ 탭 네비게이션 (홈, 일정, 내담자, 더보기)
  ☐ 대시보드 (오늘 일정 요약)
  ☐ 일정 목록/상세
  ☐ 내담자 목록/상세
  ☐ 푸시 알림 설정 (expo-notifications + FCM)
  ☐ 알림 목록 화면
```

### Phase 2: 필드노트

**목표**: 녹음 + 서버 사이드 STT + 메모 기능

```
백엔드:
  ☐ FieldNote 모듈 구현 (모델/서비스/핸들러/라우터)
  ☐ STT WebSocket 엔드포인트
  ☐ STT 서비스 연동 (Google Cloud STT 또는 Whisper API)
  ☐ Presigned URL 발급 엔드포인트
  ☐ Voice/Memo CRUD

모바일:
  ☐ 녹음 서비스 (expo-av)
  ☐ STT WebSocket 클라이언트
  ☐ 녹음 화면 UI (녹음 컨트롤, 실시간 트랜스크립트)
  ☐ 메모 입력 (카테고리 선택 + 텍스트)
  ☐ Voice 타임라인 뷰
  ☐ 오디오 S3 업로드
  ☐ 필드노트 목록/상세/편집
  ☐ Voice 텍스트 교정
  ☐ 오프라인 녹음 지원 (로컬 저장 → 온라인 시 업로드)
```

### Phase 3: 상담/검사 + 고도화

**목표**: 상담/검사 현황 + UX 개선

```
모바일:
  ☐ 상담 현황 (케이스 목록, 세션 관리)
  ☐ 검사 현황 (케이스 목록, 진행 상태)
  ☐ 세션 → 필드노트 연결 (세션 상세에서 바로 녹음 시작)
  ☐ TanStack Query 캐시 Persist (오프라인 읽기)
  ☐ 딥 링크 (알림 탭 → 해당 화면 이동)
  ☐ 앱 아이콘/스플래시 스크린
  ☐ TestFlight / Internal Track 배포
```

### Phase 4: 릴리즈 + AI 기능

```
모바일:
  ☐ 앱 스토어 심사 대응 (개인정보 처리방침, 마이크 권한 설명 등)
  ☐ App Store / Google Play 배포
  ☐ 크래시 리포팅 (Sentry)
  ☐ 앱 업데이트 알림 (OTA via EAS Update)

백엔드 (Phase 2 AI):
  ☐ full_transcript 자동 생성 (Voice 통합)
  ☐ AI 요약 생성 (LLM 연동)
  ☐ 개인정보 자동 마스킹 (NER 기반)
```

---

## 부록: 주요 결정 근거 요약

| 결정 | 근거 |
|------|------|
| React Native + Expo | 성숙한 생태계, 녹음/STT/푸시 검증된 라이브러리 |
| API 직접 호출 (프록시 미사용) | 모바일은 프록시 불필요, 직접 Bearer 토큰으로 통신 |
| MMKV 토큰 스토리지 | AsyncStorage 대비 30배 빠른 동기 읽기, 암호화 지원 |
| 서버 사이드 STT (Phase 1) | 빠른 구현, API 키 서버 관리, 일관된 품질 |
| TanStack Query | 웹과 동일 패턴, 캐시/갱신/persist 생태계 |
| Online-First 오프라인 | 풀 오프라인 동기화는 과도, 읽기 캐시 + 녹음 로컬 저장이면 충분 |
| BFF 미도입 | 트래픽 적은 초기에는 과도, 기존 API 직접 사용이 효율적 |
| PushToken platform 구분 | FCM이 iOS/Android 모두 커버, 플랫폼별 페이로드 분기 필요 |
