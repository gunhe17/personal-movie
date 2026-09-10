/**
 * Firebase Cloud Messaging Service Worker
 *
 * 백그라운드 푸시 알림 수신 처리
 * - compat 버전 CDN import (Vite 빌드와 독립적)
 */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js')

// Firebase 초기화 (messagingSenderId만 필수)
// 실제 config는 메인 앱에서 getToken() 호출 시 전달됨
firebase.initializeApp({
  apiKey: 'placeholder',
  projectId: 'placeholder',
  messagingSenderId: 'placeholder',
  appId: 'placeholder'
})

const messaging = firebase.messaging()

// 백그라운드 메시지 수신 핸들러
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  const data = payload.data || {}

  const notificationTitle = title || '새 알림'
  const notificationOptions = {
    body: body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {
      navigate_to: data.navigate_to || '/',
      notification_id: data.notification_id || ''
    },
    tag: data.notification_id || Date.now().toString()
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// 알림 클릭 핸들러
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const navigateTo = event.notification.data?.navigate_to || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 이미 열린 탭이 있으면 포커스 + 네비게이션
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            navigate_to: navigateTo
          })
          return
        }
      }
      // 열린 탭이 없으면 새 창
      return clients.openWindow(navigateTo)
    })
  )
})
