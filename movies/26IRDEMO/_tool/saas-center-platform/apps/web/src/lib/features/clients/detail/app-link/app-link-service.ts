import { t, josa } from '$lib/ontology/terms'
import { modalUtils } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import { showErrorSnackbar } from '$lib/utils/errorHandler'
import {
  postAppLinkInvitation,
  postAppLinkInvitationSms
} from '$lib/hooks/actions/appLink.action'

export interface AppLinkServiceDeps {
  clientId: string
  refetchStatus: () => void
  /** 본인 연결 발급 성공 시 — role이 both로 승격되므로 내담자 상세를 다시 불러와야 한다 */
  onSelfLinked?: () => void
}

export function createAppLinkService(deps: AppLinkServiceDeps) {
  const { clientId, refetchStatus, onSelfLinked } = deps

  async function requestInvitation(): Promise<boolean> {
    try {
      // centerId는 이벤트 핸들러 실행 시점에 조회 (SSR null 안전)
      await postAppLinkInvitation().request({
        centerId: requireCenterId(),
        clientId
      })
      refetchStatus()
      return true
    } catch (err) {
      showErrorSnackbar(err, '초대 코드 발급에 실패했어요.')
      return false
    }
  }

  /** 최초 발급 */
  async function issueInvitation() {
    const ok = await requestInvitation()
    if (ok) snackbarStore.success('앱 초대 코드를 발급했어요.')
  }

  /** 재발급 — 기존 유효 코드가 무효화되므로 확인을 먼저 받는다 */
  // hasLinkedChild = 이미 이 코드로 연결된 자녀가 있음. 재발급으로 다른 사람이
  // 연결하면 "같은 가족"이 아니라 "별개 가족"으로 갈라진다 — 같은 집이면 앱 가족
  // 초대를 써야 데이터가 하나로 유지되므로, 그 경우 문구를 강화한다.
  async function reissueInvitation(hasLinkedChild = false) {
    const confirmed = hasLinkedChild
      ? await modalUtils.confirm(
          '새 코드로 다른 분이 연결하면 별개 가족이 되어 서로의 기록이 보이지 않아요.',
          '추가 연결 코드 발급',
          {
            description:
              `같은 가족이면, 이미 연결한 ${josa(t('guardian'), '이/가')} 앱 [마이 › 가족 초대]로 초대해야 해요.`,
            confirmText: '그래도 발급',
            cancelText: '취소',
            type: 'warning'
          }
        )
      : await modalUtils.confirm(
          '재발급하면 기존 코드는 더 이상 사용할 수 없어요.',
          '초대 코드 재발급',
          {
            description: `${t('guardian')}에게 새 코드를 다시 안내해 주세요.`,
            confirmText: '재발급',
            cancelText: '취소',
            type: 'warning'
          }
        )
    if (!confirmed) return
    const ok = await requestInvitation()
    if (ok) snackbarStore.success('새 초대 코드를 발급했어요.')
  }

  /**
   * 본인 연결 발급 — 보호자 없는 내담자(청소년·성인 본인)에게 직접 발급.
   * 서버가 role을 both로 승격 + 발급을 한 트랜잭션으로 처리한다.
   * 만 14세 미만·생년월일 미등록은 서버가 400으로 거절 → 에러 스낵바로 노출.
   */
  async function issueSelfInvitation() {
    const confirmed = await modalUtils.confirm(
      `이 ${t('subject')} 본인에게 초대 코드를 발급합니다.`,
      '본인에게 코드 발급',
      {
        description:
          `${t('guardian')} 없이 본인이 직접 앱을 사용하는 경우예요. 발급하면 이 ${josa(t('subject'), '이/가')} 앱 연결 대상이 돼요.`,
        confirmText: '발급',
        cancelText: '취소',
        type: 'warning'
      }
    )
    if (!confirmed) return
    try {
      await postAppLinkInvitation().request({
        centerId: requireCenterId(),
        clientId,
        selfLink: true
      })
      snackbarStore.success('앱 초대 코드를 발급했어요.')
      // role 승격으로 상세가 보호자 화면으로 바뀌며 코드가 표시된다
      onSelfLinked?.()
    } catch (err) {
      showErrorSnackbar(err, '초대 코드 발급에 실패했어요.')
    }
  }

  /** 현재 유효 코드를 보호자 등록 번호로 문자 발송 (발송 자체는 서버 백그라운드) */
  async function sendCodeSms() {
    try {
      const res = await postAppLinkInvitationSms().request({
        centerId: requireCenterId(),
        clientId
      })
      snackbarStore.success(`${res.sent_to}로 초대 문자를 보냈어요.`)
    } catch (err) {
      showErrorSnackbar(err, '문자 발송에 실패했어요.')
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      snackbarStore.success('초대 코드를 복사했어요.')
    } catch {
      snackbarStore.error('복사에 실패했어요. 코드를 직접 안내해 주세요.')
    }
  }

  return {
    issueInvitation,
    reissueInvitation,
    issueSelfInvitation,
    sendCodeSms,
    copyCode
  }
}
