import { afterNavigate } from '$app/navigation'
import { browser } from '$app/environment'

const KEY = 'exam:listUrl'
const LIST_PATH = '/examinations'

/**
 * 검사 화면에서 나갈 때 돌아갈 목록 주소를 기억한다.
 *
 * 그냥 '/examinations'로 보내면 보던 페이지·필터가 날아간다 — 3페이지에서
 * 검사를 열었다가 중단하면 1페이지로 떨어진다. 목록의 상태는 그 URL에
 * 실려 있으므로(page·search·status·type) 진입 직전 주소를 기억해 둔다.
 *
 * ⚠️ 컴포넌트 상태로는 안 된다. 목록에서 오는 진입은 항상 첫 단계로 향하고
 * (progress를 모르므로 — exam-route.ts 참고), 도착하면 [step] 가드가 열린
 * 단계로 다시 goto 한다. 그 두 번째 이동의 from은 목록이 아니라 검사 화면이고,
 * (exam) 레이아웃이 다시 마운트되면서 컴포넌트 상태는 초기화된다.
 * 그래서 마운트를 넘어 사는 sessionStorage에 둔다.
 *
 * 목록을 거치지 않고 들어온 경우(링크 직접 진입, 대시보드 드릴다운, 내담자
 * 상세)는 기억된 값이 없으니 목록 첫 페이지로 보낸다.
 */
export function createExamExit() {
  let listUrl = $state(read())

  afterNavigate((nav) => {
    const from = nav.from?.url
    if (from?.pathname === LIST_PATH) {
      listUrl = from.pathname + from.search
      write(listUrl)
    }
  })

  return {
    get listUrl() {
      return listUrl
    }
  }
}

function read(): string {
  if (!browser) return LIST_PATH
  try {
    return sessionStorage.getItem(KEY) || LIST_PATH
  } catch {
    // 사파리 프라이빗 등에서 접근이 막힐 수 있다 — 기본값으로 떨어진다
    return LIST_PATH
  }
}

function write(url: string) {
  if (!browser) return
  try {
    sessionStorage.setItem(KEY, url)
  } catch {
    // 저장 못 해도 이동 자체는 되어야 하므로 삼킨다
  }
}
