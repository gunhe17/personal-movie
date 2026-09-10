import { env } from '$env/dynamic/public'
import { API_URL } from '$lib/server/config'
import type { UserInfo } from '../app.d'
import type { LayoutServerLoad } from './$types'

/**
 * JWT에는 name이 없어 인사말·프로필 이름이 비어 보인다.
 * 이름이 없을 때만 /auth/me로 보강한다(백엔드 무수정, web 내부에서 해결).
 * root 레이아웃에서 처리 — auth.login()이 root/protected 양쪽에서 호출되는데
 * onMount는 부모(root)가 마지막에 실행돼 store 최종값을 덮으므로 여기서 채워야 한다.
 */
async function enrichUserName(
  user: UserInfo | null,
  accessToken: string | null
): Promise<UserInfo | null> {
  if (!user || user.name || !accessToken) return user
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return user
    const me = (await res.json()) as {
      person?: { name?: string; phone?: string } | null
    }
    return {
      ...user,
      name: me.person?.name ?? user.name,
      phone: me.person?.phone ?? user.phone
    }
  } catch {
    return user
  }
}

export const load: LayoutServerLoad = async ({ locals }) => {
  // Firebase 설정 (서버사이드에서 읽어 클라이언트로 전달)
  const firebaseConfig = {
    apiKey: env.PUBLIC_FIREBASE_API_KEY || '',
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.PUBLIC_FIREBASE_APP_ID || ''
  }

  return {
    user: await enrichUserName(locals.user, locals.accessToken),
    firebaseConfig,
    firebaseVapidKey: env.PUBLIC_FIREBASE_VAPID_KEY || '',
    firebaseAvailable: !!(
      firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId
    )
  }
}
