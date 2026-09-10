/**
 * FCM 메시징 관리
 *
 * - 토큰 발급/등록/해제
 * - 포그라운드 메시지 리스너
 * - 서비스 워커 등록
 */
import { getToken, onMessage, type Unsubscribe } from 'firebase/messaging'
import { getFirebaseMessaging, isFirebaseConfigured } from './config'
import { post, deleteResource } from '$lib/services/api/instances'
import { pushToastStore } from '$lib/features/notification/stores/push-toast.store'
import { resolveNavigateTo } from '$lib/features/notification/view-model'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'

let vapidKey = ''

/**
 * 서버에서 전달받은 VAPID Key 설정
 * (+layout.svelte onMount에서 호출)
 */
export function setVapidKey(key: string): void {
  vapidKey = key
}

/** 현재 등록된 FCM 토큰 (메모리 캐시) */
let currentToken: string | null = null

/**
 * Service Worker 등록
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope'
    })
    return registration
  } catch (err) {
    console.error('[FCM] Service Worker registration failed:', err)
    return null
  }
}

/**
 * FCM 토큰 발급
 */
async function acquireToken(
  swRegistration: ServiceWorkerRegistration
): Promise<string | null> {
  const messaging = getFirebaseMessaging()
  if (!messaging || !vapidKey) return null

  try {
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: swRegistration
    })
    return token || null
  } catch (err) {
    console.error('[FCM] Token acquisition failed:', err)
    return null
  }
}

/**
 * 서버에 토큰 등록
 */
async function registerTokenToServer(token: string): Promise<void> {
  const centerId = requireCenterId()
  const deviceInfo = navigator.userAgent.slice(0, 100)

  await post(`centers/${centerId}/notifications/push-tokens`, {
    token,
    device_info: deviceInfo
  })
}

/**
 * 서버에서 토큰 해제
 */
export async function unregisterTokenFromServer(token: string): Promise<void> {
  const centerId = requireCenterId()
  await deleteResource(`centers/${centerId}/notifications/push-tokens/${encodeURIComponent(token)}`)
}

/**
 * 포그라운드 메시지 리스너 설정
 */
function setupForegroundListener(queryClient: QueryClient): Unsubscribe | null {
  const messaging = getFirebaseMessaging()
  if (!messaging) return null

  return onMessage(messaging, (payload) => {
    const { title, body } = payload.notification || {}
    const data = payload.data as Record<string, string> | undefined

    // Push 토스트로 포그라운드 알림 표시
    if (title || body) {
      const category = data?.category ?? ''
      const eventType = data?.event_type ?? ''
      const navigateTo = resolveNavigateTo(category, eventType, data ?? null)

      pushToastStore.show({
        title: title || '새 알림',
        body: body || '',
        category,
        eventType,
        navigateTo: navigateTo ?? undefined
      })
    }

    // 알림 관련 쿼리 무효화 (읽지 않은 수, 목록 갱신)
    queryClient.invalidateQueries({ queryKey: ['getUnreadCount'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getNotificationList'], exact: false })
  })
}

/**
 * 알림 클릭 메시지 리스너 (Service Worker → 메인 스레드)
 */
function setupNotificationClickListener(): void {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.navigate_to) {
      window.location.href = event.data.navigate_to
    }
  })
}

/**
 * FCM Push 초기화 (onMount에서 호출)
 *
 * 1. Firebase 설정 확인
 * 2. Service Worker 등록
 * 3. 기존 permission이 granted이면 자동으로 토큰 발급/등록
 * 4. 포그라운드 메시지 리스너 설정
 */
export async function initializePush(queryClient: QueryClient): Promise<void> {
  if (!isFirebaseConfigured()) return
  if (!('Notification' in window)) return

  // Service Worker 등록
  const swRegistration = await registerServiceWorker()
  if (!swRegistration) return

  // 알림 클릭 리스너
  setupNotificationClickListener()

  // 포그라운드 리스너
  setupForegroundListener(queryClient)

  // 이전에 permission을 허용했으면 자동으로 토큰 갱신
  if (Notification.permission === 'granted') {
    const token = await acquireToken(swRegistration)
    if (token && token !== currentToken) {
      try {
        await registerTokenToServer(token)
        currentToken = token
      } catch (err) {
        console.error('[FCM] Token registration failed:', err)
      }
    }
  }
}

/**
 * Push 알림 권한 요청 + 토큰 등록
 *
 * 알림 설정 페이지에서 Push 토글 ON 시 호출
 */
export async function requestAndRegisterPush(): Promise<'granted' | 'denied' | 'default'> {
  if (!isFirebaseConfigured()) return 'default'
  if (!('Notification' in window)) return 'default'

  const permission = await Notification.requestPermission()

  if (permission === 'granted') {
    const swRegistration = await registerServiceWorker()
    if (swRegistration) {
      const token = await acquireToken(swRegistration)
      if (token) {
        try {
          await registerTokenToServer(token)
          currentToken = token
        } catch (err) {
          console.error('[FCM] Token registration failed:', err)
        }
      }
    }
  }

  return permission
}

/**
 * 현재 등록된 토큰 반환
 */
export function getCurrentToken(): string | null {
  return currentToken
}
