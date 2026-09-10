/**
 * 토스페이먼츠 SDK 유틸
 *
 * 동적으로 토스 SDK를 로드하고 결제 위젯을 초기화합니다.
 */

import { getTossClientKey } from '$lib/hooks/actions/subscription.action'

const TOSS_SDK_URL = 'https://js.tosspayments.com/v1/payment'

let sdkLoaded = false

/**
 * 토스 SDK 스크립트를 동적 로드
 */
function loadScript(): Promise<void> {
  if (sdkLoaded) return Promise.resolve()

  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${TOSS_SDK_URL}"]`)) {
      sdkLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = TOSS_SDK_URL
    script.onload = () => {
      sdkLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('토스 SDK 로드 실패'))
    document.head.appendChild(script)
  })
}

/**
 * 토스 결제 SDK 인스턴스 생성
 */
export async function loadTossPayments(centerId: string) {
  // 1. 클라이언트 키 조회
  const keyData = await getTossClientKey().request({ centerId })
  if (!keyData?.client_key) return null

  // 2. SDK 로드
  await loadScript()

  // 3. TossPayments 인스턴스 생성
  const TossPayments = (window as any).TossPayments
  if (!TossPayments) return null

  return TossPayments(keyData.client_key)
}
