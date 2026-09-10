/**
 * Firebase 앱 초기화
 *
 * 서버에서 전달받은 config로 초기화, 미설정 시 graceful 비활성화
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, type Messaging } from 'firebase/messaging'

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

let firebaseConfig: FirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
}

/**
 * 서버에서 전달받은 Firebase 설정으로 초기화
 * (+layout.svelte onMount에서 호출)
 */
export function initializeFirebaseConfig(config: FirebaseConfig): void {
  firebaseConfig = config
}

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId)
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

export function getFirebaseMessaging(): Messaging | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!messaging) {
    messaging = getMessaging(firebaseApp)
  }
  return messaging
}
